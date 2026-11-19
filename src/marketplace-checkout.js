import { requireBuyer } from "./lib/auth.js";
import {
  cartGrandTotal,
  cartIssue,
  cartLineTotal,
  getOrder,
  listCart,
  money,
  placeOrder,
  statusLabel,
} from "./lib/marketplaceApi.js";
import { markBusy, markIdle, paintMarketToolbar, productCellHtml, publicOrderCode, sellerNameHtml, setStatus, showActionFeedback } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const panel = document.querySelector("[data-checkout]");
const status = document.querySelector("[data-market-status]");
const placedId = new URLSearchParams(window.location.search).get("order");

const profile = await requireBuyer("marketplace-checkout.html");
if (!profile) throw new Error("Sign in required");
paintMarketToolbar(toolbar, profile, "marketplace-checkout.html");

let placing = false;

function thumb(url) {
  return url
    ? `<img class="market-cart-thumb" src="${url}" alt="">`
    : `<div class="market-cart-thumb is-empty">No image</div>`;
}

function orderBlock(order) {
  const items = order.marketplace_order_items || [];
  return `
    <article class="card">
      <p class="meta">${statusLabel(order.status)}</p>
      <h2>Order ${publicOrderCode(order)}</h2>
      <p>${new Date(order.created_at).toLocaleString()}</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Seller</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td>${productCellHtml(item)}</td>
                <td>${sellerNameHtml(item)}</td>
                <td>${item.quantity}</td>
                <td>${money(item.unit_price)}</td>
                <td>${money(Number(item.unit_price) * Number(item.quantity))}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="lede">Total ${money(order.total)}</p>
      <p>Status starts at Waiting for Payment. Each seller confirms payment, then shipment, for their own items. You confirm delivery to complete the purchase.</p>
      <p>
        <a class="btn btn-navy" href="marketplace-orders.html">My Orders</a>
        <a class="btn btn-line" href="marketplace.html">Continue browsing</a>
      </p>
    </article>`;
}

function review(rows) {
  const issues = rows.map(cartIssue).filter(Boolean);
  const total = cartGrandTotal(rows);
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const product = row.marketplace_products || {};
              const issue = cartIssue(row);
              return `
            <tr${issue ? ' class="is-stock-out"' : ""}>
              <td>
                <div class="market-checkout-product">
                  ${thumb(product.image_url)}
                  <div>
                    <strong>${product.title || "Listing"}</strong>
                    <p class="meta">Seller: ${product.seller_label || "Campus seller"}</p>
                    ${issue ? `<p>${issue}</p>` : ""}
                  </div>
                </div>
              </td>
              <td>${row.quantity}</td>
              <td>${money(product.price)}</td>
              <td>${money(cartLineTotal(row))}</td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="lede">Total ${money(total)}</p>
    ${
      issues.length
        ? `<p>Update quantities in your <a href="marketplace-cart.html">cart</a> before placing the order.</p>`
        : `<p class="market-action-row">
            <a class="btn btn-line" href="marketplace-cart.html">Back to cart</a>
            <button type="button" class="btn btn-gold" data-place-order>
              <span data-en>Place Order</span>
              <span data-zh>成立訂單</span>
            </button>
            <span class="market-action-feedback hidden" data-action-feedback role="status" aria-live="polite" aria-atomic="true" hidden></span>
          </p>`
    }`;
}

async function renderConfirmation(id) {
  const order = await getOrder(id);
  if (!order || order.buyer_id !== profile.id) {
    setStatus(status, "That order was not found.", "error");
    return;
  }
  setStatus(status, `Order confirmed. Your order ID is ${order.order_code || "—"}.`);
  if (panel) panel.innerHTML = orderBlock(order);
}

async function renderCheckout() {
  const rows = await listCart();
  if (!panel) return;
  if (!rows.length) {
    panel.innerHTML = `<p>Your cart is empty. <a href="marketplace.html">Browse products</a> or open <a href="marketplace-cart.html">Cart</a>.</p>`;
    return;
  }
  panel.innerHTML = review(rows);
}

panel?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-place-order]");
  if (!button || placing) return;
  placing = true;
  if (!markBusy(button, "Saving…", "儲存中…")) {
    placing = false;
    return;
  }
  showActionFeedback(button, "", "");
  try {
    const id = await placeOrder();
    showActionFeedback(button, "Order placed", "訂單已成立");
    window.location.replace(`marketplace-checkout.html?order=${id}`);
  } catch (err) {
    placing = false;
    markIdle(button);
    showActionFeedback(button, err.message || "Could not place the order.", err.message || "無法成立訂單。", "error");
  }
});

try {
  if (placedId) await renderConfirmation(placedId);
  else await renderCheckout();
} catch (err) {
  setStatus(status, err.message || "Could not load checkout.", "error");
}
