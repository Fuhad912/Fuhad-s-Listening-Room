(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function bylineFromArtists(artists) {
    if (!Array.isArray(artists) || !artists.length) return "Unknown artist";
    return artists.map((artist) => artist && artist.name ? artist.name : "Unknown artist").join(", ");
  }

  function imageMarkup(images, alt, className) {
    const image = Array.isArray(images) && images.length ? images[0] : null;
    if (image && image.url) {
      return `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
    }
    return `<div class="${className || "art-fallback"}" aria-hidden="true">♪</div>`;
  }

  function formatRelativeDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  function ensureToastRoot() {
    let root = document.getElementById("toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "toast-root";
      root.className = "toast-root";
      root.setAttribute("aria-live", "polite");
      document.body.appendChild(root);
    }
    return root;
  }

  function showToast(type, message) {
    const safeType = ["success", "error", "info"].includes(type) ? type : "info";
    const root = ensureToastRoot();
    const toast = document.createElement("div");
    toast.className = `toast toast-${safeType}`;
    toast.setAttribute("role", safeType === "error" ? "alert" : "status");
    toast.innerHTML = `
      <p class="toast-text">${escapeHtml(message || "")}</p>
      <button class="toast-close" type="button" aria-label="Dismiss notification">×</button>
    `;
    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", function () {
      toast.remove();
    });

    root.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 4200);
  }

  function setLoading(element, on) {
    if (!element) return;
    element.classList.toggle("is-loading", Boolean(on));
    element.setAttribute("aria-busy", on ? "true" : "false");
  }

  function renderEmpty(target, message) {
    if (!target) return;
    target.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function renderInlineError(target, message, retryKey) {
    if (!target) return;
    const button = retryKey
      ? `<button class="btn btn-ghost btn-small" type="button" data-retry="${escapeHtml(retryKey)}">Retry</button>`
      : "";
    target.innerHTML = `<div class="inline-error">${escapeHtml(message)}${button}</div>`;
  }

  function renderTrackSkeletons(target, count) {
    if (!target) return;
    target.innerHTML = `<div class="skeleton-grid">${Array.from({ length: count || 6 })
      .map(() => '<div class="skeleton" style="min-height:82px"></div>')
      .join("")}</div>`;
  }

  function renderArtistSkeletons(target, count) {
    if (!target) return;
    target.innerHTML = `<div class="skeleton-grid">${Array.from({ length: count || 6 })
      .map(() => '<div class="skeleton" style="min-height:180px"></div>')
      .join("")}</div>`;
  }

  function renderRecentSkeletons(target, count) {
    if (!target) return;
    target.innerHTML = `<div class="skeleton-grid">${Array.from({ length: count || 8 })
      .map(() => '<div class="skeleton" style="min-height:56px"></div>')
      .join("")}</div>`;
  }

  function renderTracks(target, tracks, options) {
    const opts = options || {};
    if (!target) return;
    if (!Array.isArray(tracks) || !tracks.length) {
      renderEmpty(target, opts.emptyMessage || "No tracks found.");
      return;
    }

    const html = tracks.map((track, index) => {
      const album = track && track.album ? track.album : {};
      const title = track && track.name ? track.name : "Unknown track";
      const artists = bylineFromArtists(track && track.artists);
      const rank = opts.showRank ? `<span class="music-rank">#${index + 1}</span>` : "";
      return `
        <article class="music-card">
          ${imageMarkup(album.images, `${title} cover art`, "art-fallback")}
          <div>
            <h3>${escapeHtml(title)}</h3>
            <div class="music-meta">${escapeHtml(artists)}</div>
            ${rank}
          </div>
        </article>
      `;
    }).join("");

    target.innerHTML = html;
  }

  function renderArtists(target, artists, options) {
    const opts = options || {};
    if (!target) return;
    if (!Array.isArray(artists) || !artists.length) {
      renderEmpty(target, opts.emptyMessage || "No artists found.");
      return;
    }

    target.innerHTML = artists.map((artist, index) => {
      const name = artist && artist.name ? artist.name : "Unknown artist";
      const genres = Array.isArray(artist && artist.genres) && artist.genres.length
        ? artist.genres.slice(0, 2).join(" • ")
        : "Spotify artist";
      const rank = opts.showRank ? `<div class="music-rank">#${index + 1}</div>` : "";
      return `
        <article class="artist-card">
          ${imageMarkup(artist && artist.images, `${name} portrait`, "artist-avatar-fallback")}
          <div>
            <h3>${escapeHtml(name)}</h3>
            <div class="artist-meta">${escapeHtml(genres)}</div>
            ${rank}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderRecentlyPlayed(target, items, options) {
    const opts = options || {};
    if (!target) return;
    if (!Array.isArray(items) || !items.length) {
      renderEmpty(target, opts.emptyMessage || "No recently played tracks available.");
      return;
    }

    target.innerHTML = items.map((item) => {
      const track = item && item.track ? item.track : item;
      const title = track && track.name ? track.name : "Unknown track";
      const artists = bylineFromArtists(track && track.artists);
      const album = track && track.album ? track.album : {};
      const playedAt = item && item.played_at ? formatRelativeDate(item.played_at) : "";
      return `
        <div class="recent-row">
          ${imageMarkup(album.images, `${title} cover art`, "art-fallback")}
          <div>
            <p class="recent-row-title">${escapeHtml(title)}</p>
            <p class="recent-row-meta">${escapeHtml(artists)}</p>
          </div>
          <div class="recent-row-time">${escapeHtml(playedAt)}</div>
        </div>
      `;
    }).join("");
  }

  function renderMoodResult(target, data) {
    if (!target) return;
    const playlist = data && data.playlist ? data.playlist : null;
    const tracks = data && Array.isArray(data.tracks) ? data.tracks : [];

    const header = playlist
      ? `
      <div class="playlist-result">
        <h3>${escapeHtml(playlist.name || "Generated playlist")}</h3>
        <p>${escapeHtml(playlist.description || "Playlist created in your Spotify account.")}</p>
        ${playlist.external_urls && playlist.external_urls.spotify
          ? `<a class="playlist-link" href="${escapeHtml(playlist.external_urls.spotify)}" target="_blank" rel="noreferrer">Open playlist on Spotify</a>`
          : ""}
      </div>`
      : "";

    const listHtml = tracks.length
      ? `<div class="results-list">${tracks.map((track) => `
        <div class="result-card">
          ${imageMarkup(track && track.album && track.album.images, `${track && track.name ? track.name : "Track"} cover`, "art-fallback")}
          <div>
            <h3>${escapeHtml(track && track.name ? track.name : "Unknown track")}</h3>
            <div class="music-meta">${escapeHtml(bylineFromArtists(track && track.artists))}</div>
          </div>
        </div>
      `).join("")}</div>`
      : `<div class="empty-state">No tracks were generated for this mood.</div>`;

    target.innerHTML = header + listHtml;
  }

  window.RoomUI = {
    showToast,
    setLoading,
    renderTracks,
    renderArtists,
    renderRecentlyPlayed,
    renderMoodResult,
    renderEmpty,
    renderInlineError,
    renderTrackSkeletons,
    renderArtistSkeletons,
    renderRecentSkeletons,
    escapeHtml,
  };
})();
