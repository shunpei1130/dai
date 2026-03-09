const { randomUUID } = require("crypto");
const {
  SUITS,
  SUIT_SYMBOLS,
  createDeck,
  shuffle,
  sortCards,
  compareRanks,
  cardLabel,
  rankLabel,
  serializeCard
} = require("./cards");
const { getDefaultSettings, normalizeSettings } = require("./rulesConfig");

const BOT_NAMES = ["Bot Akane", "Bot Gin", "Bot Kumo", "Bot Yoru"];
const POINT_TABLE = [5, 3, 1, 0];
const ROLE_LABELS = ["大富豪", "富豪", "貧民", "大貧民"];

function nowIso() {
  return new Date().toISOString();
}

function createEmptyGame() {
  return {
    status: "lobby",
    roundNumber: 0,
    startedAt: null,
    endedAt: null,
    currentPlayerId: null,
    currentCombo: null,
    recentCombo: null,
    recentPlayerId: null,
    lastPlayedBy: null,
    leadPlayerId: null,
    lockedSuits: null,
    direction: 1,
    revolution: false,
    elevenBack: false,
    passedPlayers: [],
    finishOrder: [],
    bottomOrder: [],
    hands: {},
    actionLog: [],
    announcements: [],
    pendingEffect: null,
    finalRanking: []
  };
}

function createPlayer({ clientId = null, nickname, seat, isBot = false }) {
  return {
    id: randomUUID(),
    clientId,
    nickname,
    seat,
    isBot,
    points: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    joinedAt: nowIso(),
    lastSeenAt: nowIso(),
    lastRoundRank: null,
    lastRoundRole: null
  };
}

function createRoom({ roomId, clientId, nickname }) {
  const host = createPlayer({
    clientId,
    nickname,
    seat: 0,
    isBot: false
  });

  return {
    id: roomId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    revision: 0,
    hostPlayerId: host.id,
    settings: getDefaultSettings(),
    players: [host],
    game: createEmptyGame(),
    lastRoundRanking: [],
    lastRoundRoles: {},
    history: []
  };
}

function orderedPlayers(room) {
  return [...room.players].sort((left, right) => left.seat - right.seat);
}

function getPlayerById(room, playerId) {
  return room.players.find((player) => player.id === playerId) || null;
}

function getPlayerByClientId(room, clientId) {
  return room.players.find((player) => player.clientId === clientId) || null;
}

function touchPlayer(player) {
  if (player) {
    player.lastSeenAt = nowIso();
  }
}

function nextRevision(room) {
  room.revision = (room.revision || 0) + 1;
  return room.revision;
}

function pushLimited(target, entry, limit = 24) {
  target.push(entry);
  if (target.length > limit) {
    target.splice(0, target.length - limit);
  }
}

function addAction(room, text, kind = "action") {
  const event = {
    id: nextRevision(room),
    kind,
    text,
    at: nowIso()
  };
  pushLimited(room.game.actionLog, event, 40);
  return event;
}

function addAnnouncement(room, type, title, detail, playerId = null) {
  const event = {
    id: nextRevision(room),
    type,
    title,
    detail,
    playerId,
    at: nowIso()
  };
  pushLimited(room.game.announcements, event, 24);
  return event;
}

function seatSet(room) {
  return new Set(room.players.map((player) => player.seat));
}

function ensureBots(room) {
  const seats = seatSet(room);
  for (let seat = 0; seat < 4; seat += 1) {
    if (!seats.has(seat)) {
      room.players.push(
        createPlayer({
          nickname: BOT_NAMES[seat % BOT_NAMES.length],
          seat,
          isBot: true
        })
      );
    }
  }

  room.players = orderedPlayers(room);
}

function roomLocked(room) {
  return room.game.roundNumber > 0 || room.game.status === "playing";
}

function joinRoom(room, { clientId, nickname }) {
  const existing = getPlayerByClientId(room, clientId);
  if (existing) {
    if (nickname) {
      existing.nickname = nickname.trim().slice(0, 20) || existing.nickname;
    }
    touchPlayer(existing);
    return existing;
  }

  if (roomLocked(room)) {
    throw new Error("この部屋はすでに参加メンバーが確定しています。新しい参加者は次の部屋を作成してください。");
  }

  const humans = room.players.filter((player) => !player.isBot);
  if (humans.length >= 4) {
    throw new Error("人間プレイヤーは4人までです。");
  }

  const seats = seatSet(room);
  let seat = 0;
  while (seats.has(seat) && seat < 4) {
    seat += 1;
  }

  const player = createPlayer({
    clientId,
    nickname,
    seat,
    isBot: false
  });
  room.players.push(player);
  room.players = orderedPlayers(room);
  addAction(room, `${player.nickname} が参加しました。`, "join");
  return player;
}

function updateSettings(room, clientId, patch) {
  const player = getPlayerByClientId(room, clientId);
  if (!player) {
    throw new Error("部屋に参加していません。");
  }

  if (room.hostPlayerId !== player.id) {
    throw new Error("ルール設定はホストのみ変更できます。");
  }

  if (room.game.status === "playing") {
    throw new Error("ゲーム中は設定を変更できません。");
  }

  room.settings = normalizeSettings({
    ...room.settings,
    ...patch
  });
  touchPlayer(player);
  addAction(room, `${player.nickname} が卓設定を更新しました。`, "settings");
}

function activePlayerIds(room) {
  const finished = new Set(room.game.finishOrder);
  const bottom = new Set(room.game.bottomOrder);
  return orderedPlayers(room)
    .map((player) => player.id)
    .filter((playerId) => !finished.has(playerId) && !bottom.has(playerId));
}

function isPlayerActive(room, playerId) {
  return activePlayerIds(room).includes(playerId);
}

function getEffectiveReversed(room) {
  return Boolean(room.game.revolution) !== Boolean(room.game.elevenBack);
}

function normalizeNickname(nickname) {
  return (nickname || "Player").trim().slice(0, 20) || "Player";
}

function determineStarter(room, hands) {
  const rule = room.settings.starterRule;

  if (rule === "lastPlace" && room.lastRoundRanking.length > 0) {
    return room.lastRoundRanking[room.lastRoundRanking.length - 1];
  }

  if (rule === "random") {
    const players = orderedPlayers(room);
    return players[Math.floor(Math.random() * players.length)].id;
  }

  const cardTargets = {
    diamond3: "D3",
    spade3: "S3",
    club3: "C3",
    heart3: "H3"
  };

  const targetCardId = cardTargets[rule] || "D3";
  const holder = orderedPlayers(room).find((player) =>
    (hands[player.id] || []).some((card) => card.id === targetCardId)
  );

  return holder ? holder.id : orderedPlayers(room)[0].id;
}

function dealHands(room) {
  const deck = shuffle(createDeck(Number(room.settings.jokerCount || 0)));
  const players = orderedPlayers(room);
  const hands = Object.fromEntries(players.map((player) => [player.id, []]));

  for (let index = 0; index < deck.length; index += 1) {
    const player = players[index % players.length];
    hands[player.id].push(deck[index]);
  }

  for (const player of players) {
    hands[player.id] = sortCards(hands[player.id], false);
  }

  return hands;
}

function startRound(room, clientId) {
  const player = getPlayerByClientId(room, clientId);
  if (!player) {
    throw new Error("部屋に参加していません。");
  }

  if (room.game.status === "playing") {
    throw new Error("すでにゲーム中です。");
  }

  ensureBots(room);
  const hands = dealHands(room);
  const roundNumber = (room.game.roundNumber || 0) + 1;
  const starterId = determineStarter(room, hands);

  room.game = {
    status: "playing",
    roundNumber,
    startedAt: nowIso(),
    endedAt: null,
    currentPlayerId: starterId,
    currentCombo: null,
    recentCombo: null,
    recentPlayerId: null,
    lastPlayedBy: null,
    leadPlayerId: starterId,
    lockedSuits: null,
    direction: 1,
    revolution: false,
    elevenBack: false,
    passedPlayers: [],
    finishOrder: [],
    bottomOrder: [],
    hands,
    actionLog: [],
    announcements: [],
    pendingEffect: null,
    finalRanking: []
  };

  addAction(room, `Round ${roundNumber} を開始しました。`, "round");
  addAnnouncement(room, "roundStart", `Round ${roundNumber}`, `${getPlayerById(room, starterId).nickname} から開始します。`, starterId);
}

function getHand(room, playerId) {
  return room.game.hands[playerId] || [];
}

function removeCardsFromHand(room, playerId, cardIds) {
  const remaining = getHand(room, playerId).filter((card) => !cardIds.includes(card.id));
  room.game.hands[playerId] = remaining;
}

function addCardsToHand(room, playerId, cards) {
  room.game.hands[playerId] = sortCards([...getHand(room, playerId), ...cards], getEffectiveReversed(room));
}

function extractCards(hand, cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    throw new Error("カードを選択してください。");
  }

  const lookup = new Map(hand.map((card) => [card.id, card]));
  const seen = new Set();
  const selected = [];

  for (const cardId of cardIds) {
    if (seen.has(cardId)) {
      throw new Error("同じカードが重複しています。");
    }
    const card = lookup.get(cardId);
    if (!card) {
      throw new Error("手札にないカードです。");
    }
    seen.add(cardId);
    selected.push(card);
  }

  return selected;
}

function arrayEquals(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function makeRankCounts(cards) {
  const counts = {};
  for (const card of cards) {
    if (card.isJoker) {
      continue;
    }
    counts[card.rank] = (counts[card.rank] || 0) + 1;
  }
  return counts;
}
function detectSingle(cards) {
  if (cards.length !== 1) {
    return null;
  }
  const card = cards[0];
  const rankCounts = makeRankCounts(cards);
  return {
    type: "single",
    count: 1,
    rank: card.rank,
    cards: [...cards],
    actualRanks: card.isJoker ? [] : [card.rank],
    intervalRanks: card.isJoker ? [] : [card.rank],
    suitSignature: card.isJoker ? null : [card.suit],
    rankCounts
  };
}

function detectSet(cards) {
  if (cards.length < 2) {
    return null;
  }

  const nonJokers = cards.filter((card) => !card.isJoker);
  if (nonJokers.length === 0) {
    return null;
  }

  const rank = nonJokers[0].rank;
  if (!nonJokers.every((card) => card.rank === rank)) {
    return null;
  }

  return {
    type: "set",
    count: cards.length,
    rank,
    cards: sortCards(cards, false),
    actualRanks: nonJokers.map((card) => card.rank),
    intervalRanks: [rank],
    suitSignature: cards.some((card) => card.isJoker)
      ? null
      : [...cards].map((card) => card.suit).sort(),
    rankCounts: makeRankCounts(cards)
  };
}

function detectSequence(cards) {
  if (cards.length < 3) {
    return null;
  }

  const nonJokers = cards.filter((card) => !card.isJoker);
  if (nonJokers.length === 0) {
    return null;
  }

  const suit = nonJokers[0].suit;
  if (!nonJokers.every((card) => card.suit === suit)) {
    return null;
  }

  const ranks = [...new Set(nonJokers.map((card) => card.rank).sort((a, b) => a - b))];
  if (ranks.length !== nonJokers.length) {
    return null;
  }

  const start = ranks[0];
  const end = start + cards.length - 1;
  if (end > 15) {
    return null;
  }

  if (!ranks.every((rank) => rank >= start && rank <= end)) {
    return null;
  }

  const jokerCount = cards.length - nonJokers.length;
  const missing = end - start + 1 - nonJokers.length;
  if (missing !== jokerCount) {
    return null;
  }

  const intervalRanks = [];
  for (let rank = start; rank <= end; rank += 1) {
    intervalRanks.push(rank);
  }

  return {
    type: "sequence",
    count: cards.length,
    rank: end,
    lowRank: start,
    highRank: end,
    cards: sortCards(cards, false),
    actualRanks: nonJokers.map((card) => card.rank),
    intervalRanks,
    suitSignature: [suit],
    rankCounts: makeRankCounts(cards)
  };
}

function detectCombo(cards, settings) {
  const single = detectSingle(cards);
  if (single) {
    return single;
  }

  if (settings.stairsEnabled) {
    const sequence = detectSequence(cards);
    if (sequence) {
      return sequence;
    }
  }

  const set = detectSet(cards);
  if (set) {
    return set;
  }

  return null;
}

function includesRank(combo, rank, useInterval = false) {
  const source = useInterval ? combo.intervalRanks : combo.actualRanks;
  return source.includes(rank);
}

function countRank(combo, rank) {
  return combo.rankCounts[rank] || 0;
}

function comboText(combo) {
  if (!combo) {
    return "";
  }

  if (combo.type === "sequence") {
    const suit = combo.suitSignature ? combo.suitSignature[0] : "J";
    return `${SUIT_SYMBOLS[suit]}${rankLabel(combo.lowRank)}-${rankLabel(combo.highRank)}`;
  }

  return combo.cards.map((card) => cardLabel(card)).join(" ");
}

function matchesLockedSuits(combo, lockedSuits) {
  if (!lockedSuits) {
    return true;
  }
  return arrayEquals(combo.suitSignature, lockedSuits);
}

function specialSpadeThreeReturn(room, combo) {
  const current = room.game.currentCombo;
  if (!current || current.type !== "single" || current.rank !== 16 || combo.type !== "single") {
    return false;
  }

  if (!room.settings.spadeThreeReturnEnabled) {
    return false;
  }

  const card = combo.cards[0];
  return !card.isJoker && card.suit === "S" && card.rank === 3;
}

function specialSandstorm(room, combo) {
  return Boolean(
    room.settings.sandstormEnabled &&
      combo.type === "set" &&
      combo.rank === 3 &&
      combo.count >= 3
  );
}

function canBeatCurrent(room, combo) {
  const current = room.game.currentCombo;
  if (!current) {
    return true;
  }

  if (specialSpadeThreeReturn(room, combo)) {
    return true;
  }

  if (specialSandstorm(room, combo)) {
    return true;
  }

  if (current.type !== combo.type || current.count !== combo.count) {
    return false;
  }

  if (!matchesLockedSuits(combo, room.game.lockedSuits)) {
    return false;
  }

  if (current.type === "single" && current.rank === 16) {
    return false;
  }

  return compareRanks(combo.rank, current.rank, getEffectiveReversed(room)) > 0;
}

function shouldLockSuits(room, previousCombo, combo) {
  if (!room.settings.suitLockEnabled || !previousCombo || room.game.lockedSuits) {
    return false;
  }

  return Boolean(combo.suitSignature) && arrayEquals(previousCombo.suitSignature, combo.suitSignature);
}

function nextActiveAfter(room, playerId, skipCount = 0) {
  const players = orderedPlayers(room).map((player) => player.id);
  const active = new Set(activePlayerIds(room));
  if (active.size === 0) {
    return null;
  }

  let index = players.indexOf(playerId);
  if (index === -1) {
    index = 0;
  }

  let remainingSkip = skipCount;
  for (let hops = 0; hops < players.length * 4; hops += 1) {
    index = (index + room.game.direction + players.length) % players.length;
    const candidate = players[index];
    if (!active.has(candidate)) {
      continue;
    }
    if (remainingSkip > 0) {
      remainingSkip -= 1;
      continue;
    }
    return candidate;
  }

  return null;
}

function clearField(room, reason) {
  const hadElevenBack = room.game.elevenBack;
  room.game.currentCombo = null;
  room.game.lastPlayedBy = null;
  room.game.leadPlayerId = null;
  room.game.lockedSuits = null;
  room.game.passedPlayers = [];
  if (hadElevenBack) {
    room.game.elevenBack = false;
    addAnnouncement(room, "elevenBackOff", "11バック解除", "カードの強さが通常に戻りました。");
  }
  addAction(room, reason, "clear");
}

function isForbiddenFinish(room, combo) {
  if (!room.settings.forbiddenFinishEnabled) {
    return false;
  }

  if (combo.cards.some((card) => card.isJoker)) {
    return true;
  }

  const reversed = getEffectiveReversed(room);
  if (!reversed && includesRank(combo, 15, true)) {
    return true;
  }
  if (reversed && includesRank(combo, 3, true)) {
    return true;
  }

  if (combo.type === "single") {
    const card = combo.cards[0];
    if (!card.isJoker && card.suit === "S" && card.rank === 3 && room.settings.spadeThreeReturnEnabled) {
      return true;
    }
  }

  if (combo.type === "sequence") {
    if (room.settings.stairsEightCutEnabled && includesRank(combo, 8, true)) {
      return true;
    }
  } else if (room.settings.eightCutEnabled && includesRank(combo, 8)) {
    return true;
  }

  return false;
}

function maybeTriggerMiyakoOchi(room, firstFinisherId) {
  if (!room.settings.miyakoOchiEnabled || room.game.finishOrder.length !== 1) {
    return;
  }

  const previousChampionId = room.lastRoundRanking[0];
  if (!previousChampionId || previousChampionId === firstFinisherId) {
    return;
  }

  if (!isPlayerActive(room, previousChampionId)) {
    return;
  }

  const champion = getPlayerById(room, previousChampionId);
  room.game.bottomOrder.push(previousChampionId);
  addAnnouncement(room, "miyakoOchi", "都落ち", `${champion.nickname} が都落ちで最下位扱いになりました。`, previousChampionId);
  addAction(room, `${champion.nickname} が都落ちで脱落しました。`, "miyakoOchi");
}

function finalizeRound(room, overrideRanking = null) {
  const ranking = overrideRanking || [
    ...room.game.finishOrder,
    ...activePlayerIds(room),
    ...room.game.bottomOrder
  ];

  const uniqueRanking = [...new Set(ranking)];
  const endedAt = nowIso();
  const deltas = {};
  const roles = {};

  uniqueRanking.forEach((playerId, index) => {
    deltas[playerId] = POINT_TABLE[index] ?? 0;
    roles[playerId] = ROLE_LABELS[index] || `順位${index + 1}`;
  });

  for (const player of room.players) {
    const index = uniqueRanking.indexOf(player.id);
    if (index === -1) {
      continue;
    }
    player.points += deltas[player.id];
    player.roundsPlayed += 1;
    if (index === 0) {
      player.roundsWon += 1;
    }
    player.lastRoundRank = index + 1;
    player.lastRoundRole = roles[player.id];
  }

  room.lastRoundRanking = uniqueRanking;
  room.lastRoundRoles = roles;
  room.history.unshift({
    roundNumber: room.game.roundNumber,
    endedAt,
    ranking: uniqueRanking.map((playerId, index) => {
      const player = getPlayerById(room, playerId);
      return {
        playerId,
        nickname: player.nickname,
        role: roles[playerId],
        pointDelta: deltas[playerId],
        totalPoints: player.points,
        rank: index + 1
      };
    })
  });
  room.history = room.history.slice(0, 8);

  room.game.status = "round_over";
  room.game.endedAt = endedAt;
  room.game.currentPlayerId = null;
  room.game.currentCombo = null;
  room.game.lastPlayedBy = null;
  room.game.leadPlayerId = null;
  room.game.lockedSuits = null;
  room.game.passedPlayers = [];
  room.game.pendingEffect = null;
  room.game.finalRanking = uniqueRanking;

  addAnnouncement(room, "roundEnd", `Round ${room.game.roundNumber} 終了`, `${getPlayerById(room, uniqueRanking[0]).nickname} がトップでした。`, uniqueRanking[0]);
  addAction(room, `Round ${room.game.roundNumber} が終了しました。`, "roundEnd");
}

function maybeFinalizeBySurvivors(room) {
  const active = activePlayerIds(room);
  if (active.length <= 1) {
    finalizeRound(room);
    return true;
  }
  return false;
}

function maybeTriggerGekokujou(room, firstFinisherId) {
  if (!room.settings.gekokujouEnabled || room.game.finishOrder.length !== 1 || room.lastRoundRanking.length !== 4) {
    return false;
  }

  const previousLastId = room.lastRoundRanking[room.lastRoundRanking.length - 1];
  if (previousLastId !== firstFinisherId) {
    return false;
  }

  const reverseRanking = [...room.lastRoundRanking].reverse();
  addAnnouncement(room, "gekokujou", "下剋上", `${getPlayerById(room, firstFinisherId).nickname} が下剋上を達成しました。`, firstFinisherId);
  addAction(room, `${getPlayerById(room, firstFinisherId).nickname} の下剋上で順位が反転しました。`, "gekokujou");
  finalizeRound(room, reverseRanking);
  return true;
}

function handlePlayerOut(room, playerId, combo) {
  const player = getPlayerById(room, playerId);

  if (isForbiddenFinish(room, combo)) {
    room.game.bottomOrder.push(playerId);
    addAnnouncement(room, "forbiddenFinish", "禁止上がり", `${player.nickname} は禁止上がりで最下位扱いになりました。`, playerId);
    addAction(room, `${player.nickname} は禁止上がりになりました。`, "penalty");
  } else {
    room.game.finishOrder.push(playerId);
    addAnnouncement(room, "finish", `${player.nickname} が上がり`, `${ROLE_LABELS[Math.min(room.game.finishOrder.length - 1, ROLE_LABELS.length - 1)]}候補になりました。`, playerId);
    addAction(room, `${player.nickname} が上がりました。`, "finish");
  }

  if (room.game.finishOrder.length === 1) {
    if (maybeTriggerGekokujou(room, playerId)) {
      return;
    }
    maybeTriggerMiyakoOchi(room, playerId);
  }

  maybeFinalizeBySurvivors(room);
}
function buildPendingQueue(room, playerId, combo) {
  const queue = [];

  if (room.settings.sevenGiveEnabled) {
    const giveCount = countRank(combo, 7);
    if (giveCount > 0) {
      const targetPlayerId = nextActiveAfter(room, playerId, 0);
      if (targetPlayerId && targetPlayerId !== playerId) {
        queue.push({
          type: "give",
          count: giveCount,
          targetPlayerId
        });
      }
    }
  }

  if (room.settings.tenTrashEnabled) {
    const trashCount = countRank(combo, 10);
    if (trashCount > 0) {
      queue.push({
        type: "trash",
        count: trashCount
      });
    }
  }

  return queue;
}

function applyImmediateEffects(room, playerId, combo, previousCombo) {
  let clearNow = false;
  let clearReason = "場が流れました。";
  let skipCount = 0;
  const wasRevolution = room.game.revolution;
  const hadElevenBack = room.game.elevenBack;
  const playerName = getPlayerById(room, playerId).nickname;

  if (room.settings.coupDetatEnabled && combo.type === "set" && combo.rank === 9 && combo.count >= 3) {
    room.game.revolution = !room.game.revolution;
    addAnnouncement(room, "coupDetat", "クーデター", `${playerName} がクーデターで革命を起こしました。`, playerId);
    addAction(room, `${playerName} がクーデターで革命を起こしました。`, "revolution");
  } else if (room.settings.revolutionEnabled && combo.type === "set" && combo.count >= 4) {
    room.game.revolution = !room.game.revolution;
    addAnnouncement(room, "revolution", "革命", `${playerName} が革命を起こしました。`, playerId);
    addAction(room, `${playerName} が革命を起こしました。`, "revolution");
  }

  if (room.settings.stairsRevolutionEnabled && combo.type === "sequence" && combo.count >= 4) {
    room.game.revolution = !room.game.revolution;
    addAnnouncement(room, "stairsRevolution", "階段革命", `${playerName} が階段革命を起こしました。`, playerId);
    addAction(room, `${playerName} が階段革命を起こしました。`, "revolution");
  }

  if (room.settings.elevenBackEnabled && includesRank(combo, 11, true)) {
    room.game.elevenBack = true;
    addAnnouncement(room, "elevenBack", "11バック", `${playerName} が11バックを発動しました。カードの強さが逆転します。`, playerId);
  }

  if (room.settings.sixReturnEnabled && hadElevenBack && includesRank(combo, 6, true)) {
    room.game.elevenBack = false;
    addAnnouncement(room, "sixReturn", "6戻し", `${playerName} が6戻しで11バックを解除しました。`, playerId);
  }

  if (room.settings.nineReverseEnabled && includesRank(combo, 9, true)) {
    room.game.direction *= -1;
    addAnnouncement(room, "direction", "9リバース", `${playerName} が9リバースを発動しました。進行方向が逆転します。`, playerId);
  }

  if (room.settings.queenReverseEnabled && includesRank(combo, 12, true)) {
    room.game.direction *= -1;
    addAnnouncement(room, "direction", "Qリバース", `${playerName} がQリバースを発動しました。進行方向が逆転します。`, playerId);
  }

  if (room.settings.fiveSkipEnabled) {
    skipCount += countRank(combo, 5);
  }

  if (room.settings.kingSkipEnabled) {
    skipCount += countRank(combo, 13);
  }

  if (combo.type === "sequence") {
    if (room.settings.stairsEightCutEnabled && includesRank(combo, 8, true)) {
      clearNow = true;
      clearReason = `${playerName} が階段8切りで場を流しました。`;
      addAnnouncement(room, "eightCut", "階段8切り", "8を含む階段で場が流れました。", playerId);
    }
  } else if (room.settings.eightCutEnabled && includesRank(combo, 8)) {
    clearNow = true;
    clearReason = `${playerName} が8切りで場を流しました。`;
    addAnnouncement(room, "eightCut", "8切り", "8切りで場が流れました。", playerId);
  }

  if (!clearNow && room.settings.fourCutEnabled && includesRank(combo, 4, true)) {
    clearNow = true;
    clearReason = `${playerName} が4切りで場を流しました。`;
    addAnnouncement(room, "fourCut", "4切り", "4を含む組み合わせで場が流れました。", playerId);
  }

  if (!clearNow && room.settings.sandstormEnabled && combo.type === "set" && combo.rank === 3 && combo.count >= 3) {
    clearNow = true;
    clearReason = `${playerName} が砂嵐で場を流しました。`;
    addAnnouncement(room, "sandstorm", "砂嵐", "3を3枚以上そろえて場が流れました。", playerId);
  }

  if (!clearNow && room.settings.queenCarEnabled && combo.type === "set" && combo.rank === 12 && combo.count >= 2) {
    clearNow = true;
    clearReason = `${playerName} がQQ車で場を流しました。`;
    addAnnouncement(room, "queenCar", "QQ車", "Qを2枚以上そろえて場が流れました。", playerId);
  }

  if (!clearNow && room.settings.sixCutEnabled && wasRevolution && includesRank(combo, 6, true)) {
    clearNow = true;
    clearReason = `${playerName} が6切りで場を流しました。`;
    addAnnouncement(room, "sixCut", "6切り", "革命中に6切りで場が流れました。", playerId);
  }

  if (!clearNow && room.settings.ambulanceEnabled && combo.type === "set" && combo.rank === 9 && combo.count >= 2) {
    clearNow = true;
    clearReason = `${playerName} が救急車で場を流しました。`;
    addAnnouncement(room, "ambulance", "救急車", "9を2枚以上そろえて場が流れました。", playerId);
  }

  if (!clearNow && room.settings.rokurokubiEnabled && combo.type === "set" && combo.rank === 6 && combo.count >= 2) {
    clearNow = true;
    clearReason = `${playerName} がろくろ首で場を流しました。`;
    addAnnouncement(room, "rokurokubi", "ろくろ首", "6を2枚以上そろえて場が流れました。", playerId);
  }

  if (shouldLockSuits(room, previousCombo, combo)) {
    room.game.lockedSuits = combo.suitSignature;
    addAnnouncement(room, "suitLock", "スート縛り", `${combo.suitSignature.map((suit) => SUIT_SYMBOLS[suit]).join("")} 縛りになりました。`, playerId);
  }

  return {
    clearNow,
    clearReason,
    skipCount,
    combo
  };
}

function finalizeAfterPlay(room, playerId, resume) {
  if (room.game.status !== "playing") {
    return;
  }

  if (getHand(room, playerId).length === 0) {
    handlePlayerOut(room, playerId, resume.combo);
    if (room.game.status !== "playing") {
      return;
    }
  }

  if (resume.clearNow) {
    clearField(room, resume.clearReason);
    if (isPlayerActive(room, playerId)) {
      room.game.currentPlayerId = playerId;
      room.game.leadPlayerId = playerId;
    } else {
      const next = nextActiveAfter(room, playerId, 0);
      room.game.currentPlayerId = next;
      room.game.leadPlayerId = next;
    }
    return;
  }

  room.game.currentPlayerId = nextActiveAfter(room, playerId, resume.skipCount);
}

function applyPendingSelection(room, playerId, cardIds) {
  const pending = room.game.pendingEffect;
  if (!pending || pending.playerId !== playerId) {
    throw new Error("解決待ちの効果がありません。");
  }

  const current = pending.queue[0];
  if (!current) {
    room.game.pendingEffect = null;
    finalizeAfterPlay(room, playerId, pending.resume);
    return;
  }

  const hand = getHand(room, playerId);
  const expectedCount = Math.min(current.count, hand.length);
  const selectedCards = extractCards(hand, cardIds);
  if (selectedCards.length !== expectedCount) {
    throw new Error(`${expectedCount}枚選択してください。`);
  }

  removeCardsFromHand(room, playerId, selectedCards.map((card) => card.id));

  if (current.type === "give") {
    addCardsToHand(room, current.targetPlayerId, selectedCards);
    addAction(room, `${getPlayerById(room, playerId).nickname} が ${getPlayerById(room, current.targetPlayerId).nickname} に ${selectedCards.length}枚渡しました。`, "effect");
  }

  if (current.type === "trash") {
    addAction(room, `${getPlayerById(room, playerId).nickname} が ${selectedCards.length}枚を10捨てしました。`, "effect");
  }

  pending.queue.shift();

  while (pending.queue.length > 0) {
    const next = pending.queue[0];
    next.count = Math.min(next.count, getHand(room, playerId).length);
    if (next.count > 0) {
      break;
    }
    pending.queue.shift();
  }

  if (pending.queue.length === 0) {
    const resume = pending.resume;
    room.game.pendingEffect = null;
    finalizeAfterPlay(room, playerId, resume);
  }
}

function autoResolvePendingEffects(room, playerId) {
  while (room.game.pendingEffect && room.game.pendingEffect.playerId === playerId) {
    const current = room.game.pendingEffect.queue[0];
    if (!current) {
      const resume = room.game.pendingEffect.resume;
      room.game.pendingEffect = null;
      finalizeAfterPlay(room, playerId, resume);
      return;
    }

    const hand = sortCards(getHand(room, playerId), getEffectiveReversed(room));
    const count = Math.min(current.count, hand.length);
    if (count <= 0) {
      room.game.pendingEffect.queue.shift();
      continue;
    }

    const selection = hand.slice(0, count).map((card) => card.id);
    applyPendingSelection(room, playerId, selection);
  }
}

function internalPlay(room, playerId, cardIds) {
  const hand = getHand(room, playerId);
  const selectedCards = extractCards(hand, cardIds);
  const combo = detectCombo(selectedCards, room.settings);

  if (!combo) {
    throw new Error("その組み合わせは出せません。");
  }

  if (!canBeatCurrent(room, combo)) {
    throw new Error("場に出ているカードを上回っていません。");
  }

  if (room.game.lockedSuits && !matchesLockedSuits(combo, room.game.lockedSuits)) {
    throw new Error("スート縛り中です。");
  }

  const previousCombo = room.game.currentCombo;
  removeCardsFromHand(room, playerId, selectedCards.map((card) => card.id));

  const player = getPlayerById(room, playerId);
  addAction(room, `${player.nickname} が ${comboText(combo)} を出しました。`, "play");

  room.game.currentCombo = combo;
  room.game.recentCombo = combo;
  room.game.recentPlayerId = playerId;
  room.game.lastPlayedBy = playerId;
  room.game.leadPlayerId = playerId;
  room.game.passedPlayers = [];

  const resume = applyImmediateEffects(room, playerId, combo, previousCombo);
  const queue = buildPendingQueue(room, playerId, combo)
    .map((effect) => ({
      ...effect,
      count: Math.min(effect.count, getHand(room, playerId).length)
    }))
    .filter((effect) => effect.count > 0);

  if (queue.length > 0) {
    room.game.pendingEffect = {
      playerId,
      queue,
      resume
    };

    if (player.isBot) {
      autoResolvePendingEffects(room, playerId);
    }
    return;
  }

  finalizeAfterPlay(room, playerId, resume);
}

function internalPass(room, playerId) {
  if (!room.game.currentCombo) {
    throw new Error("場が空なのでパスできません。");
  }

  if (room.game.passedPlayers.includes(playerId)) {
    throw new Error("すでにパスしています。");
  }

  const player = getPlayerById(room, playerId);
  room.game.passedPlayers.push(playerId);
  addAction(room, `${player.nickname} がパスしました。`, "pass");

  const active = activePlayerIds(room);
  const remaining = active.filter(
    (activePlayerId) =>
      activePlayerId !== room.game.lastPlayedBy &&
      !room.game.passedPlayers.includes(activePlayerId)
  );

  if (remaining.length === 0) {
    const lead = room.game.lastPlayedBy;
    clearField(room, "全員パスで場が流れました。");
    if (lead && isPlayerActive(room, lead)) {
      room.game.currentPlayerId = lead;
      room.game.leadPlayerId = lead;
    } else {
      const next = nextActiveAfter(room, playerId, 0);
      room.game.currentPlayerId = next;
      room.game.leadPlayerId = next;
    }
    return;
  }

  room.game.currentPlayerId = nextActiveAfter(room, playerId, 0);
}

function assertCanAct(room, playerId) {
  if (room.game.status !== "playing") {
    throw new Error("現在ゲームは進行していません。");
  }

  if (room.game.currentPlayerId !== playerId) {
    throw new Error("あなたの手番ではありません。");
  }

  if (room.game.pendingEffect) {
    throw new Error("先に特殊効果を解決してください。");
  }
}

function playTurn(room, clientId, cardIds) {
  const player = getPlayerByClientId(room, clientId);
  if (!player) {
    throw new Error("部屋に参加していません。");
  }
  touchPlayer(player);
  assertCanAct(room, player.id);
  internalPlay(room, player.id, cardIds);
}

function passTurn(room, clientId) {
  const player = getPlayerByClientId(room, clientId);
  if (!player) {
    throw new Error("部屋に参加していません。");
  }
  touchPlayer(player);
  assertCanAct(room, player.id);
  internalPass(room, player.id);
}

function resolvePendingEffect(room, clientId, cardIds) {
  const player = getPlayerByClientId(room, clientId);
  if (!player) {
    throw new Error("部屋に参加していません。");
  }
  touchPlayer(player);

  if (!room.game.pendingEffect || room.game.pendingEffect.playerId !== player.id) {
    throw new Error("あなたに割り当てられた特殊効果はありません。");
  }

  applyPendingSelection(room, player.id, cardIds);
}
function generateSetCombos(hand) {
  const jokers = hand.filter((card) => card.isJoker);
  const groups = new Map();
  for (const card of hand.filter((item) => !item.isJoker)) {
    if (!groups.has(card.rank)) {
      groups.set(card.rank, []);
    }
    groups.get(card.rank).push(card);
  }

  const combos = [];
  for (const [, cards] of groups) {
    for (let count = 2; count <= Math.min(4, cards.length + jokers.length); count += 1) {
      const needJokers = Math.max(0, count - cards.length);
      if (needJokers > jokers.length) {
        continue;
      }
      const chosen = [...cards.slice(0, count - needJokers), ...jokers.slice(0, needJokers)];
      combos.push(chosen);
    }
  }

  return combos;
}

function generateSequenceCombos(hand) {
  const bySuit = new Map();
  for (const suit of SUITS) {
    bySuit.set(suit, hand.filter((card) => !card.isJoker && card.suit === suit).sort((a, b) => a.rank - b.rank));
  }

  const combos = [];
  for (const [, cards] of bySuit.entries()) {
    const unique = [];
    const seenRanks = new Set();
    for (const card of cards) {
      if (!seenRanks.has(card.rank)) {
        unique.push(card);
        seenRanks.add(card.rank);
      }
    }

    for (let start = 0; start < unique.length; start += 1) {
      const current = [unique[start]];
      for (let index = start + 1; index < unique.length; index += 1) {
        if (unique[index].rank !== unique[index - 1].rank + 1) {
          break;
        }
        current.push(unique[index]);
        if (current.length >= 3) {
          combos.push([...current]);
        }
      }
    }

    const jokers = hand.filter((card) => card.isJoker);
    if (jokers.length > 0 && unique.length >= 2) {
      for (let index = 0; index < unique.length - 1; index += 1) {
        const left = unique[index];
        const right = unique[index + 1];
        if (right.rank - left.rank === 2) {
          combos.push([left, jokers[0], right]);
        }
      }
    }
  }

  return combos;
}

function generateCandidateSelections(room, playerId) {
  const hand = sortCards(getHand(room, playerId), getEffectiveReversed(room));
  const selections = [];

  for (const card of hand) {
    selections.push([card]);
  }

  for (const cards of generateSetCombos(hand)) {
    selections.push(cards);
  }

  if (room.settings.stairsEnabled) {
    for (const cards of generateSequenceCombos(hand)) {
      selections.push(cards);
    }
  }

  const dedup = new Map();
  for (const cards of selections) {
    const key = cards
      .map((card) => card.id)
      .sort()
      .join("|");
    if (!dedup.has(key)) {
      dedup.set(key, cards);
    }
  }

  return [...dedup.values()];
}

function botScore(room, selection, combo, playerId) {
  const handLength = getHand(room, playerId).length;
  let score = combo.rank * 10 + combo.count * 3;

  if (combo.cards.some((card) => card.isJoker)) {
    score += 50;
  }
  if (includesRank(combo, 8, true)) {
    score += 20;
  }
  if (room.settings.fourCutEnabled && includesRank(combo, 4, true)) {
    score += 16;
  }
  if (room.settings.sandstormEnabled && combo.type === "set" && combo.rank === 3 && combo.count >= 3) {
    score += 28;
  }
  if (room.settings.queenCarEnabled && combo.type === "set" && combo.rank === 12 && combo.count >= 2) {
    score += 18;
  }
  if (room.settings.sixReturnEnabled && room.game.elevenBack && includesRank(combo, 6, true)) {
    score += 14;
  }
  if (handLength === selection.length && !isForbiddenFinish(room, combo)) {
    score -= 100;
  }
  if (combo.type === "sequence") {
    score += 10;
  }
  if (!room.game.currentCombo) {
    score -= combo.count;
  }

  return score;
}

function chooseBotPlay(room, playerId) {
  const candidates = [];

  for (const selection of generateCandidateSelections(room, playerId)) {
    const combo = detectCombo(selection, room.settings);
    if (!combo) {
      continue;
    }
    if (!canBeatCurrent(room, combo)) {
      continue;
    }
    if (room.game.lockedSuits && !matchesLockedSuits(combo, room.game.lockedSuits)) {
      continue;
    }
    if (getHand(room, playerId).length === selection.length && isForbiddenFinish(room, combo)) {
      continue;
    }
    candidates.push({
      cardIds: selection.map((card) => card.id),
      combo,
      score: botScore(room, selection, combo, playerId)
    });
  }

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0] || null;
}

function runBotsUntilHuman(room) {
  while (room.game.status === "playing") {
    if (room.game.pendingEffect) {
      const pendingPlayer = getPlayerById(room, room.game.pendingEffect.playerId);
      if (!pendingPlayer || !pendingPlayer.isBot) {
        return;
      }
      autoResolvePendingEffects(room, pendingPlayer.id);
      continue;
    }

    const current = getPlayerById(room, room.game.currentPlayerId);
    if (!current || !current.isBot) {
      return;
    }

    const choice = chooseBotPlay(room, current.id);
    if (choice) {
      internalPlay(room, current.id, choice.cardIds);
    } else {
      internalPass(room, current.id);
    }
  }
}

function runSingleBotStep(room) {
  if (room.game.status !== "playing") {
    return false;
  }

  if (room.game.pendingEffect) {
    const pendingPlayer = getPlayerById(room, room.game.pendingEffect.playerId);
    if (!pendingPlayer || !pendingPlayer.isBot) {
      return false;
    }
    autoResolvePendingEffects(room, pendingPlayer.id);
    return true;
  }

  const current = getPlayerById(room, room.game.currentPlayerId);
  if (!current || !current.isBot) {
    return false;
  }

  const choice = chooseBotPlay(room, current.id);
  if (choice) {
    internalPlay(room, current.id, choice.cardIds);
  } else {
    internalPass(room, current.id);
  }

  return true;
}

function getPlayerStatus(room, playerId) {
  if (room.game.finishOrder.includes(playerId)) {
    return "finished";
  }
  if (room.game.bottomOrder.includes(playerId)) {
    return "bottom";
  }
  if (room.game.passedPlayers.includes(playerId)) {
    return "passed";
  }
  return "active";
}

function serializeCombo(combo) {
  if (!combo) {
    return null;
  }

  return {
    type: combo.type,
    count: combo.count,
    rank: combo.rank,
    rankLabel: rankLabel(combo.rank),
    text: comboText(combo),
    cards: combo.cards.map((card) => serializeCard(card)),
    suitSignature: combo.suitSignature,
    intervalRanks: combo.intervalRanks,
    lowRank: combo.lowRank || combo.rank,
    highRank: combo.highRank || combo.rank
  };
}

function getPendingView(room) {
  if (!room.game.pendingEffect) {
    return null;
  }

  const current = room.game.pendingEffect.queue[0];
  if (!current) {
    return null;
  }

  const target = current.targetPlayerId ? getPlayerById(room, current.targetPlayerId) : null;
  return {
    type: current.type,
    count: current.count,
    targetPlayerId: current.targetPlayerId || null,
    targetNickname: target ? target.nickname : null
  };
}

function getStateForClient(room, clientId = null) {
  const self = clientId ? getPlayerByClientId(room, clientId) : null;
  const reversed = getEffectiveReversed(room);
  const players = orderedPlayers(room);

  const common = {
    roomId: room.id,
    revision: room.revision,
    hostPlayerId: room.hostPlayerId,
    status: room.game.status,
    roundNumber: room.game.roundNumber,
    createdAt: room.createdAt,
    settings: room.settings,
    history: room.history,
    players: players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      seat: player.seat,
      isBot: player.isBot,
      points: player.points,
      roundsWon: player.roundsWon,
      roundsPlayed: player.roundsPlayed,
      lastRoundRank: player.lastRoundRank,
      lastRoundRole: player.lastRoundRole,
      handCount: getHand(room, player.id).length,
      isCurrent: room.game.currentPlayerId === player.id,
      status: getPlayerStatus(room, player.id)
    })),
    game: {
      status: room.game.status,
      roundNumber: room.game.roundNumber,
      currentPlayerId: room.game.currentPlayerId,
      currentCombo: serializeCombo(room.game.currentCombo),
      recentCombo: serializeCombo(room.game.recentCombo),
      recentPlayerId: room.game.recentPlayerId,
      direction: room.game.direction,
      revolution: room.game.revolution,
      elevenBack: room.game.elevenBack,
      effectiveReversed: reversed,
      lockedSuits: room.game.lockedSuits,
      passedPlayers: room.game.passedPlayers,
      finishOrder: room.game.finishOrder,
      bottomOrder: room.game.bottomOrder,
      finalRanking: room.game.finalRanking,
      actionLog: room.game.actionLog,
      announcements: room.game.announcements
    },
    joinLocked: roomLocked(room)
  };

  if (!self) {
    return {
      ...common,
      requiresJoin: true,
      joinedHumans: players.filter((player) => !player.isBot).length
    };
  }

  const pending = room.game.pendingEffect && room.game.pendingEffect.playerId === self.id ? getPendingView(room) : null;

  return {
    ...common,
    requiresJoin: false,
    self: {
      id: self.id,
      nickname: self.nickname,
      seat: self.seat,
      isHost: room.hostPlayerId === self.id,
      points: self.points,
      hand: sortCards(getHand(room, self.id), reversed).map((card) => serializeCard(card))
    },
    permissions: {
      canStart: room.game.status !== "playing",
      canEditSettings: room.hostPlayerId === self.id && room.game.status !== "playing",
      canPlay: room.game.status === "playing" && room.game.currentPlayerId === self.id && !room.game.pendingEffect,
      canPass: room.game.status === "playing" && room.game.currentPlayerId === self.id && !room.game.pendingEffect && Boolean(room.game.currentCombo),
      canResolvePending: Boolean(pending)
    },
    pendingEffect: pending
  };
}

module.exports = {
  createRoom,
  getStateForClient,
  joinRoom,
  normalizeNickname,
  passTurn,
  playTurn,
  resolvePendingEffect,
  runSingleBotStep,
  runBotsUntilHuman,
  startRound,
  updateSettings
};

