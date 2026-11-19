import { requireBuyer } from "./lib/auth.js";
import {
  cartGrandTotal,
  cartIssue,
  cartLineTotal,
  listCart,
  money,
  setCartQuantity,
} from "./lib/marketplaceApi.js";
import { bindMarketLogout, marketToolbar, setStatus, withBusy } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const list = document.querySelector("[data-cart]");
const status = document.querySelector("[data-market-status]");

const profile = await requireBuyer("marketplace-cart.html");
if (!profile) throw new Error("Sign in required");

if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-cart.html");
bindMarketLogout();

let lastNote = null;

function thumb(product) {
  if (product?.image_url) {
    return `<img class="market-cart-thumb" src="${product.image_url}" alt="">`;
  }
  return `<div class="market-cart-thumb is-empty">No image</div>`;
}

function noteFor(id) {
  if (!lastNote || lastNote.id !== id) return "";
  return `<span class="market-action-feedback" data-action-feedback role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastNote.en}</span><span data-zh>${lastNote.zh}</span></span>`;
}

async function render() {
  const rows = await listCart();
  if (!list) return;
  const flash =
    lastNote && !rows.some((row) => row.id === lastNote.id)
      ? `<p class="market-action-feedback" data-action-feedback role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastNote.en}</span><span data-zh>${lastNote.zh}</span></p>`
      : "";
  if (!rows.length) {
    list.innerHTML = `${flash}<p>Your cart is empty. <a href="marketplace.html">Browse products</a>.</p>`;
    return;
  }
  const issues = rows.map(cartIssue).filter(Boolean);
  const total = cartGrandTotal(rows);
  list.innerHTML = `
    ${flash}
    <div class="market-cart-list">
      ${rows
        .map((row) => {
          const product = row.marketplace_products || {};
          const issue = cartIssue(row);
          const max = Number(product.stock) || 0;
          return `
        <article class="card market-cart-item${issue ? " is-stock-out" : ""}">
          ${thumb(product)}
          <div>
            <h3>${product.title || "Listing"}</h3>
            <p class="meta">${product.seller_label ? `Seller: ${product.seller_label}` : ""}</p>
            <p>${money(product.price)} each · ${max} available</p>
            ${issue ? `<p class="status" data-kind="error">${issue}</p>` : ""}
          </div>
          <div class="market-cart-side">
            <p class="market-price">${money(cartLineTotal(row))}</p>
            <p class="market-action-row">
              <button type="button" class="btn btn-line" data-qty="${row.id}" data-next="${row.quantity - 1}">−</button>
              <strong>${row.quantity}</strong>
              <button type="button" class="btn btn-line" data-qty="${row.id}" data-next="${row.quantity + 1}" ${
                row.quantity >= max ? "disabled" : ""
              }>+</button>
            </p>
            <p class="market-action-row">
              <button type="button" class="btn btn-danger" data-qty="${row.id}" data-next="0">
                <span data-en>Remove</span><span data-zh>移除</span>
              </button>
              ${noteFor(row.id)}
            </p>
          </div>
        </article>`;
        })
        .join("")}
    </div>
    <p class="lede">Total ${money(total)}</p>
    ${
      issues.length
        ? `<p>Fix stock or availability before checkout.</p>`
        : `<p>
            <a class="btn btn-navy" href="marketplace-checkout.html">
              <span data-en>Proceed to checkout</span>
              <span data-zh>前往結帳</span>
            </a>
          </p>`
    }`;
}

list?.addEventListener("click", async (event) => {
  const qty = event.target.closest("[data-qty]");
  if (!qty) return;
  const next = Number(qty.dataset.next);
  const removing = next < 1;
  const result = await withBusy(qty, () => setCartQuantity(qty.dataset.qty, next), {
    busyEn: removing ? "Removing…" : "Saving…",
    busyZh: removing ? "移除中…" : "儲存中…",
  });
  if (result.error || result.skipped) return;
  lastNote = removing
    ? { id: qty.dataset.qty, en: "Removed from cart", zh: "已從購物車移除" }
    : { id: qty.dataset.qty, en: "Quantity updated", zh: "數量已更新" };
  await render();
});

try {
  await render();
} catch (err) {
  setStatus(status, err.message || "Could not load the cart.", "error");
}
