const SPOTIFY_ACCOUNTS_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

const DEFAULT_MARKET = "US";
const DEFAULT_PLAYLIST_ID = "37i9dQZF1DXcBWIGoYBM5M"; // Today's Top Hits
const DEFAULT_TRACK_LIMIT = 12;
const DEFAULT_RELEASE_LIMIT = 8;
const DEFAULT_SPOTLIGHT_LIMIT = 5;
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

let tokenCache = { accessToken: null, expiresAt: 0 };

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function normalizeMarket(value) {
  const market = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(market) ? market : DEFAULT_MARKET;
}

function normalizePlaylistId(value) {
  const playlistId = String(value || "").trim();
  if (!playlistId) return DEFAULT_PLAYLIST_ID;
  if (!/^[A-Za-z0-9]+$/.test(playlistId)) {
    throw new HttpError(400, "Invalid playlistId. Expected a Spotify playlist ID.");
  }
  return playlistId;
}

function parseSpotifyIdList(value, maxItems = 6) {
  if (!value) return [];
  const ids = String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((v) => /^[A-Za-z0-9]+$/.test(v));
  return Array.from(new Set(ids)).slice(0, maxItems);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(
      500,
      `Missing required environment variable: ${name}. Add it in Vercel Project Settings or local .env.`
    );
  }
  return value;
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { rawText: await response.text() };
  }
  return response.json();
}

function buildSpotifyUrl(path, params) {
  const url = new URL(String(path || "").replace(/^\/+/, ""), `${SPOTIFY_API_BASE_URL}/`);
  if (params && typeof params === "object") {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function getSpotifyAccessToken() {
  const now = Date.now();
  if (tokenCache.accessToken && now < tokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
    return tokenCache.accessToken;
  }

  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  const basicToken = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(SPOTIFY_ACCOUNTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await readJson(response);
  if (!response.ok) {
    const message = data && data.error_description ? data.error_description : "Failed to authenticate with Spotify.";
    throw new HttpError(response.status, message, data);
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
  };

  return tokenCache.accessToken;
}

async function spotifyFetch(path, params) {
  const token = await getSpotifyAccessToken();
  const response = await fetch(buildSpotifyUrl(path, params), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await readJson(response);

  if (!response.ok) {
    const message = data && data.error && data.error.message ? data.error.message : "Spotify API request failed.";
    throw new HttpError(response.status, message, data);
  }

  return data;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function pickImage(images) {
  if (!Array.isArray(images) || !images.length) return null;
  const img = images[0];
  return { url: img.url || null, width: img.width || null, height: img.height || null };
}

function mapArtistLite(artist) {
  if (!artist) return null;
  return {
    id: artist.id || null,
    name: artist.name || "Unknown Artist",
    externalUrl: artist.external_urls ? artist.external_urls.spotify || null : null,
  };
}

function mapAlbum(album) {
  if (!album) return null;
  return {
    id: album.id || null,
    name: album.name || "Untitled Album",
    type: album.album_type || null,
    image: pickImage(album.images),
    images: Array.isArray(album.images) ? album.images : [],
    artists: Array.isArray(album.artists) ? album.artists.map(mapArtistLite).filter(Boolean) : [],
    releaseDate: album.release_date || null,
    releasePrecision: album.release_date_precision || null,
    totalTracks: album.total_tracks ?? null,
    externalUrl: album.external_urls ? album.external_urls.spotify || null : null,
  };
}

function mapTrack(track) {
  if (!track) return null;
  return {
    id: track.id || null,
    name: track.name || "Untitled Track",
    explicit: Boolean(track.explicit),
    durationMs: Number(track.duration_ms) || 0,
    popularity: Number.isFinite(track.popularity) ? track.popularity : null,
    previewUrl: track.preview_url || null,
    externalUrl: track.external_urls ? track.external_urls.spotify || null : null,
    trackNumber: track.track_number ?? null,
    artists: Array.isArray(track.artists) ? track.artists.map(mapArtistLite).filter(Boolean) : [],
    album: mapAlbum(track.album),
  };
}

function mapArtist(artist) {
  if (!artist) return null;
  return {
    id: artist.id || null,
    name: artist.name || "Unknown Artist",
    image: pickImage(artist.images),
    images: Array.isArray(artist.images) ? artist.images : [],
    genres: Array.isArray(artist.genres) ? artist.genres : [],
    popularity: Number.isFinite(artist.popularity) ? artist.popularity : null,
    followers: artist.followers && Number.isFinite(artist.followers.total) ? artist.followers.total : null,
    externalUrl: artist.external_urls ? artist.external_urls.spotify || null : null,
  };
}

function mapPlaylistMeta(playlist) {
  if (!playlist) return null;
  return {
    id: playlist.id || null,
    name: playlist.name || "Featured Playlist",
    description: stripHtml(playlist.description),
    image: pickImage(playlist.images),
    images: Array.isArray(playlist.images) ? playlist.images : [],
    externalUrl: playlist.external_urls ? playlist.external_urls.spotify || null : null,
    owner: playlist.owner
      ? {
          id: playlist.owner.id || null,
          name: playlist.owner.display_name || playlist.owner.id || "Spotify",
        }
      : null,
    followers: playlist.followers && Number.isFinite(playlist.followers.total) ? playlist.followers.total : null,
    totalTracks: playlist.tracks && Number.isFinite(playlist.tracks.total) ? playlist.tracks.total : null,
  };
}

function mapPlaylistTrackItems(page) {
  const items = Array.isArray(page && page.items) ? page.items : [];
  const results = [];
  for (const item of items) {
    const rawTrack = item && item.track;
    if (!rawTrack || rawTrack.is_local) continue;
    const track = mapTrack(rawTrack);
    if (!track) continue;
    results.push({ ...track, addedAt: item.added_at || null, position: results.length + 1 });
  }
  return results;
}

function mapReleaseAlbum(album) {
  const mapped = mapAlbum(album);
  return mapped ? { ...mapped, label: album.label || null } : null;
}

function deriveArtistIdsFromTracks(tracks, maxItems = 6) {
  const seen = new Set();
  const artistIds = [];
  for (const track of tracks || []) {
    for (const artist of track && Array.isArray(track.artists) ? track.artists : []) {
      if (!artist || !artist.id || seen.has(artist.id)) continue;
      seen.add(artist.id);
      artistIds.push(artist.id);
      if (artistIds.length >= maxItems) return artistIds;
    }
  }
  return artistIds;
}

async function getRoomData(options = {}) {
  const market = normalizeMarket(options.market || process.env.SPOTIFY_MARKET);
  const playlistId = normalizePlaylistId(options.playlistId || process.env.SPOTIFY_FEATURED_PLAYLIST_ID);
  const trackLimit = clamp(options.trackLimit || DEFAULT_TRACK_LIMIT, 4, 24);
  const releaseLimit = clamp(options.releaseLimit || DEFAULT_RELEASE_LIMIT, 4, 20);

  const [playlistMetaResponse, playlistTracksResponse, newReleasesResponse] = await Promise.all([
    spotifyFetch(`/playlists/${playlistId}`, {
      fields:
        "id,name,description,external_urls,followers(total),images,owner(display_name,id),tracks(total)",
    }),
    spotifyFetch(`/playlists/${playlistId}/tracks`, {
      market,
      limit: trackLimit,
      fields:
        "items(added_at,track(id,name,explicit,duration_ms,popularity,preview_url,track_number,external_urls,is_local,artists(id,name,external_urls),album(id,name,album_type,release_date,release_date_precision,images,external_urls,artists(id,name,external_urls))))",
    }),
    spotifyFetch("/browse/new-releases", { country: market, limit: releaseLimit }),
  ]);

  const featuredPlaylist = mapPlaylistMeta(playlistMetaResponse);
  const playlistTracks = mapPlaylistTrackItems(playlistTracksResponse);

  const requestedArtistIds = parseSpotifyIdList(
    options.featuredArtistIds || process.env.SPOTIFY_FEATURED_ARTIST_IDS,
    6
  );
  const artistIds = requestedArtistIds.length ? requestedArtistIds : deriveArtistIdsFromTracks(playlistTracks, 6);

  let featuredArtists = [];
  let spotlightArtist = null;
  let spotlightTracks = [];

  if (artistIds.length) {
    const artistsResponse = await spotifyFetch("/artists", { ids: artistIds.join(",") });
    featuredArtists = Array.isArray(artistsResponse.artists)
      ? artistsResponse.artists.map(mapArtist).filter(Boolean)
      : [];

    const firstArtistId = featuredArtists[0] && featuredArtists[0].id;
    if (firstArtistId) {
      const topTracksResponse = await spotifyFetch(`/artists/${firstArtistId}/top-tracks`, { market });
      spotlightArtist = featuredArtists[0];
      spotlightTracks = Array.isArray(topTracksResponse.tracks)
        ? topTracksResponse.tracks.slice(0, DEFAULT_SPOTLIGHT_LIMIT).map(mapTrack).filter(Boolean)
        : [];
    }
  }

  const newReleases =
    newReleasesResponse &&
    newReleasesResponse.albums &&
    Array.isArray(newReleasesResponse.albums.items)
      ? newReleasesResponse.albums.items.map(mapReleaseAlbum).filter(Boolean)
      : [];

  return {
    generatedAt: new Date().toISOString(),
    market,
    featuredPlaylist,
    playlistTracks,
    featuredArtists,
    spotlightArtist,
    spotlightTracks,
    newReleases,
  };
}

async function searchSpotify(options = {}) {
  const q = String(options.q || "").trim();
  if (q.length < 2) {
    throw new HttpError(400, "Search query must be at least 2 characters.");
  }
  if (q.length > 100) {
    throw new HttpError(400, "Search query is too long (max 100 characters).");
  }

  const market = normalizeMarket(options.market || process.env.SPOTIFY_MARKET);
  const limit = clamp(options.limit || 6, 1, 10);
  const response = await spotifyFetch("/search", {
    q,
    type: "track,artist,album",
    market,
    limit,
  });

  return {
    generatedAt: new Date().toISOString(),
    market,
    q,
    tracks: response.tracks && Array.isArray(response.tracks.items) ? response.tracks.items.map(mapTrack).filter(Boolean) : [],
    artists:
      response.artists && Array.isArray(response.artists.items)
        ? response.artists.items.map(mapArtist).filter(Boolean)
        : [],
    albums: response.albums && Array.isArray(response.albums.items) ? response.albums.items.map(mapReleaseAlbum).filter(Boolean) : [],
  };
}

function sendJson(res, statusCode, payload, cacheControl) {
  if (cacheControl) res.setHeader("Cache-Control", cacheControl);
  return res.status(statusCode).json(payload);
}

function handleApiError(res, error) {
  const statusCode =
    error && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : 500;
  const message = error && error.message ? error.message : "Unexpected server error while talking to Spotify.";
  return sendJson(res, statusCode, { error: { message, status: statusCode } }, "no-store");
}

module.exports = {
  HttpError,
  getRoomData,
  handleApiError,
  normalizeMarket,
  searchSpotify,
  sendJson,
};
