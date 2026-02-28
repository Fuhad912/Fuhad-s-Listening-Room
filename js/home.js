(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    art: $("now-playing-art"),
    title: $("now-playing-title"),
    meta: $("now-playing-meta"),
    refresh: $("now-playing-refresh"),
    openLink: $("now-playing-link"),
  };

  if (!els.art || !els.title || !els.meta) {
    return;
  }

  function setText(title, meta) {
    els.title.textContent = title;
    els.meta.textContent = meta;
  }

  function setArtwork(url, label) {
    if (!url) {
      els.art.innerHTML = '<div class="now-playing-fallback" aria-hidden="true">NP</div>';
      return;
    }
    const safeLabel = String(label || "Album art")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const safeUrl = String(url)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
    els.art.innerHTML = `<img src="${safeUrl}" alt="${safeLabel}" loading="lazy" />`;
  }

  function setLink(url) {
    if (!url) {
      els.openLink.classList.add("hidden");
      els.openLink.removeAttribute("href");
      return;
    }
    els.openLink.href = url;
    els.openLink.classList.remove("hidden");
  }

  async function hasValidSpotifySession() {
    try {
      const response = await fetch("/api/spotify?path=/me");
      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  async function loadNowPlaying() {
    setText("Checking your Spotify player...", "Getting current playback data.");

    if (els.refresh) {
      els.refresh.disabled = true;
    }

    try {
      const response = await fetch("/api/spotify?path=/me/player/currently-playing");

      if (response.status === 204) {
        setArtwork("", "");
        setLink("");
        setText("Nothing is currently playing", "Start playback in Spotify and press refresh.");
        return;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage =
          payload && payload.error && payload.error.message
            ? payload.error.message
            : `Spotify request failed (${response.status})`;

        if (response.status === 401 || response.status === 403) {
          const connected = await hasValidSpotifySession();
          if (connected) {
            setArtwork("", "");
            setLink("");
            setText(
              "Spotify connected, but playback permission is missing",
              "Click Connect Spotify once to re-authorize playback access."
            );
            return;
          }
          setArtwork("", "");
          setLink("");
          setText("Spotify not connected", "Click Connect Spotify, then come back and refresh.");
          return;
        }

        setArtwork("", "");
        setLink("");
        setText("Could not load now playing", errorMessage);
        return;
      }

      const item = payload && payload.item ? payload.item : null;
      if (!item) {
        setArtwork("", "");
        setLink("");
        setText("Nothing is currently playing", "Start playback in Spotify and press refresh.");
        return;
      }

      const title = item.name || "Unknown track";
      const artists = Array.isArray(item.artists)
        ? item.artists.map((artist) => (artist && artist.name ? artist.name : "")).filter(Boolean).join(", ")
        : "";
      const albumName = item.album && item.album.name ? item.album.name : "";
      const playingState = payload && payload.is_playing ? "Playing now" : "Paused";
      const meta = [artists, albumName, playingState].filter(Boolean).join(" | ");

      const image =
        item.album &&
        Array.isArray(item.album.images) &&
        item.album.images[0] &&
        item.album.images[0].url
          ? item.album.images[0].url
          : "";
      const trackUrl =
        item.external_urls && item.external_urls.spotify ? item.external_urls.spotify : "";

      setArtwork(image, `${title} cover`);
      setLink(trackUrl);
      setText(title, meta || "Spotify track");
    } catch (error) {
      setArtwork("", "");
      setLink("");
      setText("Could not load now playing", error && error.message ? error.message : "Unknown error");
    } finally {
      if (els.refresh) {
        els.refresh.disabled = false;
      }
    }
  }

  if (els.refresh) {
    els.refresh.addEventListener("click", function () {
      loadNowPlaying();
    });
  }

  loadNowPlaying();
})();
