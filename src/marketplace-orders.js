import { requireBuyer } from "./lib/auth.js";
import {
  confirmDelivery,
  formatStamp,
  itemStage,
  itemStatusLabel,
  lineImage,
  listBuyerOrders,
  listOrderEvents,
  money,
  paymentLabel,
  statusLabel,
  watchMarketplaceOrders,
} from "./lib/marketplaceApi.js";
import { orderPhoneCard, orderViewsHtml, paintMarketToolbar, productCellHtml, publicOrderCode, sellerNameHtml, setStatus, withBusy } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const list = document.querySelector("[data-orders]");
const status = document.querySelector("[data-market-status]");
const orderId = new URLSearchParams(window.location.search).get("id");
let lastItemNote = null;

const profile = await requireBuyer("marketplace-orders.html");
if (!profile) throw new Error("Sign in required");
paintMarketToolbar(toolbar, profile, "marketplace-orders.html");

const STAGES = ["waiting_payment", "ready_to_ship", "shipped", "completed"];

function thumb(item) {
  const src = lineImage(item);
  return src
    ? `<img class="market-cart-thumb" src="${src}" alt="">`
    : `<div class="market-cart-thumb is-empty">No image</div>`;
}

function timeline(item) {
  const current = itemStage(item);
  const idx = STAGES.indexOf(current);
  return `<ol class="market-steps">
    ${STAGES.map(
      (stage, i) =>
        `<li class="${i < idx ? "is-done" : i === idx ? "is-current" : ""}">${itemStatusLabel(stage)}</li>`
    ).join("")}
  </ol>`;
}

function ownOrders(orders) {
  return (orders || []).filter((order) => order.buyer_id === profile.id);
}

function renderList(orders) {
  const rows = [];
  for (const order of orders) {
    for (const item of order.marketplace_order_items || []) {
      rows.push({ order, item });
    }
  }
  if (!rows.length) {
    list.innerHTML = `<p>You have no orders yet. Completed purchases will stay listed here.</p>`;
    return;
  }
  list.innerHTML = orderViewsHtml({
    headers: `<th class="col-order-id">Order ID</th>
          <th class="col-product">Product</th>
          <th class="col-seller">Seller</th>
          <th class="col-qty">Qty</th>
          <th>Total</th>
          <th>Order date</th>
          <th>Payment status</th>
          <th>Order status</th>
          <th></th>`,
    body: rows
      .map(
        ({ order, item }) => `
          <tr>
            <td>${publicOrderCode(order)}</td>
            <td>${productCellHtml(item)}</td>
            <td>${sellerNameHtml(item)}</td>
            <td>${item.quantity}</td>
            <td>${money(Number(item.unit_price) * Number(item.quantity))}</td>
            <td>${formatStamp(order.created_at)}</td>
            <td>${paymentLabel(item)}</td>
            <td>${itemStatusLabel(itemStage(item))}</td>
            <td><a class="btn btn-line" href="marketplace-orders.html?id=${order.id}">View details</a></td>
          </tr>`
      )
      .join(""),
    cards: rows
      .map(({ order, item }) =>
        orderPhoneCard([
          { en: "Order ID", zh: "訂單編號", html: publicOrderCode(order) },
          { en: "Product", zh: "商品", html: productCellHtml(item) },
          { en: "Seller", zh: "賣家", html: sellerNameHtml(item) },
          { en: "Qty", zh: "數量", html: String(item.quantity) },
          { en: "Total", zh: "合計", html: money(Number(item.unit_price) * Number(item.quantity)) },
          { en: "Status", zh: "狀態", html: `${paymentLabel(item)} · ${itemStatusLabel(itemStage(item))}` },
          {
            en: "Details",
            zh: "詳情",
            html: `<a class="btn btn-line" href="marketplace-orders.html?id=${order.id}"><span data-en>View details</span><span data-zh>查看詳情</span></a>`,
          },
        ])
      )
      .join(""),
  });
}

async function renderDetail(order) {
  if (!order || order.buyer_id !== profile.id) {
    list.innerHTML = `<p>That order was not found. <a href="marketplace-orders.html">Back to My Orders</a>.</p>`;
    return;
  }
  const events = await listOrderEvents(order.id).catch(() => []);
  const items = order.marketplace_order_items || [];
  list.innerHTML = `
    <p><a class="btn btn-line" href="marketplace-orders.html">Back to My Orders</a></p>
    <article class="card market-order-card">
      <p class="meta">${statusLabel(order.status)} · order total ${money(order.total)}</p>
      <h2>Order ${publicOrderCode(order)}</h2>
      <p>Order date: ${formatStamp(order.created_at)}</p>
      ${items
        .map((item) => {
          const stage = itemStage(item);
          return `
        <div class="market-order-line">
          <div class="market-checkout-product">
            ${thumb(item)}
            <div>
              <p><strong>${item.title}</strong></p>
              <p>${sellerNameHtml(item)}</p>
              <p>Quantity ${item.quantity} · ${money(item.unit_price)} each · line ${money(Number(item.unit_price) * Number(item.quantity))}</p>
              <p>Payment status: ${paymentLabel(item)}</p>
              <p>Order status: ${itemStatusLabel(stage)}</p>
              ${item.shipped_at ? `<p>Shipped ${formatStamp(item.shipped_at)}</p>` : ""}
              ${item.completed_at ? `<p>Completed ${formatStamp(item.completed_at)}</p>` : ""}
            </div>
          </div>
          ${timeline(item)}
          ${
            stage === "shipped"
              ? `<p class="market-action-row"><button type="button" class="btn btn-navy" data-deliver="${item.id}"><span data-en>Confirm delivery</span><span data-zh>確認收貨</span></button>${
                  lastItemNote?.id === item.id
                    ? `<span class="market-action-feedback" data-action-feedback role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastItemNote.en}</span><span data-zh>${lastItemNote.zh}</span></span>`
                    : ""
                }</p>`
              : lastItemNote?.id === item.id
                ? `<p class="market-action-feedback" data-action-feedback role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastItemNote.en}</span><span data-zh>${lastItemNote.zh}</span></p>`
                : ""
          }
        </div>`;
        })
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
  const orders = ownOrders(await listBuyerOrders());
  if (!list) return;
  if (orderId) {
    await renderDetail(orders.find((order) => order.id === orderId) || null);
  } else {
    renderList(orders);
  }
}

list?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-deliver]");
  if (!button) return;
  const result = await withBusy(button, () => confirmDelivery(button.dataset.deliver));
  if (result.error || result.skipped) return;
  lastItemNote = { id: button.dataset.deliver, en: "Delivery confirmed", zh: "已確認收貨" };
  await render();
});

try {
  await render();
  watchMarketplaceOrders(() => {
    render().catch(() => {});
  });
} catch (err) {
  setStatus(status, err.message || "Could not load orders.", "error");
}
