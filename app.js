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
  activeModal: "",
  playAnimation: null,
  playAnimationTimer: null,
  pilePulse: false,
  pilePulseTimer: null
};

const CARD_RANK_LABELS = {
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
  15: "2",
  16: "JK"
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

function normalizeErrorMessage(message) {
  const text = String(message || "");
  if (!text) {
    return "Something went wrong.";
  }
  if (text.includes("UPSTASH_REDIS") || text.includes("Persistent Redis storage")) {
    return "Persistent Redis storage is not configured. Add the required environment variables.";
  }
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
  if (!response.ok) {
    throw new Error(normalizeErrorMessage(payload.error || "Something went wrong."));
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

function clearPlayAnimation() {
  if (state.playAnimationTimer) {
    clearTimeout(state.playAnimationTimer);
    state.playAnimationTimer = null;
  }
  state.playAnimation = null;
}

async function syncRoomAfterActionError(action) {
  if (!state.roomId) {
    return;
  }

  const syncSensitiveActions = new Set([
    "jump-room",
    "join-room",
    "refresh-state",
    "start-round",
    "play-selected",
    "pass",
    "resolve-effect"
  ]);

  if (!syncSensitiveActions.has(action)) {
    return;
  }

  try {
    await refreshState(true);
  } catch {
    // Preserve the original action error if room sync also fails.
  }
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
    <section class="landing-shell">
      <article class="hero-card form-card landing-card">
        <div>
          <div class="panel-kicker">Daifugo Arena</div>
          <h1 class="brand landing-title">Create or join a room</h1>
          <p class="muted landing-copy">Pick a nickname, start a table, or enter a room code to jump in.</p>
        </div>
        ${renderToast()}
        <label>
          <div class="muted">Nickname</div>
          <input id="nickname-input" class="input" maxlength="20" placeholder="Your name" value="${escapeHtml(getSavedNickname())}" />
        </label>
        <div class="setup-grid">
          <section class="setup-section primary-setup">
            <strong>Create a new room</strong>
            <div class="muted helper-text">Start a table and share the link with other players.</div>
            <button class="button primary setup-button" data-action="create-room">Create room</button>
          </section>
          <div class="divider-label">or</div>
          <section class="setup-section secondary-setup">
            <strong>Join with a room code</strong>
            <input id="room-code-input" class="input" maxlength="6" placeholder="6-character room code" />
            <button class="button secondary setup-button" data-action="jump-room">Join room</button>
          </section>
        </div>
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
      <div class="muted">${player.isBot ? "Bot" : "Human"} / 謇区惆 ${player.handCount}譫・/ ${player.lastRoundRole || "蠕・ｩ滉ｸｭ"}</div>
    </div>
  `;
}

function renderHistory() {
  const rounds = state.room?.history || [];
  if (rounds.length === 0) {
    return `<div class="empty">縺ｾ縺繝ｩ繧ｦ繝ｳ繝臥ｵ先棡縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・/div>`;
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
    return `<div class="empty">繝ｭ繧ｰ縺ｯ縺ｾ縺縺ゅｊ縺ｾ縺帙ｓ縲・/div>`;
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

function renderSeatHand(player, seatClass) {
  const isSelf = player.id === state.room?.self?.id;
  if (isSelf || player.handCount <= 0) {
    return "";
  }

  return `
    <div class="seat-hand seat-hand-${seatClass}" aria-label="${player.handCount} cards remaining">
      ${Array.from(
        { length: player.handCount },
        (_, index) => `<span class="seat-hand-card" style="--hand-index:${index}; --hand-total:${player.handCount};"></span>`
      ).join("")}
    </div>
  `;
}
function renderSeatCard(player) {
  const seatClass = relativeSeatClass(player);
  const badges = [];
  if (player.isCurrent) {
    badges.push("TURN");
  }
  if (player.status === "passed") {
    badges.push("PASS");
  }
  if (player.status === "finished") {
    badges.push("OUT");
  }
  if (player.status === "bottom") {
    badges.push("BOTTOM");
  }
  if (player.isBot) {
    badges.push("BOT");
  }

  return `
    <article class="seat-card ${seatClass} ${player.isCurrent ? "current" : ""}">
      <div class="rule-head seat-head">
        <strong class="seat-name">${escapeHtml(player.nickname)}</strong>
        <span class="badge">${player.points}pt</span>
      </div>
      ${badges.length ? `<div class="meta-row">${badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
      ${renderSeatHand(player, seatClass)}
    </article>
  `;
}
function renderPile() {
  const combo = state.room?.game?.currentCombo;
  if (!combo) {
    return `<div class="empty">Play a card to start the pile.</div>`;
  }

  return `
    <div class="pile-display">
      <div class="panel-kicker">Current Combo</div>
      <h2 class="pile-title">${escapeHtml(combo.text)}</h2>
      <div class="pile-cards ${state.pilePulse ? "live" : ""}">
        ${combo.cards
          .map((card, index, cards) =>
            renderPlayingCard(card, {
              compact: true,
              className: "pile-card",
              style: `--pile-index:${index}; --pile-tilt:${(index - (cards.length - 1) / 2) * 8}deg;`
            })
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
    flags.push("Revolution");
  }
  if (room.game.elevenBack) {
    flags.push("11 Back");
  }
  if (room.game.lockedSuits?.length) {
    flags.push(`Lock ${room.game.lockedSuits.join(" ")}`);
  }

  return `
    <div class="status-strip">
      <div class="status-main ${room.permissions.canPlay ? "active" : ""}">
        <strong>${room.permissions.canPlay ? "Your turn" : `${escapeHtml(turnPlayer?.nickname || "Waiting")}'s turn`}</strong>
        <span>${room.permissions.canPlay ? "Select cards and drop them into the center." : "Watch the table and get ready."}</span>
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
          <strong>Hand ${hand.length}</strong>
          <div class="muted hand-copy">${selectedCount ? `${selectedCount} selected` : canAct ? "Choose a combo to attack." : "Waiting for the next turn."}</div>
        </div>
        <div class="hand-actions">
          ${selectedCount ? '<button class="button secondary" data-action="clear-selection">Clear</button>' : ""}
          ${canAct ? '<button class="button primary" data-action="play-selected">Play</button>' : ""}
          ${canPass ? '<button class="button danger" data-action="pass">Pass</button>' : ""}
        </div>
      </div>
      <div class="hand-grid">
        ${hand
          .map((card, index, cards) =>
            renderPlayingCard(card, {
              interactive: true,
              action: "toggle-card",
              cardId: card.id,
              selected: state.selected.has(card.id),
              disabled: !canAct,
              style: `--card-order:${index}; --card-tilt:${(index - (cards.length - 1) / 2) * 2.8}deg;`
            })
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
            <h2>Table overview</h2>
          </div>
          <button class="button ghost modal-close" data-action="close-modal">Close</button>
        </div>
        <div class="modal-scroll info-sections">
          <section class="info-section">
            <div class="panel-kicker">Standings</div>
            <div class="metric-stack">${playersByScore.map(renderPlayerSummary).join("")}</div>
          </section>
          <section class="info-section">
            <div class="panel-kicker">Rules</div>
            <div class="rule-columns">${renderRules()}</div>
          </section>
          <section class="info-section">
            <div class="panel-kicker">History</div>
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
  const heading = pending.type === "give"
    ? `Choose ${pending.count} card${pending.count > 1 ? "s" : ""} for ${pending.targetNickname}`
    : `Choose ${pending.count} card${pending.count > 1 ? "s" : ""}`;

  return `
    <div class="overlay">
      <div class="overlay-card">
        <div class="panel-kicker">Special Effect</div>
        <h2>${escapeHtml(heading)}</h2>
        <p class="muted">Select exactly ${pending.count} card${pending.count > 1 ? "s" : ""} to resolve the effect.</p>
        <div class="hand-grid">
          ${hand
            .map((card, index) =>
              renderPlayingCard(card, {
                interactive: true,
                action: "toggle-pending-card",
                cardId: card.id,
                selected: state.pendingSelected.has(card.id),
                style: `--card-order:${index}; --card-tilt:0deg;`
              })
            )
            .join("")}
        </div>
        <div class="top-actions" style="margin-top:16px;">
          <button class="button secondary" data-action="clear-pending">Clear</button>
          <button class="button primary" data-action="resolve-effect">Resolve</button>
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
        <h2>${locked ? "This room is locked to current players." : "Enter a nickname to join the table."}</h2>
        <p class="muted">${locked ? "Only players who were already seated can continue in this round." : "If a seat is open, you can jump in immediately."}</p>
        ${locked ? "" : `<input id="join-nickname-input" class="input" maxlength="20" value="${escapeHtml(getSavedNickname())}" placeholder="Nickname" />`}
        <div class="top-actions" style="margin-top:16px;">
          ${locked ? `<button class="button primary" data-action="leave-room">Back</button>` : `<button class="button primary" data-action="join-room">Join</button>`}
        </div>
      </div>
    </div>
  `;
}

function renderRoom() {
  const room = state.room;
  const canStart = room.permissions?.canStart;
  const selfName = room.self?.nickname || "Guest";

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
            <button class="button ghost" data-action="open-modal" data-modal="info">Info</button>
            <button class="button ghost" data-action="copy-link">Copy Link</button>
            ${canStart ? `<button class="button primary" data-action="start-round">${room.status === "round_over" ? "Next Round" : "Start Round"}</button>` : ""}
          </div>
        </div>
      </section>
      <section class="panel board-panel">
        <section class="board-stage simple-board-stage ${state.playAnimation ? "play-active" : ""} ${state.pilePulse ? "pile-live" : ""}">
          <div class="board-top">
            ${renderBoardMetrics()}
          </div>
          <div class="seat-layer">
            ${room.players.map(renderSeatCard).join("")}
          </div>
          <div class="center-pile">
            ${renderPile()}
          </div>
          ${renderPlayBurst()}
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
          <h1 class="brand">Loading room...</h1>
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
    setRoomState(payload.state);
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
  setRoomState(payload.state);
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
  setRoomState(payload.state);
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
  setRoomState(payload.state);
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
          throw new Error("Enter a room code.");
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
        showMessage("Room link copied.");
        return;
      case "refresh-state":
        await refreshState();
        return;
      case "start-round": {
        const payload = await api("/api/start-round", { roomId: state.roomId, clientId: state.clientId });
        setRoomState(payload.state);
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
        if (!state.room?.permissions?.canPlay) {
          await refreshState(true);
          if (!state.room?.permissions?.canPlay) {
            throw new Error("It is no longer your turn. The table has been refreshed.");
          }
        }

        normalizeSelectionAgainstHand();
        const handIds = new Set(state.room?.self?.hand?.map((card) => card.id) || []);
        const cardIds = [...state.selected].filter((cardId) => handIds.has(cardId));
        if (cardIds.length === 0) {
          throw new Error("Select at least one card before playing.");
        }
        if (cardIds.length !== state.selected.size) {
          state.selected = new Set(cardIds);
          throw new Error("Some selected cards are no longer in your hand. Choose again.");
        }
        const cards = (state.room?.self?.hand || []).filter((card) => cardIds.includes(card.id));
        triggerPlayAnimation(cards);
        const payload = await api("/api/play", { roomId: state.roomId, clientId: state.clientId, cardIds });
        setRoomState(payload.state);
        clearSelections();
        queueFlashes();
        render();
        return;
      }
      case "pass": {
        const payload = await api("/api/pass", { roomId: state.roomId, clientId: state.clientId });
        setRoomState(payload.state);
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
          throw new Error(`Select exactly ${state.room?.pendingEffect?.count || 0} cards.`);
        }
        const payload = await api("/api/resolve-effect", { roomId: state.roomId, clientId: state.clientId, cardIds });
        setRoomState(payload.state);
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
    if (action === "play-selected") {
      clearPlayAnimation();
    }
    await syncRoomAfterActionError(action);
    showMessage(error.message);
    render();
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
    showMessage("Failed to load rule settings.");
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
  if (state.playAnimationTimer) {
    clearTimeout(state.playAnimationTimer);
  }
  if (state.pilePulseTimer) {
    clearTimeout(state.pilePulseTimer);
  }
});

init();

