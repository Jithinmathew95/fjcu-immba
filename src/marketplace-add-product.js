import { requireSeller } from "./lib/auth.js";
import { getProduct, saveProduct, uploadProductImage } from "./lib/marketplaceApi.js";
import { bindMarketLogout, marketToolbar, setStatus } from "./lib/marketplaceUi.js";

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

function showPreview(url) {
  if (!preview) return;
  const img = preview.querySelector("img");
  const on = Boolean(url);
  preview.classList.toggle("hidden", !on);
  preview.hidden = !on;
  if (img) img.src = url || "";
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
        submitLabel.innerHTML = `<span data-en>Save changes</span><span data-zh>儲存變更</span>`;
      }
    }
  } catch (err) {
    setStatus(status, err.message || "Could not load that listing.", "error");
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("[type=submit]");
  if (button) button.disabled = true;
  try {
    const creating = !form.elements.id.value;
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
      const url = await uploadProductImage(profile.id, product.id, file);
      showPreview(url);
    }
    form.elements.id.value = product.id;
    form.elements.photo.value = "";
    const live = form.elements.status.value === "active";
    setStatus(
      status,
      live
        ? creating
          ? "Product added. It is now visible on the buyer browse page."
          : "Product updated and visible on the buyer browse page."
        : "Product saved as Hidden. Set status to Active to show it to buyers."
    );
    if (submitLabel) {
      submitLabel.innerHTML = `<span data-en>Save changes</span><span data-zh>儲存變更</span>`;
    }
  } catch (err) {
    setStatus(status, err.message || "Could not add the product.", "error");
  } finally {
    if (button) button.disabled = false;
  }
});
