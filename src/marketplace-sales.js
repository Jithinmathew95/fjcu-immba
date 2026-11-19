import { requireSeller } from "./lib/auth.js";
import {
  confirmPayment,
  confirmShipment,
  formatStamp,
  itemStage,
  itemStatusLabel,
  lineImage,
  listBuyerOrders,
  listOrderEvents,
  money,
  paymentLabel,
  sellerSaleRows,
  statusLabel,
  watchMarketplaceOrders,
} from "./lib/marketplaceApi.js";
import { bindMarketLogout, marketToolbar, productCellHtml, publicOrderCode, setStatus, withBusy } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const panel = document.querySelector("[data-sales]");
const status = document.querySelector("[data-market-status]");
const orderId = new URLSearchParams(window.location.search).get("id");

const profile = await requireSeller("marketplace-sales.html");
if (!profile) throw new Error("Sign in required");
if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-sales.html");
bindMarketLogout();

function thumb(item) {
  const src = lineImage(item);
  return src
    ? `<img class="market-cart-thumb" src="${src}" alt="">`
    : `<div class="market-cart-thumb is-empty">No image</div>`;
}

let lastItemNote = null;

function noteFor(id) {
  if (!lastItemNote || lastItemNote.id !== id) return "";
  return `<span class="market-action-feedback" data-action-feedback data-kind="info" role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastItemNote.en}</span><span data-zh>${lastItemNote.zh}</span></span>`;
}

function actionFor(item) {
  const stage = itemStage(item);
  if (stage === "waiting_payment") {
    return `<span class="market-action-row"><button type="button" class="btn btn-navy" data-pay="${item.id}"><span data-en>Confirm payment</span><span data-zh>確認付款</span></button>${noteFor(item.id)}</span>`;
  }
  if (stage === "ready_to_ship") {
    return `<span class="market-action-row"><button type="button" class="btn btn-navy" data-ship="${item.id}"><span data-en>Mark shipped</span><span data-zh>標記出貨</span></button>${noteFor(item.id)}</span>`;
  }
  if (stage === "shipped") {
    return `Shipped ${formatStamp(item.shipped_at)}. Waiting for delivery confirmation. ${noteFor(item.id)}`;
  }
  return `${`Completed ${formatStamp(item.completed_at) || ""}`.trim()} ${noteFor(item.id)}`;
}

function renderList(rows) {
  if (!rows.length) {
    panel.innerHTML = `<p>No sales yet. Completed sales will remain in this history.</p>`;
    return;
  }
  panel.innerHTML = `<div class="admin-table-wrap">
    <table class="admin-table">
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Buyer</th>
          <th>Purchased products</th>
          <th>Qty</th>
          <th>Total</th>
          <th>Order date</th>
          <th>Payment status</th>
          <th>Order status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            ({ order, item }) => `
          <tr>
            <td>${publicOrderCode(order)}</td>
            <td>${order.buyer_email}</td>
            <td>${productCellHtml(item)}</td>
            <td>${item.quantity}</td>
            <td>${money(Number(item.unit_price) * Number(item.quantity))}</td>
            <td>${formatStamp(order.created_at)}</td>
            <td>${paymentLabel(item)}</td>
            <td>${itemStatusLabel(itemStage(item))}</td>
            <td class="admin-actions">
              <a class="btn btn-line" href="marketplace-sales.html?id=${order.id}">View details</a>
              ${actionFor(item)}
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

async function renderDetail(order, mine) {
  if (!order || !mine.length) {
    panel.innerHTML = `<p>That sale was not found. <a href="marketplace-sales.html">Back to My Sales</a>.</p>`;
    return;
  }
  const events = await listOrderEvents(order.id).catch(() => []);
  const subtotal = mine.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
  panel.innerHTML = `
    <p><a class="btn btn-line" href="marketplace-sales.html">Back to My Sales</a></p>
    <article class="card market-order-card">
      <p class="meta">${statusLabel(order.status)} · your subtotal ${money(subtotal)}</p>
      <h2>Order ${publicOrderCode(order)}</h2>
      <p>Buyer: ${order.buyer_email}</p>
      <p>Order date: ${formatStamp(order.created_at)}</p>
      <p>You only see and process the items you sold on this order.</p>
      ${mine
        .map(
          (item) => `
        <div class="market-order-line">
          <div class="market-checkout-product">
            ${thumb(item)}
            <div>
              <p><strong>${item.title}</strong></p>
              <p>Quantity ${item.quantity} · ${money(item.unit_price)} each · line ${money(Number(item.unit_price) * Number(item.quantity))}</p>
              <p>Payment status: ${paymentLabel(item)}</p>
              <p>Order status: ${itemStatusLabel(itemStage(item))}</p>
              ${item.shipped_at ? `<p>Shipped ${formatStamp(item.shipped_at)}</p>` : ""}
              ${item.completed_at ? `<p>Completed ${formatStamp(item.completed_at)}</p>` : ""}
            </div>
          </div>
          <p>${actionFor(item)}</p>
        </div>`
        )
        .join("")}
      ${
        events.length
          ? `<p class="meta">Status history</p><ul>${events
              .map((event) => `<li>${formatStamp(event.created_at)} — ${itemStatusLabel(event.to_status)} · ${event.note || ""}</li>`)
              .join("")}</ul>`
          : ""
      }
    </article>`;
}

async function render() {
  const rows = sellerSaleRows(await listBuyerOrders(), profile.id);
  if (!panel) return;
  if (orderId) {
    const order = rows.find((row) => row.order.id === orderId)?.order || null;
    const mine = rows.filter((row) => row.order.id === orderId).map((row) => row.item);
    await renderDetail(order, mine);
  } else {
    renderList(rows);
  }
}

panel?.addEventListener("click", async (event) => {
  const pay = event.target.closest("[data-pay]");
  const ship = event.target.closest("[data-ship]");
  if (pay) {
    const result = await withBusy(pay, () => confirmPayment(pay.dataset.pay));
    if (result.error || result.skipped) return;
    lastItemNote = { id: pay.dataset.pay, en: "Payment confirmed", zh: "已確認付款" };
    await render();
    return;
  }
  if (ship) {
    const result = await withBusy(ship, () => confirmShipment(ship.dataset.ship));
    if (result.error || result.skipped) return;
    lastItemNote = { id: ship.dataset.ship, en: "Marked shipped", zh: "已標記出貨" };
    await render();
  }
});

try {
  await render();
  watchMarketplaceOrders(() => {
    render().catch(() => {});
  });
} catch (err) {
  setStatus(status, err.message || "Could not load sales.", "error");
}
