const { getRoomData, handleApiError, sendJson } = require("./_lib/spotify");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: { message: "Method Not Allowed", status: 405 } }, "no-store");
  }

  try {
    const query = req.query || {};
    const data = await getRoomData({
      market: query.market,
      playlistId: query.playlistId,
      featuredArtistIds: query.artistIds,
      trackLimit: query.trackLimit,
      releaseLimit: query.releaseLimit,
    });
    return sendJson(res, 200, data, "public, s-maxage=300, stale-while-revalidate=900");
  } catch (error) {
    return handleApiError(res, error);
  }
};
