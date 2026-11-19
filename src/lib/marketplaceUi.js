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

export function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const KNOWN_ERRORS = {
  "Please choose an image under 2 MB.": ["Please choose an image under 2 MB.", "請選擇 2 MB 以下的圖片。"],
  "Please choose a JPG, PNG, or WebP image.": ["Please choose a JPG, PNG, or WebP image.", "請選擇 JPG、PNG 或 WebP 圖片。"],
  "Stock cannot be negative.": ["Stock cannot be negative.", "庫存不可為負。"],
};

export function errorCopy(err) {
  const raw = err?.message || "Something went wrong.";
  return KNOWN_ERRORS[raw] || [raw, raw];
}

export function fieldError(field) {
  if (!field) {
    return { en: "Please fill in the required fields.", zh: "請填寫必填欄位。" };
  }
  const label = field.closest("label")?.querySelector("[data-en]")?.textContent?.trim() || field.name || "This field";
  if (field.validity.valueMissing) {
    return { en: `${label} is required.`, zh: `請填寫「${label}」。` };
  }
  if (field.validity.rangeUnderflow || field.validity.badInput || field.validity.stepMismatch) {
    return { en: `${label} is not a valid number.`, zh: `「${label}」不是有效數字。` };
  }
  return { en: field.validationMessage || `${label} is invalid.`, zh: field.validationMessage || `「${label}」無效。` };
}

export function ensureActionFeedback(button) {
  if (!button) return null;
  const parent = button.parentElement;
  let el = parent?.querySelector(":scope > [data-action-feedback]");
  if (!el) {
    el = document.createElement("span");
    el.className = "market-action-feedback";
    el.dataset.actionFeedback = "";
    button.insertAdjacentElement("afterend", el);
  }
  el.setAttribute("role", "status");
  el.setAttribute("aria-atomic", "true");
  return el;
}

export function showActionFeedback(button, en, zh = en, kind = "info") {
  const el = ensureActionFeedback(button);
  if (!el) return;
  el.dataset.kind = kind || "info";
  el.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  const html = Boolean(en && /<a[\s>]/i.test(en));
  const wrap = (value) => (html ? value : escHtml(value));
  el.innerHTML = en ? `<span data-en>${wrap(en)}</span><span data-zh>${wrap(zh)}</span>` : "";
  el.hidden = !en;
  el.classList.toggle("hidden", !en);
}

export function markBusy(button, en = "Saving…", zh = "儲存中…") {
  if (!button) return false;
  if (button.getAttribute("aria-busy") === "true" || button.disabled) return false;
  if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.innerHTML = `<span data-en>${escHtml(en)}</span><span data-zh>${escHtml(zh)}</span>`;
  return true;
}

export function markIdle(button) {
  if (!button) return;
  button.disabled = false;
  button.removeAttribute("aria-busy");
  if (button.dataset.idleHtml) button.innerHTML = button.dataset.idleHtml;
}

export async function withBusy(button, task, labels = {}) {
  const started = markBusy(button, labels.busyEn || "Saving…", labels.busyZh || "儲存中…");
  if (!started) return { skipped: true };
  showActionFeedback(button, "", "");
  try {
    const value = await task();
    markIdle(button);
    return { value };
  } catch (err) {
    markIdle(button);
    const [en, zh] = errorCopy(err);
    showActionFeedback(button, en, zh, "error");
    return { error: err };
  }
}
