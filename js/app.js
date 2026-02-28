(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  const els = {
    status: $("dashboard-status"),
    summaryNote: $("analytics-summary-note"),
    reloadBtn: $("analytics-reload"),
    tabs: $$("[data-time-range]"),
    metricTopTracks: $("metric-top-tracks"),
    metricTopArtists: $("metric-top-artists"),
    metricRecentPlays: $("metric-recent-plays"),
    metricAvgPopularity: $("metric-avg-popularity"),
    chartTopTracks: $("chart-top-tracks"),
    chartTopArtists: $("chart-top-artists"),
    chartGenres: $("chart-genres"),
    chartRecentHours: $("chart-recent-hours"),
    topTracksList: $("top-tracks-list"),
    topArtistsList: $("top-artists-list"),
  };

  if (!els.status || !els.chartTopTracks) {
    return;
  }

  const state = {
    timeRange: "short_term",
    topTracks: [],
    topArtists: [],
    recentItems: [],
    charts: {
      topTracks: null,
      topArtists: null,
      genres: null,
      recentHours: null,
    },
    loading: false,
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(message) {
    els.status.textContent = String(message || "");
  }

  function setSummaryNote(message) {
    if (els.summaryNote) {
      els.summaryNote.textContent = String(message || "");
    }
  }

  function setLoading(loading) {
    state.loading = Boolean(loading);
    if (els.reloadBtn) {
      els.reloadBtn.disabled = state.loading;
    }
    els.tabs.forEach((tab) => {
      tab.disabled = state.loading;
    });
  }

  function redirectToLogin(message) {
    const url = new URL("/index.html", window.location.origin);
    url.searchParams.set("error", message || "Please log in");
    window.location.replace(url.toString());
  }

  function labelForRange(range) {
    if (range === "short_term") return "last 4 weeks";
    if (range === "medium_term") return "last 6 months";
    return "all time";
  }

  function truncate(text, max) {
    const value = String(text || "");
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1)).trim()}...`;
  }

  function artistNames(artists) {
    if (!Array.isArray(artists)) return "";
    return artists
      .map((item) => (item && item.name ? item.name : ""))
      .filter(Boolean)
      .join(", ");
  }

  async function apiSpotify(path, options) {
    const opts = options || {};
    const method = (opts.method || "GET").toUpperCase();
    const params = new URLSearchParams();
    params.set("path", path);

    if (opts.query && typeof opts.query === "object") {
      Object.entries(opts.query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        params.set(key, String(value));
      });
    }

    const requestOptions = { method, headers: {} };
    if (method !== "GET" && method !== "HEAD" && opts.body !== undefined) {
      requestOptions.headers["Content-Type"] = "application/json";
      requestOptions.body = JSON.stringify(opts.body);
    }

    const response = await fetch(`/api/spotify?${params.toString()}`, requestOptions);
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
      throw error;
    }

    return payload;
  }

  async function ensureChartJsLoaded() {
    if (typeof window.Chart === "function") return true;

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
      script.async = true;
      script.onload = function () {
        resolve(typeof window.Chart === "function");
      };
      script.onerror = function () {
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  function destroyChart(name) {
    const chart = state.charts[name];
    if (chart && typeof chart.destroy === "function") {
      chart.destroy();
    }
    state.charts[name] = null;
  }

  function renderOrReplaceChart(name, canvas, config) {
    if (!canvas || typeof window.Chart !== "function") return;
    destroyChart(name);
    state.charts[name] = new window.Chart(canvas, config);
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function chartBaseOptions(extra) {
    const text = cssVar("--text", "#0b1c2d");
    const text2 = cssVar("--text-2", "#2e4053");
    return Object.assign(
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: text,
              boxWidth: 12,
            },
          },
          tooltip: {
            backgroundColor: "rgba(8,18,31,0.96)",
            titleColor: "#ffffff",
            bodyColor: "#ffffff",
            borderColor: "rgba(255,255,255,0.25)",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: { color: text2 },
            grid: { color: "rgba(11,28,45,0.08)" },
          },
          y: {
            ticks: { color: text2 },
            grid: { color: "rgba(11,28,45,0.08)" },
          },
        },
      },
      extra || {}
    );
  }

  function withFallback(labels, values, fallbackLabel) {
    if (Array.isArray(labels) && labels.length && Array.isArray(values) && values.length) {
      return { labels, values };
    }
    return { labels: [fallbackLabel], values: [0] };
  }

  function buildTrackSeries() {
    const top = state.topTracks.slice(0, 10);
    return withFallback(
      top.map((track) => {
        const name = truncate(track && track.name ? track.name : "Unknown", 24);
        const artists = truncate(artistNames(track && track.artists), 18);
        return artists ? `${name} - ${artists}` : name;
      }),
      top.map((track) => Number(track && track.popularity) || 0),
      "No track data"
    );
  }

  function buildArtistSeries() {
    const top = state.topArtists.slice(0, 10);
    return withFallback(
      top.map((artist) => truncate(artist && artist.name ? artist.name : "Unknown", 22)),
      top.map((artist) => Number(artist && artist.popularity) || 0),
      "No artist data"
    );
  }

  function buildGenreSeries() {
    const counts = new Map();
    state.topArtists.forEach((artist) => {
      const genres = Array.isArray(artist && artist.genres) ? artist.genres : [];
      genres.forEach((genre) => {
        const key = String(genre || "").trim();
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    const entries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return withFallback(
      entries.map(([label]) => truncate(label, 20)),
      entries.map(([, value]) => value),
      "No genre data"
    );
  }

  function buildRecentHourSeries() {
    const buckets = Array.from({ length: 24 }, () => 0);
    state.recentItems.forEach((item) => {
      const playedAt = item && item.played_at ? new Date(item.played_at) : null;
      if (!playedAt || Number.isNaN(playedAt.getTime())) return;
      buckets[playedAt.getHours()] += 1;
    });
    return {
      labels: buckets.map((_, hour) => `${String(hour).padStart(2, "0")}:00`),
      values: buckets,
    };
  }

  function renderMetrics() {
    const trackCount = state.topTracks.length;
    const artistCount = state.topArtists.length;
    const recentCount = state.recentItems.length;
    const avgPopularity = trackCount
      ? Math.round(
          state.topTracks.reduce((sum, track) => sum + (Number(track && track.popularity) || 0), 0) / trackCount
        )
      : 0;

    if (els.metricTopTracks) els.metricTopTracks.textContent = String(trackCount);
    if (els.metricTopArtists) els.metricTopArtists.textContent = String(artistCount);
    if (els.metricRecentPlays) els.metricRecentPlays.textContent = String(recentCount);
    if (els.metricAvgPopularity) els.metricAvgPopularity.textContent = `${avgPopularity}/100`;

    const topTrack = state.topTracks[0] && state.topTracks[0].name ? state.topTracks[0].name : "No top tracks yet";
    const topArtist =
      state.topArtists[0] && state.topArtists[0].name ? state.topArtists[0].name : "No top artists yet";
    setSummaryNote(`Top track: ${topTrack} | Top artist: ${topArtist}`);
  }

  function renderLists() {
    if (els.topTracksList) {
      if (!state.topTracks.length) {
        els.topTracksList.innerHTML =
          '<li class="analytics-list-empty">No top tracks available for this time range.</li>';
      } else {
        els.topTracksList.innerHTML = state.topTracks
          .slice(0, 10)
          .map((track, index) => {
            const trackName = escapeHtml(track && track.name ? track.name : "Unknown track");
            const artists = escapeHtml(artistNames(track && track.artists) || "Unknown artist");
            const popularity = Number(track && track.popularity) || 0;
            return `<li><span>${index + 1}. ${trackName} <small>${artists}</small></span><strong>${popularity}</strong></li>`;
          })
          .join("");
      }
    }

    if (els.topArtistsList) {
      if (!state.topArtists.length) {
        els.topArtistsList.innerHTML =
          '<li class="analytics-list-empty">No top artists available for this time range.</li>';
      } else {
        els.topArtistsList.innerHTML = state.topArtists
          .slice(0, 10)
          .map((artist, index) => {
            const artistName = escapeHtml(artist && artist.name ? artist.name : "Unknown artist");
            const popularity = Number(artist && artist.popularity) || 0;
            return `<li><span>${index + 1}. ${artistName}</span><strong>${popularity}</strong></li>`;
          })
          .join("");
      }
    }
  }

  function renderCharts() {
    const tracks = buildTrackSeries();
    const artists = buildArtistSeries();
    const genres = buildGenreSeries();
    const hours = buildRecentHourSeries();

    renderOrReplaceChart("topTracks", els.chartTopTracks, {
      type: "bar",
      data: {
        labels: tracks.labels,
        datasets: [
          {
            label: "Popularity",
            data: tracks.values,
            backgroundColor: "rgba(76,47,116,0.72)",
            borderColor: "rgba(76,47,116,1)",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: chartBaseOptions({
        indexAxis: "y",
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: { color: cssVar("--text-2", "#2e4053") },
            grid: { color: "rgba(11,28,45,0.08)" },
          },
          y: {
            ticks: { color: cssVar("--text-2", "#2e4053") },
            grid: { display: false },
          },
        },
      }),
    });

    renderOrReplaceChart("topArtists", els.chartTopArtists, {
      type: "bar",
      data: {
        labels: artists.labels,
        datasets: [
          {
            label: "Popularity",
            data: artists.values,
            backgroundColor: "rgba(127,88,178,0.72)",
            borderColor: "rgba(127,88,178,1)",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: chartBaseOptions({
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: cssVar("--text-2", "#2e4053") }, grid: { display: false } },
          y: { min: 0, max: 100, ticks: { color: cssVar("--text-2", "#2e4053") }, grid: { color: "rgba(11,28,45,0.08)" } },
        },
      }),
    });

    renderOrReplaceChart("genres", els.chartGenres, {
      type: "doughnut",
      data: {
        labels: genres.labels,
        datasets: [
          {
            data: genres.values,
            backgroundColor: [
              "rgba(76,47,116,0.88)",
              "rgba(127,88,178,0.88)",
              "rgba(98,65,141,0.88)",
              "rgba(143,109,191,0.88)",
              "rgba(67,42,102,0.88)",
              "rgba(111,78,160,0.88)",
              "rgba(85,54,129,0.88)",
              "rgba(154,123,199,0.88)",
            ],
            borderColor: "rgba(246,241,255,0.92)",
            borderWidth: 1,
          },
        ],
      },
      options: chartBaseOptions({
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: cssVar("--text-2", "#2e4053") },
          },
        },
        scales: {},
      }),
    });

    renderOrReplaceChart("recentHours", els.chartRecentHours, {
      type: "line",
      data: {
        labels: hours.labels,
        datasets: [
          {
            label: "Plays",
            data: hours.values,
            borderColor: "rgba(76,47,116,1)",
            backgroundColor: "rgba(76,47,116,0.18)",
            fill: true,
            tension: 0.35,
            pointRadius: 2,
            pointHoverRadius: 3,
          },
        ],
      },
      options: chartBaseOptions({ plugins: { legend: { display: false } } }),
    });
  }

  async function ensureAuthenticatedUser() {
    try {
      await apiSpotify("/me");
      return true;
    } catch (error) {
      if (error && error.status === 401) {
        redirectToLogin("Please log in");
        return false;
      }
      throw error;
    }
  }

  async function loadAnalyticsData() {
    setLoading(true);
    setStatus(`Loading analytics for ${labelForRange(state.timeRange)}...`);

    try {
      const authenticated = await ensureAuthenticatedUser();
      if (!authenticated) return;

      const [tracksRes, artistsRes, recentRes] = await Promise.allSettled([
        apiSpotify("/me/top/tracks", { query: { time_range: state.timeRange, limit: 20 } }),
        apiSpotify("/me/top/artists", { query: { time_range: state.timeRange, limit: 20 } }),
        apiSpotify("/me/player/recently-played", { query: { limit: 50 } }),
      ]);

      state.topTracks =
        tracksRes.status === "fulfilled" && Array.isArray(tracksRes.value && tracksRes.value.items)
          ? tracksRes.value.items
          : [];
      state.topArtists =
        artistsRes.status === "fulfilled" && Array.isArray(artistsRes.value && artistsRes.value.items)
          ? artistsRes.value.items
          : [];
      state.recentItems =
        recentRes.status === "fulfilled" && Array.isArray(recentRes.value && recentRes.value.items)
          ? recentRes.value.items
          : [];

      const failed = [];
      if (tracksRes.status === "rejected") failed.push("tracks");
      if (artistsRes.status === "rejected") failed.push("artists");
      if (recentRes.status === "rejected") failed.push("recent plays");

      renderMetrics();
      renderLists();

      const chartReady = await ensureChartJsLoaded();
      if (chartReady) {
        renderCharts();
      } else {
        setSummaryNote("Chart library failed to load. Reload this page.");
      }

      if (!state.topTracks.length && !state.topArtists.length && !state.recentItems.length) {
        setSummaryNote("No Spotify listening data was returned for this profile yet.");
      }

      if (failed.length) {
        setStatus(`Analytics loaded with partial data (missing: ${failed.join(", ")}).`);
      } else {
        setStatus(`Analytics ready for ${labelForRange(state.timeRange)}.`);
      }
    } catch (error) {
      const message = error && error.message ? error.message : "Could not load analytics.";
      setStatus(message);
      setSummaryNote("Failed to load Spotify analytics. Try reload or log in again.");
    } finally {
      setLoading(false);
    }
  }

  function setRange(range) {
    if (!["short_term", "medium_term", "long_term"].includes(range)) return;
    if (range === state.timeRange) return;

    state.timeRange = range;
    els.tabs.forEach((tab) => {
      const active = tab.dataset.range === range;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    loadAnalyticsData();
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        setRange(tab.dataset.range);
      });
    });

    if (els.reloadBtn) {
      els.reloadBtn.addEventListener("click", function () {
        loadAnalyticsData();
      });
    }
  }

  bindEvents();
  loadAnalyticsData();
})();
