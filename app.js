const root = document.getElementById("app");
const flashLayer = document.getElementById("flash-layer");

const state = {
  clientId: getOrCreateClientId(),
  roomId: getRoomIdFromUrl(),
  room: null,
  selected: new Set(),
  pendingSelected: new Set(),
  message: "",
  loading: false,
  polling: null,
  activeModal: "",
  messageTimer: null,
  playBurst: null,
  playBurstTimer: null,
  clearBurst: null,
  clearBurstTimer: null,
  botAdvanceTimer: null,
  botAdvancing: false
};

const LOCKED_ACTIONS = new Set([
  "create-room",
  "join-room",
  "jump-room",
  "start-round",
  "play-selected",
  "pass",
  "resolve-effect",
  "refresh-room",
  "copy-link",
  "update-rule"
]);

const BOT_ACTION_DELAY_MS = 900;

const CARD_RANK_LABELS = { 3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K",14:"A",15:"2",16:"JK" };
const SUIT_MARKS = { S:"\u2660", H:"\u2665", D:"\u2666", C:"\u2663", J:"\u2605" };

const RULE_COPY = {
  stairsEnabled:{label:"階段",category:"基本",description:"連番の組み合わせを出せます。"},
  revolutionEnabled:{label:"革命",category:"基本",description:"4枚出しで強さの順序が反転します。"},
  stairsRevolutionEnabled:{label:"階段革命",category:"基本",description:"長い階段でも革命が発生します。"},
  eightCutEnabled:{label:"8切り",category:"基本",description:"8を出すと場を流します。"},
  stairsEightCutEnabled:{label:"階段8切り",category:"基本",description:"8を含む階段でも場を流します。"},
  suitLockEnabled:{label:"しばり",category:"基本",description:"同じスートが続くと場がしばられます。"},
  spadeThreeReturnEnabled:{label:"スペ3返し",category:"基本",description:"スペード3でジョーカーに返せます。"},
  forbiddenFinishEnabled:{label:"禁止上がり",category:"上がり",description:"特定のカードでは上がれません。"},
  miyakoOchiEnabled:{label:"都落ち",category:"上がり",description:"前回の勝者が最下位に落ちることがあります。"},
  gekokujouEnabled:{label:"下克上",category:"上がり",description:"番狂わせで順位が入れ替わることがあります。"},
  elevenBackEnabled:{label:"11バック",category:"特殊",description:"Jを出すと一時的に強さが反転します。"},
  fiveSkipEnabled:{label:"5スキップ",category:"特殊",description:"5を出すと次の手番を飛ばします。"},
  sevenGiveEnabled:{label:"7渡し",category:"特殊",description:"7を出すとカードを渡します。"},
  tenTrashEnabled:{label:"10捨て",category:"特殊",description:"10を出すと手札を捨てられます。"},
  nineReverseEnabled:{label:"9リバース",category:"特殊",description:"9を出すと手番順が反転します。"},
  queenReverseEnabled:{label:"Qリバース",category:"特殊",description:"Qを出すと手番順が反転します。"},
  kingSkipEnabled:{label:"Kスキップ",category:"特殊",description:"Kを出すと次の手番を飛ばします。"},
  ambulanceEnabled:{label:"救急車",category:"特殊",description:"9に関する特殊な流しルールです。"},
  rokurokubiEnabled:{label:"ろくろ首",category:"特殊",description:"6に関する特殊な流しルールです。"},
  fourCutEnabled:{label:"4切り",category:"特殊",description:"4に関する特殊な流しルールです。"},
  sandstormEnabled:{label:"砂嵐",category:"特殊",description:"3が3枚そろうと場を流します。"},
  queenCarEnabled:{label:"QQカー",category:"特殊",description:"Qのペアで場を流します。"},
  coupDetatEnabled:{label:"クーデター",category:"特殊",description:"特殊条件で革命が発生します。"},
  sixCutEnabled:{label:"6切り",category:"特殊",description:"革命中に6で場を流します。"},
  sixReturnEnabled:{label:"6戻し",category:"特殊",description:"6で11バックを打ち消せます。"},
  jokerCount:{label:"ジョーカー枚数",category:"準備",description:"山札に入るジョーカーの枚数です。"},
  starterRule:{label:"開始プレイヤー",category:"準備",description:"ラウンド開始時の最初の手番を決めます。"}
};

const RULE_OPTIONS = {
  jokerCount: [
    { value: 0, label: "0" },
    { value: 1, label: "1" },
    { value: 2, label: "2" }
  ],
  starterRule: [
    { value: "diamond3", label: "ダイヤ3所持者" },
    { value: "spade3", label: "スペード3所持者" },
    { value: "club3", label: "クラブ3所持者" },
    { value: "heart3", label: "ハート3所持者" },
    { value: "lastPlace", label: "前回最下位" },
    { value: "random", label: "ランダム" }
  ]
};

function getOrCreateClientId() {
  const key = "daifugo-client-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

function getSavedNickname() {
  return localStorage.getItem("daifugo-nickname") || "";
}

function saveNickname(value) {
  localStorage.setItem("daifugo-nickname", value);
}

function getRoomIdFromUrl() {
  return new URLSearchParams(window.location.search).get("room")?.toUpperCase() || "";
}

function setRoomId(roomId) {
  state.roomId = roomId;
  if (!roomId) {
    clearBotAdvanceTimer();
  }
  const url = new URL(window.location.href);
  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }
  history.replaceState({}, "", url);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeErrorMessage(message) {
  const text = String(message || "");
  if (!text) return "エラーが発生しました。";
  if (text.includes("UPSTASH_REDIS") || text.includes("Persistent Redis storage")) return "Redis の設定を確認してください。";
  if (text.includes("Room not found")) return "ルームが見つかりません。";
  if (text.includes("roomId is required")) return "ルームIDが必要です。";
  if (text.includes("roomId and clientId are required")) return "ルームIDとクライアントIDが必要です。";
  if (text.includes("clientId is required")) return "クライアントIDが必要です。";
  if (text.includes("Method not allowed")) return "許可されていない操作です。";
  return text;
}

async function api(path, body = null, method = "POST") {
  const options = { method, headers: {} };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(normalizeErrorMessage(payload.error || "エラーが発生しました。"));
  return payload;
}

function showMessage(message, { autoHide = true } = {}) {
  state.message = message;
  clearTimeout(state.messageTimer);
  state.messageTimer = null;
  render();
  if (!message || !autoHide) return;
  state.messageTimer = setTimeout(() => {
    state.message = "";
    state.messageTimer = null;
    render();
  }, 2200);
}

function clearSelections() {
  state.selected.clear();
  state.pendingSelected.clear();
}

function arrayEquals(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function makeRankCounts(cards) {
  const counts = {};
  for (const card of cards) {
    if (card.isJoker) continue;
    counts[card.rank] = (counts[card.rank] || 0) + 1;
  }
  return counts;
}

function detectSingle(cards) {
  if (cards.length !== 1) return null;
  const card = cards[0];
  return {
    type: 'single',
    count: 1,
    rank: card.rank,
    cards: [...cards],
    actualRanks: card.isJoker ? [] : [card.rank],
    intervalRanks: card.isJoker ? [] : [card.rank],
    suitSignature: card.isJoker ? null : [card.suit],
    rankCounts: makeRankCounts(cards)
  };
}

function detectSet(cards) {
  if (cards.length < 2) return null;
  const nonJokers = cards.filter((card) => !card.isJoker);
  if (!nonJokers.length) return null;
  const rank = nonJokers[0].rank;
  if (!nonJokers.every((card) => card.rank === rank)) return null;
  return {
    type: 'set',
    count: cards.length,
    rank,
    cards: [...cards],
    actualRanks: nonJokers.map((card) => card.rank),
    intervalRanks: [rank],
    suitSignature: cards.some((card) => card.isJoker) ? null : [...cards].map((card) => card.suit).sort(),
    rankCounts: makeRankCounts(cards)
  };
}

function detectSequence(cards) {
  if (cards.length < 3) return null;
  const nonJokers = cards.filter((card) => !card.isJoker);
  if (!nonJokers.length) return null;
  const suit = nonJokers[0].suit;
  if (!nonJokers.every((card) => card.suit === suit)) return null;
  const ranks = [...new Set(nonJokers.map((card) => card.rank).sort((a, b) => a - b))];
  if (ranks.length !== nonJokers.length) return null;
  const start = ranks[0];
  const end = start + cards.length - 1;
  if (end > 15) return null;
  if (!ranks.every((rank) => rank >= start && rank <= end)) return null;
  const jokerCount = cards.length - nonJokers.length;
  const missing = end - start + 1 - nonJokers.length;
  if (missing !== jokerCount) return null;
  const intervalRanks = [];
  for (let rank = start; rank <= end; rank += 1) intervalRanks.push(rank);
  return {
    type: 'sequence',
    count: cards.length,
    rank: end,
    lowRank: start,
    highRank: end,
    cards: [...cards],
    actualRanks: nonJokers.map((card) => card.rank),
    intervalRanks,
    suitSignature: [suit],
    rankCounts: makeRankCounts(cards)
  };
}

function detectLocalCombo(cards, settings) {
  return (
    detectSingle(cards) ||
    (settings?.stairsEnabled ? detectSequence(cards) : null) ||
    detectSet(cards) ||
    null
  );
}

function matchesLockedSuits(combo, lockedSuits) {
  if (!lockedSuits) return true;
  return arrayEquals(combo.suitSignature, lockedSuits);
}

function compareRanks(rankA, rankB, reversed) {
  const normalOrder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const revolutionOrder = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 16];
  const order = reversed ? revolutionOrder : normalOrder;
  return order.indexOf(rankA) - order.indexOf(rankB);
}

function canBeatCurrentCombo(room, combo) {
  const current = room?.game?.currentCombo;
  if (!current) return true;

  const card = combo.cards[0];
  const spadeThreeReturn =
    current.type === 'single' &&
    current.rank === 16 &&
    combo.type === 'single' &&
    room?.settings?.spadeThreeReturnEnabled &&
    card &&
    !card.isJoker &&
    card.suit === 'S' &&
    card.rank === 3;
  if (spadeThreeReturn) return true;

  const sandstorm =
    room?.settings?.sandstormEnabled &&
    combo.type === 'set' &&
    combo.rank === 3 &&
    combo.count >= 3;
  if (sandstorm) return true;

  if (current.type !== combo.type || current.count !== combo.count) return false;
  if (!matchesLockedSuits(combo, room?.game?.lockedSuits)) return false;
  if (current.type === 'single' && current.rank === 16) return false;

  return compareRanks(combo.rank, current.rank, Boolean(room?.game?.effectiveReversed)) > 0;
}

function validateSelectedPlay() {
  const room = state.room;
  const selectedIds = [...state.selected];
  if (!room?.permissions?.canPlay) {
    return { ok: false, message: '今はカードを出せません。' };
  }
  if (!selectedIds.length) {
    return { ok: false, message: 'カードを選択してください。' };
  }

  const lookup = new Map((room.self?.hand || []).map((card) => [card.id, card]));
  const cards = [];
  for (const cardId of selectedIds) {
    const card = lookup.get(cardId);
    if (!card) {
      return { ok: false, message: '手札にないカードが選択されています。' };
    }
    cards.push(card);
  }

  const combo = detectLocalCombo(cards, room.settings || {});
  if (!combo) {
    return { ok: false, message: 'その組み合わせでは出せません。' };
  }
  if (!canBeatCurrentCombo(room, combo)) {
    return { ok: false, message: '場に勝てる組み合わせではありません。' };
  }
  if (room.game?.lockedSuits && !matchesLockedSuits(combo, room.game.lockedSuits)) {
    return { ok: false, message: 'しばりのスートに合っていません。' };
  }
  return { ok: true };
}

function isUiLocked() {
  return Boolean(state.loading || state.botAdvancing);
}

function openModal(modal) {
  state.activeModal = modal;
  render();
}

function closeModal() {
  state.activeModal = "";
  render();
}

function normalizeSelectionAgainstHand() {
  const handIds = new Set(state.room?.self?.hand?.map((card) => card.id) || []);
  state.selected = new Set([...state.selected].filter((cardId) => handIds.has(cardId)));
  state.pendingSelected = new Set([...state.pendingSelected].filter((cardId) => handIds.has(cardId)));
}

function relativeSeatClass(player) {
  const selfSeat = state.room?.self?.seat;
  const diff = selfSeat === undefined ? player.seat : (player.seat - selfSeat + 4) % 4;
  return { 0: "south", 1: "east", 2: "north", 3: "west" }[diff] || "south";
}
function relativeSeatLabel(player) {
  return {
    south: "\u3042\u306a\u305f",
    east: "\u53f3\u5074",
    north: "\u6b63\u9762",
    west: "\u5de6\u5074"
  }[relativeSeatClass(player)] || "\u5353\u4e0a";
}
function cardRankLabel(card) {
  return card.isJoker ? "JK" : CARD_RANK_LABELS[card.rank] || String(card.rank || "");
}

function cardSuitLabel(card) {
  return card.isJoker ? "\u2605" : SUIT_MARKS[card.suit] || "";
}

function formatTime(value) {
  try {
    return value ? new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  } catch {
    return "--:--";
  }
}

function formatPointDelta(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `+${amount}点` : `${amount}点`;
}

function getRuleMeta(key, value) {
  const copy = RULE_COPY[key] || {};
  const type = typeof value === "boolean" ? "boolean" : "select";
  return {
    key,
    value,
    type,
    label: copy.label || key,
    category: copy.category || "その他",
    description: copy.description || "",
    options: RULE_OPTIONS[key] || []
  };
}

function localizePlayerStatus(status) {
  return {
    passed: "パス",
    finished: "上がり",
    bottom: "最下位"
  }[status] || status || "";
}

function localizePendingType(type) {
  return {
    give: "渡し",
    trash: "捨て札",
    effect: "効果"
  }[type] || type || "効果";
}

function localizeResultRole(role, rank) {
  const text = String(role || "").trim();
  if (!text) return `第${rank || "-"}位`;
  if (/^Rank\s+\d+$/i.test(text)) {
    return `第${rank || text.replace(/\D+/g, "")}位`;
  }
  return {
    Daifugo: "大富豪",
    Fugo: "富豪",
    Heimin: "平民",
    Hinmin: "貧民",
    Daihinmin: "大貧民"
  }[text] || text;
}

function comboSignature(combo) {
  if (!combo?.cards?.length) return "";
  return combo.cards.map((card) => card.id || `${card.suit || "J"}-${card.rank || 0}-${card.isJoker ? 1 : 0}`).join("|");
}

function latestActionOfKind(room, kind) {
  const actions = room?.game?.actionLog || [];
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (actions[index]?.kind === kind) {
      return actions[index];
    }
  }
  return null;
}

function clearPlayBurst({ rerender = true } = {}) {
  if (state.playBurstTimer) {
    clearTimeout(state.playBurstTimer);
    state.playBurstTimer = null;
  }
  if (!state.playBurst) return;
  state.playBurst = null;
  if (!rerender) return;
  if (state.room && state.room.status !== "round_over") {
    render({ patchBoard: true });
    return;
  }
  render();
}

function clearClearBurst({ rerender = true } = {}) {
  if (state.clearBurstTimer) {
    clearTimeout(state.clearBurstTimer);
    state.clearBurstTimer = null;
  }
  if (!state.clearBurst) return;
  state.clearBurst = null;
  if (!rerender) return;
  if (state.room && state.room.status !== "round_over") {
    render({ patchBoard: true });
    return;
  }
  render();
}

function clearBotAdvanceTimer() {
  if (!state.botAdvanceTimer) return;
  clearTimeout(state.botAdvanceTimer);
  state.botAdvanceTimer = null;
}

function triggerPlayBurst(cards) {
  const burstCards = (cards || []).slice(0, 5).map((card) => ({ ...card }));
  if (!burstCards.length) return;
  clearPlayBurst({ rerender: false });
  state.playBurst = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cards: burstCards
  };
  state.playBurstTimer = setTimeout(() => {
    clearPlayBurst();
  }, 980);
}

function triggerClearBurst(reason, cards) {
  const burstCards = (cards || []).slice(0, 5).map((card) => ({ ...card }));
  clearClearBurst({ rerender: false });
  state.clearBurst = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    reason: String(reason || "場が流れました。"),
    cards: burstCards
  };
  state.clearBurstTimer = setTimeout(() => {
    clearClearBurst();
  }, 1500);
}

function maybeTriggerPlayBurst(previousRoom, nextRoom) {
  if (!previousRoom || previousRoom.status !== "playing" || nextRoom?.status !== "playing") {
    return;
  }
  if ((previousRoom.game?.roundNumber || 0) !== (nextRoom.game?.roundNumber || 0)) {
    return;
  }
  const previousSignature = comboSignature(previousRoom.game?.currentCombo);
  const nextCombo = nextRoom.game?.currentCombo;
  const nextSignature = comboSignature(nextCombo);
  if (!nextSignature || previousSignature === nextSignature) {
    return;
  }
  triggerPlayBurst(nextCombo.cards || []);
}

function maybeTriggerClearBurst(previousRoom, nextRoom) {
  if (!previousRoom || previousRoom.status !== "playing" || nextRoom?.status !== "playing") {
    return;
  }
  const previousClear = latestActionOfKind(previousRoom, "clear");
  const nextClear = latestActionOfKind(nextRoom, "clear");
  if (!nextClear || nextClear.id === previousClear?.id) {
    return;
  }
  const cards = previousRoom.game?.currentCombo?.cards || nextRoom.game?.recentCombo?.cards || [];
  triggerClearBurst(nextClear.text, cards);
}

function shouldAdvanceBotTurn(room = state.room) {
  const current = getCurrentPlayer(room);
  return Boolean(
    room &&
    room.status === "playing" &&
    room.self?.isHost &&
    !room.requiresJoin &&
    !room.pendingEffect &&
    current?.isBot &&
    !state.botAdvancing
  );
}

async function advanceBotTurn() {
  if (state.loading || !shouldAdvanceBotTurn()) {
    return;
  }

  state.botAdvancing = true;
  render({ patchBoard: true });

  let failed = false;
  try {
    const payload = await api("/api/advance-bot", { roomId: state.roomId, clientId: state.clientId });
    setRoomState(payload.state);
  } catch (error) {
    failed = true;
    showMessage(error.message || "BOT \u306e\u9032\u884c\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002", { autoHide: false });
  } finally {
    state.botAdvancing = false;
    render({ patchBoard: true });
    if (!failed) {
      queueBotAdvance();
    }
  }
}

function queueBotAdvance(room = state.room) {
  clearBotAdvanceTimer();
  if (!shouldAdvanceBotTurn(room)) {
    return;
  }

  state.botAdvanceTimer = setTimeout(() => {
    advanceBotTurn();
  }, BOT_ACTION_DELAY_MS);
}

function setRoomState(nextRoom) {
  maybeTriggerPlayBurst(state.room, nextRoom);
  maybeTriggerClearBurst(state.room, nextRoom);
  if (nextRoom?.status === "round_over" || !nextRoom) {
    clearPlayBurst({ rerender: false });
    clearClearBurst({ rerender: false });
  }
  state.room = nextRoom;
  normalizeSelectionAgainstHand();
  if (!nextRoom?.permissions?.canPlay) {
    state.selected.clear();
  }
  if (!nextRoom?.permissions?.canResolvePending) {
    state.pendingSelected.clear();
  }
  queueBotAdvance(nextRoom);
  return true;
}
function getPlayerMap(room = state.room) {
  return new Map((room?.players || []).map((player) => [player.id, player]));
}

function getCurrentPlayer(room = state.room) {
  const players = getPlayerMap(room);
  return players.get(room?.game?.currentPlayerId) || null;
}

function getVisibleCombo(room = state.room) {
  return room?.game?.currentCombo || room?.game?.recentCombo || null;
}

function getRoomLink() {
  const url = new URL(window.location.href);
  if (state.roomId) url.searchParams.set("room", state.roomId);
  return url.toString();
}

function renderToast() {
  return state.message ? `<div class="toast">${escapeHtml(state.message)}</div>` : "";
}

function renderPlayingCard(card, opts = {}) {
  const {
    interactive = false,
    action = "",
    cardId = "",
    selected = false,
    disabled = false,
    compact = false,
    className = "",
    style = ""
  } = opts;
  const tag = interactive ? "button" : "div";
  const classes = [
    interactive ? "card-button" : "mini-card",
    "playing-card",
    card.suitName,
    card.isJoker ? "joker" : "",
    compact ? "compact" : "",
    selected ? "selected" : "",
    className
  ].filter(Boolean).join(" ");
  const attrs = [
    `class="${classes}"`,
    style ? `style="${escapeHtml(style)}"` : "",
    interactive && action ? `data-action="${escapeHtml(action)}"` : "",
    interactive && cardId ? `data-card-id="${escapeHtml(cardId)}"` : "",
    interactive && disabled ? "disabled" : ""
  ].filter(Boolean).join(" ");
  const rank = cardRankLabel(card);
  const suit = cardSuitLabel(card);
  return `<${tag} ${attrs}><span class="card-sheen"></span><span class="card-corner top"><span class="card-rank">${escapeHtml(rank)}</span><span class="card-suit">${escapeHtml(suit)}</span></span><span class="card-center ${card.isJoker ? "joker" : ""}"><span class="card-center-mark">${escapeHtml(card.isJoker ? "★" : suit)}</span><span class="card-center-label">${escapeHtml(card.isJoker ? "ジョーカー" : rank)}</span></span><span class="card-corner bottom"><span class="card-rank">${escapeHtml(rank)}</span><span class="card-suit">${escapeHtml(suit)}</span></span></${tag}>`;
}

function renderPortrait(player) {
  const initials = String(player.nickname || (player.isBot ? "代打" : "参加者")).slice(0, 2);
  return `<div class="avatar-frame ${player.isBot ? "bot" : "human"}"><div class="avatar-art"><span class="avatar-feather" aria-hidden="true"></span><span class="avatar-sigil">${escapeHtml(initials)}</span><span class="avatar-shadow head"></span><span class="avatar-shadow body"></span></div></div>`;
}



function renderLoading() {
  return `<section class="landing-screen loading-screen"><article class="gilded-panel landing-card loading-card"><div class="crest-label">大富豪オンライン</div><h1 class="landing-title">ルームを読み込み中</h1><p class="landing-copy">最新の卓状態を取得しています。</p>${renderToast()}</article></section>`;
}
function renderLanding() {
  return `<section class="landing-screen"><article class="gilded-panel landing-card"><div class="crest-label">大富豪オンライン</div><h1 class="landing-title">大富豪アリーナ</h1><p class="landing-copy">ルームを作成するか、ルームコードで参加してください。</p>${renderToast()}<label class="field-block"><span class="field-label">名前</span><input id="nickname-input" class="input" maxlength="20" placeholder="名前を入力" value="${escapeHtml(getSavedNickname())}" /></label><div class="landing-actions"><section class="option-panel primary"><strong>ルームを作成</strong><p>新しい卓を開いて招待できます。</p><button class="button primary setup-button" data-action="create-room">ルーム作成</button></section><section class="option-panel secondary"><strong>コードで参加</strong><input id="room-code-input" class="input" maxlength="6" placeholder="6文字コード" /><button class="button secondary setup-button" data-action="jump-room">ルームを開く</button></section></div></article></section>`;
}

function renderPlayerSummary(player) {
  return `<article class="player-summary-card"><div class="player-summary-main"><div class="player-summary-rank">${escapeHtml((player.lastRoundRank || player.seat + 1).toString())}</div><div><strong>${escapeHtml(player.nickname)}</strong><div class="mini-copy">${player.isBot ? "自動" : "参加者"}${player.status ? ` | ${escapeHtml(localizePlayerStatus(player.status))}` : ""}</div></div></div><div class="points-chip">${escapeHtml(String(player.points || 0))}点</div></article>`;
}

function renderHistory(room) {
  const items = room.history || [];
  if (!items.length) {
    return `<div class="empty-state">まだラウンド履歴はありません。</div>`;
  }
  return `<div class="menu-history-list">${items.map((entry) => `<article class="history-card"><div class="history-card-head"><strong>第${escapeHtml(String(entry.roundNumber || 0))}ラウンド</strong><span>${escapeHtml(formatTime(entry.endedAt))}</span></div><div class="history-lines">${(entry.ranking || []).map((item) => `<div class="history-line"><strong>${escapeHtml(String(item.rank || "-"))}位 ${escapeHtml(item.nickname || "-")}</strong><span>${escapeHtml(formatPointDelta(item.pointDelta || 0))}</span></div>`).join("")}</div></article>`).join("")}</div>`;
}

function renderFeed(room) {
  if (!room.roundNumber) {
    return "";
  }
  return `<div class="feed-panel"><div class="feed-row"><div class="feed-meta">進行中</div><div class="feed-message">第${escapeHtml(String(room.roundNumber || 0))}ラウンド開始</div></div></div>`;
}

function getTurnUiState(room) {
  const currentPlayer = getCurrentPlayer(room);
  const selfId = room.self?.id;
  const isPlaying = room.status === "playing";
  const isPending = Boolean(room.pendingEffect);
  const isSelfTurn = Boolean(currentPlayer?.id) && currentPlayer.id === selfId;
  const seatLabel = currentPlayer ? relativeSeatLabel(currentPlayer) : "";
  const playerName = currentPlayer?.nickname || "\u53c2\u52a0\u8005";

  if (!isPlaying) {
    return {
      tone: "idle",
      compact: "\u958b\u59cb\u5f85\u3061",
      eyebrow: "\u6b21\u306e\u624b\u756a",
      headline: "\u30e9\u30a6\u30f3\u30c9\u958b\u59cb\u5f85\u3061",
      detail: "\u30db\u30b9\u30c8\u306e\u958b\u59cb\u5f85\u3061\u3067\u3059\u3002",
      seatLabel: "",
      playerName,
      currentPlayer: null
    };
  }

  if (!currentPlayer) {
    return {
      tone: "idle",
      compact: "\u540c\u671f\u4e2d",
      eyebrow: "\u73fe\u5728\u306e\u624b\u756a",
      headline: "\u624b\u756a\u3092\u540c\u671f\u4e2d",
      detail: "\u6700\u65b0\u72b6\u614b\u3092\u53d6\u5f97\u3057\u3066\u3044\u307e\u3059\u3002",
      seatLabel: "",
      playerName,
      currentPlayer: null
    };
  }

  if (isPending) {
    const pendingLabel = localizePendingType(room.pendingEffect?.type || "effect");
    return {
      tone: isSelfTurn ? "self" : "watch",
      compact: isSelfTurn ? `${pendingLabel}\u3092\u9078\u629e` : `${playerName}\u304c\u51e6\u7406\u4e2d`,
      eyebrow: "\u73fe\u5728\u306e\u624b\u756a",
      headline: isSelfTurn ? "\u3042\u306a\u305f\u306e\u8ffd\u52a0\u51e6\u7406\u3067\u3059" : `${playerName}\u304c\u52b9\u679c\u3092\u51e6\u7406\u4e2d`,
      detail: isSelfTurn ? "\u5fc5\u8981\u306a\u30ab\u30fc\u30c9\u3092\u9078\u3093\u3067\u7d9a\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002" : "\u7279\u6b8a\u52b9\u679c\u306e\u89e3\u6c7a\u304c\u7d42\u308f\u308b\u307e\u3067\u5f85\u6a5f\u3057\u307e\u3059\u3002",
      seatLabel,
      playerName,
      currentPlayer
    };
  }

  if (isSelfTurn) {
    return {
      tone: "self",
      compact: "\u3042\u306a\u305f\u306e\u756a",
      eyebrow: "\u73fe\u5728\u306e\u624b\u756a",
      headline: "\u3042\u306a\u305f\u306e\u756a\u3067\u3059",
      detail: room.game?.currentCombo ? "\u51fa\u3059\u30ab\u30fc\u30c9\u3092\u9078\u3076\u304b\u3001\u30d1\u30b9\u3057\u3066\u304f\u3060\u3055\u3044\u3002" : "\u5834\u304c\u7a7a\u3067\u3059\u3002\u597d\u304d\u306a\u7d44\u307f\u5408\u308f\u305b\u304b\u3089\u59cb\u3081\u3089\u308c\u307e\u3059\u3002",
      seatLabel,
      playerName,
      currentPlayer
    };
  }

  return {
    tone: "watch",
    compact: `${playerName}\u5f85\u3061`,
    eyebrow: "\u73fe\u5728\u306e\u624b\u756a",
    headline: `${playerName}\u306e\u756a\u3067\u3059`,
    detail: currentPlayer?.isBot ? `${seatLabel}\u306e BOT \u304c\u30ab\u30fc\u30c9\u3092\u51fa\u3057\u307e\u3059\u3002` : `${seatLabel}\u306e\u30d7\u30ec\u30a4\u3092\u5f85\u3063\u3066\u3044\u307e\u3059\u3002`,
    seatLabel,
    playerName,
    currentPlayer
  };
}

function renderSeatHand(player) {
  const total = Math.max(0, Number(player.handCount || 0));
  if (!total) return "";
  const visible = Math.max(1, Math.min(7, total));
  return `<div class="seat-hand" style="--hand-total:${visible}">${Array.from({ length: visible }).map((_, index) => `<span class="seat-hand-card" style="--hand-index:${index}"></span>`).join("")}</div>`;
}

function renderSeatCard(player) {
  const seatClass = relativeSeatClass(player);
  const badges = [];
  if (player.status === "passed") badges.push(`<span class="status-badge dim">パス</span>`);
  if (player.status === "finished") badges.push(`<span class="status-badge good">上がり</span>`);
  if (player.status === "bottom") badges.push(`<span class="status-badge warn">最下位</span>`);
  const positionBadge = player.lastRoundRank ? `<span class="seat-position">${escapeHtml(String(player.lastRoundRank))}</span>` : "";
  const stateRow = badges.length ? `<div class="seat-state-row">${badges.join("")}</div>` : "";
  return `<article class="seat-card ${seatClass} ${player.isCurrent ? "current" : ""}" data-player-id="${escapeHtml(player.id || "")}"><div class="seat-nameplate">${escapeHtml(player.nickname || "参加者")}</div><div class="seat-visual">${renderSeatHand(player)}<div class="seat-avatar-wrap">${renderPortrait(player)}${positionBadge}<span class="seat-hand-count">${escapeHtml(String(player.handCount || 0))}</span></div></div>${stateRow}</article>`;
}

function renderPile(room) {
  const combo = room.game?.currentCombo;
  const visibleCombo = getVisibleCombo(room);
  if (!visibleCombo) {
    return `<div class="pile-display"><p class="pile-empty">\u5834\u304c\u7a7a\u3067\u3059</p></div>`;
  }

  const cards = visibleCombo.cards || [];
  const isRemembered = !combo;
  const recentPlayer = getPlayerMap(room).get(room.game?.recentPlayerId) || null;
  const ownerText = recentPlayer ? `${recentPlayer.nickname}${recentPlayer.isBot ? " | BOT" : ""}` : "";
  const label = isRemembered ? "\u76f4\u524d\u306b\u51fa\u305f\u30ab\u30fc\u30c9" : "\u5834\u306e\u30ab\u30fc\u30c9";
  const summary = visibleCombo.text || "";

  return `<div class="pile-display ${isRemembered ? "remembered" : ""}"><div class="pile-caption"><span class="pile-label">${escapeHtml(label)}</span>${ownerText ? `<span class="pile-owner">${escapeHtml(ownerText)}</span>` : ""}</div>${summary ? `<div class="pile-summary">${escapeHtml(summary)}</div>` : ""}<div class="pile-cards ${combo && cards.length ? "live" : ""} ${isRemembered ? "remembered" : ""}">${cards.map((card, index) => renderPlayingCard(card, { compact: true, className: "pile-card", style: `--pile-index:${index}; --pile-tilt:${(index - ((cards.length - 1) / 2)) * 5}deg` })).join("")}</div></div>`;
}

function getConstraintBadges(room) {
  const badges = [];
  const lockedSuits = room.game?.lockedSuits;
  if (Array.isArray(lockedSuits) && lockedSuits.length) {
    badges.push({
      tone: "suit",
      label: `マーク ${lockedSuits.map((suit) => SUIT_MARKS[suit] || suit).join("")}`
    });
  }

  const combo = room.game?.currentCombo;
  if (combo) {
    const numberLabel = combo.type === "sequence"
      ? `${CARD_RANK_LABELS[combo.lowRank] || String(combo.lowRank || "")}-${CARD_RANK_LABELS[combo.highRank] || String(combo.highRank || "")}`
      : `${combo.rankLabel || CARD_RANK_LABELS[combo.rank] || String(combo.rank || "")}${combo.count > 1 ? ` x${combo.count}` : ""}`;
    badges.push({
      tone: "rank",
      label: `数字 ${numberLabel}`
    });
  }

  return badges;
}

function renderConstraintCorner(room) {
  const badges = getConstraintBadges(room);
  if (!badges.length) return "";
  return `<div class="constraint-stack" aria-label="現在の縛り">${badges.map((badge) => `<span class="constraint-chip ${escapeHtml(badge.tone)}">${escapeHtml(badge.label)}</span>`).join("")}</div>`;
}

function renderPlayBurst() {
  if (!state.playBurst?.cards?.length) return "";
  return `<div class="play-burst" data-burst-id="${escapeHtml(state.playBurst.id)}"><div class="play-burst-core"></div>${state.playBurst.cards.map((card, index) => {
    const spread = (index - ((state.playBurst.cards.length - 1) / 2)) * 46;
    const tilt = (index - ((state.playBurst.cards.length - 1) / 2)) * 7;
    return renderPlayingCard(card, {
      compact: true,
      className: "play-burst-card",
      style: `--burst-index:${index}; --burst-spread:${spread}px; --burst-tilt:${tilt}deg`
    });
  }).join("")}</div>`;
}

function renderClearBurst() {
  if (!state.clearBurst) return "";
  const reason = state.clearBurst.reason || "場が流れました。";
  const cards = state.clearBurst.cards || [];
  return `<div class="clear-burst" data-clear-id="${escapeHtml(state.clearBurst.id)}"><div class="clear-burst-flash"></div><div class="clear-burst-sweep"></div><div class="clear-burst-copy"><div class="clear-burst-title">場が流れた</div><div class="clear-burst-detail">${escapeHtml(reason)}</div></div>${cards.map((card, index) => {
    const spread = (index - ((cards.length - 1) / 2)) * 44;
    const tilt = (index - ((cards.length - 1) / 2)) * 8;
    return renderPlayingCard(card, {
      compact: true,
      className: "clear-burst-card",
      style: `--clear-index:${index}; --clear-spread:${spread}px; --clear-tilt:${tilt}deg`
    });
  }).join("")}</div>`;
}
function renderHand(room) {
  const hand = room.self?.hand || [];
  const turn = getTurnUiState(room);
  const isPendingSelection = Boolean(room.permissions?.canResolvePending);
  const isPlaySelection = Boolean(room.permissions?.canPlay);
  const action = room.permissions?.canResolvePending ? "toggle-pending" : "toggle-card";
  const selectedSet = room.permissions?.canResolvePending ? state.pendingSelected : state.selected;
  const handInteractive = Boolean(room.permissions?.canResolvePending || room.permissions?.canPlay);
  const playValidation = room.permissions?.canResolvePending ? { ok: false } : validateSelectedPlay();
  const playDisabled = isUiLocked() || !playValidation.ok;
  const passDisabled = isUiLocked() || !room.permissions?.canPass;
  const resolveDisabled = isUiLocked() || !room.permissions?.canResolvePending || state.pendingSelected.size !== Number(room.pendingEffect?.count || 0);
  const actionButtons = room.permissions?.canResolvePending
    ? `<button class="button primary" data-action="resolve-effect" ${resolveDisabled ? "disabled" : ""}>確定</button>`
    : `<button class="button primary" data-action="play-selected" ${playDisabled ? "disabled" : ""}>出す</button><button class="button secondary" data-action="pass" ${passDisabled ? "disabled" : ""}>パス</button>`;
  const center = (hand.length - 1) / 2;
  const spacing = hand.length <= 1 ? 0 : Math.min(28, Math.max(14, 250 / Math.max(hand.length - 1, 1)));
  const maxDistance = Math.max(center, 1);
  const handStateClass = room.permissions?.canResolvePending ? "pending" : (room.permissions?.canPlay ? "self" : "watch");
  const handPhaseTitle = isPendingSelection
    ? "追加処理を選択"
    : (isPlaySelection ? (room.game?.currentCombo ? "出すカードを選択" : "最初の手を選択") : turn.compact);
  const handPhaseDetail = isPendingSelection
    ? `${room.pendingEffect?.count || 0}枚選んで確定してください`
    : (isPlaySelection ? "カードを選んで出すか、パスしてください。" : turn.detail);
  const handZoneClass = [
    "hand-zone",
    handStateClass,
    isPlaySelection ? "selecting-play" : "",
    isPendingSelection ? "selecting-pending" : ""
  ].filter(Boolean).join(" ");
  const handSignal = `<div class="hand-turn-callout ${escapeHtml(turn.tone)} ${escapeHtml(handStateClass)}"><span class="hand-turn-dot"></span><span class="hand-turn-dot"></span><span class="hand-turn-dot"></span><span class="hand-turn-copy"><strong>${escapeHtml(handPhaseTitle)}</strong><small>${escapeHtml(handPhaseDetail)}</small></span></div>`;

  return `<section class="${escapeHtml(handZoneClass)}"><div class="hand-rail"></div><article class="hand-panel"><div class="hand-header">${handSignal}<div class="hand-actions">${actionButtons}</div></div><div class="hand-grid" style="--hand-count:${hand.length}">${hand.map((card, index) => {
    const distance = Math.abs(index - center);
    const offset = Math.round((index - center) * spacing);
    const lift = Math.round(Math.max(0, (maxDistance - distance) * 4));
    const tilt = (index - center) * 3.1;
    return renderPlayingCard(card, {
      interactive: true,
      action,
      cardId: card.id,
      selected: selectedSet.has(card.id),
      disabled: isUiLocked() || !handInteractive,
      style: `--card-order:${index}; --card-tilt:${tilt}deg; --card-offset:${offset}px; --card-lift:${lift}px`
    });
  }).join("")}</div></article></section>`;
}
function renderRuleControl(rule, room) {
  const disabled = isUiLocked() || !room.permissions?.canEditSettings;
  if (rule.type === "boolean") {
    return `<article class="rule-tile"><div class="rule-title-row"><strong class="rule-title">${escapeHtml(rule.label)}</strong><span class="rule-state">${rule.value ? "有効" : "無効"}</span></div><div class="rule-description">${escapeHtml(rule.description)}</div><div class="rule-toggle-row"><button class="mini-toggle ${rule.value ? "active" : ""}" data-action="update-rule" data-key="${escapeHtml(rule.key)}" data-value="true" ${disabled ? "disabled" : ""}>有効</button><button class="mini-toggle ${!rule.value ? "active" : ""}" data-action="update-rule" data-key="${escapeHtml(rule.key)}" data-value="false" ${disabled ? "disabled" : ""}>無効</button></div></article>`;
  }
  return `<article class="rule-tile select-tile"><div class="rule-title-row"><strong class="rule-title">${escapeHtml(rule.label)}</strong><span class="rule-state">${escapeHtml(String(rule.value))}</span></div><div class="rule-description">${escapeHtml(rule.description)}</div><select class="select" data-action="update-rule-select" data-key="${escapeHtml(rule.key)}" ${disabled ? "disabled" : ""}>${rule.options.map((option) => `<option value="${escapeHtml(String(option.value))}" ${String(option.value) === String(rule.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></article>`;
}

function renderRules(room) {
  const ruleEntries = Object.entries(room.settings || {}).map(([key, value]) => getRuleMeta(key, value));
  const groups = new Map();
  for (const rule of ruleEntries) {
    const list = groups.get(rule.category) || [];
    list.push(rule);
    groups.set(rule.category, list);
  }
  return `<div class="rules-scroll">${[...groups.entries()].map(([category, rules]) => `<section class="rules-section"><div class="section-title">${escapeHtml(category)}</div><div class="rules-grid">${rules.map((rule) => renderRuleControl(rule, room)).join("")}</div></section>`).join("")}</div>`;
}
function renderMenuModal(room) {
  return `<div class="modal-overlay" data-action="close-modal"><div class="gilded-panel modal-panel" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="modal-header"><div><div class="crest-label">ルームメニュー</div><h2>メニュー</h2><p class="modal-copy">共有や履歴の確認ができます。</p></div><button class="button ghost" data-action="close-modal">閉じる</button></div><section class="modal-section"><div class="section-title">操作</div><div class="menu-grid"><button class="menu-button highlight" data-action="copy-link">招待リンクをコピー</button><button class="menu-button" data-action="open-rules">ルールを見る</button><button class="menu-button" data-action="refresh-room">更新する</button><div class="menu-button static">第${escapeHtml(String(room.roundNumber || 0))}ラウンド</div></div></section><section class="modal-section"><div class="section-title">参加者</div><div class="menu-summary-list">${(room.players || []).map((player) => renderPlayerSummary(player)).join("")}</div></section><section class="modal-section"><div class="section-title">最近のラウンド</div>${renderHistory(room)}</section></div></div>`;
}

function renderRulesModal(room) {
  return `<div class="modal-overlay" data-action="close-modal"><div class="gilded-panel modal-panel rules-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="modal-header"><div><div class="crest-label">ルームルール</div><h2>ルール</h2><p class="modal-copy">${room.permissions?.canEditSettings ? "ラウンド開始前ならホストが変更できます。" : "現在のルールを表示しています。"}</p></div><div class="modal-actions"><button class="button secondary" data-action="open-menu">メニュー</button><button class="button ghost" data-action="close-modal">閉じる</button></div></div>${renderRules(room)}</div></div>`;
}

function renderPendingOverlay(room) {
  if (!room.pendingEffect) return "";
  const pending = room.pendingEffect;
  return `<div class="overlay-lock"><div class="gilded-panel modal-panel"><div class="modal-header"><div><div class="crest-label">特殊効果</div><h2>解決</h2><p class="modal-copy">必要なカードを選んで続行してください。</p></div></div><div class="pending-grid">${(room.self?.hand || []).map((card) => renderPlayingCard(card, {
    interactive: true,
    action: "toggle-pending",
    cardId: card.id,
    selected: state.pendingSelected.has(card.id),
    compact: true,
    disabled: isUiLocked(),
    className: "burst-face"
  })).join("")}</div><div class="modal-section"><div class="log-row"><strong>必要枚数</strong><span>${escapeHtml(String(pending.count || 0))}枚</span></div><div class="log-row"><strong>種類</strong><span>${escapeHtml(localizePendingType(pending.type || "effect"))}</span></div>${pending.targetNickname ? `<div class="log-row"><strong>対象</strong><span>${escapeHtml(pending.targetNickname)}</span></div>` : ""}</div><div class="modal-footer-actions"><button class="button primary" data-action="resolve-effect" ${state.pendingSelected.size === Number(pending.count || 0) && !isUiLocked() ? "" : "disabled"}>確定する</button></div></div></div>`;
}

function renderJoinOverlay(room) {
  return `<div class="overlay-lock"><div class="gilded-panel modal-panel"><div class="modal-header"><div><div class="crest-label">ルーム参加</div><h2>${escapeHtml(room.roomId || state.roomId)}</h2><p class="modal-copy">${room.joinLocked ? "このルームは対戦開始後のため参加できません。" : "名前を入力して席に着いてください。"}</p></div></div><label class="field-block"><span class="field-label">名前</span><input id="join-nickname-input" class="input" maxlength="20" placeholder="名前を入力" value="${escapeHtml(getSavedNickname())}" ${room.joinLocked ? "disabled" : ""} /></label><div class="modal-footer-actions"><button class="button secondary" data-action="copy-link">招待リンクをコピー</button><button class="button primary" data-action="join-room" ${room.joinLocked || isUiLocked() ? "disabled" : ""}>参加する</button></div></div></div>`;
}

function getLatestRoundRanking(room) {
  if (room.history?.[0]?.ranking?.length) {
    return room.history[0].ranking;
  }
  return [...(room.players || [])]
    .filter((player) => player.lastRoundRank)
    .sort((left, right) => (left.lastRoundRank || 99) - (right.lastRoundRank || 99))
    .map((player) => ({
      playerId: player.id,
      nickname: player.nickname,
      role: localizeResultRole(player.lastRoundRole, player.lastRoundRank),
      pointDelta: 0,
      totalPoints: player.points,
      rank: player.lastRoundRank
    }));
}

function resultClassForRank(rank) {
  if (rank === 1) return "grand";
  if (rank === 2) return "rich";
  if (rank === 3) return "poor";
  return "lowest";
}

function renderResultRow(entry, playerMap) {
  const player = playerMap.get(entry.playerId) || { nickname: entry.nickname, isBot: false };
  return `<article class="result-entry ${resultClassForRank(entry.rank)}"><div class="result-rank-card"><div class="result-rank-number">${escapeHtml(String(entry.rank || "-"))}</div><div class="result-role">${escapeHtml(localizeResultRole(entry.role, entry.rank))}</div><div class="result-delta">${escapeHtml(formatPointDelta(entry.pointDelta || 0))}</div></div><div class="result-avatar-cell">${renderPortrait(player)}</div><div class="result-data-cell"><div class="result-line"><strong>名前</strong><span>${escapeHtml(entry.nickname || player.nickname || "-")}</span></div><div class="result-line"><strong>合計</strong><span>${escapeHtml(String(entry.totalPoints || 0))}点</span></div></div></article>`;
}

function renderResultView(room) {
  const ranking = getLatestRoundRanking(room);
  const playerMap = getPlayerMap(room);
  return `<section class="result-screen"><div class="result-shell"><header class="result-header"><div class="result-ornament"></div><h1>結果</h1><div class="result-ornament"></div></header><div class="result-list-board">${ranking.map((entry) => renderResultRow(entry, playerMap)).join("")}</div><div class="result-footer-bar"></div><div class="result-bottom"><button class="button secondary result-button" data-action="copy-link">招待リンク</button><div class="result-round-indicator"><span>${escapeHtml(String(room.roundNumber || 0).padStart(2, "0"))}</span></div><button class="button primary result-button" data-action="start-round" ${room.permissions?.canStart && !isUiLocked() ? "" : "disabled"}>${room.permissions?.canStart ? "次のラウンド" : "待機中"}</button></div></div>${renderToast()}</section>`;
}

function renderBoardView(room) {
  const selfId = room.self?.id;
  const otherPlayers = (room.players || []).filter((player) => player.id !== selfId);
  const showLobbyStart = Boolean(room.permissions?.canStart) && (room.roundNumber || 0) === 0;
  const stageClass = ["table-stage", room.permissions?.canPlay ? "play-active" : "", room.game?.currentCombo ? "pile-live" : ""].filter(Boolean).join(" ");
  return `<section class="room-stage">${showLobbyStart ? `<div class="prestart-bar"><button class="button primary prestart-button" data-action="start-round" ${isUiLocked() ? "disabled" : ""}>ラウンド開始</button></div>` : ""}<div class="${stageClass}"><div class="table-history-shell"><div class="tool-cluster left"><button class="tool-button" data-action="open-menu" ${isUiLocked() ? "disabled" : ""} title="メニュー">メ</button><button class="tool-button" data-action="open-rules" ${isUiLocked() ? "disabled" : ""} title="ルール">規</button></div>${renderFeed(room)}<div class="table-corner right"><div class="tool-cluster right"><button class="tool-button" data-action="refresh-room" ${isUiLocked() ? "disabled" : ""} title="更新">更</button><button class="tool-button" data-action="copy-link" ${isUiLocked() ? "disabled" : ""} title="共有">共</button></div>${renderConstraintCorner(room)}</div></div><div class="seat-layer">${otherPlayers.map((player) => renderSeatCard(player)).join("")}</div>${renderPlayBurst()}${renderClearBurst()}${room.self ? renderSeatCard(room.self) : ""}${room.self ? renderHand(room) : ""}</div>${renderToast()}${room.requiresJoin ? renderJoinOverlay(room) : ""}${room.pendingEffect ? renderPendingOverlay(room) : ""}${state.activeModal === "menu" ? renderMenuModal(room) : ""}${state.activeModal === "rules" ? renderRulesModal(room) : ""}</section>`;
}

function renderRoom() {



  if (!state.room) return renderLoading();
  if (state.room.status === "round_over") {
    return renderResultView(state.room);
  }
  return renderBoardView(state.room);
}

function patchBoardView() {
  if (!state.room || state.room.status === "round_over") return false;
  const currentStage = root.querySelector(".room-stage");
  if (!currentStage || currentStage.querySelector(".overlay-lock, .modal-overlay")) return false;

  const template = document.createElement("template");
  template.innerHTML = renderBoardView(state.room).trim();
  const nextStage = template.content.firstElementChild;
  if (!nextStage || nextStage.querySelector(".overlay-lock, .modal-overlay")) return false;

  const currentTable = currentStage.querySelector(".table-stage");
  const nextTable = nextStage.querySelector(".table-stage");
  if (!currentTable || !nextTable) return false;

  currentTable.className = nextTable.className;

  const syncElementMarkup = (currentNode, nextNode) => {
    if (currentNode.className !== nextNode.className) {
      currentNode.className = nextNode.className;
    }
    const currentStyle = currentNode.getAttribute("style");
    const nextStyle = nextNode.getAttribute("style");
    if (currentStyle !== nextStyle) {
      if (nextStyle) {
        currentNode.setAttribute("style", nextStyle);
      } else {
        currentNode.removeAttribute("style");
      }
    }
    if (currentNode.innerHTML !== nextNode.innerHTML) {
      currentNode.innerHTML = nextNode.innerHTML;
    }
  };

  const syncOptional = (selector, scope = currentStage, nextScope = nextStage, appendTarget = scope, insertBeforeSelector = "") => {
    const currentNode = scope.querySelector(selector);
    const nextNode = nextScope.querySelector(selector);
    if (currentNode && nextNode) {
      syncElementMarkup(currentNode, nextNode);
      return true;
    }
    if (!currentNode && !nextNode) {
      return true;
    }
    if (!currentNode && nextNode) {
      const anchor = insertBeforeSelector ? appendTarget.querySelector(insertBeforeSelector) : null;
      if (anchor) {
        appendTarget.insertBefore(nextNode, anchor);
      } else {
        appendTarget.append(nextNode);
      }
      return true;
    }
    if (currentNode && !nextNode) {
      currentNode.remove();
      return true;
    }
    return false;
  };

  const syncSeatLayer = () => {
    const currentLayer = currentTable.querySelector(".seat-layer");
    const nextLayer = nextTable.querySelector(".seat-layer");
    if (!currentLayer || !nextLayer) {
      return syncOptional(".seat-layer", currentTable, nextTable, currentTable);
    }

    const currentCards = [...currentLayer.querySelectorAll(":scope > .seat-card")];
    const nextCards = [...nextLayer.querySelectorAll(":scope > .seat-card")];
    const currentById = new Map(currentCards.map((card, index) => [card.dataset.playerId || `seat-${index}`, card]));
    const usedIds = new Set();

    nextCards.forEach((nextCard, index) => {
      const key = nextCard.dataset.playerId || `seat-${index}`;
      const currentCard = currentById.get(key);
      if (currentCard) {
        syncElementMarkup(currentCard, nextCard);
        currentLayer.append(currentCard);
      } else {
        currentLayer.append(nextCard);
      }
      usedIds.add(key);
    });

    currentCards.forEach((card, index) => {
      const key = card.dataset.playerId || `seat-${index}`;
      if (!usedIds.has(key)) {
        card.remove();
      }
    });

    return true;
  };

  syncOptional(".prestart-bar", currentStage, nextStage, currentStage, ".table-stage");
  syncOptional(".table-history-shell", currentTable, nextTable, currentTable);
  syncSeatLayer();
  syncOptional(".play-burst", currentTable, nextTable, currentTable);
  syncOptional(".clear-burst", currentTable, nextTable, currentTable);
  syncOptional(".seat-card.south", currentTable, nextTable, currentTable, ".hand-zone");
  syncOptional(".hand-zone", currentTable, nextTable, currentTable);
  syncOptional(".toast", currentStage, nextStage, currentStage);

  return true;
}
function render(options = {}) {
  const { patchBoard = false } = options;
  flashLayer.innerHTML = "";
  if (!state.roomId && !state.room) {
    root.innerHTML = renderLanding();
    return;
  }
  if (state.roomId && !state.room) {
    root.innerHTML = renderLoading();
    return;
  }
  if (patchBoard && patchBoardView()) {
    return;
  }
  root.innerHTML = renderRoom();
}
async function refreshState({ silent = false } = {}) {
  if (!state.roomId) return;
  try {
    const query = new URLSearchParams({ roomId: state.roomId, clientId: state.clientId }).toString();
    const payload = await api(`/api/state?${query}`, null, "GET");
    setRoomState(payload.state);
    render({ patchBoard: silent });
  } catch (error) {
    if (!silent) showMessage(error.message || "ルームの更新に失敗しました。");
    if (String(error.message || "").includes("Room not found")) {
      stopPolling();
      setRoomId("");
      state.room = null;
      render();
    }
  }
}

function stopPolling() {
  if (state.polling) {
    clearInterval(state.polling);
    state.polling = null;
  }
}

function startPolling() {
  stopPolling();
  if (!state.roomId) return;
  state.polling = setInterval(() => {
    if (state.loading || state.botAdvancing) {
      return;
    }
    refreshState({ silent: true });
  }, 2000);
}

async function createRoomAction() {
  const nickname = (document.getElementById("nickname-input")?.value || getSavedNickname()).trim();
  if (nickname) saveNickname(nickname);
  state.loading = true;
  render();
  try {
    const payload = await api("/api/create-room", { nickname, clientId: state.clientId });
    setRoomId(payload.roomId);
    setRoomState(payload.state);
    state.activeModal = "";
    startPolling();
  } catch (error) {
    showMessage(error.message || "ルームの作成に失敗しました。");
  } finally {
    state.loading = false;
    render();
  }
}

async function joinRoomAction() {
  const nicknameInput = document.getElementById("join-nickname-input") || document.getElementById("nickname-input");
  const nickname = (nicknameInput?.value || getSavedNickname()).trim();
  if (!state.roomId) {
    showMessage("ルームコードがありません。");
    return;
  }
  if (nickname) saveNickname(nickname);
  state.loading = true;
  render();
  try {
    const payload = await api("/api/join-room", { roomId: state.roomId, nickname, clientId: state.clientId });
    setRoomState(payload.state);
    state.activeModal = "";
    startPolling();
  } catch (error) {
    showMessage(error.message || "ルームへの参加に失敗しました。");
  } finally {
    state.loading = false;
    render();
  }
}

async function updateRule(key, rawValue) {
  if (!state.roomId || !state.room?.permissions?.canEditSettings) return;
  const currentValue = state.room.settings?.[key];
  let value = rawValue;
  if (typeof currentValue === "boolean") {
    value = rawValue === true || rawValue === "true";
  } else if (typeof currentValue === "number") {
    value = Number(rawValue);
  }
  state.loading = true;
  render();
  try {
    const payload = await api("/api/update-settings", { roomId: state.roomId, clientId: state.clientId, patch: { [key]: value } });
    setRoomState(payload.state);
  } catch (error) {
    showMessage(error.message || "ルールの更新に失敗しました。");
  } finally {
    state.loading = false;
    render();
  }
}

function toggleCardSelection(cardId) {
  if (!cardId) return;
  if (state.selected.has(cardId)) {
    state.selected.delete(cardId);
  } else {
    state.selected.add(cardId);
  }
  render();
}

function togglePendingSelection(cardId) {
  if (!cardId) return;
  const limit = Number(state.room?.pendingEffect?.count || 0);
  if (state.pendingSelected.has(cardId)) {
    state.pendingSelected.delete(cardId);
  } else if (state.pendingSelected.size < limit) {
    state.pendingSelected.add(cardId);
  }
  render();
}

async function performRoomAction(path, body, successMessage = "") {
  if (!state.roomId) return;
  state.loading = true;
  render();
  try {
    const payload = await api(path, { ...body, roomId: state.roomId, clientId: state.clientId });
    setRoomState(payload.state);
    clearSelections();
    if (successMessage) showMessage(successMessage);
  } catch (error) {
    showMessage(error.message || "操作に失敗しました。");
  } finally {
    state.loading = false;
    render();
  }
}

async function copyRoomLink() {
  const link = getRoomLink();
  try {
    await navigator.clipboard.writeText(link);
    showMessage("招待リンクをコピーしました。");
  } catch {
    showMessage(link, { autoHide: false });
  }
}

async function handleAction(action, trigger) {
  if (!action) return;
  if (LOCKED_ACTIONS.has(action) && isUiLocked()) return;

  if (action === "create-room") return createRoomAction();
  if (action === "join-room") return joinRoomAction();
  if (action === "open-menu") return openModal("menu");
  if (action === "open-rules") return openModal("rules");
  if (action === "close-modal") return closeModal();
  if (action === "refresh-room") return refreshState();
  if (action === "copy-link") return copyRoomLink();
  if (action === "start-round") return performRoomAction("/api/start-round", {}, "ラウンドを開始しました。");
  if (action === "play-selected") {
    const validation = validateSelectedPlay();
    if (!validation.ok) return;
    return performRoomAction("/api/play", { cardIds: [...state.selected] });
  }
  if (action === "pass") return performRoomAction("/api/pass", {});
  if (action === "resolve-effect") return performRoomAction("/api/resolve-effect", { cardIds: [...state.pendingSelected] });
  if (action === "toggle-card") return toggleCardSelection(trigger?.dataset.cardId || "");
  if (action === "toggle-pending") return togglePendingSelection(trigger?.dataset.cardId || "");
  if (action === "update-rule") return updateRule(trigger?.dataset.key || "", trigger?.dataset.value);

  if (action === "jump-room") {
    const roomCode = String(document.getElementById("room-code-input")?.value || "").trim().toUpperCase();
    const nickname = String(document.getElementById("nickname-input")?.value || "").trim();
    if (!roomCode) {
      showMessage("ルームコードを入力してください。");
      return;
    }
    if (nickname) saveNickname(nickname);
    setRoomId(roomCode);
    state.room = null;
    render();
    await refreshState();
    startPolling();
  }
}

root.addEventListener("click", (event) => {


  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  event.preventDefault();
  handleAction(trigger.dataset.action, trigger);
});

root.addEventListener("change", (event) => {
  const trigger = event.target.closest("[data-action='update-rule-select']");
  if (!trigger) return;
  updateRule(trigger.dataset.key || "", trigger.value);
});

async function init() {
  render();
  if (!state.roomId) return;
  await refreshState();
  startPolling();
}

window.addEventListener("beforeunload", () => {
  stopPolling();
  clearTimeout(state.messageTimer);
  clearTimeout(state.playBurstTimer);
  clearBotAdvanceTimer();
});

init();




















