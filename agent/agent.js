/* ── DOM refs ─────────────────────────────────────────────── */
const messagesEl  = document.getElementById("messages");
const userInputEl = document.getElementById("userInput");
const sendBtn     = document.getElementById("sendBtn");
const clearBtn    = document.getElementById("clearChat");
const menuBtn     = document.getElementById("menuBtn");
const sidebar     = document.getElementById("sidebar");
const closeSbBtn  = document.getElementById("closeSidebar");
const overlay     = document.getElementById("overlay");

/* ── Simulated order database ────────────────────────────── */
const ORDERS = {
  "ORD-1001": { item: "Mechanical Keyboard",    status: "shipped",   address: "42 Elm St, NY 10001",       total: "$129.00", date: "Aug 28, 2026", tracking: "TRK992341" },
  "ORD-1002": { item: "USB-C Hub (7-in-1)",     status: "pending",   address: "8 Oak Ave, LA 90001",       total: "$49.00",  date: "Aug 30, 2026", tracking: "TRK992342" },
  "ORD-1003": { item: "Noise-Cancelling Headphones", status: "delivered", address: "5 Pine Rd, TX 73301",  total: "$219.00", date: "Aug 25, 2026", tracking: "TRK992343" },
};

/* ── Conversation history for context ───────────────────── */
const conversationHistory = [];

/* ── System prompt ───────────────────────────────────────── */
const SYSTEM_PROMPT = `You are Agent, a customer support AI for an online store. You are helpful, concise, and professional.

You can handle:
1. Check order status — when a user provides an order ID (format: ORD-XXXX), return the details as a JSON action.
2. Update shipping details — collect the order ID and new address, confirm the update.
3. Issue refunds — collect the order ID, verify eligibility (delivered orders qualify), initiate refund.
4. Answer general customer questions — shipping policy, return policy, payment methods, etc.

STORE POLICIES:
- Shipping: Standard 5–7 days, Express 2 days ($12 extra).
- Returns: 30-day return window from delivery date.
- Refunds: Processed within 3–5 business days to original payment method.
- Support hours: 24/7 via Agent (human escalation Mon–Fri, 9–5 EST).
- Payment: Visa, Mastercard, Amex, PayPal, Apple Pay.

When a user provides an order ID, respond with valid JSON in this exact format (nothing else, no prose):
{"action":"order_status","orderId":"ORD-XXXX"}

When a user confirms a shipping update with order ID and new address, respond with:
{"action":"update_shipping","orderId":"ORD-XXXX","newAddress":"full address here"}

When a user requests a refund with an order ID, respond with:
{"action":"refund","orderId":"ORD-XXXX"}

For all other messages, respond in plain conversational text (no JSON). Keep responses under 120 words. Be friendly and direct.`;

/* ── Sidebar toggle ──────────────────────────────────────── */
function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("open");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("open");
}

menuBtn.addEventListener("click", openSidebar);
closeSbBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

/* ── Quick action buttons ────────────────────────────────── */
document.querySelectorAll(".quick-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    closeSidebar();
    userInputEl.value = btn.dataset.prompt;
    userInputEl.dispatchEvent(new Event("input"));
    userInputEl.focus();
  });
});

/* ── Auto-resize textarea ────────────────────────────────── */
userInputEl.addEventListener("input", () => {
  userInputEl.style.height = "auto";
  userInputEl.style.height = Math.min(userInputEl.scrollHeight, 140) + "px";
  sendBtn.disabled = userInputEl.value.trim() === "";
});

/* ── Send on Enter (Shift+Enter = newline) ───────────────── */
userInputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
});

sendBtn.addEventListener("click", handleSend);

/* ── Clear conversation ──────────────────────────────────── */
clearBtn.addEventListener("click", () => {
  conversationHistory.length = 0;
  messagesEl.innerHTML = "";
  appendWelcome();
});

/* ── Render helpers ──────────────────────────────────────── */

function svgIcon(name) {
  const icons = {
    agent: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
    user:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    box:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`,
    pin:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    refund:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  };
  return icons[name] || "";
}

function appendMessage(role, htmlContent) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = svgIcon(role === "agent" ? "agent" : "user");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = htmlContent;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function showTyping() {
  const wrapper = document.createElement("div");
  wrapper.className = "message agent";
  wrapper.id = "typing";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = svgIcon("agent");

  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  indicator.innerHTML = "<span></span><span></span><span></span>";

  wrapper.appendChild(avatar);
  wrapper.appendChild(indicator);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

/* ── Action renderers ────────────────────────────────────── */

function renderOrderStatus(orderId) {
  const order = ORDERS[orderId];
  if (!order) {
    return `<p>I couldn't find order <strong>${orderId}</strong>. Please double-check the order ID and try again.</p>`;
  }

  const statusClass = order.status;
  return `
    <p>Here are the details for <strong>${orderId}</strong>:</p>
    <div class="action-card">
      <div class="action-card-header">${svgIcon("box")} Order Details</div>
      <div class="action-card-body">
        <div class="action-row">
          <span class="action-label">Item</span>
          <span class="action-value">${order.item}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Status</span>
          <span class="action-value"><span class="status-badge ${statusClass}">${order.status}</span></span>
        </div>
        <div class="action-row">
          <span class="action-label">Tracking</span>
          <span class="action-value">${order.tracking}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Address</span>
          <span class="action-value">${order.address}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Total</span>
          <span class="action-value">${order.total}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Order Date</span>
          <span class="action-value">${order.date}</span>
        </div>
      </div>
    </div>`;
}

function renderShippingUpdate(orderId, newAddress) {
  const order = ORDERS[orderId];
  if (!order) {
    return `<p>I couldn't find order <strong>${orderId}</strong> to update the shipping address.</p>`;
  }
  const old = order.address;
  order.address = newAddress; // update in memory

  return `
    <p>Shipping address for <strong>${orderId}</strong> has been updated.</p>
    <div class="action-card">
      <div class="action-card-header">${svgIcon("pin")} Address Updated</div>
      <div class="action-card-body">
        <div class="action-row">
          <span class="action-label">Previous</span>
          <span class="action-value" style="text-decoration:line-through;color:var(--grey-400)">${old}</span>
        </div>
        <div class="action-row">
          <span class="action-label">New Address</span>
          <span class="action-value">${newAddress}</span>
        </div>
      </div>
    </div>`;
}

function renderRefund(orderId) {
  const order = ORDERS[orderId];
  if (!order) {
    return `<p>I couldn't find order <strong>${orderId}</strong>. Please check the order ID and try again.</p>`;
  }
  if (order.status !== "delivered") {
    return `<p>Refunds are only available for delivered orders. Your order <strong>${orderId}</strong> is currently <strong>${order.status}</strong>. Please wait until delivery to request a refund.</p>`;
  }

  order.status = "refunded";
  return `
    <p>Refund initiated for <strong>${orderId}</strong>.</p>
    <div class="action-card">
      <div class="action-card-header">${svgIcon("refund")} Refund Confirmed</div>
      <div class="action-card-body">
        <div class="action-row">
          <span class="action-label">Order</span>
          <span class="action-value">${orderId}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Item</span>
          <span class="action-value">${order.item}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Amount</span>
          <span class="action-value">${order.total}</span>
        </div>
        <div class="action-row">
          <span class="action-label">Status</span>
          <span class="action-value"><span class="status-badge refunded">refunded</span></span>
        </div>
        <div class="action-row">
          <span class="action-label">ETA</span>
          <span class="action-value">3–5 business days</span>
        </div>
      </div>
    </div>`;
}

/* ── Main send handler ───────────────────────────────────── */

async function handleSend() {
  const text = userInputEl.value.trim();
  if (!text) return;

  // Render user message
  appendMessage("user", escapeHtml(text));

  // Add to history
  conversationHistory.push({ role: "user", content: text });

  // Reset input
  userInputEl.value = "";
  userInputEl.style.height = "auto";
  sendBtn.disabled = true;

  showTyping();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: conversationHistory,
      }),
    });

    const data = await response.json();
    const rawReply = data.content?.[0]?.text || "";

    // Add assistant reply to history
    conversationHistory.push({ role: "assistant", content: rawReply });

    removeTyping();

    // Try parsing as action JSON
    let parsed = null;
    try {
      parsed = JSON.parse(rawReply.trim());
    } catch (_) { /* plain text response */ }

    if (parsed?.action === "order_status") {
      appendMessage("agent", renderOrderStatus(parsed.orderId));
    } else if (parsed?.action === "update_shipping") {
      appendMessage("agent", renderShippingUpdate(parsed.orderId, parsed.newAddress));
    } else if (parsed?.action === "refund") {
      appendMessage("agent", renderRefund(parsed.orderId));
    } else {
      appendMessage("agent", escapeHtml(rawReply));
    }

  } catch (err) {
    removeTyping();
    appendMessage("agent", "Something went wrong connecting to the server. Please try again.");
    console.error(err);
  }
}

/* ── Utility: escape HTML for plain text output ─────────── */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

/* ── Welcome message ─────────────────────────────────────── */
function appendWelcome() {
  appendMessage("agent", `
    Hi, I'm <strong>Agent</strong> — your customer support assistant.<br><br>
    I can help you with:<br>
    &nbsp;• Check order status (e.g. <em>ORD-1001</em>)<br>
    &nbsp;• Update your shipping address<br>
    &nbsp;• Request a refund<br>
    &nbsp;• Answer any questions about your order<br><br>
    What do you need today?
  `);
}

/* ── Init ────────────────────────────────────────────────── */
appendWelcome();
sendBtn.disabled = true;
