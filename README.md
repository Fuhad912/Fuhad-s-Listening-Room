# Fuhad's Listening Room

Spotify-powered website for Vercel with:

- Static frontend (`HTML`, `CSS`, `Vanilla JS`)
- Backend proxy via Vercel Serverless Functions in `/api`
- Secure Spotify auth (Client Secret kept server-side only)

## Features

- Featured playlist + highlighted tracks
- Artist spotlight + top tracks
- New releases feed (market-aware)
- Spotify search (tracks, artists, albums)
- Responsive UI with loading/error states
- Server-side Spotify token caching
- Spotify OAuth (Authorization Code Flow) with HTTP-only cookies

## Folder Structure

```text
.
|-- api/
|   |-- _lib/
|   |   `-- spotify.js
|   |-- _utils.js
|   |-- callback.js
|   |-- login.js
|   |-- logout.js
|   |-- room.js
|   `-- search.js
|-- app.html
|-- app.js
|-- index.html
|-- styles.css
|-- .env.example
|-- .gitignore
`-- README.md
```

## Spotify App Setup

1. Create an app in the Spotify Developer Dashboard.
2. Copy the `Client ID` and `Client Secret`.
3. Set them as environment variables locally and in Vercel.

Required:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `APP_BASE_URL`
- `SPOTIFY_REDIRECT_URI`

Optional:

- `SPOTIFY_MARKET` (default `US`)
- `SPOTIFY_FEATURED_PLAYLIST_ID` (default is Spotify's "Today's Top Hits")
- `SPOTIFY_FEATURED_ARTIST_IDS` (comma-separated Spotify artist IDs)

## Spotify OAuth (Authorization Code Flow) Setup

The OAuth login endpoints use:

- `GET /api/login`
- `GET /api/callback`
- `GET /api/logout`

### Required OAuth Environment Variables

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `APP_BASE_URL` (site origin only, no trailing path)
- `SPOTIFY_REDIRECT_URI` (must exactly match the callback URL configured in Spotify)

### Local Development (Exact Redirect URI)

If you run with `vercel dev` on port `3000`, use:

- `APP_BASE_URL=http://localhost:3000`
- `SPOTIFY_REDIRECT_URI=http://localhost:3000/api/callback`

Add `http://localhost:3000/api/callback` to your Spotify app Redirect URIs.

### Production (Exact Redirect URI)

Use your deployed Vercel domain or custom domain:

- `APP_BASE_URL=https://your-app.vercel.app`
- `SPOTIFY_REDIRECT_URI=https://your-app.vercel.app/api/callback`

Add the exact production callback URL to your Spotify app Redirect URIs.

Important:

- Spotify requires an exact string match for `redirect_uri`
- If you use both local and production, add both callback URLs in the Spotify dashboard
- If you use a custom domain, add that callback URL too

## Local Development (Recommended: Vercel CLI)

Run static files and `/api` functions together:

```bash
# Windows PowerShell
Copy-Item .env.example .env.local

# edit .env.local and add your Spotify credentials
npx vercel@latest dev
```

Open the local URL printed by the CLI (usually `http://localhost:3000`).

## Deploy to Vercel

### Vercel Dashboard

1. Push the project to GitHub/GitLab/Bitbucket
2. Import the repo into Vercel
3. Add env vars:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `APP_BASE_URL`
   - `SPOTIFY_REDIRECT_URI`
   - optional variables above
4. Deploy

### Vercel CLI

```bash
npx vercel@latest
```

Add env vars:

```bash
npx vercel@latest env add SPOTIFY_CLIENT_ID
npx vercel@latest env add SPOTIFY_CLIENT_SECRET
npx vercel@latest env add APP_BASE_URL
npx vercel@latest env add SPOTIFY_REDIRECT_URI
```

Redeploy:

```bash
npx vercel@latest --prod
```

## API Endpoints

- `GET /api/room`
- `GET /api/search?q=asake`
- `GET /api/login`
- `GET /api/callback`
- `GET /api/logout`

Optional query params:

- `/api/room?market=GB`
- `/api/room?playlistId=<spotify_playlist_id>`
- `/api/room?artistIds=<id1,id2,...>`
- `/api/search?q=tems&market=NG`

## Security

- `SPOTIFY_CLIENT_SECRET` is used only in server-side code
- Frontend never receives Spotify credentials
- Browser calls only your own `/api/*` endpoints
- OAuth tokens are stored in HTTP-only cookies by the callback handler

## Notes

- `/api/room` and `/api/search` send cache headers for Vercel CDN caching
- OAuth login uses `SameSite=Lax` cookies and `Secure` cookies in production
- Customize colors/layout in `styles.css`
- For a personalized room, set `SPOTIFY_FEATURED_PLAYLIST_ID` to your own public playlist ID
