const { clearCookie } = require("./_utils");

const COOKIE_NAMES = [
  "spotify_oauth_state",
  "spotify_access_token",
  "spotify_refresh_token",
  "spotify_token_expires_at",
];

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end(`Redirecting to ${location}`);
}

function safeAppBaseUrl(value) {
  try {
    return new URL(String(value || "")).origin;
  } catch (_error) {
    return "http://localhost:3000";
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
    return;
  }

  COOKIE_NAMES.forEach((name) => clearCookie(res, name));

  const appBaseUrl = safeAppBaseUrl(process.env.APP_BASE_URL);
  redirect(res, new URL("/index.html", appBaseUrl).toString());
};
