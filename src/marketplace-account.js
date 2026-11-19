import {
  becomeMarketplaceSeller,
  getProfile,
  isBuyer,
  isPlatformAdmin,
  isSeller,
  loginHref,
} from "./lib/auth.js";
import { bindMarketLogout, marketToolbar, roleSummary, setStatus, withBusy } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const menus = document.querySelector("[data-role-menus]");
const status = document.querySelector("[data-market-status]");
const who = document.querySelector("[data-market-who]");

const profile = await getProfile().catch(() => null);
if (!profile?.user) {
  window.location.replace(loginHref("marketplace-account.html"));
} else {
  if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-account.html");
  bindMarketLogout();
  if (who) who.textContent = `${profile.email || profile.user.email} · ${roleSummary(profile)}`;

  const buyer = isBuyer(profile);
  const seller = isSeller(profile);
  const admin = isPlatformAdmin(profile);

  menus.innerHTML = `
    ${
      buyer
        ? `<a class="card" href="marketplace.html">
            <p class="meta">Buyer</p>
            <h3 data-en>Browse products</h3>
            <h3 data-zh>瀏覽商品</h3>
            <p data-en>View listings and product details.</p>
            <p data-zh>查看刊登與商品詳情。</p>
          </a>
          <a class="card" href="marketplace-cart.html">
            <p class="meta">Buyer</p>
            <h3 data-en>Cart and checkout</h3>
            <h3 data-zh>購物車與下單</h3>
            <p data-en>Review items, change quantity, then go to checkout.</p>
            <p data-zh>檢視商品、調整數量，再前往結帳。</p>
          </a>
          <a class="card" href="marketplace-checkout.html">
            <p class="meta">Buyer</p>
            <h3 data-en>Checkout</h3>
            <h3 data-zh>結帳</h3>
            <p data-en>Confirm stock, place the order, and see your order ID.</p>
            <p data-zh>確認庫存、成立訂單，並查看訂單編號。</p>
          </a>
          <a class="card" href="marketplace-orders.html">
            <p class="meta">Buyer</p>
            <h3 data-en>My Orders</h3>
            <h3 data-zh>我的訂單</h3>
            <p data-en>Order ID, products, images, sellers, totals, and live status. Open an order for full details.</p>
            <p data-zh>訂單編號、商品、圖片、賣家、金額與即時狀態。可開啟訂單查看詳情。</p>
          </a>`
        : ""
    }
    ${
      seller
        ? `<a class="card" href="marketplace-add-product.html">
            <p class="meta">Seller</p>
            <h3 data-en>Add Product</h3>
            <h3 data-zh>新增商品</h3>
            <p data-en>Name, category, description, price, quantity, image, and listing status.</p>
            <p data-zh>名稱、類別、說明、價格、數量、圖片與刊登狀態。</p>
          </a>
          <a class="card" href="marketplace-seller.html">
            <p class="meta">Seller</p>
            <h3 data-en>Seller cabinet</h3>
            <h3 data-zh>賣家後台</h3>
            <p data-en>Edit, hide, or remove your listings. Confirm payment and shipment.</p>
            <p data-zh>編輯、隱藏或移除自己的刊登，並確認付款與出貨。</p>
          </a>
          <a class="card" href="marketplace-sales.html">
            <p class="meta">Seller</p>
            <h3 data-en>My Sales</h3>
            <h3 data-zh>我的銷售</h3>
            <p data-en>Your sales history, including completed orders. Process only your own lines.</p>
            <p data-zh>您的銷售紀錄（含已完成）。僅能處理自己的訂單明細。</p>
          </a>
          <a class="card" href="marketplace-accounting.html">
            <p class="meta">Seller</p>
            <h3 data-en>Accounting dashboard</h3>
            <h3 data-zh>賣家帳務</h3>
            <p data-en>Monthly completed revenue, pending payments, shipment queue, and sales history from your own transactions.</p>
            <p data-zh>依您自己的交易計算已完成營收、待付款、待出貨與銷售紀錄。</p>
          </a>`
        : `<div class="card">
            <p class="meta">Seller</p>
            <h3 data-en>Become a seller</h3>
            <h3 data-zh>成為賣家</h3>
            <p data-en>Keep your buyer account and also list books or course packs. You will only manage your own inventory.</p>
            <p data-zh>保留買家身分，同時刊登書籍或講義。您只能管理自己的庫存。</p>
            <p class="market-action-row"><button type="button" class="btn btn-navy" data-become-seller><span data-en>Enable seller tools</span><span data-zh>啟用賣家功能</span></button></p>
          </div>`
    }
    ${
      admin
        ? `<a class="card" href="marketplace-admin.html">
            <p class="meta">Platform administrator</p>
            <h3 data-en>Monitor the marketplace</h3>
            <h3 data-zh>監管市集</h3>
            <p data-en>Users, products, transactions, search and status filters. Only an administrator can grant this role.</p>
            <p data-zh>使用者、商品、交易、搜尋與狀態篩選。僅管理員可授予此角色。</p>
          </a>`
        : ""
    }`;

  menus.querySelector("[data-become-seller]")?.addEventListener("click", async () => {
    const button = menus.querySelector("[data-become-seller]");
    const result = await withBusy(button, () => becomeMarketplaceSeller());
    if (result.error || result.skipped) return;
    window.location.reload();
  });
}
