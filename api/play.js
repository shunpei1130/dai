const { allowMethods, readJson, sendJson } = require("../lib/http");
const { getRoom, saveRoom } = require("../lib/storage");
const { getStateForClient, playTurn, runBotsUntilHuman } = require("../lib/game");

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
      sendJson(res, 404, { error: "部屋が見つかりません。" });
      return;
    }

    playTurn(room, clientId, cardIds);
    runBotsUntilHuman(room);
    await saveRoom(room);

    sendJson(res, 200, {
      state: getStateForClient(room, clientId)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "カードを出せませんでした。" });
  }
};
