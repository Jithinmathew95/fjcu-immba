import { getProfile, isBuyer, loginHref } from "./lib/auth.js";
import {
  addToCart,
  categoryLabel,
  getProduct,
  listActiveProducts,
  money,
  PRODUCT_CATEGORIES,
} from "./lib/marketplaceApi.js";
import { paintMarketToolbar, setStatus, showActionFeedback, withBusy } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const filters = document.querySelector("[data-browse-filters]");
const grid = document.querySelector("[data-product-grid]");
const detail = document.querySelector("[data-product-detail]");
const status = document.querySelector("[data-market-status]");
const productId = new URLSearchParams(window.location.search).get("id");

function sellerLine(product) {
  return product.seller_label || "Campus seller";
}

function photo(product, className = "market-card-photo") {
  if (product.image_url) {
    return `<img class="${className}" src="${product.image_url}" alt="">`;
  }
  return `<div class="${className} is-empty">No image</div>`;
}

function stockLine(product) {
  const qty = Number(product.stock) || 0;
  if (qty <= 0) return "Out of stock";
  if (qty <= 3) return `${qty} available · low stock`;
  return `${qty} available`;
}

function quantityField(product) {
  const max = Number(product.stock) || 0;
  if (max < 1) return "";
  return `<label class="market-qty">
    <span data-en>Quantity</span><span data-zh>數量</span>
    <input type="number" min="1" max="${max}" value="1" data-qty-for="${product.id}">
  </label>`;
}

function addButton(product) {
  if ((Number(product.stock) || 0) < 1) {
    return `<button type="button" class="btn btn-line" disabled><span data-en>Out of stock</span><span data-zh>缺貨</span></button>`;
  }
  return `<span class="market-action-row"><button type="button" class="btn btn-navy" data-add-cart="${product.id}">
          <span data-en>Add to cart</span><span data-zh>加入購物車</span>
        </button></span>`;
}

function productCard(product) {
  return `
    <article class="card market-card">
      ${photo(product)}
      <p class="meta">${categoryLabel(product.category)}</p>
      <h3>${product.title}</h3>
      <p class="market-price">${money(product.price)}</p>
      <p>${stockLine(product)}</p>
      <p class="meta">Seller: ${sellerLine(product)}</p>
      <p>
        <a class="btn btn-line" href="marketplace.html?id=${product.id}">
          <span data-en>View details</span><span data-zh>查看詳情</span>
        </a>
        ${quantityField(product)}
        ${addButton(product)}
      </p>
    </article>`;
}

function requestedQty(id) {
  const input = document.querySelector(`[data-qty-for="${id}"]`);
  const value = Number(input?.value || 1);
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function applyFilters(products) {
  const q = (filters?.elements.q.value || "").trim().toLowerCase();
  const category = filters?.elements.category.value || "";
  const sort = filters?.elements.sort.value || "newest";
  let rows = products.filter((product) => {
    if (category && product.category !== category) return false;
    if (q && !(product.title || "").toLowerCase().includes(q)) return false;
    return true;
  });
  if (sort === "price-asc") rows = [...rows].sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === "price-desc") rows = [...rows].sort((a, b) => Number(b.price) - Number(a.price));
  return rows;
}

function renderGrid(products) {
  if (!grid) return;
  const rows = applyFilters(products);
  grid.hidden = false;
  grid.innerHTML = rows.length
    ? rows.map(productCard).join("")
    : `<p class="lede">No active products match this search.</p>`;
}

function renderDetail(product) {
  if (!detail) return;
  if (filters) {
    filters.hidden = true;
    filters.classList.add("hidden");
  }
  if (grid) {
    grid.hidden = true;
    grid.innerHTML = "";
  }
  detail.hidden = false;
  detail.classList.remove("hidden");
  detail.innerHTML = `
    <article class="card market-detail">
      ${photo(product, "market-detail-photo")}
      <p class="meta">${categoryLabel(product.category)}</p>
      <h2>${product.title}</h2>
      <p class="market-price">${money(product.price)}</p>
      <p>${stockLine(product)}</p>
      <p class="meta">Seller: ${sellerLine(product)}</p>
      <p>${product.description || ""}</p>
      <p class="admin-actions">
        ${quantityField(product)}
        ${addButton(product)}
        <a class="btn btn-line" href="marketplace.html">
          <span data-en>Back to listings</span><span data-zh>返回列表</span>
        </a>
      </p>
    </article>`;
}

async function handleAdd(button, profile) {
  const id = button.dataset.addCart;
  const next = productId ? `marketplace.html?id=${id}` : "marketplace.html";
  if (!profile?.user) {
    window.location.href = loginHref(next);
    return;
  }
  if (!isBuyer(profile)) {
    showActionFeedback(button, "This account cannot buy in the marketplace.", "此帳號無法在市集購物。", "error");
    return;
  }
  const result = await withBusy(button, () => addToCart(id, requestedQty(id)), {
    busyEn: "Adding…",
    busyZh: "加入中…",
  });
  if (result.error || result.skipped) return;
  showActionFeedback(
    button,
    `Added to cart. <a href="marketplace-cart.html">Open Cart</a>`,
    `已加入購物車。<a href="marketplace-cart.html">前往購物車</a>`
  );
}

try {
  const profile = await getProfile().catch(() => null);
  paintMarketToolbar(toolbar, profile, "marketplace.html");

  if (filters?.elements.category) {
    filters.elements.category.innerHTML =
      `<option value="">All categories</option>` +
      PRODUCT_CATEGORIES.map((item) => `<option value="${item.id}">${item.en}</option>`).join("");
  }

  if (productId) {
    const product = await getProduct(productId);
    if (!product || !product.is_active) {
      setStatus(status, "That listing is not available.", "error");
      if (detail) {
        detail.hidden = false;
        detail.classList.remove("hidden");
        detail.innerHTML = `<p><a class="btn btn-line" href="marketplace.html">Back to listings</a></p>`;
      }
    } else {
      renderDetail(product);
    }
  } else {
    const products = await listActiveProducts();
    renderGrid(products);
    filters?.addEventListener("input", () => renderGrid(products));
    filters?.addEventListener("change", () => renderGrid(products));
    filters?.addEventListener("submit", (event) => {
      event.preventDefault();
      renderGrid(products);
    });
  }

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-cart]");
    if (!button) return;
    handleAdd(button, profile);
  });
} catch (err) {
  setStatus(status, err.message || "Could not load the marketplace.", "error");
}
