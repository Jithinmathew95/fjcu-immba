import { requireBuyer } from "./lib/auth.js";
import {
  cartGrandTotal,
  cartIssue,
  cartLineTotal,
  listCart,
  money,
  setCartQuantity,
} from "./lib/marketplaceApi.js";
import { bindMarketLogout, marketToolbar, setStatus } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const list = document.querySelector("[data-cart]");
const status = document.querySelector("[data-market-status]");

const profile = await requireBuyer("marketplace-cart.html");
if (!profile) throw new Error("Sign in required");

if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-cart.html");
bindMarketLogout();

function thumb(product) {
  if (product?.image_url) {
    return `<img class="market-cart-thumb" src="${product.image_url}" alt="">`;
  }
  return `<div class="market-cart-thumb is-empty">No image</div>`;
}

async function render() {
  const rows = await listCart();
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = `<p>Your cart is empty. <a href="marketplace.html">Browse products</a>.</p>`;
    return;
  }
  const issues = rows.map(cartIssue).filter(Boolean);
  const total = cartGrandTotal(rows);
  list.innerHTML = `
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
            <p>
              <button type="button" class="btn btn-line" data-qty="${row.id}" data-next="${row.quantity - 1}">−</button>
              <strong>${row.quantity}</strong>
              <button type="button" class="btn btn-line" data-qty="${row.id}" data-next="${row.quantity + 1}" ${
                row.quantity >= max ? "disabled" : ""
              }>+</button>
            </p>
            <button type="button" class="btn btn-danger" data-qty="${row.id}" data-next="0">Remove</button>
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
  try {
    await setCartQuantity(qty.dataset.qty, Number(qty.dataset.next));
    await render();
  } catch (err) {
    setStatus(status, err.message || "Could not update the cart.", "error");
  }
});

try {
  await render();
} catch (err) {
  setStatus(status, err.message || "Could not load the cart.", "error");
}
