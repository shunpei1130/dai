const { allowMethods, readJson, sendJson } = require("../lib/http");
const { getRoom, saveRoom } = require("../lib/storage");
const { getStateForClient, joinRoom, normalizeNickname } = require("../lib/game");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJson(req);
    const roomId = String(body.roomId || "").trim().toUpperCase();
    const clientId = String(body.clientId || "").trim();
    const nickname = normalizeNickname(body.nickname);

    if (!roomId || !clientId) {
      sendJson(res, 400, { error: "roomId と clientId が必要です。" });
      return;
    }

    const room = await getRoom(roomId);
    if (!room) {
      sendJson(res, 404, { error: "部屋が見つかりません。" });
      return;
    }

    joinRoom(room, { clientId, nickname });
    await saveRoom(room);

    sendJson(res, 200, {
      state: getStateForClient(room, clientId)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "参加に失敗しました。" });
  }
};
