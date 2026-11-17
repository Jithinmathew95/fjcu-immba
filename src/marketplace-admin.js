import { listProfiles, requirePlatformAdmin, setMarketplaceFlags } from "./lib/auth.js";
import {
  formatStamp,
  itemStage,
  itemStatusLabel,
  listBuyerOrders,
  listOwnProducts,
  money,
  statusLabel,
} from "./lib/marketplaceApi.js";
import { bindMarketLogout, marketToolbar, setStatus } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const status = document.querySelector("[data-market-status]");
const usersEl = document.querySelector("[data-admin-users]");
const productsEl = document.querySelector("[data-admin-products]");
const ordersEl = document.querySelector("[data-admin-orders]");
const search = document.querySelector("[data-order-search]");
const filter = document.querySelector("[data-order-status]");

const profile = await requirePlatformAdmin("marketplace-admin.html");
if (!profile) throw new Error("Sign in required");
if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-admin.html");
bindMarketLogout();

let orders = [];

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
                : `<button type="button" class="btn btn-line" data-admin-user="${user.id}" data-buyer="${user.is_buyer}" data-seller="${user.is_seller}" data-admin="${Boolean(user.is_platform_admin)}">Toggle admin</button>`
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
  const q = (search?.value || "").trim().toLowerCase();
  const st = filter?.value || "";
  const visible = orders.filter((order) => {
    if (st && order.status !== st) return false;
    if (!q) return true;
    const blob = [
      order.id,
      order.buyer_email,
      order.status,
      ...(order.marketplace_order_items || []).map((item) => item.title),
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
  ordersEl.innerHTML = visible.length
    ? `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Order</th><th>Buyer</th><th>Overall</th><th>Total</th><th>Seller lines</th></tr></thead>
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
                    `${item.title} × ${item.quantity} · ${item.seller_label || "seller"} · ${itemStatusLabel(itemStage(item))}${
                      item.shipped_at ? ` · shipped ${formatStamp(item.shipped_at)}` : ""
                    }${item.completed_at ? ` · completed ${formatStamp(item.completed_at)}` : ""}`
                )
                .join("<br>")}</td>
            </tr>`
            )
            .join("")}
        </tbody></table></div>`
    : `<p>No matching transactions.</p>`;
}

usersEl?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-user]");
  if (!button) return;
  try {
    const makeAdmin = button.dataset.admin !== "true";
    await setMarketplaceFlags(button.dataset.adminUser, {
      isBuyer: button.dataset.buyer === "true",
      isSeller: button.dataset.seller === "true",
      isPlatformAdmin: makeAdmin,
    });
    const users = await listProfiles();
    renderUsers(users);
    setStatus(status, makeAdmin ? "Platform administrator granted." : "Administrator flag removed.");
  } catch (err) {
    setStatus(status, err.message || "Could not update the role.", "error");
  }
});

search?.addEventListener("input", renderOrders);
filter?.addEventListener("change", renderOrders);

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
} catch (err) {
  setStatus(status, err.message || "Could not load administrator tools.", "error");
}
