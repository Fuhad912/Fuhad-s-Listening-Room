(function () {
  "use strict";

  if (!window.RoomUI) {
    return;
  }

  const UI = window.RoomUI;
  const $ = (id) => document.getElementById(id);

  const els = {
    greetingTitle: $("enter-hero-heading"),
    greetingMeta: $("enter-greeting-meta"),
    heroStatus: $("enter-hero-status"),
    roomSummary: $("enter-room-summary"),
    applySuggestedBtn: $("enter-apply-suggested"),
    signatureSummary: $("enter-signature-summary"),
    signatureOpen: $("enter-signature-open"),
    lastSessionSummary: $("enter-last-session-summary"),
    lastSessionResume: $("enter-last-session-resume"),
    lastSessionOpen: $("enter-last-session-open"),
    presetStatus: $("enter-preset-status"),
    presetsWrap: $("enter-presets"),
    sessionStatus: $("enter-session-status"),
    topTrack: $("enter-top-track"),
    topArtist: $("enter-top-artist"),
    recent: $("enter-recent"),
  };

  if (!els.greetingTitle || !els.roomSummary || !els.presetsWrap) {
    return;
  }

  const STORAGE_KEYS = {
    presets: "fuhad_room_mode_presets_v1",
    activePresetId: "fuhad_room_active_preset_id_v1",
    timeRooms: "fuhad_room_time_rooms_v1",
    signaturePlaylist: "fuhad_room_signature_playlist_v1",
    lastRoomSession: "fuhad_room_last_session_v1",
  };
  const SESSION_KEYS = {
    dashboardLaunchHint: "fuhad_room_dashboard_launch_hint_v1",
  };

  const TIME_BLOCKS = [
    { id: "morning", label: "Morning" },
    { id: "afternoon", label: "Afternoon" },
    { id: "evening", label: "Evening" },
    { id: "night", label: "Night" },
  ];

  const moodLabels = {
    chill: "Chill",
    focus: "Focus",
    gym: "Gym",
    party: "Party",
    heartbreak: "Heartbreak",
    soft: "Soft",
  };

  const state = {
    user: null,
    presets: [],
    activePresetId: null,
    timeRooms: {
      mapping: {},
      autoApply: false,
    },
    signaturePlaylist: null,
    lastRoomSession: null,
    suggestedPreset: null,
    suggestedBlockId: "night",
    quickSnapshot: {
      topTracks: [],
      topArtists: [],
      recentItems: [],
    },
  };

  function canUseStorage() {
    try {
      const key = "__room_enter_test__";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function readStorageJson(key) {
    if (!canUseStorage()) return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function writeStorageValue(key, value) {
    if (!canUseStorage()) return;
    try {
      if (value === null || value === undefined || value === "") {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, String(value));
      }
    } catch (_error) {
      // ignore
    }
  }

  function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function canUseSessionStorage() {
    try {
      const key = "__room_enter_session_test__";
      window.sessionStorage.setItem(key, "1");
      window.sessionStorage.removeItem(key);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function writeSessionJson(key, value) {
    if (!canUseSessionStorage()) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // ignore
    }
  }

  function shortRangeLabel(range) {
    if (range === "short_term") return "4 weeks";
    if (range === "medium_term") return "6 months";
    return "All time";
  }

  function getTimeBlockId(date) {
    const d = date instanceof Date ? date : new Date();
    const hour = d.getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 22) return "evening";
    return "night";
  }

  function timeBlockLabel(blockId) {
    const item = TIME_BLOCKS.find((block) => block.id === blockId);
    return item ? item.label : "Now";
  }

  function formatPresetMeta(preset) {
    return `${moodLabels[preset.mood] || preset.mood} • ${shortRangeLabel(preset.timeRange)} • ${
      preset.useTopSeeds ? "Top seeds" : "Recent-first seeds"
    }`;
  }

  function normalizePreset(preset) {
    if (!preset || typeof preset !== "object") return null;
    const mood = String(preset.mood || "");
    const timeRange = String(preset.timeRange || "");
    const name = String(preset.name || "").trim().slice(0, 40);
    if (!name) return null;
    if (!["short_term", "medium_term", "long_term"].includes(timeRange)) return null;
    if (!moodLabels[mood]) return null;
    return {
      id: String(preset.id || "").trim(),
      name,
      mood,
      timeRange,
      useTopSeeds: Boolean(preset.useTopSeeds),
    };
  }

  function normalizeSignatureRecord(record) {
    if (!record || typeof record !== "object") return null;
    const id = String(record.id || "").trim();
    if (!id) return null;
    return {
      id,
      name: String(record.name || "Fuhad's Signature Playlist").trim() || "Fuhad's Signature Playlist",
      url: String(record.url || "").trim(),
      lastRefreshedAt: Number(record.lastRefreshedAt) || 0,
      lastPresetName: String(record.lastPresetName || "").trim(),
      lastMood: String(record.lastMood || "").trim(),
      lastTimeRange: String(record.lastTimeRange || "").trim(),
      lastTrackCount: Number(record.lastTrackCount) || 0,
    };
  }

  function normalizeLastRoomSession(record) {
    if (!record || typeof record !== "object") return null;
    const mood = String(record.mood || "").trim();
    const timeRange = String(record.timeRange || "").trim();
    if (!moodLabels[mood]) return null;
    if (!["short_term", "medium_term", "long_term"].includes(timeRange)) return null;

    return {
      source: String(record.source || "mood_generator").trim() || "mood_generator",
      savedAt: Number(record.savedAt) || 0,
      mood,
      timeRange,
      useTopSeeds: Boolean(record.useTopSeeds),
      activePresetId: String(record.activePresetId || "").trim(),
      activePresetName: String(record.activePresetName || "").trim(),
      playlistId: String(record.playlistId || "").trim(),
      playlistName: String(record.playlistName || "Listening Room Playlist").trim() || "Listening Room Playlist",
      playlistUrl: String(record.playlistUrl || "").trim(),
      trackCount: Number(record.trackCount) || 0,
    };
  }

  function findPresetById(id) {
    return state.presets.find((preset) => preset.id === id) || null;
  }

  function sanitizeTimeRoomMapping() {
    const valid = new Set(state.presets.map((preset) => preset.id));
    const mapping = Object.assign({}, state.timeRooms.mapping || {});
    let changed = false;
    Object.keys(mapping).forEach((blockId) => {
      if (!valid.has(mapping[blockId])) {
        delete mapping[blockId];
        changed = true;
      }
    });
    if (changed) {
      state.timeRooms.mapping = mapping;
      try {
        const existing = readStorageJson(STORAGE_KEYS.timeRooms) || {};
        existing.mapping = mapping;
        if (canUseStorage()) {
          window.localStorage.setItem(STORAGE_KEYS.timeRooms, JSON.stringify(existing));
        }
      } catch (_error) {
        // ignore storage failures
      }
    }
  }

  function heuristicPresetForTimeBlock(blockId) {
    const presets = state.presets;
    if (!presets.length) return null;

    const moodPriority = {
      morning: ["focus", "soft", "chill"],
      afternoon: ["focus", "chill", "gym"],
      evening: ["party", "gym", "chill"],
      night: ["soft", "chill", "focus", "heartbreak"],
    }[blockId] || ["chill", "focus", "soft"];

    const nameHints = {
      morning: ["morning", "am"],
      afternoon: ["afternoon", "day"],
      evening: ["evening", "sunset"],
      night: ["night", "late", "midnight"],
    }[blockId] || [];

    const byName = presets.find((preset) =>
      nameHints.some((hint) => preset.name.toLowerCase().includes(hint))
    );
    if (byName) return byName;

    for (const mood of moodPriority) {
      const match = presets.find((preset) => preset.mood === mood);
      if (match) return match;
    }
    return presets[0] || null;
  }

  function computeSuggestedRoom() {
    const blockId = getTimeBlockId(new Date());
    const mappedPreset = findPresetById(state.timeRooms.mapping[blockId]);
    state.suggestedBlockId = blockId;
    state.suggestedPreset = mappedPreset || heuristicPresetForTimeBlock(blockId);
  }

  function primeDashboardLaunchHint(selectedPresetId, options) {
    const opts = options || {};
    const rawResume = opts.resumeSettings && typeof opts.resumeSettings === "object" ? opts.resumeSettings : null;
    const resumeSettings =
      rawResume &&
      moodLabels[String(rawResume.mood || "").trim()] &&
      ["short_term", "medium_term", "long_term"].includes(String(rawResume.timeRange || "").trim())
        ? {
            mood: String(rawResume.mood).trim(),
            timeRange: String(rawResume.timeRange).trim(),
            useTopSeeds: Boolean(rawResume.useTopSeeds),
            activePresetId: String(rawResume.activePresetId || "").trim(),
          }
        : null;

    const hint = {
      source: "enter-room",
      createdAt: Date.now(),
      selectedPresetId:
        typeof selectedPresetId === "string" && selectedPresetId
          ? selectedPresetId
          : state.activePresetId || (state.suggestedPreset && state.suggestedPreset.id) || "",
      suggestedPresetId: state.suggestedPreset && state.suggestedPreset.id ? state.suggestedPreset.id : "",
      suggestedBlockId: state.suggestedBlockId || "",
      user:
        state.user && state.user.id
          ? {
              id: state.user.id,
              display_name: state.user.display_name || "",
            }
          : null,
      snapshot: {
        topTracks: Array.isArray(state.quickSnapshot.topTracks) ? state.quickSnapshot.topTracks.slice(0, 3) : [],
        topArtists: Array.isArray(state.quickSnapshot.topArtists) ? state.quickSnapshot.topArtists.slice(0, 3) : [],
        recentItems: Array.isArray(state.quickSnapshot.recentItems) ? state.quickSnapshot.recentItems.slice(0, 3) : [],
      },
      resumeSettings,
    };
    writeSessionJson(SESSION_KEYS.dashboardLaunchHint, hint);
  }

  function setActivePresetForDashboard(presetId) {
    writeStorageValue(STORAGE_KEYS.activePresetId, presetId);
    state.activePresetId = presetId;
    primeDashboardLaunchHint(presetId);
  }

  function goToDashboard(options) {
    primeDashboardLaunchHint("", options);
    window.location.href = "/app.html";
  }

  function renderGreeting() {
    const now = new Date();
    const blockLabel = timeBlockLabel(state.suggestedBlockId);
    const timeText = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now);
    const userName =
      (state.user && (state.user.display_name || state.user.id)) ||
      "Fuhad";

    els.greetingTitle.textContent = `Good ${blockLabel.toLowerCase()}, ${userName}.`;
    els.greetingMeta.textContent = `${blockLabel} room is ready • ${timeText}`;
  }

  function renderRoomSummary() {
    const preset = state.suggestedPreset;
    const blockLabel = timeBlockLabel(state.suggestedBlockId);

    if (!preset) {
      els.roomSummary.innerHTML = `
        <div class="enter-room-summary-copy">
          <strong>${UI.escapeHtml(blockLabel)} room:</strong>
          <span>No preset available yet. Open the dashboard and save a few presets first.</span>
        </div>
      `;
      els.applySuggestedBtn.disabled = true;
      els.heroStatus.textContent = "No preset found yet. You can still go straight to the dashboard.";
      return;
    }

    const source = state.timeRooms.mapping[state.suggestedBlockId] ? "Saved mapping" : "Smart suggestion";
    els.roomSummary.innerHTML = `
      <div class="enter-room-summary-copy">
        <strong>${UI.escapeHtml(blockLabel)} room</strong>
        <div>${UI.escapeHtml(preset.name)}</div>
        <span>${UI.escapeHtml(formatPresetMeta(preset))} • ${UI.escapeHtml(source)}</span>
      </div>
    `;
    els.applySuggestedBtn.disabled = false;
    els.heroStatus.textContent = "Continue with the suggested room or choose another preset below.";
  }

  function renderSignatureSummary() {
    const sig = state.signaturePlaylist;
    if (!sig) {
      els.signatureSummary.innerHTML = `
        <div class="empty-state">
          No signature playlist linked yet. Create and manage it from the dashboard.
        </div>
      `;
      els.signatureOpen.classList.add("hidden");
      els.signatureOpen.removeAttribute("href");
      return;
    }

    const refreshed = sig.lastRefreshedAt
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(sig.lastRefreshedAt)
        )
      : "Never";

    const details = [
      sig.lastPresetName || "",
      sig.lastMood ? `Mood: ${moodLabels[sig.lastMood] || sig.lastMood}` : "",
      sig.lastTimeRange ? `Range: ${shortRangeLabel(sig.lastTimeRange)}` : "",
      sig.lastTrackCount ? `${sig.lastTrackCount} tracks` : "",
    ]
      .filter(Boolean)
      .join(" • ");

    els.signatureSummary.innerHTML = `
      <div class="enter-signature-card">
        <strong>${UI.escapeHtml(sig.name)}</strong>
        <span>Last refreshed: ${UI.escapeHtml(refreshed)}</span>
        ${details ? `<span>${UI.escapeHtml(details)}</span>` : ""}
      </div>
    `;

    if (sig.url) {
      els.signatureOpen.href = sig.url;
      els.signatureOpen.classList.remove("hidden");
    } else {
      els.signatureOpen.classList.add("hidden");
      els.signatureOpen.removeAttribute("href");
    }
  }

  function resumeSettingsFromLastSession(sessionRecord) {
    if (!sessionRecord) return null;
    return {
      mood: sessionRecord.mood,
      timeRange: sessionRecord.timeRange,
      useTopSeeds: Boolean(sessionRecord.useTopSeeds),
      activePresetId: sessionRecord.activePresetId || "",
    };
  }

  function renderLastSessionPanel() {
    if (!els.lastSessionSummary || !els.lastSessionResume || !els.lastSessionOpen) return;

    const sessionRecord = state.lastRoomSession;
    if (!sessionRecord) {
      els.lastSessionSummary.innerHTML = `
        <div class="empty-state">
          No room session saved yet. Generate a mood playlist in the dashboard and it will appear here.
        </div>
      `;
      els.lastSessionResume.disabled = true;
      els.lastSessionOpen.classList.add("hidden");
      els.lastSessionOpen.removeAttribute("href");
      return;
    }

    const savedText = sessionRecord.savedAt
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(sessionRecord.savedAt)
        )
      : "Unknown time";

    const details = [
      sessionRecord.activePresetName || "",
      `Mood: ${moodLabels[sessionRecord.mood] || sessionRecord.mood}`,
      `Range: ${shortRangeLabel(sessionRecord.timeRange)}`,
      sessionRecord.useTopSeeds ? "Top seeds" : "Recent-first seeds",
      sessionRecord.trackCount ? `${sessionRecord.trackCount} tracks` : "",
    ]
      .filter(Boolean)
      .join(" â€¢ ");

    els.lastSessionSummary.innerHTML = `
      <div class="enter-last-session-card">
        <strong>${UI.escapeHtml(sessionRecord.playlistName)}</strong>
        <span>Generated: ${UI.escapeHtml(savedText)}</span>
        ${details ? `<span>${UI.escapeHtml(details)}</span>` : ""}
      </div>
    `;
    els.lastSessionResume.disabled = false;

    if (sessionRecord.playlistUrl) {
      els.lastSessionOpen.href = sessionRecord.playlistUrl;
      els.lastSessionOpen.classList.remove("hidden");
    } else {
      els.lastSessionOpen.classList.add("hidden");
      els.lastSessionOpen.removeAttribute("href");
    }
  }

  function renderPresetLauncher() {
    if (!state.presets.length) {
      els.presetsWrap.innerHTML = '<div class="empty-state">No presets yet. Save presets in the dashboard first.</div>';
      els.presetStatus.textContent = "No saved presets found.";
      return;
    }

    els.presetsWrap.innerHTML = state.presets
      .map((preset) => {
        const isActive = preset.id === state.activePresetId;
        const isSuggested = state.suggestedPreset && preset.id === state.suggestedPreset.id;
        return `
          <button class="enter-preset-launch${isActive ? " is-active" : ""}" type="button" data-enter-preset-id="${UI.escapeHtml(preset.id)}">
            <div class="enter-preset-launch-top">
              <span class="enter-preset-launch-name">${UI.escapeHtml(preset.name)}</span>
              ${isSuggested ? '<span class="enter-pill">Suggested</span>' : isActive ? '<span class="enter-pill">Active</span>' : ""}
            </div>
            <div class="enter-preset-launch-meta">${UI.escapeHtml(formatPresetMeta(preset))}</div>
          </button>
        `;
      })
      .join("");

    const active = findPresetById(state.activePresetId);
    els.presetStatus.textContent = active
      ? `Active preset for dashboard: ${active.name}`
      : "Choose a preset to launch the dashboard with.";
  }

  function loadLocalRoomState() {
    const presetsRaw = readStorageJson(STORAGE_KEYS.presets);
    state.presets = Array.isArray(presetsRaw) ? presetsRaw.map(normalizePreset).filter(Boolean).slice(0, 12) : [];

    const activePresetId = canUseStorage() ? firstValue(window.localStorage.getItem(STORAGE_KEYS.activePresetId)) : null;
    state.activePresetId = typeof activePresetId === "string" ? activePresetId : null;

    const timeRoomsRaw = readStorageJson(STORAGE_KEYS.timeRooms);
    state.timeRooms = {
      mapping:
        timeRoomsRaw && typeof timeRoomsRaw.mapping === "object" && timeRoomsRaw.mapping
          ? Object.assign({}, timeRoomsRaw.mapping)
          : {},
      autoApply: Boolean(timeRoomsRaw && timeRoomsRaw.autoApply),
    };
    sanitizeTimeRoomMapping();

    state.signaturePlaylist = normalizeSignatureRecord(readStorageJson(STORAGE_KEYS.signaturePlaylist));
    state.lastRoomSession = normalizeLastRoomSession(readStorageJson(STORAGE_KEYS.lastRoomSession));
    computeSuggestedRoom();
  }

  async function apiSpotify(path, query) {
    const params = new URLSearchParams();
    params.set("path", path);
    if (query && typeof query === "object") {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        params.set(key, String(value));
      });
    }

    const response = await fetch(`/api/spotify?${params.toString()}`);
    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }
    if (!response.ok) {
      const error = new Error(
        payload && payload.error && payload.error.message
          ? payload.error.message
          : `Spotify request failed (${response.status})`
      );
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function redirectToIndexWithError(message) {
    const url = new URL("/index.html", window.location.origin);
    url.searchParams.set("error", message || "Please log in");
    window.location.replace(url.toString());
  }

  async function verifyAuthAndLoadUser() {
    try {
      state.user = await apiSpotify("/me");
      primeDashboardLaunchHint();
    } catch (error) {
      if (error && error.status === 401) {
        redirectToIndexWithError("Please log in");
        return;
      }
      throw error;
    }
  }

  async function loadQuickSnapshot() {
    UI.renderTrackSkeletons(els.topTrack, 1);
    UI.renderArtistSkeletons(els.topArtist, 1);
    UI.renderRecentSkeletons(els.recent, 1);

    try {
      const [topTracks, topArtists, recent] = await Promise.all([
        apiSpotify("/me/top/tracks", { time_range: "short_term", limit: 1 }),
        apiSpotify("/me/top/artists", { time_range: "short_term", limit: 1 }),
        apiSpotify("/me/player/recently-played", { limit: 1 }),
      ]);

      state.quickSnapshot = {
        topTracks: topTracks && Array.isArray(topTracks.items) ? topTracks.items : [],
        topArtists: topArtists && Array.isArray(topArtists.items) ? topArtists.items : [],
        recentItems: recent && Array.isArray(recent.items) ? recent.items : [],
      };
      primeDashboardLaunchHint();

      UI.renderTracks(els.topTrack, state.quickSnapshot.topTracks, {
        emptyMessage: "No top track found yet.",
      });
      UI.renderArtists(els.topArtist, state.quickSnapshot.topArtists, {
        emptyMessage: "No top artist found yet.",
      });
      UI.renderRecentlyPlayed(els.recent, state.quickSnapshot.recentItems, {
        emptyMessage: "No recent playback found.",
      });

      els.sessionStatus.textContent = "Snapshot loaded from your Spotify profile.";
    } catch (error) {
      const message = error && error.message ? error.message : "Could not load your room snapshot.";
      els.sessionStatus.textContent = "Snapshot unavailable right now.";
      UI.renderInlineError(els.topTrack, message);
      UI.renderInlineError(els.topArtist, "Try opening the full dashboard.");
      UI.renderInlineError(els.recent, "Try opening the full dashboard.");
      UI.showToast("error", message);
    }
  }

  function onApplySuggested() {
    if (!state.suggestedPreset) {
      goToDashboard();
      return;
    }
    setActivePresetForDashboard(state.suggestedPreset.id);
    UI.showToast("success", `Entering with ${state.suggestedPreset.name}`);
    window.setTimeout(goToDashboard, 120);
  }

  function onPresetLaunchClick(event) {
    const button = event.target.closest("[data-enter-preset-id]");
    if (!button) return;
    const presetId = button.getAttribute("data-enter-preset-id");
    const preset = findPresetById(presetId);
    if (!preset) return;
    setActivePresetForDashboard(preset.id);
    state.activePresetId = preset.id;
    renderPresetLauncher();
    UI.showToast("success", `Opening dashboard with ${preset.name}`);
    window.setTimeout(goToDashboard, 120);
  }

  function onResumeLastSession() {
    const sessionRecord = state.lastRoomSession;
    if (!sessionRecord) {
      UI.showToast("error", "No saved room session found yet.");
      return;
    }

    if (sessionRecord.activePresetId) {
      setActivePresetForDashboard(sessionRecord.activePresetId);
    } else {
      primeDashboardLaunchHint("", { resumeSettings: resumeSettingsFromLastSession(sessionRecord) });
    }

    UI.showToast("success", "Resuming your last room session");
    window.setTimeout(function () {
      goToDashboard({ resumeSettings: resumeSettingsFromLastSession(sessionRecord) });
    }, 120);
  }

  function bindEvents() {
    els.applySuggestedBtn.addEventListener("click", onApplySuggested);
    els.presetsWrap.addEventListener("click", onPresetLaunchClick);
    if (els.lastSessionResume) {
      els.lastSessionResume.addEventListener("click", onResumeLastSession);
    }
  }

  function renderLobbyShell() {
    loadLocalRoomState();
    computeSuggestedRoom();
    renderRoomSummary();
    renderSignatureSummary();
    renderLastSessionPanel();
    renderPresetLauncher();
  }

  async function init() {
    bindEvents();
    renderLobbyShell();
    await verifyAuthAndLoadUser();
    renderGreeting();
    await loadQuickSnapshot();
  }

  init().catch((error) => {
    const message = error && error.message ? error.message : "Could not open the room lobby.";
    els.greetingMeta.textContent = message;
    UI.showToast("error", message);
  });
})();
