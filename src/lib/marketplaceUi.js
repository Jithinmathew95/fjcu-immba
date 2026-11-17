import { isBuyer, isPlatformAdmin, isSeller, loginHref, signOut } from "./auth.js";

export function marketToolbar(profile, current) {
  const signedIn = Boolean(profile?.user);
  const links = [
    ["marketplace.html", "Browse", "瀏覽商品"],
    ["marketplace-cart.html", "Cart", "購物車"],
    ["marketplace-checkout.html", "Checkout", "結帳"],
    ["marketplace-account.html", "My marketplace", "我的市集"],
  ];
  if (signedIn && isBuyer(profile)) {
    links.push(["marketplace-orders.html", "My Orders", "我的訂單"]);
  }
  if (signedIn && (isSeller(profile) || isPlatformAdmin(profile))) {
    links.push(["marketplace-add-product.html", "Add Product", "新增商品"]);
    links.push(["marketplace-seller.html", "Seller", "賣家"]);
    links.push(["marketplace-sales.html", "My Sales", "我的銷售"]);
    links.push(["marketplace-accounting.html", "Accounting", "銷售報表"]);
  }
  if (signedIn && isPlatformAdmin(profile)) {
    links.push(["marketplace-admin.html", "Admin", "市集管理員"]);
  }
  const auth = signedIn
    ? `<span class="market-who">${profile.email || profile.user.email || ""}</span>
       <button type="button" class="btn btn-line" data-market-logout>
         <span data-en>Sign out</span><span data-zh>登出</span>
       </button>`
    : `<a class="btn btn-navy" href="${loginHref(current)}">
         <span data-en>Sign in</span><span data-zh>登入</span>
       </a>`;
  return `
    <nav class="market-toolbar" aria-label="Marketplace">
      ${links
        .map(
          ([href, en, zh]) =>
            `<a class="btn btn-line${href === current ? " is-active" : ""}" href="${href}">
              <span data-en>${en}</span><span data-zh>${zh}</span>
            </a>`
        )
        .join("")}
      ${auth}
    </nav>`;
}

export function bindMarketLogout() {
  document.querySelector("[data-market-logout]")?.addEventListener("click", async () => {
    await signOut();
    window.location.replace("marketplace.html");
  });
}

export function roleSummary(profile) {
  if (!profile?.user) return "Guest";
  const parts = [];
  if (isBuyer(profile)) parts.push("Buyer");
  if (isSeller(profile)) parts.push("Seller");
  if (isPlatformAdmin(profile)) parts.push("Platform administrator");
  return parts.join(" · ") || "Signed in";
}

export function setStatus(el, message, kind = "info") {
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("hidden", !message);
  el.hidden = !message;
  el.dataset.kind = kind;
}
