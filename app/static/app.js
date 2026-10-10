// ================= chhote helpers =================
function el(id) {
  return document.getElementById(id);
}

function money(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

// admin ya user ka likha text page me daalne se pehle safe bana deta hai
function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML.replace(/"/g, "&quot;");
}

// chhota popup message
let toastTimer = null;
function toast(message) {
  const box = el("toast");
  box.textContent = message;
  box.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add("hidden"), 2500);
}

// ================= app ki yaaddaasht =================
const state = {
  category: null,
  search: "",
  page: 1,
  pageSize: 10,
  total: 0,
  user: null,
  authMode: "login",
  requestId: 0,
  adminFilter: ""   // NAYA: admin screen ka status filter
};

// ================= server se baat (token ke saath) =================
async function api(path, options = {}) {
  const token = localStorage.getItem("shopkaro_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(path, { ...options, headers });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {}

  if (!res.ok) {
    // NAYA: sirf 401 (token kharab ya expire) par logout. 403 ka matlab "tum admin nahi ho" bhi ho sakta hai
    if (res.status === 401 && token) {
      logout();
    }
    let detail = "Something went wrong";
    if (data && typeof data.detail === "string") {
      detail = data.detail;
    } else if (data && Array.isArray(data.detail) && data.detail[0]) {
      detail = data.detail[0].msg;
    }
    throw new Error(detail);
  }
  return data;
}

// ================= screens =================
const SCREENS = ["home", "cart", "account", "checkout", "confirm", "orders", "admin"];  // NAYA: orders, admin

function showScreen(name) {
  SCREENS.forEach(s => {
    el("screen-" + s).classList.toggle("hidden", s !== name);
  });

  // checkout pe Cart tab, confirm pe Home tab, admin pe Account tab chamakta rahe
  let navName = name;
  if (name === "checkout") navName = "cart";
  if (name === "confirm") navName = "home";
  if (name === "admin") navName = "account";   // NAYA

  document.querySelectorAll(".bottom-nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.screen === navName);
  });

  if (name === "cart") loadCart();
  if (name === "account") renderAccount();
  if (name === "orders") loadOrders();            // NAYA
  if (name === "admin") loadAdminOrders();        // NAYA
  window.scrollTo(0, 0);
}

// NAYA: Orders tab ab asli screen kholta hai (pehle sirf popup aata tha)
document.querySelectorAll(".bottom-nav a").forEach(a => {
  a.addEventListener("click", () => showScreen(a.dataset.screen));
});

el("top-cart").addEventListener("click", () => showScreen("cart"));

// ================= account: login, register, logout =================
function renderAccount() {
  const loggedIn = !!state.user;
  el("auth-box").classList.toggle("hidden", loggedIn);
  el("profile-box").classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    el("profile-name").textContent = state.user.name;
    el("profile-email").textContent = state.user.email;
    el("profile-role").textContent = state.user.role;
  }
  // NAYA: admin button sirf admin ko dikhe
  el("open-admin").classList.toggle("hidden", !(loggedIn && state.user.role === "admin"));
}

function setAuthMode(mode) {
  state.authMode = mode;
  el("tab-login").classList.toggle("active", mode === "login");
  el("tab-register").classList.toggle("active", mode === "register");
  el("name").classList.toggle("hidden", mode === "login");
  el("auth-submit").textContent = mode === "login" ? "Login" : "Create account";
  el("auth-error").textContent = "";
}

async function submitAuth() {
  const err = el("auth-error");
  err.textContent = "";
  const email = el("email").value.trim();
  const password = el("password").value;

  try {
    if (state.authMode === "register") {
      const name = el("name").value.trim();
      if (!name) {
        err.textContent = "Please enter your name";
        return;
      }
      await api("/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    }

    const data = await api("/login", { method: "POST", body: JSON.stringify({ email, password }) });
    localStorage.setItem("shopkaro_token", data.access_token);
    await loadUser();
    el("password").value = "";
    toast("Welcome!");
    showScreen("home");
  } catch (e) {
    err.textContent = e.message;
  }
}

async function loadUser() {
  if (!localStorage.getItem("shopkaro_token")) {
    state.user = null;
    updateCartBadge(0);
    return;
  }
  try {
    state.user = await api("/me");
    const cart = await api("/cart");
    updateCartBadge(cart.item_count);
  } catch (e) {
    state.user = null;
  }
}

function logout() {
  localStorage.removeItem("shopkaro_token");
  state.user = null;
  updateCartBadge(0);
  ["co-name", "co-phone", "co-address", "co-city", "co-pincode"].forEach(id => {
    el(id).value = "";
  });
  renderAccount();
}

el("tab-login").addEventListener("click", () => setAuthMode("login"));
el("tab-register").addEventListener("click", () => setAuthMode("register"));
el("auth-submit").addEventListener("click", submitAuth);
el("logout-btn").addEventListener("click", () => {
  logout();
  toast("Logged out");
  showScreen("account");
});

// ================= cart =================
function updateCartBadge(count) {
  ["cart-badge", "cart-badge-top"].forEach(id => {
    const badge = el(id);
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  });
}

async function addToCart(productId) {
  if (!state.user) {
    toast("Please log in first");
    showScreen("account");
    return;
  }
  try {
    const cart = await api("/cart/items", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, quantity: 1 })
    });
    updateCartBadge(cart.item_count);
    toast("Added to cart");
  } catch (e) {
    toast(e.message);
  }
}

function cartRow(i) {
  return `
    <div class="cart-row">
      <div class="cart-info">
        <div class="cart-name">${esc(i.name)}</div>
        <div class="cart-price">${money(i.price)} each</div>
        <div class="cart-actions">
          <button class="qty-btn" data-action="dec" data-id="${i.product_id}" data-qty="${i.quantity}">-</button>
          <span>${i.quantity}</span>
          <button class="qty-btn" data-action="inc" data-id="${i.product_id}" data-qty="${i.quantity}">+</button>
          <button class="remove-btn" data-action="remove" data-id="${i.product_id}">Remove</button>
        </div>
      </div>
      <div class="cart-line-total">${money(i.line_total)}</div>
    </div>`;
}

async function loadCart() {
  const box = el("cart-items");
  const summary = el("cart-summary");

  if (!state.user) {
    box.innerHTML = '<p class="empty">Please log in to see your cart</p>';
    summary.classList.add("hidden");
    return;
  }

  try {
    const cart = await api("/cart");
    updateCartBadge(cart.item_count);

    if (cart.items.length === 0) {
      box.innerHTML = '<p class="empty">Your cart is empty</p>';
      summary.classList.add("hidden");
      return;
    }

    box.innerHTML = cart.items.map(cartRow).join("");
    el("cart-total").textContent = money(cart.total);
    summary.classList.remove("hidden");
  } catch (e) {
    toast(e.message);
  }
}

// cart ke +, -, Remove buttons (ek hi "kaan" poori list pe)
el("cart-items").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const qty = parseInt(btn.dataset.qty);
  const action = btn.dataset.action;

  try {
    if (action === "remove" || (action === "dec" && qty <= 1)) {
      await api("/cart/items/" + id, { method: "DELETE" });
    } else {
      const newQty = action === "inc" ? qty + 1 : qty - 1;
      await api("/cart/items/" + id, { method: "PUT", body: JSON.stringify({ quantity: newQty }) });
    }
    loadCart();
  } catch (err) {
    toast(err.message);
  }
});

// ================= checkout =================
async function openCheckout() {
  if (!state.user) {
    toast("Please log in first");
    showScreen("account");
    return;
  }
  try {
    const cart = await api("/cart");
    if (cart.items.length === 0) {
      toast("Your cart is empty");
      return;
    }
    el("co-total").textContent = money(cart.total);
    if (!el("co-name").value) el("co-name").value = state.user.name;
    el("co-error").textContent = "";
    showScreen("checkout");
  } catch (e) {
    toast(e.message);
  }
}

function renderConfirmation(order) {
  el("cf-id").textContent = "Order #" + order.id + " (" + order.status + ")";
  el("cf-items").innerHTML = order.items
    .map(i => `<div class="row-line"><span>${esc(i.name)} × ${i.quantity}</span><span>${money(i.line_total)}</span></div>`)
    .join("");
  el("cf-total").textContent = money(order.total);
  el("cf-address").textContent =
    "Delivering to " + order.full_name + ", " + order.address + ", " + order.city + " - " + order.pincode;
}

async function placeOrder() {
  const err = el("co-error");
  err.textContent = "";

  const body = {
    full_name: el("co-name").value.trim(),
    phone: el("co-phone").value.trim(),
    address: el("co-address").value.trim(),
    city: el("co-city").value.trim(),
    pincode: el("co-pincode").value.trim()
  };

  if (body.full_name.length < 2) { err.textContent = "Please enter your full name"; return; }
  if (!/^\d{10}$/.test(body.phone)) { err.textContent = "Phone number must be 10 digits"; return; }
  if (body.address.length < 5) { err.textContent = "Please enter your full address"; return; }
  if (body.city.length < 2) { err.textContent = "Please enter your city"; return; }
  if (!/^\d{6}$/.test(body.pincode)) { err.textContent = "Pincode must be 6 digits"; return; }

  const btn = el("place-order");
  btn.disabled = true;
  btn.textContent = "Placing order...";

  try {
    const order = await api("/orders", { method: "POST", body: JSON.stringify(body) });
    updateCartBadge(0);
    renderConfirmation(order);
    showScreen("confirm");
    loadProducts(true);
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Place order";
  }
}

el("checkout-btn").addEventListener("click", openCheckout);
el("place-order").addEventListener("click", placeOrder);
el("back-to-cart").addEventListener("click", () => showScreen("cart"));
el("continue-shopping").addEventListener("click", () => showScreen("home"));
el("view-orders").addEventListener("click", () => showScreen("orders"));   // NAYA

// ================= orders (NAYA) =================
function formatDate(iso) {
  // server UTC time bhejta hai (bina Z ke), isliye Z jodke browser ke local time me badalte hain
  const d = new Date(iso + "Z");
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function customerActions(o) {
  if (o.status !== "placed") return "";
  return `<div class="order-actions">
    <button class="btn-small danger" data-act="cancel" data-id="${o.id}">Cancel order</button>
  </div>`;
}

function adminActions(o) {
  const btn = (status, label, cls) =>
    `<button class="btn-small ${cls}" data-act="status" data-id="${o.id}" data-status="${status}">${label}</button>`;

  if (o.status === "placed") {
    return `<div class="order-actions">${btn("shipped", "Mark shipped", "solid")}${btn("cancelled", "Cancel", "danger")}</div>`;
  }
  if (o.status === "shipped") {
    return `<div class="order-actions">${btn("delivered", "Mark delivered", "solid")}${btn("cancelled", "Cancel", "danger")}</div>`;
  }
  return "";
}

function orderCard(o, admin) {
  const items = o.items
    .map(i => `<div class="row-line"><span>${esc(i.name)} × ${i.quantity}</span><span>${money(i.line_total)}</span></div>`)
    .join("");

  const customer = admin
    ? `<p class="muted">Customer: ${esc(o.customer_name)} (${esc(o.customer_email)})<br>Phone: ${esc(o.phone)}</p>`
    : "";

  return `
    <div class="order-card">
      <div class="order-head">
        <div>
          <b>Order #${o.id}</b>
          <div class="muted">${formatDate(o.created_at)}</div>
        </div>
        <span class="pill ${esc(o.status)}">${esc(o.status)}</span>
      </div>
      ${customer}
      ${items}
      <div class="cart-total" style="margin-top:8px"><span>Total</span><b>${money(o.total)}</b></div>
      <p class="muted">Delivering to ${esc(o.full_name)}, ${esc(o.address)}, ${esc(o.city)} - ${esc(o.pincode)}</p>
      ${admin ? adminActions(o) : customerActions(o)}
    </div>`;
}

async function loadOrders() {
  const box = el("orders-list");

  if (!state.user) {
    box.innerHTML = '<p class="empty">Please log in to see your orders</p>';
    return;
  }

  box.innerHTML = '<p class="empty">Loading...</p>';
  try {
    const orders = await api("/orders");
    box.innerHTML = orders.length === 0
      ? '<p class="empty">You have no orders yet</p>'
      : orders.map(o => orderCard(o, false)).join("");
  } catch (e) {
    toast(e.message);
  }
}

// "Cancel order" button (poori list pe ek hi kaan)
el("orders-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act='cancel']");
  if (!btn) return;
  if (!confirm("Cancel this order?")) return;

  try {
    await api("/orders/" + btn.dataset.id + "/cancel", { method: "POST" });
    toast("Order cancelled");
    loadOrders();
    loadProducts(true);   // stock waapas badha hoga
  } catch (err) {
    toast(err.message);
  }
});

// ================= admin orders (NAYA) =================
async function loadAdminOrders() {
  const box = el("admin-orders");
  box.innerHTML = '<p class="empty">Loading...</p>';

  try {
    const query = state.adminFilter ? "?status=" + state.adminFilter : "";
    const orders = await api("/admin/orders" + query);
    box.innerHTML = orders.length === 0
      ? '<p class="empty">No orders found</p>'
      : orders.map(o => orderCard(o, true)).join("");
  } catch (e) {
    box.innerHTML = '<p class="empty">' + esc(e.message) + "</p>";
  }
}

el("open-admin").addEventListener("click", () => showScreen("admin"));
el("admin-back").addEventListener("click", () => showScreen("account"));

el("admin-filters").querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    el("admin-filters").querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.adminFilter = chip.dataset.status;
    loadAdminOrders();
  });
});

// "Mark shipped / Mark delivered / Cancel" buttons
el("admin-orders").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act='status']");
  if (!btn) return;

  const status = btn.dataset.status;
  if (status === "cancelled" && !confirm("Cancel this order? Stock will be added back.")) return;

  try {
    await api("/admin/orders/" + btn.dataset.id + "/status", {
      method: "PUT",
      body: JSON.stringify({ status })
    });
    toast("Order " + status);
    loadAdminOrders();
    loadProducts(true);
  } catch (err) {
    toast(err.message);
    loadAdminOrders();
  }
});

// ================= products (home screen) =================
const CATEGORY_LOOK = {
  Mobiles: {
    bg: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    icon: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'
  },
  Fashion: {
    bg: "linear-gradient(135deg, #ec4899, #f97316)",
    icon: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'
  },
  Home: {
    bg: "linear-gradient(135deg, #10b981, #06b6d4)",
    icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
  },
  Books: {
    bg: "linear-gradient(135deg, #f59e0b, #ef4444)",
    icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'
  }
};

const DEFAULT_LOOK = {
  bg: "linear-gradient(135deg, #64748b, #94a3b8)",
  icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>'
};

function placeholder(categoryName) {
  const look = CATEGORY_LOOK[categoryName] || DEFAULT_LOOK;
  return `<div class="ph" style="background:${look.bg}">
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${look.icon}</svg>
  </div>`;
}

function skeletonCards(n) {
  const card = '<div class="product skeleton"><div class="img"></div><div class="line"></div><div class="line short"></div></div>';
  return card.repeat(n);
}

function productCard(p) {
  const image = p.image_url
    ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`
    : placeholder(p.category);

  let note = "";
  if (p.stock === 0) {
    note = '<div class="stock-note">Out of stock</div>';
  } else if (p.stock <= 5) {
    note = `<div class="stock-note">Only ${p.stock} left</div>`;
  }

  const disabled = p.stock === 0 ? "disabled" : "";

  return `
    <div class="product">
      <div class="img">${image}</div>
      <div class="name">${esc(p.name)}</div>
      <div class="price">${money(p.price)}</div>
      ${note}
      <button class="add-btn" data-id="${p.id}" ${disabled}>Add to cart</button>
    </div>`;
}

async function loadCategories() {
  const res = await fetch("/categories");
  const categories = await res.json();

  const chips = el("chips");
  chips.innerHTML =
    '<span class="chip active" data-id="">All</span>' +
    categories.map(c => `<span class="chip" data-id="${c.id}">${esc(c.name)}</span>`).join("");

  chips.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.category = chip.dataset.id || null;
      loadProducts(true);
    });
  });
}

async function loadProducts(reset) {
  const grid = el("grid");
  const myRequest = ++state.requestId;

  if (reset) {
    state.page = 1;
    grid.innerHTML = skeletonCards(4);
    el("empty").classList.add("hidden");
    el("load-more").classList.add("hidden");
  }

  const params = new URLSearchParams({ page: state.page, page_size: state.pageSize });
  if (state.search) params.set("search", state.search);
  if (state.category) params.set("category_id", state.category);

    let data;
  try {
    const res = await fetch("/products?" + params.toString());
    data = await res.json();
  } catch (e) {
    if (myRequest === state.requestId) {
      grid.innerHTML = '<p class="empty" style="grid-column: 1 / -1">Could not load products. Please check your internet connection.</p>';
    }
    return;
  }

  if (myRequest !== state.requestId) return;

  state.total = data.total;
  if (reset) grid.innerHTML = "";
  grid.insertAdjacentHTML("beforeend", data.items.map(productCard).join(""));

  const shown = grid.children.length;
  el("empty").classList.toggle("hidden", data.total !== 0);
  el("load-more").classList.toggle("hidden", shown >= data.total);
}

// "Add to cart" button (poore grid pe ek hi kaan)
el("grid").addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (btn) addToCart(parseInt(btn.dataset.id));
});

// search: typing rukne ke 0.4 second baad hi API bulao
let searchTimer = null;
el("search").addEventListener("input", (e) => {
  showScreen("home");
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    loadProducts(true);
  }, 400);
});

el("load-more").addEventListener("click", () => {
  state.page += 1;
  loadProducts(false);
});

// ================= page khulte hi =================
async function init() {
  setAuthMode("login");
  await loadUser();
  loadCategories();
  loadProducts(true);
}

init();
