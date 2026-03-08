const { allowMethods, readJson, sendError, sendJson } = require("../lib/http");
const { getRoom, saveRoom } = require("../lib/storage");
const { getStateForClient, resolvePendingEffect, runBotsUntilHuman } = require("../lib/game");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJson(req);
    const roomId = String(body.roomId || "").trim().toUpperCase();
    const clientId = String(body.clientId || "").trim();
    const cardIds = Array.isArray(body.cardIds) ? body.cardIds : [];

    const room = await getRoom(roomId);
    if (!room) {
      sendJson(res, 404, { error: "Room not found." });
      return;
    }

    resolvePendingEffect(room, clientId, cardIds);
    runBotsUntilHuman(room);
    await saveRoom(room);

    sendJson(res, 200, {
      state: getStateForClient(room, clientId)
    });
  } catch (error) {
    sendError(res, error, 400, "Failed to resolve pending effect.");
  }
};

