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

/* ── Session / history management (in-memory) ─────────────── */
let sessions = [];
let activeId = null;
let history  = []; // API conversation history for current session
let isBusy   = false;

function saveSessions() { /* in-memory only — no persistence needed */ }

function startNewSession() {
  activeId = Date.now().toString();
  history  = [];
  sessions.unshift({ id: activeId, title: "New conversation", ts: Date.now() });
  if (sessions.length > 20) sessions = sessions.slice(0, 20);
  saveSessions();
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
  (s.messages || []).forEach(m => appendMessage(m.role, m.html, true));
  if (!s.messages?.length) renderEmpty();
  else messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateSession(role, html, text) {
  const s = sessions.find(s => s.id === activeId);
  if (!s) return;
  if (!s.messages) s.messages = [];
  s.messages.push({ role, html });
  /* derive a title from the first user message */
  if (s.title === "New conversation" && role === "user") {
    s.title = text.slice(0, 42) + (text.length > 42 ? "…" : "");
  }
  s.ts = Date.now();
  saveSessions();
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

CAPABILITIES:
1. Check order status — user gives an order ID like ORD-XXXX
2. Update shipping address — user provides order ID + new address
3. Issue refund — user provides order ID; only delivered orders qualify
4. Answer general questions — shipping, returns, payments, policies

STORE POLICIES:
- Standard shipping: 5–7 business days (free over $50)
- Express shipping: 1–2 business days ($12)
- Return window: 30 days from delivery
- Refund processing: 3–5 business days to original payment
- Payment: Visa, Mastercard, Amex, PayPal, Apple Pay
- Support: 24/7 via Agent; human agents Mon–Fri 9am–5pm EST

RESPONSE RULES — follow exactly:

When the user gives an order ID (ORD-XXXX), respond ONLY with this JSON (no extra text):
{"action":"order_status","orderId":"ORD-XXXX"}

When the user confirms a new shipping address with an order ID, respond ONLY with:
{"action":"update_shipping","orderId":"ORD-XXXX","newAddress":"the full address"}

When the user requests a refund and gives an order ID, respond ONLY with:
{"action":"refund","orderId":"ORD-XXXX"}

For everything else, respond in plain conversational text. Be concise (under 100 words). No markdown, no bullet lists in JSON responses. If the user seems frustrated, acknowledge it first.`;

/* ── Sidebar toggle ─────────────────────────────────────────── */
function openSidebar()  { sidebar.classList.add("open");  overlay.classList.add("open"); }
function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("open"); }

menuBtn.addEventListener("click", openSidebar);
closeSbBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);
newChatBtn.addEventListener("click", () => { startNewSession(); closeSidebar(); });

/* ── Quick action buttons ───────────────────────────────────── */
document.querySelectorAll(".quick-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    closeSidebar();
    userInputEl.value = btn.dataset.prompt;
    userInputEl.dispatchEvent(new Event("input"));
    userInputEl.focus();
  });
});

/* ── Input behaviour ────────────────────────────────────────── */
userInputEl.addEventListener("input", () => {
  userInputEl.style.height = "auto";
  userInputEl.style.height = Math.min(userInputEl.scrollHeight, 140) + "px";
  sendBtn.disabled = userInputEl.value.trim() === "" || isBusy;
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
  if (s) { s.messages = []; s.title = "New conversation"; saveSessions(); renderHistory(); }
  history = [];
  messagesEl.innerHTML = "";
  renderEmpty();
});

/* ── Render helpers ─────────────────────────────────────────── */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Convert simple markdown-ish text to safe HTML */
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

function renderEmpty() {
  const el = document.createElement("div");
  el.className = "empty-state";
  el.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <h2>How can I help you today?</h2>
    <p>Ask about an order, request a refund, update your shipping address, or ask a general question.</p>`;
  messagesEl.appendChild(el);
}

function appendMessage(role, html, replay = false) {
  /* Remove empty state if present */
  messagesEl.querySelector(".empty-state")?.remove();

  const row = document.createElement("div");
  row.className = `message ${role}`;

  const avatarIcons = {
    agent: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    user:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  };

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = avatarIcons[role] || avatarIcons.agent;

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
  return bubble;
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

/* ── SVG icon helper for cards ──────────────────────────────── */
const ICONS = {
  box:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`,
  pin:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  refund: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  warn:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  check:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  truck:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect width="13" height="8" x="9" y="11" rx="2"/><circle cx="11" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>`,
};

/* ── Action renderers ───────────────────────────────────────── */

function renderOrderStatus(orderId) {
  const o = ORDERS[orderId.toUpperCase()];
  if (!o) {
    return `<p>I couldn't find an order with ID <strong>${escapeHtml(orderId)}</strong>. Please double-check and try again — order IDs look like <strong>ORD-1001</strong>.</p>`;
  }

  return `
    <p>Here are the details for <strong>${escapeHtml(orderId)}</strong>:</p>
    <div class="action-card">
      <div class="action-card-header">${ICONS.box} Order Details</div>
      <div class="action-card-body">
        <div class="action-row">
          <span class="action-label">Item</span>
          <span class="action-value">${escapeHtml(o.item)}</span>
        </div>
        <div class="action-divider"></div>
        <div class="action-row">
          <span class="action-label">Status</span>
          <span class="action-value"><span class="badge ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></span>
        </div>
        <div class="action-row">
          <span class="action-label">Carrier</span>
          <span class="action-value">${escapeHtml(o.carrier)}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Tracking</span>
          <span class="action-value">${escapeHtml(o.tracking)}</span>
        </div>
        <div class="action-row">
          <span class="action-label">ETA</span>
          <span class="action-value">${escapeHtml(o.eta)}</span>
        </div>
        <div class="action-divider"></div>
        <div class="action-row">
          <span class="action-label">Ship to</span>
          <span class="action-value">${escapeHtml(o.address)}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Order Date</span>
          <span class="action-value">${escapeHtml(o.date)}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Total</span>
          <span class="action-value"><strong>${escapeHtml(o.total)}</strong></span>
        </div>
      </div>
    </div>`;
}

function renderShippingUpdate(orderId, newAddress) {
  const id = orderId.toUpperCase();
  const o  = ORDERS[id];
  if (!o) {
    return `<p>I couldn't find order <strong>${escapeHtml(orderId)}</strong>. Please verify the order ID and try again.</p>`;
  }
  if (o.status === "delivered" || o.status === "refunded") {
    return `<p>The shipping address for <strong>${escapeHtml(id)}</strong> can't be updated — the order has already been <strong>${escapeHtml(o.status)}</strong>.</p>`;
  }

  const prev = o.address;
  o.address  = newAddress;

  return `
    <p>Shipping address updated for <strong>${escapeHtml(id)}</strong>.</p>
    <div class="action-card">
      <div class="action-card-header">${ICONS.pin} Address Updated</div>
      <div class="action-card-body">
        <div class="action-row">
          <span class="action-label">Previous</span>
          <span class="action-value" style="text-decoration:line-through;color:var(--g400)">${escapeHtml(prev)}</span>
        </div>
        <div class="action-row">
          <span class="action-label">New address</span>
          <span class="action-value">${escapeHtml(newAddress)}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Status</span>
          <span class="action-value"><span class="badge delivered">${ICONS.check} confirmed</span></span>
        </div>
      </div>
    </div>`;
}

function renderRefund(orderId) {
  const id = orderId.toUpperCase();
  const o  = ORDERS[id];
  if (!o) {
    return `<p>I couldn't find order <strong>${escapeHtml(orderId)}</strong>. Please check the ID and try again.</p>`;
  }
  if (o.status === "refunded") {
    return `<p>A refund has already been processed for order <strong>${escapeHtml(id)}</strong>. It should arrive within 3–5 business days of when it was initiated.</p>`;
  }
  if (o.status !== "delivered") {
    return `
      <p>Refunds are only available after delivery. Order <strong>${escapeHtml(id)}</strong> is currently <span class="badge ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span>.</p>
      <p style="margin-top:8px;font-size:13px;color:var(--g500)">Once it's delivered, come back and I'll process your refund right away.</p>`;
  }

  o.status = "refunded";

  return `
    <p>Refund initiated for <strong>${escapeHtml(id)}</strong>.</p>
    <div class="action-card">
      <div class="action-card-header">${ICONS.refund} Refund Confirmed</div>
      <div class="action-card-body">
        <div class="action-row">
          <span class="action-label">Order</span>
          <span class="action-value">${escapeHtml(id)}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Item</span>
          <span class="action-value">${escapeHtml(o.item)}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Refund amount</span>
          <span class="action-value"><strong>${escapeHtml(o.total)}</strong></span>
        </div>
        <div class="action-divider"></div>
        <div class="action-row">
          <span class="action-label">Status</span>
          <span class="action-value"><span class="badge refunded">refunded</span></span>
        </div>
        <div class="action-row">
          <span class="action-label">Timeline</span>
          <span class="action-value">3–5 business days</span>
        </div>
        <div class="action-row">
          <span class="action-label">To</span>
          <span class="action-value">Original payment method</span>
        </div>
      </div>
    </div>`;
}

/* ── Main send handler ──────────────────────────────────────── */

async function handleSend() {
  const text = userInputEl.value.trim();
  if (!text || isBusy) return;

  /* Render user bubble */
  const userHtml = renderText(text);
  appendMessage("user", userHtml);
  updateSession("user", userHtml, text);

  /* Push to API history */
  history.push({ role: "user", content: text });

  /* Reset input */
  userInputEl.value       = "";
  userInputEl.style.height = "auto";
  isBusy                   = true;
  sendBtn.disabled         = true;

  showTyping();

  try {
    const res = await fetch("https://agent.doollearn.workers.dev/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile", // Use an active model ID
    max_tokens: 1000,
    messages: [
      { role: "system", content: SYSTEM },
      ...history,
    ],
  }),
});
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data     = await res.json();
    /* Groq returns OpenAI-compatible shape: choices[0].message.content */
    const rawReply = (data.choices?.[0]?.message?.content || "").trim();

    /* Push assistant reply to history */
    history.push({ role: "assistant", content: rawReply });

    removeTyping();

    /* Try to parse as action JSON */
    let parsed = null;
    try {
      const cleaned = rawReply.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (_) { /* plain text */ }

    let agentHtml = "";

    if (parsed?.action === "order_status") {
      agentHtml = renderOrderStatus(parsed.orderId || "");
    } else if (parsed?.action === "update_shipping") {
      agentHtml = renderShippingUpdate(parsed.orderId || "", parsed.newAddress || "");
    } else if (parsed?.action === "refund") {
      agentHtml = renderRefund(parsed.orderId || "");
    } else {
      agentHtml = renderText(rawReply);
    }

    appendMessage("agent", agentHtml);
    updateSession("agent", agentHtml, rawReply);

  } catch (err) {
    removeTyping();

    const errHtml = `
      <div class="error-card">
        ${ICONS.warn}
        <div>
          <strong>Something went wrong.</strong><br>
          ${escapeHtml(err.message || "Could not reach the server.")} — please try again.
        </div>
      </div>`;

    appendMessage("agent", errHtml);
    console.error("[Agent]", err);
  } finally {
    isBusy           = false;
    sendBtn.disabled = userInputEl.value.trim() === "";
  }
}

/* ── Init ───────────────────────────────────────────────────── */

renderHistory();

/* Resume most recent session or start fresh */
if (sessions.length > 0) {
  loadSession(sessions[0].id);
} else {
  startNewSession();
}
