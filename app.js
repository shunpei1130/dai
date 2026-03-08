const root = document.getElementById("app");
const flashLayer = document.getElementById("flash-layer");

const state = {
  clientId: getOrCreateClientId(),
  roomId: getRoomIdFromUrl(),
  room: null,
  rulesConfig: [],
  selected: new Set(),
  pendingSelected: new Set(),
  message: "",
  loading: false,
  polling: null,
  lastFlashId: 0,
  flashQueue: [],
  flashing: false,
  activeModal: ""
};

function getOrCreateClientId() {
  const key = "daifugo-client-id";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }
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

async function api(path, body = null, method = "POST") {
  const options = { method, headers: {} };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "通信に失敗しました。");
  }
  return payload;
}

function showMessage(message) {
  state.message = message;
  render();
}

function clearSelections() {
  state.selected.clear();
  state.pendingSelected.clear();
}

function openModal(modal) {
  state.activeModal = modal;
  render();
}

function closeModal() {
  if (!state.activeModal) {
    return;
  }
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
  if (selfSeat === undefined) {
    return ["south", "east", "north", "west"][player.seat] || "south";
  }

  const diff = (player.seat - selfSeat + 4) % 4;
  return {
    0: "south",
    1: "east",
    2: "north",
    3: "west"
  }[diff];
}

function cardRankLabel(card) {
  return card.isJoker ? "JK" : CARD_RANK_LABELS[card.rank] || String(card.rank || "");
}

function cardSuitLabel(card) {
  return card.isJoker ? "WILD" : card.suitSymbol;
}

function comboSignature(combo) {
  if (!combo) {
    return "";
  }
  return `${combo.text}:${combo.cards.map((card) => card.id).join(",")}`;
}

function triggerPilePulse() {
  state.pilePulse = true;
  if (state.pilePulseTimer) {
    clearTimeout(state.pilePulseTimer);
  }
  state.pilePulseTimer = setTimeout(() => {
    state.pilePulse = false;
    render();
  }, 820);
}

function setRoomState(nextRoom, { animateCombo = true } = {}) {
  const previousCombo = comboSignature(state.room?.game?.currentCombo);
  const nextCombo = comboSignature(nextRoom?.game?.currentCombo);

  state.room = nextRoom;

  if (animateCombo && nextCombo && nextCombo !== previousCombo) {
    triggerPilePulse();
  }
}

function triggerPlayAnimation(cards) {
  if (!cards?.length) {
    return;
  }

  state.playAnimation = {
    token: `${Date.now()}-${Math.random()}`,
    cards: [...cards]
  };

  if (state.playAnimationTimer) {
    clearTimeout(state.playAnimationTimer);
  }

  state.playAnimationTimer = setTimeout(() => {
    state.playAnimation = null;
    render();
  }, 980);

  render();
}

function renderPlayingCard(
  card,
  {
    interactive = false,
    action = "",
    cardId = "",
    selected = false,
    disabled = false,
    compact = false,
    className = "",
    style = ""
  } = {}
) {
  const tag = interactive ? "button" : "div";
  const classes = [
    interactive ? "card-button" : "mini-card",
    "playing-card",
    card.suitName,
    compact ? "compact" : "",
    selected ? "selected" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");
  const attributes = [
    `class="${classes}"`,
    style ? `style="${escapeHtml(style)}"` : "",
    interactive && action ? `data-action="${escapeHtml(action)}"` : "",
    interactive && cardId ? `data-card-id="${escapeHtml(cardId)}"` : "",
    interactive && disabled ? "disabled" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const rank = cardRankLabel(card);
  const suit = cardSuitLabel(card);
  const centerLabel = card.isJoker ? "JOKER" : card.label;

  return `
    <${tag} ${attributes}>
      <span class="card-sheen"></span>
      <span class="card-corner top">
        <span class="card-rank">${escapeHtml(rank)}</span>
        <span class="card-suit">${escapeHtml(suit)}</span>
      </span>
      <span class="card-center ${card.isJoker ? "joker" : ""}">
        <span class="card-center-mark">${escapeHtml(card.isJoker ? "JOKER" : suit)}</span>
        <span class="card-center-label">${escapeHtml(centerLabel)}</span>
      </span>
      <span class="card-corner bottom">
        <span class="card-rank">${escapeHtml(rank)}</span>
        <span class="card-suit">${escapeHtml(suit)}</span>
      </span>
    </${tag}>
  `;
}

function renderPlayBurst() {
  if (!state.playAnimation?.cards?.length) {
    return "";
  }

  return `
    <div class="play-burst" data-token="${escapeHtml(state.playAnimation.token)}">
      <div class="play-burst-core"></div>
      ${state.playAnimation.cards
        .map((card, index, cards) => {
          const tilt = (index - (cards.length - 1) / 2) * 9;
          const spread = (index - (cards.length - 1) / 2) * 56;
          return `
            <div class="play-burst-card" style="--burst-index:${index}; --burst-tilt:${tilt}deg; --burst-spread:${spread}px;">
              ${renderPlayingCard(card, { compact: true, className: "burst-face" })}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function shareUrl() {
  return `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
}

function renderToast() {
  if (!state.message) {
    return "";
  }
  return `<div class="toast">${escapeHtml(state.message)}</div>`;
}

function renderLanding() {
  return `
    <section class="hero">
      <article class="hero-card">
        <div class="hero-kicker">Daifugo Arena</div>
        <h1 class="hero-title">ルールを盛れる<br />オンライン大富豪</h1>
        <p class="hero-copy">
          URL共有だけで部屋を作成。人が足りないときはBotが自動参加し、毎回の順位はポイント制で蓄積されます。
        </p>
        <div class="feature-grid">
          <div class="feature-card">
            <strong>ルール切替</strong>
            <div class="muted">革命、8切り、11バック、7渡し、10捨て、都落ち、下剋上まで卓ごとに設定。</div>
          </div>
          <div class="feature-card">
            <strong>常に4人卓</strong>
            <div class="muted">開始時点で不足している席はBotが補完。待ち時間なしで遊べます。</div>
          </div>
          <div class="feature-card">
            <strong>連戦ランキング</strong>
            <div class="muted">同じURLで何戦も回し、部屋内ポイントで実力差が見えるようにしています。</div>
          </div>
        </div>
      </article>
      <article class="hero-card form-card">
        <div>
          <div class="panel-kicker">Room Setup</div>
          <h2 class="brand">部屋を作る / 参加する</h2>
        </div>
        ${renderToast()}
        <label>
          <div class="muted">ニックネーム</div>
          <input id="nickname-input" class="input" maxlength="20" placeholder="例: しゅん" value="${escapeHtml(getSavedNickname())}" />
        </label>
        <div class="form-row">
          <button class="button primary" data-action="create-room">新しい部屋を作る</button>
        </div>
        <label>
          <div class="muted">招待コードで入る</div>
          <input id="room-code-input" class="input" maxlength="6" placeholder="6文字の部屋コード" />
        </label>
        <div class="form-row">
          <button class="button secondary" data-action="jump-room">部屋へ移動</button>
        </div>
        <div class="muted">Vercel向けに静的フロント + API構成です。共有URLはそのまま招待リンクとして使えます。</div>
      </article>
    </section>
  `;
}

function renderPlayerSummary(player) {
  return `
    <div class="result-row">
      <div class="rule-head">
        <strong>${escapeHtml(player.nickname)}</strong>
        <span class="badge">${player.points}pt</span>
      </div>
      <div class="muted">${player.isBot ? "Bot" : "Human"} / 手札 ${player.handCount}枚 / ${player.lastRoundRole || "待機中"}</div>
    </div>
  `;
}

function renderHistory() {
  const rounds = state.room?.history || [];
  if (rounds.length === 0) {
    return `<div class="empty">まだラウンド結果はありません。</div>`;
  }

  return rounds
    .map(
      (round) => `
        <div class="result-row">
          <div class="rule-head">
            <strong>Round ${round.roundNumber}</strong>
            <span class="badge">${new Date(round.endedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div class="result-list">
            ${round.ranking
              .map(
                (entry) => `
                  <div class="muted">${entry.rank}. ${escapeHtml(entry.nickname)} / ${entry.role} / +${entry.pointDelta}pt</div>
                `
              )
              .join("")}
          </div>
        </div>
      `
    )
    .join("");
}

function renderActionLog() {
  const items = [...(state.room?.game?.actionLog || [])].slice(-8).reverse();
  if (items.length === 0) {
    return `<div class="empty">ログはまだありません。</div>`;
  }

  return items
    .map(
      (item) => `
        <div class="log-item">
          <div>${escapeHtml(item.text)}</div>
          <div class="muted">${new Date(item.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      `
    )
    .join("");
}

function renderSeatCard(player) {
  const seatClass = relativeSeatClass(player);
  const status = player.isCurrent
    ? "手番"
    : player.status === "passed"
      ? "パス"
      : player.status === "finished"
        ? "上がり"
        : player.status === "bottom"
          ? "脱落"
          : player.isBot
            ? "BOT"
            : "";

  return `
    <article class="seat-card ${seatClass} ${player.isCurrent ? "current" : ""}">
      <div class="rule-head seat-head">
        <strong class="seat-name">${escapeHtml(player.nickname)}</strong>
        ${status ? `<span class="badge">${escapeHtml(status)}</span>` : ""}
      </div>
      <div class="muted mini-meta">手札 ${player.handCount}枚</div>
    </article>
  `;
}
function renderPile() {
  const combo = state.room?.game?.currentCombo;
  if (!combo) {
    return `<div class="empty">Play a card to start the pile.</div>`;
  }

  return `
    <div>
      <h2>${escapeHtml(combo.text)}</h2>
      <div class="pile-cards">
        ${combo.cards
          .map(
            (card) => `
              <div class="mini-card ${card.suitName}">
                <div>${escapeHtml(card.label)}</div>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}
function renderBoardMetrics() {
  const room = state.room;
  const turnPlayer = room.players.find((player) => player.isCurrent);
  const flags = [];
  if (room.game.revolution) {
    flags.push("革命中");
  }
  if (room.game.elevenBack) {
    flags.push("11バック");
  }
  if (room.game.lockedSuits?.length) {
    flags.push(`縛り ${room.game.lockedSuits.join(" ")}`);
  }

  return `
    <div class="status-strip">
      <div class="status-main ${room.permissions.canPlay ? "active" : ""}">
        <strong>${room.permissions.canPlay ? "あなたの番" : `${escapeHtml(turnPlayer?.nickname || "相手")}の番`}</strong>
        <span>${room.permissions.canPlay ? "カードを選んで出します" : "少し待ってください"}</span>
      </div>
      ${flags.length ? `<div class="status-flags">${flags.map((flag) => `<span class="badge">${escapeHtml(flag)}</span>`).join("")}</div>` : ""}
    </div>
  `;
}
function renderHand() {
  if (!state.room?.self) {
    return "";
  }

  const canAct = state.room.permissions.canPlay;
  const canPass = state.room.permissions.canPass;
  const hand = state.room.self.hand || [];
  const selectedCount = state.selected.size;

  return `
    <div class="hand-panel">
      <div class="rule-head hand-header">
        <div>
          <strong>手札 ${hand.length}枚</strong>
          <div class="muted hand-copy">${selectedCount ? `${selectedCount}枚選択中` : canAct ? "出すカードを選んでください" : "相手の手番です"}</div>
        </div>
        <div class="hand-actions">
          ${selectedCount ? '<button class="button secondary" data-action="clear-selection">クリア</button>' : ""}
          ${canAct ? '<button class="button primary" data-action="play-selected">出す</button>' : ""}
          ${canPass ? '<button class="button danger" data-action="pass">パス</button>' : ""}
        </div>
      </div>
      <div class="hand-grid">
        ${hand
          .map(
            (card) => `
              <button
                class="card-button ${card.suitName} ${state.selected.has(card.id) ? "selected" : ""}"
                data-action="toggle-card"
                data-card-id="${card.id}"
                ${canAct ? "" : "disabled"}
              >
                <span>${escapeHtml(card.label)}</span>
                <span>${escapeHtml(card.isJoker ? "wild" : card.suitSymbol)}</span>
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}
function renderRules() {
  const editable = state.room?.permissions?.canEditSettings;
  const categories = {};
  for (const rule of state.rulesConfig) {
    if (!categories[rule.category]) {
      categories[rule.category] = [];
    }
    categories[rule.category].push(rule);
  }

  return Object.entries(categories)
    .map(
      ([category, rules]) => `
        <section class="rule-category">
          <div class="panel-kicker">${escapeHtml(category)}</div>
          ${rules
            .map((rule) => {
              const value = state.room?.settings?.[rule.key];
              if (rule.type === "select") {
                return `
                  <div class="rule-item">
                    <div class="rule-head">
                      <strong>${escapeHtml(rule.label)}</strong>
                    </div>
                    <div class="muted">${escapeHtml(rule.description)}</div>
                    <select class="select rule-select" data-rule-key="${rule.key}" ${editable ? "" : "disabled"}>
                      ${rule.options
                        .map(
                          (option) => `
                            <option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>
                          `
                        )
                        .join("")}
                    </select>
                  </div>
                `;
              }

              return `
                <div class="rule-item">
                  <div class="rule-head">
                    <strong>${escapeHtml(rule.label)}</strong>
                    <button class="toggle ${value ? "on" : ""}" data-action="toggle-rule" data-rule-key="${rule.key}" data-next="${String(!value)}" ${editable ? "" : "disabled"}>
                      <span></span>
                    </button>
                  </div>
                  <div class="muted">${escapeHtml(rule.description)}</div>
                </div>
              `;
            })
            .join("")}
        </section>
      `
    )
    .join("");
}

function renderInfoModal() {
  if (state.activeModal !== "info") {
    return "";
  }

  const playersByScore = [...state.room.players].sort((left, right) => right.points - left.points || left.seat - right.seat);

  return `
    <div class="overlay info-modal">
      <div class="overlay-card modal-card compact-modal">
        <div class="rule-head modal-heading">
          <div>
            <div class="panel-kicker">Info</div>
            <h2>必要な情報</h2>
          </div>
          <button class="button ghost modal-close" data-action="close-modal">閉じる</button>
        </div>
        <div class="modal-scroll info-sections">
          <section class="info-section">
            <div class="panel-kicker">順位</div>
            <div class="metric-stack">${playersByScore.map(renderPlayerSummary).join("")}</div>
          </section>
          <section class="info-section">
            <div class="panel-kicker">ルール</div>
            <div class="rule-columns">${renderRules()}</div>
          </section>
          <section class="info-section">
            <div class="panel-kicker">履歴</div>
            <div class="history-list">${renderHistory()}</div>
          </section>
        </div>
      </div>
    </div>
  `;
}
function renderPendingOverlay() {
  const pending = state.room?.pendingEffect;
  if (!pending) {
    return "";
  }

  const hand = state.room.self.hand || [];
  const heading = pending.type === "give" ? `${pending.targetNickname} に ${pending.count}枚渡す` : `${pending.count}枚を10捨てする`;

  return `
    <div class="overlay">
      <div class="overlay-card">
        <div class="panel-kicker">Special Effect</div>
        <h2>${escapeHtml(heading)}</h2>
        <p class="muted">効果解決用にちょうど ${pending.count} 枚を選択してください。</p>
        <div class="hand-grid">
          ${hand
            .map(
              (card) => `
                <button class="card-button ${card.suitName} ${state.pendingSelected.has(card.id) ? "selected" : ""}" data-action="toggle-pending-card" data-card-id="${card.id}">
                  <span>${escapeHtml(card.label)}</span>
                  <span>${escapeHtml(card.isJoker ? "wild" : card.suitSymbol)}</span>
                </button>
              `
            )
            .join("")}
        </div>
        <div class="top-actions" style="margin-top:16px;">
          <button class="button secondary" data-action="clear-pending">選択解除</button>
          <button class="button primary" data-action="resolve-effect">効果を確定</button>
        </div>
      </div>
    </div>
  `;
}

function renderJoinOverlay() {
  const locked = state.room?.joinLocked;
  return `
    <div class="join-overlay">
      <div class="overlay-card">
        <div class="panel-kicker">Join Room</div>
        <h2>${locked ? "この部屋は参加締切です" : "ニックネームを入力して参加"}</h2>
        <p class="muted">${locked ? "初戦開始後は参加者固定です。新しく遊ぶ場合は部屋を作り直してください。" : "ゲーム中に表示される名前になります。"}</p>
        ${locked ? "" : `<input id="join-nickname-input" class="input" maxlength="20" value="${escapeHtml(getSavedNickname())}" placeholder="ニックネーム" />`}
        <div class="top-actions" style="margin-top:16px;">
          ${locked ? `<button class="button primary" data-action="leave-room">トップへ戻る</button>` : `<button class="button primary" data-action="join-room">参加する</button>`}
        </div>
      </div>
    </div>
  `;
}

function renderRoom() {
  const room = state.room;
  const canStart = room.permissions?.canStart;
  const selfName = room.self?.nickname || "ゲスト";

  return `
    ${renderToast()}
    <div class="room-shell simple-room">
      <section class="panel room-header compact-header">
        <div class="table-header compact-table-header">
          <div>
            <div class="panel-kicker">Room</div>
            <div class="room-title-row">
              <span class="code-chip">${escapeHtml(room.roomId)}</span>
              <span class="badge">${escapeHtml(selfName)}</span>
            </div>
          </div>
          <div class="top-actions header-actions compact-actions">
            <button class="button ghost" data-action="open-modal" data-modal="info">情報</button>
            <button class="button ghost" data-action="copy-link">共有</button>
            ${canStart ? `<button class="button primary" data-action="start-round">${room.status === "round_over" ? "次の対戦" : "開始"}</button>` : ""}
          </div>
        </div>
      </section>
      <section class="panel board-panel">
        <section class="board-stage simple-board-stage">
          <div class="board-top">
            ${renderBoardMetrics()}
          </div>
          <div class="seat-layer">
            ${room.players.map(renderSeatCard).join("")}
          </div>
          <div class="center-pile">
            ${renderPile()}
          </div>
          <div class="hand-zone">
            ${renderHand()}
          </div>
        </section>
      </section>
    </div>
    ${renderInfoModal()}
    ${room.requiresJoin ? renderJoinOverlay() : ""}
    ${renderPendingOverlay()}
  `;
}
function render() {
  if (!state.roomId) {
    root.innerHTML = renderLanding();
    return;
  }

  if (!state.room) {
    root.innerHTML = `
      <section class="hero">
        <article class="hero-card form-card">
          <div class="panel-kicker">Loading</div>
          <h1 class="brand">部屋を読み込み中…</h1>
          ${renderToast()}
        </article>
      </section>
    `;
    return;
  }

  root.innerHTML = renderRoom();
}

function queueFlashes() {
  const flashyTypes = new Set(["revolution", "stairsRevolution", "gekokujou", "miyakoOchi", "eightCut", "fourCut", "sandstorm", "queenCar", "coupDetat", "sixCut", "sixReturn", "elevenBack", "forbiddenFinish"]);
  for (const announcement of state.room?.game?.announcements || []) {
    if (announcement.id <= state.lastFlashId) {
      continue;
    }
    if (flashyTypes.has(announcement.type)) {
      state.flashQueue.push(announcement);
    }
    state.lastFlashId = Math.max(state.lastFlashId, announcement.id);
  }
  showNextFlash();
}

function showNextFlash() {
  if (state.flashing || state.flashQueue.length === 0) {
    return;
  }

  state.flashing = true;
  const announcement = state.flashQueue.shift();
  flashLayer.innerHTML = `
    <div class="flash ${escapeHtml(announcement.type)}">
      <div class="flash-card">
        <div class="panel-kicker">Rare Rule Triggered</div>
        <div class="flash-title" style="font-size:2.3rem; margin: 12px 0;">${escapeHtml(announcement.title)}</div>
        <div>${escapeHtml(announcement.detail)}</div>
      </div>
    </div>
  `;

  setTimeout(() => {
    flashLayer.innerHTML = "";
    state.flashing = false;
    showNextFlash();
  }, 1700);
}

async function refreshState(silent = false) {
  if (!state.roomId) {
    return;
  }

  try {
    const payload = await api(`/api/state?roomId=${encodeURIComponent(state.roomId)}&clientId=${encodeURIComponent(state.clientId)}`, null, "GET");
    state.room = payload.state;
    normalizeSelectionAgainstHand();
    queueFlashes();
    if (!silent) {
      state.message = "";
    }
    render();
  } catch (error) {
    showMessage(error.message);
    render();
  }
}

function startPolling() {
  if (state.polling) {
    clearInterval(state.polling);
  }
  state.polling = setInterval(() => {
    refreshState(true);
  }, 1500);
}

async function createRoomAction() {
  const nickname = document.getElementById("nickname-input")?.value?.trim() || getSavedNickname() || "Player";
  saveNickname(nickname);
  const payload = await api("/api/create-room", {
    nickname,
    clientId: state.clientId
  });
  setRoomId(payload.roomId);
  state.room = payload.state;
  clearSelections();
  startPolling();
  render();
}

async function joinRoomAction() {
  const nickname = document.getElementById("join-nickname-input")?.value?.trim() || getSavedNickname() || "Player";
  saveNickname(nickname);
  const payload = await api("/api/join-room", {
    roomId: state.roomId,
    clientId: state.clientId,
    nickname
  });
  state.room = payload.state;
  clearSelections();
  render();
}

async function updateRule(key, value) {
  const patch = { [key]: value };
  const payload = await api("/api/update-settings", {
    roomId: state.roomId,
    clientId: state.clientId,
    patch
  });
  state.room = payload.state;
  render();
}

function toggleCardSelection(cardId) {
  if (state.selected.has(cardId)) {
    state.selected.delete(cardId);
  } else {
    state.selected.add(cardId);
  }
  render();
}

function togglePendingSelection(cardId) {
  if (state.pendingSelected.has(cardId)) {
    state.pendingSelected.delete(cardId);
  } else {
    state.pendingSelected.add(cardId);
  }
  render();
}

async function handleAction(action, target) {
  try {
    switch (action) {
      case "create-room":
        await createRoomAction();
        return;
      case "jump-room": {
        const code = document.getElementById("room-code-input")?.value?.trim()?.toUpperCase();
        if (!code) {
          throw new Error("部屋コードを入力してください。");
        }
        setRoomId(code);
        await refreshState();
        startPolling();
        return;
      }
      case "join-room":
        await joinRoomAction();
        return;
      case "leave-room":
        setRoomId("");
        state.room = null;
        state.activeModal = "";
        clearSelections();
        render();
        return;
      case "copy-link":
        await navigator.clipboard.writeText(shareUrl());
        showMessage("招待URLをコピーしました。");
        return;
      case "refresh-state":
        await refreshState();
        return;
      case "start-round": {
        const payload = await api("/api/start-round", { roomId: state.roomId, clientId: state.clientId });
        state.room = payload.state;
        clearSelections();
        queueFlashes();
        render();
        return;
      }
      case "toggle-card":
        toggleCardSelection(target.dataset.cardId);
        return;
      case "clear-selection":
        state.selected.clear();
        render();
        return;
      case "play-selected": {
        const cardIds = [...state.selected];
        if (cardIds.length === 0) {
          throw new Error("カードを選択してください。");
        }
        const payload = await api("/api/play", { roomId: state.roomId, clientId: state.clientId, cardIds });
        state.room = payload.state;
        clearSelections();
        queueFlashes();
        render();
        return;
      }
      case "pass": {
        const payload = await api("/api/pass", { roomId: state.roomId, clientId: state.clientId });
        state.room = payload.state;
        clearSelections();
        queueFlashes();
        render();
        return;
      }
      case "toggle-pending-card":
        togglePendingSelection(target.dataset.cardId);
        return;
      case "clear-pending":
        state.pendingSelected.clear();
        render();
        return;
      case "resolve-effect": {
        const cardIds = [...state.pendingSelected];
        if (!state.room?.pendingEffect || cardIds.length !== state.room.pendingEffect.count) {
          throw new Error(`${state.room?.pendingEffect?.count || 0}枚選択してください。`);
        }
        const payload = await api("/api/resolve-effect", { roomId: state.roomId, clientId: state.clientId, cardIds });
        state.room = payload.state;
        clearSelections();
        queueFlashes();
        render();
        return;
      }
      case "open-modal":
        openModal(target.dataset.modal);
        return;
      case "close-modal":
        closeModal();
        return;
      case "toggle-rule":
        await updateRule(target.dataset.ruleKey, target.dataset.next === "true");
        return;
      default:
        return;
    }
  } catch (error) {
    showMessage(error.message);
  }
}
document.addEventListener("click", (event) => {
  if (event.target.matches(".info-modal")) {
    closeModal();
    return;
  }

  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }
  handleAction(target.dataset.action, target);
});
document.addEventListener("change", async (event) => {
  const target = event.target;
  if (!target.matches(".rule-select")) {
    return;
  }

  try {
    const rule = state.rulesConfig.find((item) => item.key === target.dataset.ruleKey);
    const option = rule?.options?.find((item) => String(item.value) === String(target.value));
    await updateRule(target.dataset.ruleKey, option ? option.value : target.value);
  } catch (error) {
    showMessage(error.message);
  }
});

async function init() {
  try {
    const response = await fetch("/data/rules-config.json");
    state.rulesConfig = await response.json();
  } catch (error) {
    showMessage("ルール設定の読み込みに失敗しました。");
  }

  if (state.roomId) {
    await refreshState(true);
    startPolling();
  }

  render();
}

window.addEventListener("beforeunload", () => {
  if (state.polling) {
    clearInterval(state.polling);
  }
});

init();
