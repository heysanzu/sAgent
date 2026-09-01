/* ── DOM refs ──────────────────────────────────────────────── */
const messagesEl  = document.getElementById("messages");
const userInputEl = document.getElementById("userInput");
const sendBtn     = document.getElementById("sendBtn");
const clearBtn    = document.getElementById("clearChat");
const menuBtn     = document.getElementById("menuBtn");
const sidebar     = document.getElementById("sidebar");
const closeSbBtn  = document.getElementById("closeSidebar");
const overlay     = document.getElementById("overlay");
const newChatBtn  = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");

/* ── Config ────────────────────────────────────────────────── */
const WORKER_URL = "https://agent.doollearn.workers.dev/";
const MODEL      = "llama-3.3-70b-versatile";

/* ── Order database (in-memory) ───────────────────────────── */
const ORDERS = {
  "ORD-1001": {
    item: "Mechanical Keyboard (TKL)",
    status: "shipped",
    address: "42 Elm Street, New York, NY 10001",
    total: "$129.00",
    date: "Aug 28, 2026",
    tracking: "TRK-992341-US",
    carrier: "FedEx",
    eta: "Sep 3, 2026",
  },
  "ORD-1002": {
    item: "USB-C Hub 7-in-1",
    status: "pending",
    address: "8 Oak Avenue, Los Angeles, CA 90001",
    total: "$49.00",
    date: "Aug 30, 2026",
    tracking: "Pending",
    carrier: "UPS",
    eta: "Sep 6, 2026",
  },
  "ORD-1003": {
    item: "Noise-Cancelling Headphones",
    status: "delivered",
    address: "5 Pine Road, Austin, TX 73301",
    total: "$219.00",
    date: "Aug 20, 2026",
    tracking: "TRK-992343-US",
    carrier: "DHL",
    eta: "Delivered Aug 26, 2026",
  },
  "ORD-1004": {
    item: "Wireless Mouse (Ergonomic)",
    status: "processing",
    address: "99 Maple Dr, Chicago, IL 60601",
    total: "$79.00",
    date: "Aug 31, 2026",
    tracking: "Pending",
    carrier: "USPS",
    eta: "Sep 7, 2026",
  },
};

/* ── Session management (in-memory) ───────────────────────── */
let sessions = [];
let activeId = null;
let history  = []; /* turns sent to API — does NOT include system prompt */
let isBusy   = false;

function startNewSession() {
  activeId = Date.now().toString();
  history  = [];
  sessions.unshift({ id: activeId, title: "New conversation", messages: [], history: [] });
  if (sessions.length > 20) sessions.length = 20;
  renderHistory();
  messagesEl.innerHTML = "";
  renderEmpty();
}

function loadSession(id) {
  const s = sessions.find(s => s.id === id);
  if (!s) return;
  activeId = id;
  history  = s.history || [];
  renderHistory();
  messagesEl.innerHTML = "";
  if (s.messages && s.messages.length) {
    s.messages.forEach(m => appendMessage(m.role, m.html, true));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    renderEmpty();
  }
}

function updateSession(role, html, text) {
  const s = sessions.find(s => s.id === activeId);
  if (!s) return;
  if (!s.messages) s.messages = [];
  s.messages.push({ role, html });
  if (s.title === "New conversation" && role === "user") {
    s.title = text.slice(0, 44) + (text.length > 44 ? "…" : "");
  }
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  sessions.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "history-item" + (s.id === activeId ? " active" : "");
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span>${escapeHtml(s.title)}</span>`;
    btn.addEventListener("click", () => { loadSession(s.id); closeSidebar(); });
    historyList.appendChild(btn);
  });
}

/* ── System prompt ─────────────────────────────────────────── */
const SYSTEM = `You are Agent, a customer support AI for an online store. Be helpful, concise, warm, and direct.

You can:
1. Check order status — when user gives an order ID (format ORD-XXXX)
2. Update shipping address — when user gives order ID + new address
3. Issue a refund — when user requests refund and gives order ID
4. Answer general questions about shipping, returns, payments

STORE POLICIES:
- Standard shipping: 5-7 business days (free over $50)
- Express shipping: 1-2 business days ($12 extra)
- Returns: 30 days from delivery date
- Refunds: 3-5 business days to original payment method
- Payment: Visa, Mastercard, Amex, PayPal, Apple Pay
- Support: 24/7 via Agent; human agents Mon-Fri 9am-5pm EST

STRICT OUTPUT RULES:
- If the user provides a NEW order request requiring an action, output ONLY one of these exact JSON structures:
  * Check status: {"action":"order_status","orderId":"ORD-XXXX"}
  * Update address: {"action":"update_shipping","orderId":"ORD-XXXX","newAddress":"full address"}
  * Request refund: {"action":"refund","orderId":"ORD-XXXX"}
- If you are answering follow-up questions or general support queries, respond in plain text only. Do NOT output JSON.
- Never output an empty response.`;

/* ── SVG icons ─────────────────────────────────────────────── */
const ICONS = {
  box:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`,
  pin:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  refund: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  warn:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  check:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

/* ── Sidebar toggle ────────────────────────────────────────── */
function openSidebar()  { sidebar.classList.add("open");    overlay.classList.add("open"); }
function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("open"); }

menuBtn.addEventListener("click", openSidebar);
closeSbBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);
newChatBtn.addEventListener("click", () => { startNewSession(); closeSidebar(); });

/* ── Quick action buttons ──────────────────────────────────── */
document.querySelectorAll(".quick-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    closeSidebar();
    userInputEl.value = btn.dataset.prompt;
    userInputEl.dispatchEvent(new Event("input"));
    userInputEl.focus();
  });
});

/* ── Input behaviour ───────────────────────────────────────── */
userInputEl.addEventListener("input", () => {
  userInputEl.style.height = "auto";
  userInputEl.style.height = Math.min(userInputEl.scrollHeight, 140) + "px";
  sendBtn.disabled = !userInputEl.value.trim() || isBusy;
});

userInputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
});

sendBtn.addEventListener("click", handleSend);

clearBtn.addEventListener("click", () => {
  const s = sessions.find(s => s.id === activeId);
  if (s) { s.messages = []; s.history = []; s.title = "New conversation"; renderHistory(); }
  history = [];
  messagesEl.innerHTML = "";
  renderEmpty();
});

/* ── Utilities ─────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderText(str) {
  return escapeHtml(str)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* Try to extract JSON from model reply — handles ```json fences and prose wrapping */
function extractJSON(str) {
  const fenced = str.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const candidate = fenced ? fenced[1].trim() : str.trim();
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
}

/* ── Render helpers ────────────────────────────────────────── */
function renderEmpty() {
  const el = document.createElement("div");
  el.className = "empty-state";
  el.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <h2>How can I help you today?</h2>
    <p>Ask about an order, request a refund, update your shipping address, or any general question.</p>`;
  messagesEl.appendChild(el);
}

function appendMessage(role, html, replay = false) {
  messagesEl.querySelector(".empty-state")?.remove();

  const avatarSVG = {
    agent: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    user:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  };

  const row    = document.createElement("div");
  row.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = avatarSVG[role] || avatarSVG.agent;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = html;

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = timestamp();

  row.appendChild(avatar);
  row.appendChild(bubble);
  row.appendChild(time);
  messagesEl.appendChild(row);

  if (!replay) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "message agent";
  row.id = "typing";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

  const ind = document.createElement("div");
  ind.className = "typing-indicator";
  ind.innerHTML = "<span></span><span></span><span></span>";

  row.appendChild(avatar);
  row.appendChild(ind);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() { document.getElementById("typing")?.remove(); }

function showError(msg) {
  appendMessage("agent", `
    <div class="error-card">
      ${ICONS.warn}
      <div><strong>Something went wrong.</strong><br>${escapeHtml(msg)}</div>
    </div>`);
}

/* ── Action card renderers ─────────────────────────────────── */
function renderOrderStatus(orderId) {
  const key = (orderId || "").toUpperCase().trim();
  const o   = ORDERS[key];
  if (!o) {
    return `<p>No order found for <strong>${escapeHtml(key)}</strong>. Double-check your order ID — it should look like <strong>ORD-1001</strong>.</p>`;
  }
  return `
    <p>Here are the details for <strong>${escapeHtml(key)}</strong>:</p>
    <div class="action-card">
      <div class="action-card-header">${ICONS.box} Order Details</div>
      <div class="action-card-body">
        <div class="action-row"><span class="action-label">Item</span><span class="action-value">${escapeHtml(o.item)}</span></div>
        <div class="action-divider"></div>
        <div class="action-row"><span class="action-label">Status</span><span class="action-value"><span class="badge ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></span></div>
        <div class="action-row"><span class="action-label">Carrier</span><span class="action-value">${escapeHtml(o.carrier)}</span></div>
        <div class="action-row"><span class="action-label">Tracking</span><span class="action-value">${escapeHtml(o.tracking)}</span></div>
        <div class="action-row"><span class="action-label">ETA</span><span class="action-value">${escapeHtml(o.eta)}</span></div>
        <div class="action-divider"></div>
        <div class="action-row"><span class="action-label">Ship to</span><span class="action-value">${escapeHtml(o.address)}</span></div>
        <div class="action-row"><span class="action-label">Order Date</span><span class="action-value">${escapeHtml(o.date)}</span></div>
        <div class="action-row"><span class="action-label">Total</span><span class="action-value"><strong>${escapeHtml(o.total)}</strong></span></div>
      </div>
    </div>`;
}

function renderShippingUpdate(orderId, newAddress) {
  const key = (orderId || "").toUpperCase().trim();
  const o   = ORDERS[key];
  if (!o) return `<p>No order found for <strong>${escapeHtml(key)}</strong>. Please verify the order ID.</p>`;
  if (o.status === "delivered" || o.status === "refunded") {
    return `<p>Cannot update address — order <strong>${escapeHtml(key)}</strong> has already been <strong>${escapeHtml(o.status)}</strong>.</p>`;
  }
  const prev = o.address;
  o.address  = newAddress;
  return `
    <p>Address updated for <strong>${escapeHtml(key)}</strong>.</p>
    <div class="action-card">
      <div class="action-card-header">${ICONS.pin} Address Updated</div>
      <div class="action-card-body">
        <div class="action-row"><span class="action-label">Previous</span><span class="action-value" style="text-decoration:line-through;color:var(--g400)">${escapeHtml(prev)}</span></div>
        <div class="action-row"><span class="action-label">New address</span><span class="action-value">${escapeHtml(newAddress)}</span></div>
        <div class="action-row"><span class="action-label">Status</span><span class="action-value"><span class="badge delivered">${ICONS.check} confirmed</span></span></div>
      </div>
    </div>`;
}

function renderRefund(orderId) {
  const key = (orderId || "").toUpperCase().trim();
  const o   = ORDERS[key];
  if (!o) return `<p>No order found for <strong>${escapeHtml(key)}</strong>. Please check the order ID.</p>`;
  if (o.status === "refunded") {
    return `<p>A refund was already processed for <strong>${escapeHtml(key)}</strong>. Allow 3–5 business days for it to appear.</p>`;
  }
  if (o.status !== "delivered") {
    return `
      <p>Refunds are only available after delivery. <strong>${escapeHtml(key)}</strong> is currently <span class="badge ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span>.</p>
      <p style="margin-top:8px;font-size:13px;color:var(--g500)">Once delivered, come back and I'll process it right away.</p>`;
  }
  o.status = "refunded";
  return `
    <p>Refund initiated for <strong>${escapeHtml(key)}</strong>.</p>
    <div class="action-card">
      <div class="action-card-header">${ICONS.refund} Refund Confirmed</div>
      <div class="action-card-body">
        <div class="action-row"><span class="action-label">Order</span><span class="action-value">${escapeHtml(key)}</span></div>
        <div class="action-row"><span class="action-label">Item</span><span class="action-value">${escapeHtml(o.item)}</span></div>
        <div class="action-row"><span class="action-label">Amount</span><span class="action-value"><strong>${escapeHtml(o.total)}</strong></span></div>
        <div class="action-divider"></div>
        <div class="action-row"><span class="action-label">Status</span><span class="action-value"><span class="badge refunded">refunded</span></span></div>
        <div class="action-row"><span class="action-label">Timeline</span><span class="action-value">3–5 business days</span></div>
        <div class="action-row"><span class="action-label">To</span><span class="action-value">Original payment method</span></div>
      </div>
    </div>`;
}

/* ── Main send handler ─────────────────────────────────────── */
async function handleSend() {
  const text = userInputEl.value.trim();
  if (!text || isBusy) return;

  /* Render + record user message */
  const userHtml = renderText(text);
  appendMessage("user", userHtml);
  updateSession("user", userHtml, text);

  /* Add turn to API history array */
  history.push({ role: "user", content: text });

  /* Reset input */
  userInputEl.value        = "";
  userInputEl.style.height = "auto";
  isBusy                   = true;
  sendBtn.disabled         = true;

  showTyping();

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM },
          ...history,
        ],
      }),
    });

    const bodyText = await res.text();
    let data;
    try { data = JSON.parse(bodyText); }
    catch (_) { throw new Error(`Worker returned non-JSON: ${bodyText.slice(0, 120)}`); }

    if (!res.ok) {
      const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const rawReply = (data?.choices?.[0]?.message?.content || "").trim();

    if (!rawReply) {
      console.warn("[Agent] Empty reply. Full response:", JSON.stringify(data));
      throw new Error("Agent returned an empty reply. Check worker logs.");
    }

    removeTyping();

    /* Parse action JSON */
    const parsed = extractJSON(rawReply);
    let agentHtml = "";
    let historyContent = rawReply;

    if (parsed?.action === "order_status") {
      agentHtml = renderOrderStatus(parsed.orderId || "");
      historyContent = `Displayed order status for ${parsed.orderId || "order"}.`;
    } else if (parsed?.action === "update_shipping") {
      agentHtml = renderShippingUpdate(parsed.orderId || "", parsed.newAddress || "");
      historyContent = `Updated shipping address for ${parsed.orderId || "order"} to: ${parsed.newAddress || "new address"}.`;
    } else if (parsed?.action === "refund") {
      agentHtml = renderRefund(parsed.orderId || "");
      historyContent = `Processed refund request for ${parsed.orderId || "order"}.`;
    } else {
      agentHtml = renderText(rawReply);
    }

    /* Save clean prose to history so follow-up requests stay clear */
    history.push({ role: "assistant", content: historyContent });

    /* Save history on session so it survives tab switch */
    const s = sessions.find(s => s.id === activeId);
    if (s) s.history = [...history];

    appendMessage("agent", agentHtml);
    updateSession("agent", agentHtml, rawReply);

  } catch (err) {
    removeTyping();
    /* Remove user turn if call failed */
    history.pop();
    showError(err.message || "Could not reach the server. Please try again.");
    console.error("[Agent error]", err);
  } finally {
    isBusy           = false;
    sendBtn.disabled = !userInputEl.value.trim();
  }
}

/* ── Init ──────────────────────────────────────────────────── */
startNewSession();
