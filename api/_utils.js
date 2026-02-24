function parseCookies(req) {
  const header = req && req.headers ? req.headers.cookie : "";
  const raw = Array.isArray(header) ? header.join("; ") : String(header || "");
  const cookies = {};

  if (!raw) {
    return cookies;
  }

  raw.split(";").forEach((part) => {
    const segment = part.trim();
    if (!segment) return;
    const eqIndex = segment.indexOf("=");
    const key = eqIndex >= 0 ? segment.slice(0, eqIndex).trim() : segment;
    const value = eqIndex >= 0 ? segment.slice(eqIndex + 1) : "";
    if (!key) return;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch (_error) {
      cookies[key] = value;
    }
  });

  return cookies;
}

function getCookie(req, name) {
  const cookies = parseCookies(req);
  return cookies[name];
}

function shouldUseSecureCookies() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function appendSetCookieHeader(res, value) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", value);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", existing.concat(value));
    return;
  }
  res.setHeader("Set-Cookie", [existing, value]);
}

function serializeCookie(name, value, options) {
  const opts = options || {};
  const parts = [`${name}=${encodeURIComponent(String(value ?? ""))}`];

  parts.push(`Path=${opts.path || "/"}`);

  if (typeof opts.maxAge === "number" && Number.isFinite(opts.maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`);
  }

  if (opts.expires instanceof Date) {
    parts.push(`Expires=${opts.expires.toUTCString()}`);
  }

  if (opts.httpOnly) {
    parts.push("HttpOnly");
  }

  if (opts.secure) {
    parts.push("Secure");
  }

  if (opts.sameSite) {
    const sameSite = String(opts.sameSite);
    parts.push(`SameSite=${sameSite}`);
  }

  if (opts.domain) {
    parts.push(`Domain=${opts.domain}`);
  }

  return parts.join("; ");
}

function setCookie(res, name, value, options) {
  const opts = Object.assign({}, options || {});
  if (opts.secure === undefined) {
    opts.secure = shouldUseSecureCookies();
  }
  if (!opts.sameSite) {
    opts.sameSite = "Lax";
  }
  if (!opts.path) {
    opts.path = "/";
  }

  appendSetCookieHeader(res, serializeCookie(name, value, opts));
}

function clearCookie(res, name) {
  setCookie(res, name, "", {
    httpOnly: true,
    expires: new Date(0),
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
  });
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function safeRedirect(res, url) {
  let location = "/index.html";
  try {
    const parsed = new URL(String(url || ""), "http://localhost");
    if (/^https?:$/.test(parsed.protocol)) {
      location = String(url);
    }
  } catch (_error) {
    location = "/index.html";
  }

  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end(`Redirecting to ${location}`);
}

module.exports = {
  parseCookies,
  getCookie,
  setCookie,
  clearCookie,
  json,
  safeRedirect,
};
