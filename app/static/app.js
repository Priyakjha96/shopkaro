// ---------- chhote helpers ----------
function money(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

// admin ka likha text page me daalne se pehle safe bana deta hai
function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML.replace(/"/g, "&quot;");
}

// ---------- state: app ki yaaddaasht ----------
const state = { category: null, search: "", page: 1, pageSize: 10, total: 0 };

// ---------- ek product ka card ----------
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

  return `
    <div class="product">
      <div class="img">${image}</div>
      <div class="name">${esc(p.name)}</div>
      <div class="price">${money(p.price)}</div>
      ${note}
    </div>`;
}

// ---------- category chips ----------
async function loadCategories() {
  const res = await fetch("/categories");
  const categories = await res.json();

  const chips = document.getElementById("chips");
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

// ---------- products (reset = true matlab shuru se) ----------
async function loadProducts(reset) {
  const grid = document.getElementById("grid");

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
  document.getElementById("empty").classList.toggle("hidden", data.total !== 0);
  document.getElementById("load-more").classList.toggle("hidden", shown >= data.total);
}

// ---------- search: typing rukne ke 0.4 second baad hi API bulao ----------
let searchTimer = null;
document.getElementById("search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    loadProducts(true);
  }, 400);
});

// ---------- Load more button ----------
document.getElementById("load-more").addEventListener("click", () => {
  state.page += 1;
  loadProducts(false);
});

// ---------- page khulte hi ----------
loadCategories();
loadProducts(true);