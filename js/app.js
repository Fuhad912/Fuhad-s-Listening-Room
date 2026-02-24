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
    dayroomClock: $("dayroom-clock"),
    dayroomSummary: $("dayroom-summary"),
    dayroomMap: $("dayroom-map"),
    applyDayroomBtn: $("apply-dayroom"),
    assignDayroomBtn: $("assign-dayroom"),
    autoApplyDayroom: $("auto-apply-dayroom"),
    signatureStatusBadge: $("signature-status-badge"),
    signatureSummary: $("signature-summary"),
    signatureCreateBtn: $("signature-create"),
    signatureRefreshDayroomBtn: $("signature-refresh-dayroom"),
    signatureRefreshBtn: $("signature-refresh"),
    signatureOpenLink: $("signature-open"),
    signatureResetBtn: $("signature-reset"),
    signatureStatus: $("signature-status"),
    signaturePreview: $("signature-preview"),
    presetNameInput: $("preset-name"),
    savePresetBtn: $("save-preset"),
    presetList: $("preset-list"),
    presetState: $("preset-state"),
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
    presets: [],
    activePresetId: null,
    timeRooms: {
      mapping: {},
      autoApply: false,
    },
    signaturePlaylist: null,
    loading: {
      topTracks: false,
      topArtists: false,
      recent: false,
      generator: false,
      signature: false,
    },
  };

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

  const DEFAULT_PRESETS = [
    {
      id: "preset-late-night-focus",
      name: "Late Night Focus",
      mood: "focus",
      timeRange: "medium_term",
      useTopSeeds: true,
    },
    {
      id: "preset-gym-push",
      name: "Gym Push",
      mood: "gym",
      timeRange: "short_term",
      useTopSeeds: true,
    },
    {
      id: "preset-soft-sunday",
      name: "Soft Sunday",
      mood: "soft",
      timeRange: "long_term",
      useTopSeeds: false,
    },
  ];

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

  function canUseStorage() {
    try {
      const key = "__room_test__";
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
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  function writeStorageJson(key, value) {
    if (!canUseStorage()) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Ignore quota/storage errors for this personal preset feature.
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
      // Ignore quota/storage errors.
    }
  }

  function readStorageValue(key) {
    if (!canUseStorage()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function canUseSessionStorage() {
    try {
      const key = "__room_session_test__";
      window.sessionStorage.setItem(key, "1");
      window.sessionStorage.removeItem(key);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function readSessionJson(key) {
    if (!canUseSessionStorage()) return null;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  function removeSessionValue(key) {
    if (!canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(key);
    } catch (_error) {
      // Ignore storage errors.
    }
  }

  function consumeDashboardLaunchHint() {
    const raw = readSessionJson(SESSION_KEYS.dashboardLaunchHint);
    removeSessionValue(SESSION_KEYS.dashboardLaunchHint);
    if (!raw || typeof raw !== "object") return null;

    const createdAt = Number(raw.createdAt);
    if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
    if (Date.now() - createdAt > 2 * 60 * 1000) return null;

    const snapshot = raw.snapshot && typeof raw.snapshot === "object" ? raw.snapshot : {};
    const user = raw.user && typeof raw.user === "object" ? raw.user : null;
    const rawResume = raw.resumeSettings && typeof raw.resumeSettings === "object" ? raw.resumeSettings : null;
    const resumeSettings = rawResume
      ? {
          mood: typeof rawResume.mood === "string" ? rawResume.mood : "",
          timeRange: typeof rawResume.timeRange === "string" ? rawResume.timeRange : "",
          useTopSeeds: Boolean(rawResume.useTopSeeds),
          activePresetId: typeof rawResume.activePresetId === "string" ? rawResume.activePresetId : "",
        }
      : null;

    return {
      source: String(raw.source || ""),
      createdAt,
      user:
        user && typeof user.id === "string" && user.id
          ? {
              id: user.id,
              display_name: typeof user.display_name === "string" ? user.display_name : "",
            }
          : null,
      snapshot: {
        topTracks: Array.isArray(snapshot.topTracks) ? snapshot.topTracks : [],
        topArtists: Array.isArray(snapshot.topArtists) ? snapshot.topArtists : [],
        recentItems: Array.isArray(snapshot.recentItems) ? snapshot.recentItems : [],
      },
      resumeSettings,
    };
  }

  function applyDashboardLaunchHint() {
    const hint = consumeDashboardLaunchHint();
    const result = {
      any: false,
      topTracks: false,
      topArtists: false,
      recent: false,
    };
    if (!hint) return result;

    if (hint.user && hint.user.id) {
      state.user = hint.user;
    }

    if (
      hint.resumeSettings &&
      moodConfigs[hint.resumeSettings.mood] &&
      ["short_term", "medium_term", "long_term"].includes(hint.resumeSettings.timeRange)
    ) {
      if (hint.resumeSettings.activePresetId && findPresetById(hint.resumeSettings.activePresetId)) {
        state.activePresetId = hint.resumeSettings.activePresetId;
        persistPresets();
      }
      setMoodSelection(hint.resumeSettings.mood, { silentStatus: true });
      setUseTopSeeds(Boolean(hint.resumeSettings.useTopSeeds));
      setTabSelection(hint.resumeSettings.timeRange);
      els.moodStatus.textContent = "Last room session restored from the lobby.";
    }

    if (hint.snapshot.topTracks.length) {
      state.topTracks = hint.snapshot.topTracks.slice();
      UI.renderTracks(els.topTracks, state.topTracks, {
        showRank: true,
        emptyMessage: "No top tracks available for this time range.",
      });
      result.topTracks = true;
    }

    if (hint.snapshot.topArtists.length) {
      state.topArtists = hint.snapshot.topArtists.slice();
      UI.renderArtists(els.topArtists, state.topArtists, {
        showRank: true,
        emptyMessage: "No top artists available for this time range.",
      });
      result.topArtists = true;
    }

    if (hint.snapshot.recentItems.length) {
      state.recentItems = hint.snapshot.recentItems.slice();
      UI.renderRecentlyPlayed(els.recent, state.recentItems, {
        emptyMessage: "No recently played items returned.",
      });
      result.recent = true;
    }

    result.any = result.topTracks || result.topArtists || result.recent;
    return result;
  }

  function normalizePreset(preset) {
    if (!preset || typeof preset !== "object") return null;
    const mood = String(preset.mood || "");
    const timeRange = String(preset.timeRange || "");
    if (!moodConfigs[mood]) return null;
    if (!["short_term", "medium_term", "long_term"].includes(timeRange)) return null;
    const name = String(preset.name || "").trim().slice(0, 40);
    if (!name) return null;
    return {
      id: String(preset.id || `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      name,
      mood,
      timeRange,
      useTopSeeds: Boolean(preset.useTopSeeds),
      createdAt: Number(preset.createdAt) || Date.now(),
      updatedAt: Number(preset.updatedAt) || Date.now(),
    };
  }

  function seedDefaultPresets() {
    state.presets = DEFAULT_PRESETS.map((preset) =>
      normalizePreset(
        Object.assign({}, preset, {
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      )
    ).filter(Boolean);
    state.activePresetId = state.presets[0] ? state.presets[0].id : null;
    persistPresets();
  }

  function loadPresets() {
    const storedPresets = readStorageJson(STORAGE_KEYS.presets);
    const normalized = Array.isArray(storedPresets)
      ? storedPresets.map(normalizePreset).filter(Boolean).slice(0, 12)
      : [];

    if (!normalized.length) {
      seedDefaultPresets();
      return;
    }

    state.presets = normalized;
    const storedActive = readStorageValue(STORAGE_KEYS.activePresetId);
    state.activePresetId = state.presets.some((preset) => preset.id === storedActive)
      ? storedActive
      : null;
  }

  function persistPresets() {
    writeStorageJson(STORAGE_KEYS.presets, state.presets);
    writeStorageValue(STORAGE_KEYS.activePresetId, state.activePresetId);
  }

  function currentSettingsSnapshot() {
    return {
      mood: state.selectedMood,
      timeRange: state.timeRange,
      useTopSeeds: Boolean(els.useTopSeeds.checked),
    };
  }

  function presetMatchesCurrent(preset) {
    if (!preset) return false;
    const current = currentSettingsSnapshot();
    return (
      preset.mood === current.mood &&
      preset.timeRange === current.timeRange &&
      preset.useTopSeeds === current.useTopSeeds
    );
  }

  function activePreset() {
    return state.presets.find((preset) => preset.id === state.activePresetId) || null;
  }

  function shortRangeLabel(range) {
    if (range === "short_term") return "4 weeks";
    if (range === "medium_term") return "6 months";
    return "All time";
  }

  function formatPresetMeta(preset) {
    return `${moodConfigs[preset.mood].label} • ${shortRangeLabel(preset.timeRange)} • ${
      preset.useTopSeeds ? "Top seeds" : "Recent-first seeds"
    }`;
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

  function loadTimeRooms() {
    const stored = readStorageJson(STORAGE_KEYS.timeRooms);
    const base = {
      mapping: {},
      autoApply: false,
    };
    if (!stored || typeof stored !== "object") {
      state.timeRooms = base;
      return;
    }

    const mapping = {};
    const rawMapping = stored.mapping && typeof stored.mapping === "object" ? stored.mapping : {};
    TIME_BLOCKS.forEach((block) => {
      const value = rawMapping[block.id];
      if (typeof value === "string" && value.trim()) {
        mapping[block.id] = value.trim();
      }
    });

    state.timeRooms = {
      mapping,
      autoApply: Boolean(stored.autoApply),
    };
    sanitizeTimeRoomMappings();
  }

  function persistTimeRooms() {
    writeStorageJson(STORAGE_KEYS.timeRooms, state.timeRooms);
  }

  function sanitizeTimeRoomMappings() {
    const validIds = new Set(state.presets.map((preset) => preset.id));
    let changed = false;
    Object.keys(state.timeRooms.mapping || {}).forEach((blockId) => {
      if (!validIds.has(state.timeRooms.mapping[blockId])) {
        delete state.timeRooms.mapping[blockId];
        changed = true;
      }
    });
    if (changed) {
      persistTimeRooms();
    }
  }

  function findPresetById(presetId) {
    return state.presets.find((preset) => preset.id === presetId) || null;
  }

  function heuristicPresetForTimeBlock(blockId) {
    const presets = state.presets || [];
    if (!presets.length) return null;

    const nameKeyword = {
      morning: ["morning", "am"],
      afternoon: ["afternoon", "day"],
      evening: ["evening", "sunset"],
      night: ["night", "late", "midnight"],
    }[blockId] || [];

    const byName = presets.find((preset) =>
      nameKeyword.some((keyword) => preset.name.toLowerCase().includes(keyword))
    );
    if (byName) return byName;

    const moodPriority = {
      morning: ["focus", "soft", "chill"],
      afternoon: ["focus", "chill", "gym"],
      evening: ["party", "gym", "chill"],
      night: ["soft", "chill", "focus", "heartbreak"],
    }[blockId] || ["chill", "focus", "soft"];

    for (const mood of moodPriority) {
      const match = presets.find((preset) => preset.mood === mood);
      if (match) return match;
    }

    return presets[0] || null;
  }

  function getSuggestedPresetForCurrentTime() {
    const blockId = getTimeBlockId(new Date());
    const mappedId = state.timeRooms.mapping[blockId];
    const mappedPreset = mappedId ? findPresetById(mappedId) : null;
    const preset = mappedPreset || heuristicPresetForTimeBlock(blockId);
    return {
      blockId,
      blockLabel: timeBlockLabel(blockId),
      preset,
      isMapped: Boolean(mappedPreset),
    };
  }

  function renderTimeRoomPanel() {
    if (!els.dayroomSummary || !els.dayroomMap) return;

    const now = new Date();
    const timeText = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
    if (els.dayroomClock) {
      els.dayroomClock.textContent = timeText;
    }

    const suggestion = getSuggestedPresetForCurrentTime();
    const preset = suggestion.preset;

    if (preset) {
      const sourceLabel = suggestion.isMapped ? "Saved room" : "Suggested from your presets";
      els.dayroomSummary.innerHTML = `
        <strong>${UI.escapeHtml(suggestion.blockLabel)} room:</strong>
        ${UI.escapeHtml(preset.name)}
        <span>(${UI.escapeHtml(formatPresetMeta(preset))}) • ${UI.escapeHtml(sourceLabel)}</span>
      `;
      els.applyDayroomBtn.disabled = false;
    } else {
      els.dayroomSummary.innerHTML = `
        <strong>${UI.escapeHtml(suggestion.blockLabel)} room:</strong>
        <span>Save a preset first to enable time-based suggestions.</span>
      `;
      els.applyDayroomBtn.disabled = true;
    }

    const active = activePreset();
    if (els.assignDayroomBtn) {
      els.assignDayroomBtn.disabled = !active;
      els.assignDayroomBtn.textContent = active
        ? `Use "${active.name}" for ${suggestion.blockLabel}`
        : "Use Active Preset for This Time";
    }
    if (els.autoApplyDayroom) {
      els.autoApplyDayroom.checked = Boolean(state.timeRooms.autoApply);
    }

    els.dayroomMap.innerHTML = TIME_BLOCKS.map((block) => {
      const assignedId = state.timeRooms.mapping[block.id];
      const assignedPreset = assignedId ? findPresetById(assignedId) : null;
      const currentClass = block.id === suggestion.blockId ? " is-current" : "";
      return `
        <div class="dayroom-slot${currentClass}">
          <div class="dayroom-slot-label">${UI.escapeHtml(block.label)}</div>
          <div class="dayroom-slot-value">
            ${
              assignedPreset
                ? `${UI.escapeHtml(assignedPreset.name)} <span>(${UI.escapeHtml(formatPresetMeta(assignedPreset))})</span>`
                : '<span>No saved room (using smart suggestion)</span>'
            }
          </div>
        </div>
      `;
    }).join("");
  }

  function normalizeSignaturePlaylistRecord(record) {
    if (!record || typeof record !== "object") return null;
    const id = String(record.id || "").trim();
    if (!id) return null;
    const normalized = {
      id,
      name: String(record.name || "Fuhad's Signature Playlist").trim() || "Fuhad's Signature Playlist",
      url: String(record.url || "").trim(),
      createdAt: Number(record.createdAt) || Date.now(),
      lastRefreshedAt: Number(record.lastRefreshedAt) || 0,
      lastMood: String(record.lastMood || "").trim(),
      lastTimeRange: String(record.lastTimeRange || "").trim(),
      lastUseTopSeeds: Boolean(record.lastUseTopSeeds),
      lastPresetName: String(record.lastPresetName || "").trim(),
      lastTrackCount: Number(record.lastTrackCount) || 0,
    };
    return normalized;
  }

  function loadSignaturePlaylistRecord() {
    state.signaturePlaylist = normalizeSignaturePlaylistRecord(readStorageJson(STORAGE_KEYS.signaturePlaylist));
  }

  function persistSignaturePlaylistRecord() {
    if (!state.signaturePlaylist) {
      writeStorageValue(STORAGE_KEYS.signaturePlaylist, null);
      return;
    }
    writeStorageJson(STORAGE_KEYS.signaturePlaylist, state.signaturePlaylist);
  }

  function renderSignaturePreview(tracks) {
    if (!els.signaturePreview) return;
    const list = Array.isArray(tracks) ? tracks.slice(0, 6) : [];
    if (!list.length) {
      els.signaturePreview.innerHTML = "";
      return;
    }

    els.signaturePreview.innerHTML = `<div class="results-list">${list
      .map((track) => {
        const album = track && track.album ? track.album : {};
        const image = Array.isArray(album.images) && album.images[0] && album.images[0].url
          ? `<img src="${UI.escapeHtml(album.images[0].url)}" alt="${UI.escapeHtml(track.name || "Track")} cover" loading="lazy" />`
          : '<div class="art-fallback" aria-hidden="true">♪</div>';
        const artists = Array.isArray(track && track.artists)
          ? track.artists.map((a) => (a && a.name) || "Unknown").join(", ")
          : "Unknown artist";
        return `
          <div class="result-card">
            ${image}
            <div>
              <h3>${UI.escapeHtml(track && track.name ? track.name : "Unknown track")}</h3>
              <div class="music-meta">${UI.escapeHtml(artists)}</div>
            </div>
          </div>
        `;
      })
      .join("")}</div>`;
  }

  function renderSignaturePlaylistPanel() {
    if (!els.signatureSummary) return;

    const sig = state.signaturePlaylist;
    const hasSignature = Boolean(sig && sig.id);
    const active = activePreset();

    if (els.signatureCreateBtn) {
      els.signatureCreateBtn.disabled = Boolean(state.loading.signature);
    }
    if (els.signatureRefreshBtn) {
      els.signatureRefreshBtn.disabled = Boolean(state.loading.signature);
    }
    if (els.signatureRefreshDayroomBtn) {
      els.signatureRefreshDayroomBtn.disabled = Boolean(state.loading.signature);
    }
    if (els.signatureResetBtn) {
      els.signatureResetBtn.disabled = Boolean(state.loading.signature || !hasSignature);
    }

    if (els.signatureOpenLink) {
      if (hasSignature && sig.url) {
        els.signatureOpenLink.href = sig.url;
        els.signatureOpenLink.classList.remove("hidden");
      } else {
        els.signatureOpenLink.classList.add("hidden");
        els.signatureOpenLink.removeAttribute("href");
      }
    }

    if (!hasSignature) {
      els.signatureStatusBadge.textContent = "Not set up";
      els.signatureSummary.innerHTML = `
        <strong>No signature playlist linked yet.</strong>
        <span>Create one private playlist that this room can refresh whenever your taste shifts.</span>
      `;
      if (!state.loading.signature) {
        els.signatureStatus.textContent = active
          ? `Current preset: ${active.name} (${formatPresetMeta(active)})`
          : "Uses your current mood, time range, and seed preference.";
      }
      renderSignaturePreview([]);
      return;
    }

    els.signatureStatusBadge.textContent = sig.lastRefreshedAt ? "Ready" : "Linked";
    const refreshedText = sig.lastRefreshedAt
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(sig.lastRefreshedAt)
        )
      : "Never";
    const sourceMeta = [
      sig.lastPresetName || "",
      sig.lastMood ? `Mood: ${moodConfigs[sig.lastMood] ? moodConfigs[sig.lastMood].label : sig.lastMood}` : "",
      sig.lastTimeRange ? `Range: ${shortRangeLabel(sig.lastTimeRange)}` : "",
      Number(sig.lastTrackCount) ? `${sig.lastTrackCount} tracks` : "",
    ]
      .filter(Boolean)
      .join(" • ");

    els.signatureSummary.innerHTML = `
      <strong>${UI.escapeHtml(sig.name)}</strong>
      <span>Last refreshed: ${UI.escapeHtml(refreshedText)}${sourceMeta ? ` • ${UI.escapeHtml(sourceMeta)}` : ""}</span>
    `;

    if (!state.loading.signature) {
      els.signatureStatus.textContent = "Refresh uses your current generator settings and updates the same playlist.";
    }
  }

  function setSignatureLoading(on, statusText) {
    state.loading.signature = Boolean(on);
    if (els.signaturePreview) {
      UI.setLoading(els.signaturePreview, on);
    }
    if (typeof statusText === "string" && els.signatureStatus) {
      els.signatureStatus.innerHTML = statusText;
    }
    renderSignaturePlaylistPanel();
  }

  function updatePresetStateLabel() {
    if (!els.presetState) return;
    const active = activePreset();
    if (!active) {
      els.presetState.textContent = "Custom setup";
      return;
    }
    if (presetMatchesCurrent(active)) {
      els.presetState.textContent = `Preset active: ${active.name}`;
      return;
    }
    els.presetState.textContent = `Modified from ${active.name}`;
  }

  function renderPresetList() {
    if (!els.presetList) return;
    if (!state.presets.length) {
      els.presetList.innerHTML = '<div class="preset-empty">No presets yet. Save your current setup.</div>';
      updatePresetStateLabel();
      return;
    }

    els.presetList.innerHTML = state.presets
      .map((preset) => {
        const isActiveId = preset.id === state.activePresetId;
        const isCurrent = presetMatchesCurrent(preset);
        const classes = `preset-item${isActiveId ? " is-active" : ""}`;
        const applyLabel = isCurrent ? "Applied" : "Apply";
        const meta = formatPresetMeta(preset);
        return `
          <div class="${classes}" data-preset-id="${UI.escapeHtml(preset.id)}">
            <div>
              <p class="preset-title">${UI.escapeHtml(preset.name)}</p>
              <p class="preset-meta">${UI.escapeHtml(meta)}</p>
            </div>
            <div class="preset-actions">
              <button class="preset-action is-primary" type="button" data-preset-action="apply" ${
                isCurrent ? "disabled" : ""
              }>
                ${UI.escapeHtml(applyLabel)}
              </button>
              <button class="preset-action is-danger" type="button" data-preset-action="delete">
                Delete
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    updatePresetStateLabel();
    renderTimeRoomPanel();
  }

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
    renderPresetList();
  }

  function setMoodSelection(mood, options) {
    const opts = options || {};
    if (!moodConfigs[mood]) return;
    state.selectedMood = mood;
    $$(".chip-btn", els.moodButtonsWrap).forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.mood === mood);
    });
    if (!opts.silentStatus) {
      els.moodStatus.textContent = `Selected mood: ${moodConfigs[mood].label}.`;
    }
    renderPresetList();
  }

  function setUseTopSeeds(enabled) {
    els.useTopSeeds.checked = Boolean(enabled);
    renderPresetList();
  }

  async function applyPresetById(presetId, options) {
    const opts = options || {};
    const preset = state.presets.find((item) => item.id === presetId);
    if (!preset) return;

    const previousRange = state.timeRange;
    state.activePresetId = preset.id;
    persistPresets();

    setMoodSelection(preset.mood, { silentStatus: true });
    setUseTopSeeds(preset.useTopSeeds);
    setTabSelection(preset.timeRange);
    renderPresetList();

    els.presetNameInput.value = preset.name;
    els.moodStatus.textContent = `Preset ready: ${preset.name}.`;

    if (!opts.skipReload && previousRange !== preset.timeRange) {
      await reloadTasteSections();
    } else if (!opts.skipReload && opts.refreshAlways) {
      await reloadTasteSections();
    }

    if (!opts.silentToast) {
      UI.showToast("success", `Preset applied: ${preset.name}`);
    }
  }

  function buildPresetPayload(name) {
    const trimmedName = String(name || "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!trimmedName) {
      throw new Error("Give your preset a name first.");
    }

    return Object.assign(
      {
        id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: trimmedName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      currentSettingsSnapshot()
    );
  }

  function saveCurrentPreset() {
    const name = els.presetNameInput.value;
    let payload;
    try {
      payload = buildPresetPayload(name);
    } catch (error) {
      UI.showToast("error", error.message || "Preset name is required.");
      return;
    }

    const existingIndex = state.presets.findIndex(
      (preset) => preset.name.toLowerCase() === payload.name.toLowerCase()
    );
    const normalizedPayload = normalizePreset(payload);
    if (!normalizedPayload) {
      UI.showToast("error", "Could not save preset. Please try again.");
      return;
    }

    if (existingIndex >= 0) {
      const existing = state.presets[existingIndex];
      state.presets[existingIndex] = normalizePreset(
        Object.assign({}, existing, normalizedPayload, {
          id: existing.id,
          createdAt: existing.createdAt || Date.now(),
          updatedAt: Date.now(),
        })
      );
      state.activePresetId = existing.id;
      UI.showToast("success", `Preset updated: ${payload.name}`);
    } else {
      state.presets = [normalizedPayload].concat(state.presets).slice(0, 12);
      state.activePresetId = normalizedPayload.id;
      UI.showToast("success", `Preset saved: ${payload.name}`);
    }

    persistPresets();
    renderPresetList();
  }

  function deletePresetById(presetId) {
    const preset = state.presets.find((item) => item.id === presetId);
    if (!preset) return;
    state.presets = state.presets.filter((item) => item.id !== presetId);
    if (state.activePresetId === presetId) {
      state.activePresetId = null;
    }
    sanitizeTimeRoomMappings();
    persistPresets();
    renderPresetList();
    UI.showToast("info", `Preset removed: ${preset.name}`);
  }

  function initializePresets() {
    loadPresets();
    renderPresetList();

    const active = activePreset();
    if (!active) return;

    applyPresetById(active.id, {
      skipReload: true,
      silentToast: true,
    }).catch(function () {
      renderPresetList();
    });
  }

  function assignActivePresetToCurrentTime() {
    const active = activePreset();
    if (!active) {
      UI.showToast("error", "Select or save a preset first.");
      return;
    }
    const blockId = getTimeBlockId(new Date());
    state.timeRooms.mapping[blockId] = active.id;
    persistTimeRooms();
    renderTimeRoomPanel();
    UI.showToast("success", `${active.name} is now your ${timeBlockLabel(blockId)} room.`);
  }

  async function applySuggestedTimeRoom() {
    const suggestion = getSuggestedPresetForCurrentTime();
    if (!suggestion.preset) {
      UI.showToast("error", "No preset available for a time-based room yet.");
      return;
    }
    await applyPresetById(suggestion.preset.id, { refreshAlways: true });
  }

  async function refreshSignatureFromSuggestedTimeRoom() {
    const suggestion = getSuggestedPresetForCurrentTime();
    if (!suggestion.preset) {
      UI.showToast("error", "No preset available for a time-based room yet.");
      return;
    }

    if (els.signatureStatus) {
      els.signatureStatus.textContent = `Applying ${suggestion.blockLabel} room (${suggestion.preset.name}) before refresh...`;
    }

    await applyPresetById(suggestion.preset.id, {
      silentToast: true,
      refreshAlways: true,
    });
    await refreshSignaturePlaylist();
  }

  function initializeTimeRooms() {
    loadTimeRooms();
    renderTimeRoomPanel();

    if (state.timeRooms.autoApply) {
      const suggestion = getSuggestedPresetForCurrentTime();
      if (suggestion.preset) {
        applyPresetById(suggestion.preset.id, {
          skipReload: true,
          silentToast: true,
        }).catch(function () {
          renderTimeRoomPanel();
        });
      }
    }
  }

  function resetSignaturePlaylistLink() {
    state.signaturePlaylist = null;
    persistSignaturePlaylistRecord();
    renderSignaturePreview([]);
    renderSignaturePlaylistPanel();
    els.signatureStatus.textContent = "Signature playlist link cleared. You can create it again anytime.";
    UI.showToast("info", "Signature playlist link reset.");
  }

  async function createSignaturePlaylistOnly() {
    setSignatureLoading(
      true,
      '<span class="loading-inline"><span class="spinner" aria-hidden="true"></span>Creating your signature playlist on Spotify...</span>'
    );
    try {
      await createSignaturePlaylist();
      renderSignaturePreview([]);
      UI.showToast("success", "Signature playlist created.");
    } catch (error) {
      UI.showToast("error", error && error.message ? error.message : "Could not create signature playlist.");
      throw error;
    } finally {
      setSignatureLoading(false);
      renderSignaturePlaylistPanel();
    }
    els.signatureStatus.textContent = "Signature playlist created. Refresh it to load your current room taste.";
  }

  function initializeSignaturePlaylist() {
    loadSignaturePlaylistRecord();
    renderSignaturePlaylistPanel();
    renderSignaturePreview([]);
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

  async function fetchRecommendedTracksForMood(moodKey, options) {
    const opts = options || {};
    const seedTrackIds = Array.isArray(opts.seedTrackIds) ? opts.seedTrackIds : getSeedTrackIds();
    if (!seedTrackIds.length) {
      throw new Error("No usable seed tracks found yet. Try reloading your data.");
    }

    const recommendations = await apiSpotify("/recommendations", {
      query: buildRecommendationsQuery(seedTrackIds, moodKey),
    });
    const tracks = Array.isArray(recommendations && recommendations.tracks)
      ? recommendations.tracks.filter((track) => track && track.uri)
      : [];

    if (!tracks.length) {
      throw new Error("Spotify did not return any recommendations for that mood.");
    }

    return tracks;
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

  function currentSignatureSourceMeta(moodKey, trackCount) {
    const active = activePreset();
    return {
      lastMood: moodKey,
      lastTimeRange: state.timeRange,
      lastUseTopSeeds: Boolean(els.useTopSeeds.checked),
      lastPresetName: active && presetMatchesCurrent(active) ? active.name : "",
      lastTrackCount: Number(trackCount) || 0,
      lastRefreshedAt: Date.now(),
    };
  }

  function persistLastRoomSessionFromGeneration(playlist, tracks, moodKey) {
    const active = activePreset();
    const playlistUrl =
      playlist && playlist.external_urls && playlist.external_urls.spotify
        ? playlist.external_urls.spotify
        : "";

    writeStorageJson(STORAGE_KEYS.lastRoomSession, {
      source: "mood_generator",
      savedAt: Date.now(),
      mood: moodKey,
      timeRange: state.timeRange,
      useTopSeeds: Boolean(els.useTopSeeds.checked),
      activePresetId: active && active.id ? active.id : "",
      activePresetName: active ? active.name : "",
      playlistId: playlist && playlist.id ? playlist.id : "",
      playlistName:
        playlist && playlist.name
          ? playlist.name
          : `Listening Room - ${(moodConfigs[moodKey] && moodConfigs[moodKey].label) || "Mood"}`,
      playlistUrl,
      trackCount: Array.isArray(tracks) ? tracks.length : 0,
    });
  }

  async function createSignaturePlaylist() {
    const me = state.user || (await ensureAuthenticatedUser());
    if (!me || !me.id) {
      throw new Error("Could not resolve your Spotify user profile.");
    }

    const playlist = await apiSpotify(`/users/${encodeURIComponent(me.id)}/playlists`, {
      method: "POST",
      body: {
        name: "Fuhad's Signature Playlist",
        description: "A continuously refreshed playlist generated by Fuhad Music Room.",
        public: false,
      },
    });

    if (!playlist || !playlist.id) {
      throw new Error("Spotify did not return a valid playlist.");
    }

    state.signaturePlaylist = normalizeSignaturePlaylistRecord({
      id: playlist.id,
      name: playlist.name || "Fuhad's Signature Playlist",
      url: playlist.external_urls && playlist.external_urls.spotify ? playlist.external_urls.spotify : "",
      createdAt: Date.now(),
    });
    persistSignaturePlaylistRecord();
    renderSignaturePlaylistPanel();
    return state.signaturePlaylist;
  }

  async function ensureSignaturePlaylistExists() {
    if (state.signaturePlaylist && state.signaturePlaylist.id) {
      return state.signaturePlaylist;
    }
    return createSignaturePlaylist();
  }

  async function replacePlaylistTracks(playlistId, tracks) {
    const uris = (tracks || []).map((track) => track && track.uri).filter(Boolean);
    await apiSpotify(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: "PUT",
      body: { uris },
    });
  }

  async function refreshSignaturePlaylist() {
    const moodKey = state.selectedMood;
    let success = false;
    let errorMessage = "";

    setSignatureLoading(
      true,
      '<span class="loading-inline"><span class="spinner" aria-hidden="true"></span>Refreshing your signature playlist with current room settings...</span>'
    );

    try {
      const signature = await ensureSignaturePlaylistExists();
      const tracks = await fetchRecommendedTracksForMood(moodKey);
      await replacePlaylistTracks(signature.id, tracks);

      state.signaturePlaylist = normalizeSignaturePlaylistRecord(
        Object.assign({}, signature, currentSignatureSourceMeta(moodKey, tracks.length))
      );
      persistSignaturePlaylistRecord();
      renderSignaturePreview(tracks);
      success = true;
      UI.showToast("success", "Fuhad's Signature Playlist refreshed.");
    } catch (error) {
      errorMessage = error && error.message ? error.message : "Could not refresh your signature playlist.";
      if (error && error.status === 404) {
        state.signaturePlaylist = null;
        persistSignaturePlaylistRecord();
      }
      UI.showToast("error", errorMessage);
      throw error;
    } finally {
      setSignatureLoading(false);
      renderSignaturePlaylistPanel();
      if (success) {
        els.signatureStatus.textContent = "Signature playlist updated successfully.";
      } else if (errorMessage) {
        els.signatureStatus.textContent = "Signature playlist refresh failed. You can retry or recreate it.";
      }
    }
  }

  async function generateMoodPlaylist() {
    const moodKey = state.selectedMood;

    setSectionLoading("generator", true);
    els.generateBtn.disabled = true;
    els.retryGenerateBtn.classList.add("hidden");
    els.moodStatus.innerHTML =
      '<span class="loading-inline"><span class="spinner" aria-hidden="true"></span>Generating a playlist and saving it to your Spotify account...</span>';
    UI.renderTrackSkeletons(els.moodResult, 6);

    try {
      const tracks = await fetchRecommendedTracksForMood(moodKey);
      const playlist = await createMoodPlaylistFromTracks(tracks, moodKey);
      persistLastRoomSessionFromGeneration(playlist, tracks, moodKey);
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
    const launchHint = applyDashboardLaunchHint();

    if (!launchHint.topTracks) {
      UI.renderTrackSkeletons(els.topTracks, 6);
    }
    if (!launchHint.topArtists) {
      UI.renderArtistSkeletons(els.topArtists, 6);
    }
    if (!launchHint.recent) {
      UI.renderRecentSkeletons(els.recent, 8);
    }
    UI.renderEmpty(els.moodResult, "Generate a playlist to see results here.");

    if (launchHint.any) {
      setStatus("Loaded a quick room snapshot from the lobby. Verifying Spotify session...");
    }

    await ensureAuthenticatedUser();
    setStatus(launchHint.any ? "Spotify session active. Refreshing full room data..." : "Spotify session active.");

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
    setMoodSelection(mood);
  }

  function onPresetListClick(event) {
    const actionButton = event.target.closest("[data-preset-action]");
    if (!actionButton) return;
    const presetItem = actionButton.closest("[data-preset-id]");
    if (!presetItem) return;
    const presetId = presetItem.getAttribute("data-preset-id");
    const action = actionButton.getAttribute("data-preset-action");

    if (action === "apply") {
      applyPresetById(presetId).catch((error) => {
        UI.showToast("error", error && error.message ? error.message : "Could not apply preset.");
      });
      return;
    }

    if (action === "delete") {
      deletePresetById(presetId);
    }
  }

  function onPresetNameKeydown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    saveCurrentPreset();
  }

  function onDayroomActionClick(event) {
    const target = event.target;
    if (target === els.applyDayroomBtn) {
      applySuggestedTimeRoom().catch((error) => {
        UI.showToast("error", error && error.message ? error.message : "Could not apply time-based room.");
      });
      return;
    }

    if (target === els.assignDayroomBtn) {
      assignActivePresetToCurrentTime();
    }
  }

  function onSignatureActionClick(event) {
    const target = event.target;
    if (target === els.signatureCreateBtn) {
      createSignaturePlaylistOnly().catch(function () {
        // Toast already shown.
      });
      return;
    }
    if (target === els.signatureRefreshBtn) {
      refreshSignaturePlaylist().catch(function () {
        // Toast already shown.
      });
      return;
    }
    if (target === els.signatureRefreshDayroomBtn) {
      refreshSignatureFromSuggestedTimeRoom().catch(function () {
        // Toast already shown.
      });
      return;
    }
    if (target === els.signatureResetBtn) {
      resetSignaturePlaylistLink();
    }
  }

  function bindEvents() {
    els.tabs.forEach((tab) => tab.addEventListener("click", onTabClick));
    document.body.addEventListener("click", onRetry);
    els.moodButtonsWrap.addEventListener("click", onMoodButtonClick);
    els.useTopSeeds.addEventListener("change", function () {
      updatePresetStateLabel();
    });
    els.savePresetBtn.addEventListener("click", saveCurrentPreset);
    els.presetList.addEventListener("click", onPresetListClick);
    els.presetNameInput.addEventListener("keydown", onPresetNameKeydown);
    els.applyDayroomBtn.addEventListener("click", onDayroomActionClick);
    els.assignDayroomBtn.addEventListener("click", onDayroomActionClick);
    els.autoApplyDayroom.addEventListener("change", function () {
      state.timeRooms.autoApply = Boolean(els.autoApplyDayroom.checked);
      persistTimeRooms();
      renderTimeRoomPanel();
      UI.showToast(
        "info",
        state.timeRooms.autoApply
          ? "Time-of-day room auto-apply is on."
          : "Time-of-day room auto-apply is off."
      );
    });
    els.generateBtn.addEventListener("click", generateMoodPlaylist);
    els.retryGenerateBtn.addEventListener("click", generateMoodPlaylist);
    els.signatureCreateBtn.addEventListener("click", onSignatureActionClick);
    els.signatureRefreshDayroomBtn.addEventListener("click", onSignatureActionClick);
    els.signatureRefreshBtn.addEventListener("click", onSignatureActionClick);
    els.signatureResetBtn.addEventListener("click", onSignatureActionClick);
  }

  initializePresets();
  initializeTimeRooms();
  initializeSignaturePlaylist();
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
