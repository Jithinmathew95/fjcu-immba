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
import { bindMarketLogout, marketToolbar, setStatus } from "./lib/marketplaceUi.js";

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
if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-seller.html");
bindMarketLogout();

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
  catalog.innerHTML = products.length
    ? `<div class="admin-table-wrap"><table class="admin-table">
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
              <td class="admin-actions">
                <button type="button" class="btn btn-navy" data-save="${product.id}">Save</button>
                <a class="btn btn-line" href="marketplace-add-product.html?id=${product.id}">Edit</a>
                <button type="button" class="btn btn-line" data-hide="${product.id}" data-active="${product.is_active}">
                  ${product.is_active ? "Hide" : "Show"}
                </button>
                <button type="button" class="btn btn-danger" data-delete="${product.id}">Remove</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody></table></div>`
    : `<p>You have not listed anything yet. Use <a href="marketplace-add-product.html">Add Product</a>.</p>`;

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

function actionCell(item, stage) {
  if (stage === "waiting") {
    return `<button type="button" class="btn btn-navy" data-pay="${item.id}">Confirm Payment</button>`;
  }
  if (stage === "ready") {
    return `<button type="button" class="btn btn-navy" data-ship="${item.id}">Confirm Shipment</button>`;
  }
  if (stage === "shipped") {
    return `Shipped ${formatStamp(item.shipped_at)}. Waiting for the buyer to confirm delivery.`;
  }
  return `Completed ${formatStamp(item.completed_at)}. Kept in transaction history.`;
}

function renderStage(el, rows, stage) {
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<p>No orders in this stage.</p>`;
    return;
  }
  el.innerHTML = groupOrders(rows)
    .map(({ order, items }) => {
      const code = order.order_code || order.id;
      return `<div class="admin-table-wrap market-order-block">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Buyer</th>
              <th>Products</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td>${code}<br><span class="meta">${order.id}</span></td>
                <td>${order.buyer_email}</td>
                <td>${item.title}</td>
                <td>${item.quantity}</td>
                <td>${money(Number(item.unit_price) * Number(item.quantity))}</td>
                <td>${itemStatusLabel(itemStage(item))}</td>
                <td>${actionCell(item, stage)}</td>
              </tr>`
              )
              .join("")}
            <tr>
              <td colspan="4"><strong>Seller subtotal for this order</strong></td>
              <td colspan="3"><strong>${money(sellerTotal(items))}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>`;
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
      await updateInventory(profile.id, id, { price, stock: Number(stock) });
      setStatus(status, "Price and available stock saved.");
      await render();
    }
    if (hide) {
      const next = hide.dataset.active !== "true";
      await setProductActive(hide.dataset.hide, profile.id, next);
      setStatus(status, next ? "Listing is Active and visible to buyers." : "Listing is Hidden from buyers.");
      await render();
    }
    if (hideOut) {
      await hideOutOfStock(profile.id);
      setStatus(status, "Out-of-stock listings are now Hidden.");
      await render();
    }
    if (remove) {
      await deleteProduct(remove.dataset.delete, profile.id);
      setStatus(status, "Listing removed.");
      await render();
    }
    if (pay) {
      await confirmPayment(pay.dataset.pay);
      setStatus(status, "Payment confirmed. This sale is Ready to Ship.");
      await render();
    }
    if (ship) {
      await confirmShipment(ship.dataset.ship);
      setStatus(status, "Shipment recorded with today’s date. Status is Shipped.");
      await render();
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
