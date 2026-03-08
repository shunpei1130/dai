const { allowMethods, readJson, sendError, sendJson } = require("../lib/http");
const { createRoomId, saveRoom } = require("../lib/storage");
const { createRoom, getStateForClient, normalizeNickname } = require("../lib/game");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJson(req);
    const nickname = normalizeNickname(body.nickname);
    const clientId = String(body.clientId || "").trim();

    if (!clientId) {
      sendJson(res, 400, { error: "clientId is required." });
      return;
    }

    const roomId = await createRoomId();
    const room = createRoom({ roomId, clientId, nickname });
    await saveRoom(room);

    sendJson(res, 200, {
      roomId,
      state: getStateForClient(room, clientId)
    });
  } catch (error) {
    sendError(res, error, 500, "Failed to create room.");
  }
};

