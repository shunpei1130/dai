const { allowMethods, readJson, sendJson } = require("../lib/http");
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
      sendJson(res, 400, { error: "clientId が必要です。" });
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
    sendJson(res, 500, { error: error.message || "部屋作成に失敗しました。" });
  }
};
