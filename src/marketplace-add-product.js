import { requireSeller } from "./lib/auth.js";
import { getProduct, saveProduct, uploadProductImage } from "./lib/marketplaceApi.js";
import {
  bindMarketLogout,
  fieldError,
  markBusy,
  markIdle,
  marketToolbar,
  setStatus,
  showActionFeedback,
} from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const status = document.querySelector("[data-market-status]");
const form = document.querySelector("[data-add-product-form]");
const preview = document.querySelector("[data-photo-preview]");
const submitLabel = document.querySelector("[data-submit-label]");
const editId = new URLSearchParams(window.location.search).get("id");

const profile = await requireSeller("marketplace-add-product.html");
if (!profile) throw new Error("Sign in required");
if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-add-product.html");
bindMarketLogout();

function idleLabel(creating) {
  return creating
    ? `<span data-en>Add Product</span><span data-zh>新增商品</span>`
    : `<span data-en>Save changes</span><span data-zh>儲存變更</span>`;
}

function showPreview(url) {
  if (!preview) return;
  const img = preview.querySelector("img");
  const on = Boolean(url);
  preview.classList.toggle("hidden", !on);
  preview.hidden = !on;
  if (img) img.src = url || "";
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  showPreview("");
  if (submitLabel) submitLabel.innerHTML = idleLabel(true);
  if (submitLabel) submitLabel.dataset.idleHtml = submitLabel.innerHTML;
  history.replaceState({}, "", "marketplace-add-product.html");
}

form?.elements.photo?.addEventListener("change", () => {
  const file = form.elements.photo.files?.[0];
  if (!file) return;
  showPreview(URL.createObjectURL(file));
});

if (editId) {
  try {
    const product = await getProduct(editId);
    if (!product || product.seller_id !== profile.id) {
      setStatus(status, "You can only edit your own listings.", "error");
    } else {
      form.elements.id.value = product.id;
      form.elements.title.value = product.title || "";
      form.elements.category.value = product.category || "other";
      form.elements.description.value = product.description || "";
      form.elements.price.value = product.price;
      form.elements.stock.value = product.stock;
      form.elements.status.value = product.is_active ? "active" : "hidden";
      showPreview(product.image_url);
      if (submitLabel) {
        submitLabel.innerHTML = idleLabel(false);
        submitLabel.dataset.idleHtml = submitLabel.innerHTML;
      }
    }
  } catch (err) {
    setStatus(status, err.message || "Could not load that listing.", "error");
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("[type=submit]");
  if (!button || button.disabled) return;
  if (!form.checkValidity()) {
    const invalid = form.querySelector(":invalid");
    const copy = fieldError(invalid);
    showActionFeedback(button, copy.en, copy.zh, "error");
    invalid?.focus();
    return;
  }
  if (!markBusy(button, "Saving…", "儲存中…")) return;
  showActionFeedback(button, "", "");
  try {
    const file = form.elements.photo.files?.[0] || null;
    const product = await saveProduct({
      id: form.elements.id.value || "",
      seller_id: profile.id,
      title: form.elements.title.value.trim(),
      category: form.elements.category.value,
      description: form.elements.description.value.trim(),
      price: Number(form.elements.price.value),
      stock: Number(form.elements.stock.value),
      is_active: form.elements.status.value === "active",
    });
    if (file) {
      await uploadProductImage(profile.id, product.id, file);
    }
    markIdle(button);
    resetForm();
    showActionFeedback(button, "Product saved", "商品已儲存");
  } catch (err) {
    markIdle(button);
    const raw = err?.message || "Could not add the product.";
    const zh =
      raw.includes("2 MB")
        ? "請選擇 2 MB 以下的圖片。"
        : raw.includes("JPG")
          ? "請選擇 JPG、PNG 或 WebP 圖片。"
          : raw;
    showActionFeedback(button, raw, zh, "error");
  }
});
