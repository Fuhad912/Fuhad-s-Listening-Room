(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    refreshButton: $("refresh-room"),
    searchForm: $("search-form"),
    searchInput: $("search-input"),
    roomStatus: $("room-status"),
    metaMarket: $("meta-market"),
    metaTrackCount: $("meta-track-count"),
    metaArtistCount: $("meta-artist-count"),
    metaUpdated: $("meta-updated"),
    featuredPlaylist: $("featured-playlist"),
    playlistTracks: $("playlist-tracks"),
    playlistTrackTotal: $("playlist-track-total"),
    spotlightArtist: $("spotlight-artist"),
    spotlightTracks: $("spotlight-tracks"),
    spotlightTrackTotal: $("spotlight-track-total"),
    artistsGrid: $("artists-grid"),
    releasesGrid: $("releases-grid"),
    searchState: $("search-state"),
    searchTracks: $("search-tracks"),
    searchArtists: $("search-artists"),
    searchAlbums: $("search-albums"),
    searchTracksCount: $("search-tracks-count"),
    searchArtistsCount: $("search-artists-count"),
    searchAlbumsCount: $("search-albums-count"),
  };

  const fmtNum = new Intl.NumberFormat();
  const fmtCompact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
  const fmtDateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const fmtDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

  const state = {
    roomLoading: false,
    searchAbort: null,
    searchTimer: null,
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function duration(ms) {
    const s = Math.floor((Number(ms) || 0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function imgMarkup(url, alt, cls) {
    if (url) return `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" />`;
    return `<div class="${cls || "placeholder-art"}" aria-hidden="true">♪</div>`;
  }

  function linkIcon(url, label) {
    return url
      ? `<a class="icon-link" href="${esc(url)}" target="_blank" rel="noreferrer" aria-label="${esc(label)}"></a>`
      : "";
  }

  function linkText(url, label) {
    return url
      ? `<a class="text-link" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`
      : "";
  }

  function imageUrl(item) {
    return item && item.image && item.image.url ? item.image.url : "";
  }

  function names(list) {
    return Array.isArray(list) && list.length ? list.map((x) => (x && x.name) || "Unknown").join(", ") : "Unknown Artist";
  }

  function albumName(track) {
    return track && track.album && track.album.name ? track.album.name : "Unknown Album";
  }

  function releaseDateLabel(dateString, precision) {
    if (!dateString) return "Release date unavailable";
    if (precision === "year") return dateString;
    if (precision === "month") {
      const [y, m] = dateString.split("-");
      return y && m ? `${m}/${y}` : dateString;
    }
    const d = new Date(dateString);
    return Number.isNaN(d.getTime()) ? dateString : fmtDate.format(d);
  }

  function stampLabel(dateString) {
    const d = new Date(dateString);
    return Number.isNaN(d.getTime()) ? "-" : fmtDateTime.format(d);
  }

  function status(message, tone) {
    els.roomStatus.textContent = message;
    els.roomStatus.classList.remove("is-loading", "is-error");
    if (tone === "loading") els.roomStatus.classList.add("is-loading");
    if (tone === "error") els.roomStatus.classList.add("is-error");
  }

  function empty(message) {
    return `<div class="empty-state">${esc(message)}</div>`;
  }

  function errorBox(message) {
    return `<div class="error-state">${esc(message)}</div>`;
  }

  function skeletonRows(count, height) {
    return Array.from({ length: count })
      .map(() => `<div class="skeleton-block" style="height:${height}px" aria-hidden="true"></div>`)
      .join("");
  }

  function renderTrackRow(track, index) {
    if (!track) return "";
    const url = track.album && track.album.image && track.album.image.url ? track.album.image.url : "";
    const cover = url ? `<img src="${esc(url)}" alt="" loading="lazy" />` : '<div class="track-cover-fallback" aria-hidden="true">♪</div>';
    const explicit = track.explicit ? '<span class="explicit-badge" aria-label="Explicit">E</span>' : "";
    const pos = Number.isFinite(track.position) ? track.position : index + 1;
    return `
      <li class="track-row">
        <span class="track-index">${esc(pos)}</span>
        ${cover}
        <div class="track-copy">
          <p class="track-name">${esc(track.name)}</p>
          <p class="track-meta">${esc(names(track.artists))} • ${esc(albumName(track))}</p>
        </div>
        <div class="track-side">
          <span>${esc(duration(track.durationMs))}</span>${explicit}
          ${linkIcon(track.externalUrl, `Open ${track.name} in Spotify`)}
        </div>
      </li>`;
  }

  function renderFeaturePlaylist(playlist) {
    if (!playlist) return errorBox("Playlist data unavailable.");
    const followers = Number.isFinite(playlist.followers) ? `${fmtCompact.format(playlist.followers)} followers` : "";
    const totalTracks = Number.isFinite(playlist.totalTracks) ? `${playlist.totalTracks} tracks` : "";
    return `
      <article class="feature-card">
        ${imgMarkup(imageUrl(playlist), `${playlist.name} cover art`)}
        <div>
          <h3>${esc(playlist.name)}</h3>
          <p>${esc(playlist.description || "A Spotify playlist selected for the listening room.")}</p>
          <div class="meta-line">
            ${playlist.owner && playlist.owner.name ? `<span>By ${esc(playlist.owner.name)}</span>` : ""}
            ${followers ? `<span>${esc(followers)}</span>` : ""}
            ${totalTracks ? `<span>${esc(totalTracks)}</span>` : ""}
          </div>
          <div class="chip-row">
            <span class="pill">Spotify Playlist</span>
            ${linkText(playlist.externalUrl, "Open in Spotify")}
          </div>
        </div>
      </article>`;
  }

  function renderSpotlight(artist) {
    if (!artist) return empty("No spotlight artist available.");
    const followers = Number.isFinite(artist.followers) ? `${fmtCompact.format(artist.followers)} followers` : "Followers unavailable";
    const popularity = Number.isFinite(artist.popularity) ? `Popularity ${artist.popularity}/100` : "Popularity unavailable";
    const chips = (artist.genres || []).slice(0, 3).map((g) => `<span class="chip">${esc(g)}</span>`).join("") || '<span class="pill">Genres unavailable</span>';
    return `
      <article class="feature-card">
        ${imgMarkup(imageUrl(artist), `${artist.name} photo`)}
        <div>
          <h3>${esc(artist.name)}</h3>
          <p>${esc(`${followers} • ${popularity}`)}</p>
          <div class="chip-row">${chips}</div>
          <div class="chip-row">${linkText(artist.externalUrl, "View artist in Spotify")}</div>
        </div>
      </article>`;
  }

  function renderArtistCard(artist) {
    if (!artist) return "";
    const genreText = (artist.genres || []).slice(0, 2).join(" • ") || "Genres unavailable";
    const followers = Number.isFinite(artist.followers) ? `${fmtCompact.format(artist.followers)} followers` : "Followers unavailable";
    const popularity = Number.isFinite(artist.popularity) ? `Popularity ${artist.popularity}` : "";
    return `
      <article class="media-card">
        ${imgMarkup(imageUrl(artist), `${artist.name} photo`)}
        <div>
          <h3>${esc(artist.name)}</h3>
          <p>${esc(genreText)}</p>
          <p>${esc([followers, popularity].filter(Boolean).join(" • "))}</p>
          <div class="card-actions">${linkText(artist.externalUrl, "Open in Spotify")}</div>
        </div>
      </article>`;
  }

  function renderAlbumCard(album) {
    if (!album) return "";
    const byline = names(album.artists);
    const when = releaseDateLabel(album.releaseDate, album.releasePrecision);
    const tracks = Number.isFinite(album.totalTracks) ? `${album.totalTracks} tracks` : "";
    return `
      <article class="media-card">
        ${imgMarkup(imageUrl(album), `${album.name} cover art`)}
        <div>
          <h3>${esc(album.name)}</h3>
          <p>${esc(byline)}</p>
          <p>${esc([when, tracks].filter(Boolean).join(" • "))}</p>
          <div class="card-actions">${linkText(album.externalUrl, "Open in Spotify")}</div>
        </div>
      </article>`;
  }

  function renderSearchCard(item, type) {
    if (!item) return "";
    let subtitle = "";
    let meta = "";
    let alt = "";
    if (type === "artist") {
      subtitle = (item.genres || []).slice(0, 2).join(" • ") || "Artist";
      meta = Number.isFinite(item.followers) ? `${fmtCompact.format(item.followers)} followers` : " ";
      alt = `${item.name} photo`;
    } else {
      subtitle = names(item.artists);
      meta = releaseDateLabel(item.releaseDate, item.releasePrecision);
      alt = `${item.name} cover art`;
    }
    return `
      <article class="search-card">
        ${imgMarkup(imageUrl(item), alt)}
        <div>
          <h4>${esc(item.name)}</h4>
          <p>${esc(subtitle)}</p>
          <p>${esc(meta)}</p>
          <div class="card-actions">${linkText(item.externalUrl, "Open")}</div>
        </div>
      </article>`;
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    let body = null;
    try {
      body = await res.json();
    } catch (_e) {
      body = null;
    }
    if (!res.ok) {
      const message = body && body.error && body.error.message ? body.error.message : `Request failed (${res.status})`;
      throw new Error(message);
    }
    return body;
  }

  function renderRoomLoading() {
    els.featuredPlaylist.innerHTML = skeletonRows(1, 132);
    els.spotlightArtist.innerHTML = skeletonRows(1, 132);
    els.playlistTracks.innerHTML = skeletonRows(6, 58);
    els.spotlightTracks.innerHTML = skeletonRows(5, 58);
    els.artistsGrid.innerHTML = skeletonRows(6, 86);
    els.releasesGrid.innerHTML = skeletonRows(8, 86);
    els.playlistTrackTotal.textContent = "-";
    els.spotlightTrackTotal.textContent = "-";
  }

  function renderRoom(data) {
    els.featuredPlaylist.innerHTML = renderFeaturePlaylist(data.featuredPlaylist);
    els.playlistTracks.innerHTML = (data.playlistTracks || []).length
      ? (data.playlistTracks || []).map(renderTrackRow).join("")
      : empty("No tracks found in the selected playlist.");
    els.playlistTrackTotal.textContent = String((data.playlistTracks || []).length);

    els.spotlightArtist.innerHTML = renderSpotlight(data.spotlightArtist);
    els.spotlightTracks.innerHTML = (data.spotlightTracks || []).length
      ? (data.spotlightTracks || []).map(renderTrackRow).join("")
      : empty("No spotlight tracks available.");
    els.spotlightTrackTotal.textContent = String((data.spotlightTracks || []).length);

    els.artistsGrid.innerHTML = (data.featuredArtists || []).length
      ? (data.featuredArtists || []).map(renderArtistCard).join("")
      : empty("No featured artists available.");
    els.releasesGrid.innerHTML = (data.newReleases || []).length
      ? (data.newReleases || []).map(renderAlbumCard).join("")
      : empty("No new releases returned for this market.");

    els.metaMarket.textContent = data.market || "-";
    els.metaTrackCount.textContent = fmtNum.format((data.playlistTracks || []).length);
    els.metaArtistCount.textContent = fmtNum.format((data.featuredArtists || []).length);
    els.metaUpdated.textContent = stampLabel(data.generatedAt);
  }

  function renderRoomError(message) {
    els.featuredPlaylist.innerHTML = errorBox(message);
    els.playlistTracks.innerHTML = empty("Playlist tracks unavailable.");
    els.spotlightArtist.innerHTML = empty("Spotlight unavailable.");
    els.spotlightTracks.innerHTML = empty("Spotlight tracks unavailable.");
    els.artistsGrid.innerHTML = empty("Featured artists unavailable.");
    els.releasesGrid.innerHTML = empty("Releases unavailable.");
    els.metaUpdated.textContent = "-";
  }

  function resetSearchColumns() {
    els.searchTracks.innerHTML = empty("Search tracks will appear here.");
    els.searchArtists.innerHTML = empty("Search artists will appear here.");
    els.searchAlbums.innerHTML = empty("Search albums will appear here.");
    els.searchTracksCount.textContent = "0";
    els.searchArtistsCount.textContent = "0";
    els.searchAlbumsCount.textContent = "0";
  }

  function renderSearchLoading() {
    els.searchTracks.innerHTML = skeletonRows(4, 52);
    els.searchArtists.innerHTML = skeletonRows(3, 86);
    els.searchAlbums.innerHTML = skeletonRows(3, 86);
  }

  function renderSearchResults(data) {
    const tracks = data.tracks || [];
    const artists = data.artists || [];
    const albums = data.albums || [];

    els.searchTracks.innerHTML = tracks.length
      ? `<ol class="track-list">${tracks.map(renderTrackRow).join("")}</ol>`
      : empty("No tracks found.");
    els.searchArtists.innerHTML = artists.length
      ? artists.map((a) => renderSearchCard(a, "artist")).join("")
      : empty("No artists found.");
    els.searchAlbums.innerHTML = albums.length
      ? albums.map((a) => renderSearchCard(a, "album")).join("")
      : empty("No albums found.");

    els.searchTracksCount.textContent = String(tracks.length);
    els.searchArtistsCount.textContent = String(artists.length);
    els.searchAlbumsCount.textContent = String(albums.length);
    els.searchState.textContent = `Results for "${data.q}" in market ${data.market}.`;
  }

  function renderSearchError(message) {
    els.searchTracks.innerHTML = errorBox(message);
    els.searchArtists.innerHTML = empty("Try another search.");
    els.searchAlbums.innerHTML = empty("Try another search.");
    els.searchTracksCount.textContent = "0";
    els.searchArtistsCount.textContent = "0";
    els.searchAlbumsCount.textContent = "0";
    els.searchState.textContent = "Search failed.";
  }

  function setQueryInUrl(q) {
    const url = new URL(window.location.href);
    if (q && q.length >= 2) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url);
  }

  async function loadRoom() {
    if (state.roomLoading) return;
    state.roomLoading = true;
    els.refreshButton.disabled = true;
    status("Refreshing room from Spotify...", "loading");
    renderRoomLoading();

    try {
      const data = await fetchJson("/api/room");
      renderRoom(data);
      status("Listening room is live.");
    } catch (err) {
      const message = err && err.message ? err.message : "Failed to load listening room.";
      status(message, "error");
      renderRoomError(message);
    } finally {
      state.roomLoading = false;
      els.refreshButton.disabled = false;
    }
  }

  async function runSearch(query) {
    const q = String(query || "").trim();
    if (q.length < 2) {
      if (state.searchAbort) state.searchAbort.abort();
      els.searchState.textContent = "Type at least 2 characters to search.";
      resetSearchColumns();
      setQueryInUrl("");
      return;
    }

    if (state.searchAbort) state.searchAbort.abort();
    const controller = new AbortController();
    state.searchAbort = controller;

    els.searchState.textContent = `Searching Spotify for "${q}"...`;
    renderSearchLoading();

    try {
      const params = new URLSearchParams({ q });
      const data = await fetchJson(`/api/search?${params.toString()}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      renderSearchResults(data);
      setQueryInUrl(q);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      renderSearchError(err && err.message ? err.message : "Search failed.");
    } finally {
      if (state.searchAbort === controller) state.searchAbort = null;
    }
  }

  function scheduleSearch() {
    if (state.searchTimer) window.clearTimeout(state.searchTimer);
    const value = els.searchInput.value;
    state.searchTimer = window.setTimeout(() => runSearch(value), 350);
  }

  function bindEvents() {
    els.refreshButton.addEventListener("click", loadRoom);
    els.searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.searchTimer) {
        window.clearTimeout(state.searchTimer);
        state.searchTimer = null;
      }
      runSearch(els.searchInput.value);
    });
    els.searchInput.addEventListener("input", scheduleSearch);
  }

  function init() {
    bindEvents();
    resetSearchColumns();
    loadRoom();

    const initialQ = (new URL(window.location.href).searchParams.get("q") || "").trim();
    if (initialQ.length >= 2) {
      els.searchInput.value = initialQ;
      runSearch(initialQ);
    }
  }

  init();
})();
