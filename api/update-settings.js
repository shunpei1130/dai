const { allowMethods, readJson, sendError, sendJson } = require("../lib/http");
const { getRoom, saveRoom } = require("../lib/storage");
const { getStateForClient, updateSettings } = require("../lib/game");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJson(req);
    const roomId = String(body.roomId || "").trim().toUpperCase();
    const clientId = String(body.clientId || "").trim();
    const patch = body.patch && typeof body.patch === "object" ? body.patch : {};

    const room = await getRoom(roomId);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }

    updateSettings(room, clientId, patch);
    await saveRoom(room);

    sendJson(res, 200, {
      state: getStateForClient(room, clientId)
    });
  } catch (error) {
    sendError(res, error, 400, "Failed to update settings.");
  }
};

