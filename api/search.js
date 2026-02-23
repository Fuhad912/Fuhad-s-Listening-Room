const { handleApiError, searchSpotify, sendJson } = require("./_lib/spotify");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: { message: "Method Not Allowed", status: 405 } }, "no-store");
  }

  try {
    const query = req.query || {};
    const data = await searchSpotify({
      q: query.q,
      market: query.market,
      limit: query.limit,
    });
    return sendJson(res, 200, data, "public, s-maxage=60, stale-while-revalidate=180");
  } catch (error) {
    return handleApiError(res, error);
  }
};
