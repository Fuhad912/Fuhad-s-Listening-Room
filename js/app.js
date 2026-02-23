(function () {
  "use strict";

  if (!window.RoomUI) {
    return;
  }

  const UI = window.RoomUI;
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const $ = (id) => document.getElementById(id);

  const els = {
    status: $("dashboard-status"),
    tabs: $$(".tab"),
    topTracks: $("top-tracks"),
    topArtists: $("top-artists"),
    recent: $("recently-played"),
    moodButtonsWrap: $("mood-buttons"),
    useTopSeeds: $("use-top-seeds"),
    generateBtn: $("generate-playlist"),
    retryGenerateBtn: $("retry-generate"),
    moodStatus: $("mood-generator-status"),
    moodResult: $("mood-result"),
  };

  if (!els.status || !els.topTracks) {
    return;
  }

  const state = {
    user: null,
    timeRange: "short_term",
    topTracks: [],
    topArtists: [],
    recentItems: [],
    selectedMood: "chill",
    loading: {
      topTracks: false,
      topArtists: false,
      recent: false,
      generator: false,
    },
  };

  const moodConfigs = {
    chill: {
      label: "Chill",
      recommendations: { target_energy: 0.35, target_valence: 0.55, target_acousticness: 0.45 },
    },
    focus: {
      label: "Focus",
      recommendations: { target_energy: 0.45, target_valence: 0.45, target_instrumentalness: 0.35 },
    },
    gym: {
      label: "Gym",
      recommendations: { target_energy: 0.88, target_danceability: 0.75, target_valence: 0.65 },
    },
    party: {
      label: "Party",
      recommendations: { target_energy: 0.82, target_danceability: 0.85, target_valence: 0.8 },
    },
    heartbreak: {
      label: "Heartbreak",
      recommendations: { target_energy: 0.28, target_valence: 0.18, target_acousticness: 0.4 },
    },
    soft: {
      label: "Soft",
      recommendations: { target_energy: 0.3, target_valence: 0.5, target_acousticness: 0.55 },
    },
  };

  function setStatus(message) {
    els.status.textContent = message;
  }

  async function apiSpotify(path, options) {
    const opts = options || {};
    const method = (opts.method || "GET").toUpperCase();
    const params = new URLSearchParams();
    params.set("path", path);

    if (opts.query && typeof opts.query === "object") {
      Object.entries(opts.query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        if (Array.isArray(value)) {
          value.forEach((item) => params.append(key, String(item)));
        } else {
          params.set(key, String(value));
        }
      });
    }

    const init = { method, headers: {} };
    if (method !== "GET" && method !== "HEAD" && opts.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }

    const response = await fetch(`/api/spotify?${params.toString()}`, init);
    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload && payload.error && payload.error.message
          ? payload.error.message
          : `Spotify request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function redirectToLogin(message) {
    const url = new URL("/index.html", window.location.origin);
    url.searchParams.set("error", message || "Please log in");
    window.location.replace(url.toString());
  }

  function setTabSelection(range) {
    state.timeRange = range;
    els.tabs.forEach((tab) => {
      const active = tab.dataset.range === range;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function getSeedTrackIds() {
    const preferTop = els.useTopSeeds.checked;
    const topTrackIds = (state.topTracks || []).map((t) => t && t.id).filter(Boolean);
    const recentTrackIds = (state.recentItems || [])
      .map((item) => item && item.track && item.track.id)
      .filter(Boolean);

    const source = preferTop ? topTrackIds.concat(recentTrackIds) : recentTrackIds.concat(topTrackIds);
    const unique = [];
    const seen = new Set();
    for (const id of source) {
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
      if (unique.length >= 5) break;
    }
    return unique;
  }

  function setSectionLoading(sectionKey, on) {
    state.loading[sectionKey] = on;
    const map = {
      topTracks: els.topTracks,
      topArtists: els.topArtists,
      recent: els.recent,
      generator: els.moodResult,
    };
    UI.setLoading(map[sectionKey], on);
  }

  function showSectionError(target, message, retryKey) {
    UI.renderInlineError(target, message, retryKey);
    UI.showToast("error", message);
  }

  async function ensureAuthenticatedUser() {
    try {
      const me = await apiSpotify("/me");
      state.user = me;
      return me;
    } catch (error) {
      if (error.status === 401) {
        redirectToLogin("Please log in");
        return null;
      }
      throw error;
    }
  }

  async function loadTopTracks() {
    setSectionLoading("topTracks", true);
    UI.renderTrackSkeletons(els.topTracks, 6);
    try {
      const data = await apiSpotify("/me/top/tracks", {
        query: { time_range: state.timeRange, limit: 12 },
      });
      state.topTracks = Array.isArray(data && data.items) ? data.items : [];
      UI.renderTracks(els.topTracks, state.topTracks, {
        showRank: true,
        emptyMessage: "No top tracks available for this time range.",
      });
    } catch (error) {
      showSectionError(els.topTracks, error.message || "Could not load top tracks.", "tracks");
    } finally {
      setSectionLoading("topTracks", false);
    }
  }

  async function loadTopArtists() {
    setSectionLoading("topArtists", true);
    UI.renderArtistSkeletons(els.topArtists, 6);
    try {
      const data = await apiSpotify("/me/top/artists", {
        query: { time_range: state.timeRange, limit: 8 },
      });
      state.topArtists = Array.isArray(data && data.items) ? data.items : [];
      UI.renderArtists(els.topArtists, state.topArtists, {
        showRank: true,
        emptyMessage: "No top artists available for this time range.",
      });
    } catch (error) {
      showSectionError(els.topArtists, error.message || "Could not load top artists.", "artists");
    } finally {
      setSectionLoading("topArtists", false);
    }
  }

  async function loadRecentlyPlayed() {
    setSectionLoading("recent", true);
    UI.renderRecentSkeletons(els.recent, 8);
    try {
      const data = await apiSpotify("/me/player/recently-played", { query: { limit: 14 } });
      state.recentItems = Array.isArray(data && data.items) ? data.items : [];
      UI.renderRecentlyPlayed(els.recent, state.recentItems, {
        emptyMessage: "No recently played items returned.",
      });
    } catch (error) {
      showSectionError(els.recent, error.message || "Could not load recently played.", "recent");
    } finally {
      setSectionLoading("recent", false);
    }
  }

  async function reloadTasteSections() {
    setStatus("Refreshing your Spotify taste profile...");
    await Promise.all([loadTopTracks(), loadTopArtists()]);
    setStatus(`Showing listening data for ${labelForRange(state.timeRange)}.`);
  }

  function labelForRange(range) {
    if (range === "short_term") return "the last 4 weeks";
    if (range === "medium_term") return "the last 6 months";
    return "all time";
  }

  function buildRecommendationsQuery(seedTrackIds, moodKey) {
    const mood = moodConfigs[moodKey] || moodConfigs.chill;
    return Object.assign(
      {
        limit: 20,
        seed_tracks: seedTrackIds.join(","),
      },
      mood.recommendations
    );
  }

  async function createMoodPlaylistFromTracks(tracks, moodKey) {
    const me = state.user || (await ensureAuthenticatedUser());
    if (!me || !me.id) {
      throw new Error("Could not resolve your Spotify user profile.");
    }

    const mood = moodConfigs[moodKey] || moodConfigs.chill;
    const now = new Date();
    const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(now);

    const playlist = await apiSpotify(`/users/${encodeURIComponent(me.id)}/playlists`, {
      method: "POST",
      body: {
        name: `Listening Room - ${mood.label} (${dateLabel})`,
        description: `Generated by Fuhad's Listening Room for a ${mood.label.toLowerCase()} mood.`,
        public: false,
      },
    });

    const trackUris = (tracks || [])
      .map((track) => track && track.uri)
      .filter(Boolean);

    if (playlist && playlist.id && trackUris.length) {
      await apiSpotify(`/playlists/${encodeURIComponent(playlist.id)}/tracks`, {
        method: "POST",
        body: { uris: trackUris },
      });
    }

    return playlist;
  }

  async function generateMoodPlaylist() {
    const moodKey = state.selectedMood;
    const seedTrackIds = getSeedTrackIds();

    if (!seedTrackIds.length) {
      UI.showToast("error", "No usable seed tracks found yet. Try reloading your data.");
      UI.renderInlineError(els.moodResult, "No seed tracks available for recommendations.", "generate");
      els.retryGenerateBtn.classList.remove("hidden");
      return;
    }

    setSectionLoading("generator", true);
    els.generateBtn.disabled = true;
    els.retryGenerateBtn.classList.add("hidden");
    els.moodStatus.innerHTML =
      '<span class="loading-inline"><span class="spinner" aria-hidden="true"></span>Generating a playlist and saving it to your Spotify account...</span>';
    UI.renderTrackSkeletons(els.moodResult, 6);

    try {
      const recommendations = await apiSpotify("/recommendations", {
        query: buildRecommendationsQuery(seedTrackIds, moodKey),
      });
      const tracks = Array.isArray(recommendations && recommendations.tracks)
        ? recommendations.tracks.filter((track) => track && track.uri)
        : [];

      if (!tracks.length) {
        throw new Error("Spotify did not return any recommendations for that mood.");
      }

      const playlist = await createMoodPlaylistFromTracks(tracks, moodKey);
      UI.renderMoodResult(els.moodResult, { playlist, tracks });
      els.moodStatus.textContent = `Playlist generated for ${moodConfigs[moodKey].label}.`;
      UI.showToast("success", "Mood playlist created in your Spotify account.");
    } catch (error) {
      const message = error && error.message ? error.message : "Failed to generate mood playlist.";
      UI.showToast("error", message);
      UI.renderInlineError(els.moodResult, message, "generate");
      els.retryGenerateBtn.classList.remove("hidden");
      els.moodStatus.textContent = "Generation failed. Adjust the mood or retry.";
    } finally {
      setSectionLoading("generator", false);
      els.generateBtn.disabled = false;
    }
  }

  async function initialLoad() {
    setStatus("Checking Spotify session...");
    UI.renderTrackSkeletons(els.topTracks, 6);
    UI.renderArtistSkeletons(els.topArtists, 6);
    UI.renderRecentSkeletons(els.recent, 8);
    UI.renderEmpty(els.moodResult, "Generate a playlist to see results here.");

    await ensureAuthenticatedUser();
    setStatus("Spotify session active.");

    await Promise.all([reloadTasteSections(), loadRecentlyPlayed()]);
  }

  function onTabClick(event) {
    const button = event.target.closest(".tab");
    if (!button || button.dataset.range === state.timeRange) return;
    setTabSelection(button.dataset.range);
    reloadTasteSections().catch((error) => {
      UI.showToast("error", error && error.message ? error.message : "Unable to refresh top data.");
    });
  }

  function onRetry(event) {
    const button = event.target.closest("[data-retry]");
    if (!button) return;
    const key = button.getAttribute("data-retry");
    if (key === "tracks") {
      loadTopTracks();
      return;
    }
    if (key === "artists") {
      loadTopArtists();
      return;
    }
    if (key === "recent") {
      loadRecentlyPlayed();
      return;
    }
    if (key === "generate") {
      generateMoodPlaylist();
    }
  }

  function onMoodButtonClick(event) {
    const button = event.target.closest("[data-mood]");
    if (!button) return;
    const mood = button.getAttribute("data-mood");
    if (!moodConfigs[mood]) return;
    state.selectedMood = mood;
    $$(".chip-btn", els.moodButtonsWrap).forEach((chip) => {
      chip.classList.toggle("is-active", chip === button);
    });
    els.moodStatus.textContent = `Selected mood: ${moodConfigs[mood].label}.`;
  }

  function bindEvents() {
    els.tabs.forEach((tab) => tab.addEventListener("click", onTabClick));
    document.body.addEventListener("click", onRetry);
    els.moodButtonsWrap.addEventListener("click", onMoodButtonClick);
    els.generateBtn.addEventListener("click", generateMoodPlaylist);
    els.retryGenerateBtn.addEventListener("click", generateMoodPlaylist);
  }

  bindEvents();
  initialLoad().catch((error) => {
    if (error && error.status === 401) {
      redirectToLogin("Please log in");
      return;
    }
    const message = error && error.message ? error.message : "Could not start the dashboard.";
    setStatus(message);
    UI.showToast("error", message);
    UI.renderInlineError(els.topTracks, message, "tracks");
    UI.renderInlineError(els.topArtists, message, "artists");
    UI.renderInlineError(els.recent, message, "recent");
  });
})();
