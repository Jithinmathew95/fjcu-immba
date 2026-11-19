import { requireSeller } from "./lib/auth.js";
import {
  categoryLabel,
  confirmPayment,
  confirmShipment,
  deleteProduct,
  hideOutOfStock,
  formatStamp,
  itemStage,
  itemStatusLabel,
  listBuyerOrders,
  listSellerInventory,
  money,
  setProductActive,
  stockFlags,
  updateInventory,
  watchMarketplaceOrders,
} from "./lib/marketplaceApi.js";
import { orderPhoneCard, orderViewsHtml, paintMarketToolbar, personNameHtml, productCellHtml, publicOrderCode, setStatus, showActionFeedback, withBusy } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const status = document.querySelector("[data-market-status]");
const catalog = document.querySelector("[data-seller-products]");
const summary = document.querySelector("[data-inventory-summary]");
const waitingEl = document.querySelector("[data-seller-waiting]");
const readyEl = document.querySelector("[data-seller-ready]");
const shippedEl = document.querySelector("[data-seller-shipped]");
const completedEl = document.querySelector("[data-seller-completed]");

const profile = await requireSeller("marketplace-seller.html");
if (!profile) throw new Error("Sign in required");
paintMarketToolbar(toolbar, profile, "marketplace-seller.html");

function badge(product) {
  const flag = stockFlags(product.available_stock);
  return `<span class="market-stock-badge is-${flag.kind}">${flag.label}</span>`;
}

function rowClass(product) {
  const flag = stockFlags(product.available_stock);
  return flag.kind === "ok" ? "" : ` class="is-stock-${flag.kind}"`;
}

async function render() {
  const products = await listSellerInventory(profile.id);
  const low = products.filter((item) => stockFlags(item.available_stock).kind === "low").length;
  const out = products.filter((item) => stockFlags(item.available_stock).kind === "out").length;
  if (summary) {
    summary.innerHTML = `<p class="lede">${products.length} listings · ${low} low stock · ${out} out of stock. Available stock falls automatically after a successful order.</p>`;
  }
  const productFlash =
    lastProductNote && !products.some((item) => item.id === lastProductNote.id)
      ? `<p class="market-action-feedback" data-action-feedback role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastProductNote.en}</span><span data-zh>${lastProductNote.zh}</span></p>`
      : "";
  catalog.innerHTML = products.length
    ? `${productFlash}<div class="admin-table-wrap"><table class="admin-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Current Stock</th>
            <th>Purchased Quantity</th>
            <th>Available Stock</th>
            <th>Listing Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${products
            .map(
              (product) => `
            <tr${rowClass(product)}>
              <td>${product.title} ${badge(product)}</td>
              <td>${categoryLabel(product.category)}</td>
              <td>
                <input class="market-inv-input" data-price="${product.id}" type="number" min="0" step="1" value="${Number(product.price)}">
              </td>
              <td>${product.current_stock}</td>
              <td>${product.purchased_qty}</td>
              <td>
                <input class="market-inv-input" data-stock="${product.id}" type="number" min="0" step="1" value="${product.available_stock}">
              </td>
              <td>${product.is_active ? "Active" : "Hidden"}</td>
              <td class="admin-actions market-action-row">
                <button type="button" class="btn btn-navy" data-save="${product.id}"><span data-en>Save</span><span data-zh>儲存</span></button>
                <a class="btn btn-line" href="marketplace-add-product.html?id=${product.id}"><span data-en>Edit</span><span data-zh>編輯</span></a>
                <button type="button" class="btn btn-line" data-hide="${product.id}" data-active="${product.is_active}">
                  ${product.is_active ? `<span data-en>Hide</span><span data-zh>隱藏</span>` : `<span data-en>Show</span><span data-zh>顯示</span>`}
                </button>
                <button type="button" class="btn btn-danger" data-delete="${product.id}"><span data-en>Remove</span><span data-zh>移除</span></button>
                ${lastProductNote?.id === product.id ? `<span class="market-action-feedback" data-action-feedback role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastProductNote.en}</span><span data-zh>${lastProductNote.zh}</span></span>` : ""}
              </td>
            </tr>`
            )
            .join("")}
        </tbody></table></div>`
    : `${productFlash}<p>You have not listed anything yet. Use <a href="marketplace-add-product.html">Add Product</a>.</p>`;

  const orders = await listBuyerOrders();
  const mine = [];
  for (const order of orders) {
    for (const item of order.marketplace_order_items || []) {
      if (item.seller_id === profile.id) mine.push({ order, item });
    }
  }
  renderStage(waitingEl, mine.filter((row) => itemStage(row.item) === "waiting_payment"), "waiting");
  renderStage(readyEl, mine.filter((row) => itemStage(row.item) === "ready_to_ship"), "ready");
  renderStage(shippedEl, mine.filter((row) => itemStage(row.item) === "shipped"), "shipped");
  renderStage(completedEl, mine.filter((row) => itemStage(row.item) === "completed"), "completed");
}

function sellerTotal(items) {
  return items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
}

function groupOrders(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.order.id)) map.set(row.order.id, { order: row.order, items: [] });
    map.get(row.order.id).items.push(row.item);
  }
  return [...map.values()];
}

let lastItemNote = null;
let lastProductNote = null;

function noteFor(id) {
  if (!lastItemNote || lastItemNote.id !== id) return "";
  return `<span class="market-action-feedback" data-action-feedback data-kind="${lastItemNote.kind || "info"}" role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastItemNote.en}</span><span data-zh>${lastItemNote.zh}</span></span>`;
}

function actionCell(item, stage) {
  if (stage === "waiting") {
    return `<span class="market-action-row"><button type="button" class="btn btn-navy" data-pay="${item.id}"><span data-en>Confirm payment</span><span data-zh>確認付款</span></button>${noteFor(item.id)}</span>`;
  }
  if (stage === "ready") {
    return `<span class="market-action-row"><button type="button" class="btn btn-navy" data-ship="${item.id}"><span data-en>Mark shipped</span><span data-zh>標記出貨</span></button>${noteFor(item.id)}</span>`;
  }
  if (stage === "shipped") {
    return `Shipped ${formatStamp(item.shipped_at)}. Waiting for the buyer to confirm delivery. ${noteFor(item.id)}`;
  }
  return `Completed ${formatStamp(item.completed_at)}. Kept in transaction history. ${noteFor(item.id)}`;
}

function renderStage(el, rows, stage) {
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<p>No orders in this stage.</p>`;
    return;
  }
  el.innerHTML = groupOrders(rows)
    .map(({ order, items }) => {
      const cards = items
        .map((item) =>
          orderPhoneCard([
            { en: "Order ID", zh: "訂單編號", html: publicOrderCode(order) },
            { en: "Product", zh: "商品", html: productCellHtml(item) },
            { en: "Buyer", zh: "買家", html: personNameHtml(order.buyer_email, "Buyer") },
            { en: "Qty", zh: "數量", html: String(item.quantity) },
            { en: "Total", zh: "合計", html: money(Number(item.unit_price) * Number(item.quantity)) },
            { en: "Status", zh: "狀態", html: itemStatusLabel(itemStage(item)) },
            { en: "Action", zh: "操作", html: actionCell(item, stage) },
          ])
        )
        .join("");
      return `<div class="market-order-block">${orderViewsHtml({
        headers: `<th class="col-order-id">Order ID</th>
              <th class="col-buyer">Buyer</th>
              <th class="col-product">Products</th>
              <th class="col-qty">Qty</th>
              <th class="col-total">Total</th>
              <th class="col-status">Status</th>
              <th class="col-action">Action</th>`,
        body:
          items
            .map(
              (item) => `
              <tr>
                <td class="col-order-id">${publicOrderCode(order)}</td>
                <td class="col-buyer">${personNameHtml(order.buyer_email, "Buyer")}</td>
                <td class="col-product">${productCellHtml(item)}</td>
                <td class="col-qty">${item.quantity}</td>
                <td class="col-total">${money(Number(item.unit_price) * Number(item.quantity))}</td>
                <td class="col-status">${itemStatusLabel(itemStage(item))}</td>
                <td class="col-action">${actionCell(item, stage)}</td>
              </tr>`
            )
            .join("") +
          `<tr>
              <td colspan="4"><strong>Seller subtotal for this order</strong></td>
              <td class="col-total" colspan="3"><strong>${money(sellerTotal(items))}</strong></td>
            </tr>`,
        cards:
          cards +
          orderPhoneCard([
            { en: "Seller subtotal for this order", zh: "此單賣家小計", html: `<strong>${money(sellerTotal(items))}</strong>` },
          ]),
      })}</div>`;
    })
    .join("");
}

document.body.addEventListener("click", async (event) => {
  const save = event.target.closest("[data-save]");
  const hide = event.target.closest("[data-hide]");
  const hideOut = event.target.closest("[data-hide-unavailable]");
  const remove = event.target.closest("[data-delete]");
  const pay = event.target.closest("[data-pay]");
  const ship = event.target.closest("[data-ship]");
  try {
    if (save) {
      const id = save.dataset.save;
      const price = document.querySelector(`[data-price="${id}"]`)?.value;
      const stock = document.querySelector(`[data-stock="${id}"]`)?.value;
      const result = await withBusy(save, () => updateInventory(profile.id, id, { price, stock: Number(stock) }));
      if (result.error || result.skipped) return;
      lastProductNote = { id, en: "Saved", zh: "已儲存" };
      await render();
      return;
    }
    if (hide) {
      const next = hide.dataset.active !== "true";
      const result = await withBusy(hide, () => setProductActive(hide.dataset.hide, profile.id, next));
      if (result.error || result.skipped) return;
      lastProductNote = {
        id: hide.dataset.hide,
        en: next ? "Listing is visible" : "Listing is hidden",
        zh: next ? "已上架" : "已隱藏",
      };
      await render();
      return;
    }
    if (hideOut) {
      const result = await withBusy(hideOut, () => hideOutOfStock(profile.id));
      if (result.error || result.skipped) return;
      showActionFeedback(hideOut, "Out-of-stock listings are now hidden.", "缺貨商品已隱藏。");
      await render();
      return;
    }
    if (remove) {
      const result = await withBusy(remove, () => deleteProduct(remove.dataset.delete, profile.id));
      if (result.error || result.skipped) return;
      lastProductNote = { id: remove.dataset.delete, en: "Removed", zh: "已移除" };
      await render();
      return;
    }
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
      return;
    }
  } catch (err) {
    setStatus(status, err.message || "Could not update seller data.", "error");
  }
});

try {
  await render();
  watchMarketplaceOrders(() => {
    render().catch(() => {});
  });
} catch (err) {
  setStatus(status, err.message || "Could not load seller tools.", "error");
}
