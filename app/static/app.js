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
  authMode: "login"
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
    if ((res.status === 401 || res.status === 403) && token) {
      logout();   // token expire ya galat
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
const SCREENS = ["home", "cart", "account", "checkout", "confirm"];  // NAYA: checkout, confirm

function showScreen(name) {
  SCREENS.forEach(s => {
    el("screen-" + s).classList.toggle("hidden", s !== name);
  });

  // NAYA: checkout pe Cart tab, confirm pe Home tab chamakta rahe
  const navName = name === "checkout" ? "cart" : name === "confirm" ? "home" : name;
  document.querySelectorAll(".bottom-nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.screen === navName);
  });

  if (name === "cart") loadCart();
  if (name === "account") renderAccount();
  window.scrollTo(0, 0);
}

document.querySelectorAll(".bottom-nav a").forEach(a => {
  a.addEventListener("click", () => {
    const screen = a.dataset.screen;
    if (screen === "orders") {
      toast("Orders will be added in Stage 8");
      return;
    }
    showScreen(screen);
  });
});

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
  // NAYA: checkout ka bhara hua address agle user ko na dikhe
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
  const badge = el("cart-badge");
  badge.textContent = count;
  badge.classList.toggle("hidden", count === 0);
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

// ================= checkout (NAYA) =================
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

  // pehle yahin check karo, taaki server ko faltu request na jaye
  if (body.full_name.length < 2) { err.textContent = "Please enter your full name"; return; }
  if (!/^\d{10}$/.test(body.phone)) { err.textContent = "Phone number must be 10 digits"; return; }
  if (body.address.length < 5) { err.textContent = "Please enter your full address"; return; }
  if (body.city.length < 2) { err.textContent = "Please enter your city"; return; }
  if (!/^\d{6}$/.test(body.pincode)) { err.textContent = "Pincode must be 6 digits"; return; }

  // button band: galti se do baar dabane par do order na ban jayein
  const btn = el("place-order");
  btn.disabled = true;
  btn.textContent = "Placing order...";

  try {
    const order = await api("/orders", { method: "POST", body: JSON.stringify(body) });
    updateCartBadge(0);
    renderConfirmation(order);
    showScreen("confirm");
    loadProducts(true);   // stock badal gaya hoga, products dobara laao
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

// ================= products (home screen) =================
function productCard(p) {
  const image = p.image_url
    ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`
    : esc(p.name.charAt(0));

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

  if (reset) {
    state.page = 1;
    grid.innerHTML = "";
  }

  const params = new URLSearchParams({ page: state.page, page_size: state.pageSize });
  if (state.search) params.set("search", state.search);
  if (state.category) params.set("category_id", state.category);

  const res = await fetch("/products?" + params.toString());
  const data = await res.json();
  state.total = data.total;

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