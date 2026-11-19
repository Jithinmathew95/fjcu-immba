import { listProfiles, requirePlatformAdmin, setMarketplaceFlags } from "./lib/auth.js";
import {
  formatStamp,
  getPlatformFee,
  itemStage,
  itemStatusLabel,
  lineAmount,
  lineFee,
  listBuyerOrders,
  listOwnProducts,
  money,
  setPlatformFee,
  statusLabel,
} from "./lib/marketplaceApi.js";
import { bindMarketLogout, fieldError, marketToolbar, setStatus, showActionFeedback, withBusy } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const status = document.querySelector("[data-market-status]");
const usersEl = document.querySelector("[data-admin-users]");
const productsEl = document.querySelector("[data-admin-products]");
const ordersEl = document.querySelector("[data-admin-orders]");
const totalsEl = document.querySelector("[data-admin-totals]");
const search = document.querySelector("[data-order-search]");
const filter = document.querySelector("[data-order-status]");
const feeForm = document.querySelector("[data-fee-form]");
const feeInput = document.querySelector("[data-platform-fee]");

const profile = await requirePlatformAdmin("marketplace-admin.html");
if (!profile) throw new Error("Sign in required");
if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-admin.html");
bindMarketLogout();

let orders = [];
let lastUserNote = null;

const STATUS_ALIASES = {
  pending_payment: ["pending_payment", "waiting_payment"],
  waiting_payment: ["pending_payment", "waiting_payment"],
  paid: ["paid", "ready_to_ship"],
  ready_to_ship: ["paid", "ready_to_ship"],
  shipped: ["shipped"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setAdminStatus(en, zh = en, kind = "info") {
  if (!status) return;
  status.innerHTML = en ? `<span data-en>${esc(en)}</span><span data-zh>${esc(zh)}</span>` : "";
  status.classList.toggle("hidden", !en);
  status.hidden = !en;
  status.dataset.kind = kind;
}

function orderMatchesStatus(order, st) {
  if (!st) return true;
  const wanted = new Set(STATUS_ALIASES[st] || [st]);
  if (wanted.has(order.status)) return true;
  return (order.marketplace_order_items || []).some((item) => wanted.has(itemStage(item)));
}

function visibleOrders() {
  const q = (search?.value || "").trim().toLowerCase();
  const st = filter?.value || "";
  return orders.filter((order) => {
    if (!orderMatchesStatus(order, st)) return false;
    if (!q) return true;
    const blob = [
      order.id,
      order.order_code,
      order.buyer_email,
      order.status,
      ...(order.marketplace_order_items || []).map((item) => item.title),
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

function renderUsers(users) {
  usersEl.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Email</th><th>Faculty role</th><th>Buyer</th><th>Seller</th><th>Platform admin</th></tr></thead>
    <tbody>
      ${users
        .map(
          (user) => `
        <tr>
          <td>${user.email}</td>
          <td>${user.role}</td>
          <td>${user.is_buyer ? "yes" : "no"}</td>
          <td>${user.is_seller ? "yes" : "no"}</td>
          <td>
            ${user.is_platform_admin || user.role === "super_admin" ? "yes" : "no"}
            ${
              user.id === profile.id || user.role === "super_admin"
                ? ""
                : `<span class="market-action-row"><button type="button" class="btn btn-line" data-admin-user="${user.id}" data-buyer="${user.is_buyer}" data-seller="${user.is_seller}" data-admin="${Boolean(user.is_platform_admin)}"><span data-en>Toggle admin</span><span data-zh>切換管理員</span></button>${
                    lastUserNote?.id === user.id
                      ? `<span class="market-action-feedback" data-action-feedback role="status" aria-live="polite" aria-atomic="true"><span data-en>${lastUserNote.en}</span><span data-zh>${lastUserNote.zh}</span></span>`
                      : ""
                  }</span>`
            }
          </td>
        </tr>`
        )
        .join("")}
    </tbody></table></div>`;
}

function renderProducts(products) {
  productsEl.innerHTML = products.length
    ? `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Title</th><th>Seller</th><th>Price</th><th>Stock</th></tr></thead>
        <tbody>
          ${products
            .map(
              (product) => `
            <tr>
              <td>${product.title}</td>
              <td>${product.seller_id.slice(0, 8)}</td>
              <td>${money(product.price)}</td>
              <td>${product.stock}${product.is_active ? "" : " · hidden"}</td>
            </tr>`
            )
            .join("")}
        </tbody></table></div>`
    : `<p>No products.</p>`;
}

function renderOrders() {
  const visible = visibleOrders();
  const lines = visible.flatMap((order) => order.marketplace_order_items || []);
  const sales = visible.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const fees = lines.reduce((sum, item) => sum + lineFee(item), 0);
  if (totalsEl) {
    totalsEl.innerHTML = `<div class="stats-grid market-stats market-admin-totals">
      <article class="card">
        <p class="meta"><span data-en>Orders</span><span data-zh>訂單數</span></p>
        <strong>${visible.length}</strong>
      </article>
      <article class="card">
        <p class="meta"><span data-en>Total sales</span><span data-zh>銷售總額</span></p>
        <strong>${money(sales)}</strong>
      </article>
      <article class="card">
        <p class="meta"><span data-en>Total platform fees</span><span data-zh>平台手續費總額</span></p>
        <strong>${money(fees)}</strong>
      </article>
    </div>`;
  }
  ordersEl.innerHTML = visible.length
    ? `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr>
          <th><span data-en>Order</span><span data-zh>訂單</span></th>
          <th><span data-en>Buyer</span><span data-zh>買家</span></th>
          <th><span data-en>Overall</span><span data-zh>整單狀態</span></th>
          <th><span data-en>Total</span><span data-zh>總額</span></th>
          <th><span data-en>Seller lines</span><span data-zh>賣家明細</span></th>
        </tr></thead>
        <tbody>
          ${visible
            .map(
              (order) => `
            <tr>
              <td>${order.order_code || order.id.slice(0, 8)}<br><span class="meta">${order.id}</span></td>
              <td>${order.buyer_email}</td>
              <td>${statusLabel(order.status)}</td>
              <td>${money(order.total)}</td>
              <td>${(order.marketplace_order_items || [])
                .map(
                  (item) =>
                    `${item.title} × ${item.quantity} · ${item.seller_label || "seller"} · ${money(lineAmount(item))} · <span data-en>Status</span><span data-zh>狀態</span>: ${itemStatusLabel(itemStage(item))} · <span data-en>Platform fee</span><span data-zh>平台手續費</span> ${money(lineFee(item))}${
                      item.shipped_at ? ` · shipped ${formatStamp(item.shipped_at)}` : ""
                    }${item.completed_at ? ` · completed ${formatStamp(item.completed_at)}` : ""}`
                )
                .join("<br>")}</td>
            </tr>`
            )
            .join("")}
        </tbody></table></div>`
    : `<p><span data-en>No matching transactions.</span><span data-zh>沒有符合的交易。</span></p>`;
}

usersEl?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-user]");
  if (!button) return;
  const makeAdmin = button.dataset.admin !== "true";
  const result = await withBusy(button, () =>
    setMarketplaceFlags(button.dataset.adminUser, {
      isBuyer: button.dataset.buyer === "true",
      isSeller: button.dataset.seller === "true",
      isPlatformAdmin: makeAdmin,
    })
  );
  if (result.error || result.skipped) return;
  lastUserNote = {
    id: button.dataset.adminUser,
    en: makeAdmin ? "Administrator granted" : "Administrator removed",
    zh: makeAdmin ? "已授予管理員" : "已移除管理員",
  };
  const users = await listProfiles();
  renderUsers(users);
});

search?.addEventListener("input", renderOrders);
filter?.addEventListener("change", renderOrders);

feeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = feeForm.querySelector("[data-save-fee]");
  if (!button) return;
  if (!feeForm.checkValidity()) {
    const copy = fieldError(feeInput);
    showActionFeedback(button, copy.en, copy.zh, "error");
    feeInput?.focus();
    return;
  }
  const fee = Number(feeInput.value);
  const result = await withBusy(button, () => setPlatformFee(fee));
  if (result.error || result.skipped) return;
  feeInput.value = String(fee);
  showActionFeedback(button, `Platform fee saved: NT$${fee}.`, `平台手續費已儲存：NT$${fee}。`);
});

try {
  const [users, products, loadedOrders] = await Promise.all([
    listProfiles(),
    listOwnProducts(),
    listBuyerOrders(),
  ]);
  orders = loadedOrders;
  renderUsers(users);
  renderProducts(products);
  renderOrders();
  try {
    feeInput.value = String(await getPlatformFee());
  } catch (err) {
    feeInput.value = "4";
    setAdminStatus(
      "The platform fee table is not in the database yet. Paste supabase/marketplace-fee.sql in the SQL Editor first.",
      "資料庫尚未建立平台手續費設定。請先在 SQL Editor 貼上並執行 supabase/marketplace-fee.sql。",
      "error"
    );
  }
} catch (err) {
  setStatus(status, err.message || "Could not load administrator tools.", "error");
}
