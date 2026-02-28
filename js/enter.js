(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  const els = {
    status: $("room-status"),
    tabs: $$("[data-room-range]"),
    reloadBtn: $("room-reload"),
    topTracks: $("room-top-tracks"),
    topArtists: $("room-top-artists"),
    topAlbums: $("room-top-albums"),
  };

  if (!els.status || !els.topTracks || !els.topArtists || !els.topAlbums) {
    return;
  }

  const state = {
    range: "short_term",
    topTracks: [],
    topArtists: [],
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

  function setLoading(loading) {
    state.loading = Boolean(loading);
    els.tabs.forEach((tab) => {
      tab.disabled = state.loading;
    });
    if (els.reloadBtn) {
      els.reloadBtn.disabled = state.loading;
    }
  }

  function labelForRange(range) {
    if (range === "short_term") return "week";
    if (range === "medium_term") return "month";
    return "all time";
  }

  function artistNames(artists) {
    if (!Array.isArray(artists)) return "";
    return artists
      .map((artist) => (artist && artist.name ? artist.name : ""))
      .filter(Boolean)
      .join(", ");
  }

  function redirectToLogin(message) {
    const url = new URL("/index.html", window.location.origin);
    url.searchParams.set("error", message || "Please log in");
    window.location.replace(url.toString());
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

  function buildAlbumsFromTracks(tracks) {
    const albumMap = new Map();
    tracks.forEach((track) => {
      const album = track && track.album ? track.album : null;
      const albumId = album && album.id ? album.id : null;
      if (!albumId) return;

      const existing = albumMap.get(albumId) || {
        id: albumId,
        name: album.name || "Unknown album",
        artist: artistNames(album.artists) || artistNames(track.artists) || "Unknown artist",
        image:
          Array.isArray(album.images) && album.images[0] && album.images[0].url ? album.images[0].url : "",
        count: 0,
        popularityScore: 0,
      };
      existing.count += 1;
      existing.popularityScore += Number(track && track.popularity) || 0;
      albumMap.set(albumId, existing);
    });

    return Array.from(albumMap.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.popularityScore - a.popularityScore;
      })
      .slice(0, 12);
  }

  function renderEmpty(target, message) {
    target.innerHTML = `<li class="room-list-empty">${escapeHtml(message)}</li>`;
  }

  function renderTrackList(tracks) {
    if (!tracks.length) {
      renderEmpty(els.topTracks, "No top tracks available for this time range.");
      return;
    }

    els.topTracks.innerHTML = tracks
      .slice(0, 12)
      .map((track, index) => {
        const name = escapeHtml(track && track.name ? track.name : "Unknown track");
        const artists = escapeHtml(artistNames(track && track.artists) || "Unknown artist");
        const image =
          track &&
          track.album &&
          Array.isArray(track.album.images) &&
          track.album.images[0] &&
          track.album.images[0].url
            ? track.album.images[0].url
            : "";
        const artHtml = image
          ? `<img src="${escapeHtml(image)}" alt="${name} cover" loading="lazy" />`
          : '<div class="room-item-art-fallback" aria-hidden="true">T</div>';

        return `
          <li class="room-item">
            <div class="room-item-main-wrap">
              <div class="room-item-art">${artHtml}</div>
              <div class="room-item-main">
                <strong>${index + 1}. ${name}</strong>
                <small>${artists}</small>
              </div>
            </div>
          </li>
        `;
      })
      .join("");
  }

  function renderArtistList(artists) {
    if (!artists.length) {
      renderEmpty(els.topArtists, "No top artists available for this time range.");
      return;
    }

    els.topArtists.innerHTML = artists
      .slice(0, 12)
      .map((artist, index) => {
        const name = escapeHtml(artist && artist.name ? artist.name : "Unknown artist");
        const genres = Array.isArray(artist && artist.genres) && artist.genres.length
          ? escapeHtml(artist.genres.slice(0, 2).join(", "))
          : "No genre tags";
        const image =
          artist && Array.isArray(artist.images) && artist.images[0] && artist.images[0].url ? artist.images[0].url : "";
        const artHtml = image
          ? `<img src="${escapeHtml(image)}" alt="${name} portrait" loading="lazy" />`
          : '<div class="room-item-art-fallback" aria-hidden="true">A</div>';

        return `
          <li class="room-item">
            <div class="room-item-main-wrap">
              <div class="room-item-art">${artHtml}</div>
              <div class="room-item-main">
                <strong>${index + 1}. ${name}</strong>
                <small>${genres}</small>
              </div>
            </div>
          </li>
        `;
      })
      .join("");
  }

  function renderAlbumList(albums) {
    if (!albums.length) {
      renderEmpty(els.topAlbums, "No top albums could be derived for this time range.");
      return;
    }

    els.topAlbums.innerHTML = albums
      .map((album, index) => {
        const name = escapeHtml(album.name || "Unknown album");
        const artists = escapeHtml(album.artist || "Unknown artist");
        const artHtml = album.image
          ? `<img src="${escapeHtml(album.image)}" alt="${name} cover" loading="lazy" />`
          : '<div class="room-item-art-fallback" aria-hidden="true">B</div>';
        return `
          <li class="room-item">
            <div class="room-item-main-wrap">
              <div class="room-item-art">${artHtml}</div>
              <div class="room-item-main">
                <strong>${index + 1}. ${name}</strong>
                <small>${artists}</small>
              </div>
            </div>
          </li>
        `;
      })
      .join("");
  }

  async function loadRoomData() {
    setLoading(true);
    setStatus(`Loading your room data for this ${labelForRange(state.range)}...`);

    try {
      const authenticated = await ensureAuthenticatedUser();
      if (!authenticated) return;

      const [tracksRes, artistsRes] = await Promise.allSettled([
        apiSpotify("/me/top/tracks", { time_range: state.range, limit: 30 }),
        apiSpotify("/me/top/artists", { time_range: state.range, limit: 30 }),
      ]);

      state.topTracks =
        tracksRes.status === "fulfilled" && Array.isArray(tracksRes.value && tracksRes.value.items)
          ? tracksRes.value.items
          : [];
      state.topArtists =
        artistsRes.status === "fulfilled" && Array.isArray(artistsRes.value && artistsRes.value.items)
          ? artistsRes.value.items
          : [];

      const topAlbums = buildAlbumsFromTracks(state.topTracks);
      renderTrackList(state.topTracks);
      renderArtistList(state.topArtists);
      renderAlbumList(topAlbums);

      if (!state.topTracks.length && !state.topArtists.length) {
        setStatus("Spotify returned no room data for this range.");
      } else {
        setStatus(`Room updated for ${labelForRange(state.range)} listening.`);
      }
    } catch (error) {
      const message = error && error.message ? error.message : "Could not load room data.";
      setStatus(message);
      renderEmpty(els.topTracks, message);
      renderEmpty(els.topArtists, message);
      renderEmpty(els.topAlbums, message);
    } finally {
      setLoading(false);
    }
  }

  function setRange(range) {
    if (!["short_term", "medium_term", "long_term"].includes(range)) return;
    if (range === state.range) return;

    state.range = range;
    els.tabs.forEach((tab) => {
      const active = tab.dataset.range === range;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    loadRoomData();
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        setRange(tab.dataset.range);
      });
    });

    if (els.reloadBtn) {
      els.reloadBtn.addEventListener("click", function () {
        loadRoomData();
      });
    }
  }

  bindEvents();
  loadRoomData();
})();
