const { allowMethods, sendError, sendJson } = require("../lib/http");
const { getRoom } = require("../lib/storage");
const { getStateForClient } = require("../lib/game");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    const roomId = String(req.query.roomId || "").trim().toUpperCase();
    const clientId = String(req.query.clientId || "").trim();

    if (!roomId) {
      sendJson(res, 400, { error: "roomId is required." });
      return;
    }

    const room = await getRoom(roomId);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }

    sendJson(res, 200, {
      state: getStateForClient(room, clientId || null)
    });
  } catch (error) {
    sendError(res, error, 500, "Failed to load room state.");
  }
};

