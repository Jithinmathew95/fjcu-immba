import { supabase, supabaseConfigError } from "./supabaseClient.js";

function need() {
  if (!supabase) throw new Error(supabaseConfigError);
  return supabase;
}

export async function listActiveProducts() {
  const { data, error } = await need()
    .from("marketplace_products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getProduct(id) {
  const { data, error } = await need().from("marketplace_products").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listOwnProducts(sellerId) {
  let query = need().from("marketplace_products").select("*").order("created_at", { ascending: false });
  if (sellerId) query = query.eq("seller_id", sellerId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export const LOW_STOCK_THRESHOLD = 3;

export function stockFlags(available) {
  const qty = Number(available) || 0;
  if (qty <= 0) return { kind: "out", label: "Out of stock" };
  if (qty <= LOW_STOCK_THRESHOLD) return { kind: "low", label: "Low stock" };
  return { kind: "ok", label: "In stock" };
}

export async function listSellerInventory(sellerId) {
  const products = await listOwnProducts(sellerId);
  const { data: items, error } = await need()
    .from("marketplace_order_items")
    .select("product_id, quantity")
    .eq("seller_id", sellerId);
  if (error) throw error;
  const purchased = {};
  for (const item of items || []) {
    purchased[item.product_id] = (purchased[item.product_id] || 0) + Number(item.quantity || 0);
  }
  return products.map((product) => {
    const available = Math.max(0, Number(product.stock) || 0);
    const purchasedQty = purchased[product.id] || 0;
    return {
      ...product,
      available_stock: available,
      purchased_qty: purchasedQty,
      current_stock: available + purchasedQty,
    };
  });
}

export async function updateInventory(sellerId, id, { price, stock }) {
  const nextPrice = Number(price);
  const nextStock = Number(stock);
  if (!Number.isFinite(nextPrice) || nextPrice < 0) {
    throw new Error("Price cannot be negative.");
  }
  if (!Number.isFinite(nextStock) || nextStock < 0 || nextStock % 1 !== 0) {
    throw new Error("Stock cannot be negative.");
  }
  const { data, error } = await need()
    .from("marketplace_products")
    .update({ price: nextPrice, stock: nextStock })
    .eq("id", id)
    .eq("seller_id", sellerId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function hideOutOfStock(sellerId) {
  const { error } = await need()
    .from("marketplace_products")
    .update({ is_active: false })
    .eq("seller_id", sellerId)
    .lte("stock", 0);
  if (error) throw error;
}

const PHOTO_BUCKET = "marketplace-photos";

export const PRODUCT_CATEGORIES = [
  { id: "textbooks", en: "Textbooks", zh: "教科書" },
  { id: "course-packs", en: "Course packs", zh: "講義／個案" },
  { id: "notes", en: "Notes", zh: "筆記" },
  { id: "stationery", en: "Stationery", zh: "文具" },
  { id: "other", en: "Other", zh: "其他" },
];

export function categoryLabel(id) {
  return PRODUCT_CATEGORIES.find((item) => item.id === id)?.en || id || "Other";
}

function payload(product) {
  const row = {
    title: product.title,
    title_zh: product.title_zh || "",
    category: product.category || "other",
    description: product.description || "",
    description_zh: product.description_zh || "",
    price: product.price,
    stock: product.stock,
    is_active: product.is_active !== false,
  };
  if (product.image_url) row.image_url = product.image_url;
  return row;
}

export async function saveProduct(product) {
  const client = need();
  const row = payload(product);
  if (product.id) {
    const { data, error } = await client
      .from("marketplace_products")
      .update(row)
      .eq("id", product.id)
      .eq("seller_id", product.seller_id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client
    .from("marketplace_products")
    .insert({ ...row, seller_id: product.seller_id })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setProductActive(id, sellerId, isActive) {
  const { error } = await need()
    .from("marketplace_products")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("seller_id", sellerId);
  if (error) throw error;
}

export async function uploadProductImage(sellerId, productId, file) {
  const client = need();
  const type = file.type || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Please choose an image under 2 MB.");
  }
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const path = `${sellerId}/${productId}/${Date.now()}.${ext}`;
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: type,
    upsert: true,
  });
  if (error) throw error;
  const { data } = client.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const { error: updateError } = await client
    .from("marketplace_products")
    .update({ image_url: data.publicUrl })
    .eq("id", productId)
    .eq("seller_id", sellerId);
  if (updateError) throw updateError;
  return data.publicUrl;
}

export async function deleteProduct(id, sellerId) {
  let query = need().from("marketplace_products").delete().eq("id", id);
  if (sellerId) query = query.eq("seller_id", sellerId);
  const { error } = await query;
  if (error) throw error;
}

export async function listCart() {
  const { data, error } = await need()
    .from("marketplace_cart")
    .select("id, quantity, product_id, marketplace_products(*)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export function cartLineTotal(row) {
  return Number(row.marketplace_products?.price || 0) * Number(row.quantity || 0);
}

export function cartGrandTotal(rows) {
  return (rows || []).reduce((sum, row) => sum + cartLineTotal(row), 0);
}

export function cartIssue(row) {
  const product = row.marketplace_products;
  const title = product?.title || "A product";
  if (!product?.is_active) return `${title} is no longer available.`;
  const available = Number(product.stock) || 0;
  if (available < 1) return `${title} is out of stock.`;
  if (Number(row.quantity) > available) return `Only ${available} available for ${title}.`;
  return "";
}

export async function addToCart(productId, quantity = 1) {
  const client = need();
  const product = await getProduct(productId);
  if (!product?.is_active) throw new Error("This listing is not available.");
  const available = Number(product.stock) || 0;
  if (available < 1) throw new Error("This product is out of stock.");
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to add items to your cart.");
  if (product.seller_id === user.id) throw new Error("You cannot buy your own listing.");
  const { data: existing, error: readError } = await client
    .from("marketplace_cart")
    .select("id, quantity")
    .eq("product_id", productId)
    .maybeSingle();
  if (readError) throw readError;
  const nextQty = (existing?.quantity || 0) + quantity;
  if (nextQty > available) {
    throw new Error(`Only ${available} available. You cannot buy more than the current stock.`);
  }
  if (existing) {
    const { error } = await client
      .from("marketplace_cart")
      .update({ quantity: nextQty })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await client.from("marketplace_cart").insert({
    buyer_id: user.id,
    product_id: productId,
    quantity,
  });
  if (error) throw error;
}

export async function setCartQuantity(id, quantity) {
  const client = need();
  if (quantity < 1) {
    const { error } = await client.from("marketplace_cart").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const { data: row, error: readError } = await client
    .from("marketplace_cart")
    .select("id, marketplace_products(stock, is_active, title)")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;
  const product = row?.marketplace_products;
  const available = Number(product?.stock) || 0;
  if (!product?.is_active) throw new Error("This listing is not available.");
  if (quantity > available) {
    throw new Error(`Only ${available} available. You cannot buy more than the current stock.`);
  }
  const { error } = await client.from("marketplace_cart").update({ quantity }).eq("id", id);
  if (error) throw error;
}

export async function placeOrder() {
  const { data, error } = await need().rpc("place_marketplace_order");
  if (error) throw error;
  return data;
}

const ORDER_SELECT = "*, marketplace_order_items(*, marketplace_products(image_url, title))";

export async function getOrder(id) {
  const { data, error } = await need()
    .from("marketplace_orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listBuyerOrders() {
  const { data, error } = await need()
    .from("marketplace_orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export function lineImage(item) {
  return item?.image_url || item?.marketplace_products?.image_url || "";
}

export function paymentLabel(item) {
  return item?.payment_confirmed ? "Paid" : "Waiting for Payment";
}

export function sellerSaleRows(orders, sellerId) {
  const rows = [];
  for (const order of orders || []) {
    for (const item of order.marketplace_order_items || []) {
      if (item.seller_id === sellerId) rows.push({ order, item });
    }
  }
  return rows;
}

export function lineAmount(item) {
  return Number(item?.unit_price || 0) * Number(item?.quantity || 0);
}

export function lineFee(item) {
  const fee = Number(item?.platform_fee);
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
}

export function sellerReceive(item) {
  return Math.max(0, lineAmount(item) - lineFee(item));
}

export async function getPlatformFee() {
  const { data, error } = await need()
    .from("marketplace_settings")
    .select("platform_fee")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  const fee = Number(data?.platform_fee);
  return Number.isFinite(fee) && fee >= 0 ? fee : 4;
}

export async function setPlatformFee(value) {
  const fee = Number(value);
  if (!Number.isFinite(fee) || fee < 0) throw new Error("Platform fee must be 0 or more.");
  const { data, error } = await need()
    .from("marketplace_settings")
    .update({ platform_fee: fee, updated_at: new Date().toISOString() })
    .eq("id", "default")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Platform fee is not in the database yet. Paste supabase/marketplace-fee.sql in the SQL Editor first.");
}

export function transactionDate(order, item) {
  const stage = itemStage(item);
  if (stage === "completed") return item.completed_at || order.created_at;
  if (stage === "shipped") return item.shipped_at || order.created_at;
  if (item.payment_confirmed_at) return item.payment_confirmed_at;
  return order.created_at;
}

export function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey() {
  return monthKey(new Date());
}

export function monthLabel(key) {
  if (!key) return "";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function lastTwelveMonthKeys() {
  const now = new Date();
  const keys = [];
  for (let i = 11; i >= 0; i -= 1) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

export function watchMarketplaceOrders(handler) {
  const client = need();
  let timer = 0;
  const bounce = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => handler(), 250);
  };
  const channel = client
    .channel(`market-orders-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_orders" }, bounce)
    .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_order_items" }, bounce)
    .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_order_events" }, bounce)
    .subscribe();
  return () => {
    window.clearTimeout(timer);
    client.removeChannel(channel);
  };
}

export async function confirmPayment(itemId) {
  const { error } = await need().rpc("confirm_marketplace_payment", { p_item_id: itemId });
  if (error) throw error;
}

export async function confirmShipment(itemId) {
  const { error } = await need().rpc("confirm_marketplace_shipment", { p_item_id: itemId });
  if (error) throw error;
}

export async function confirmDelivery(itemId) {
  const { error } = await need().rpc("confirm_marketplace_delivery", { p_item_id: itemId });
  if (error) throw error;
}

export async function listOrderEvents(orderId) {
  const { data, error } = await need()
    .from("marketplace_order_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export function itemStage(item) {
  return (
    item?.fulfillment_status ||
    (item?.shipment_confirmed ? "shipped" : item?.payment_confirmed ? "ready_to_ship" : "waiting_payment")
  );
}

export function itemStatusLabel(status) {
  const map = {
    waiting_payment: "Waiting for Payment",
    ready_to_ship: "Ready to Ship",
    shipped: "Shipped",
    completed: "Completed",
  };
  return map[status] || statusLabel(status);
}

export function formatStamp(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export function formatStampHtml(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `<span class="market-stamp"><span class="market-stamp-date">${date}</span><span class="market-stamp-time">${time}</span></span>`;
}

export function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "NT$0";
  return `NT$${amount.toFixed(0)}`;
}

export function statusLabel(status) {
  const map = {
    pending_payment: "Waiting for Payment",
    paid: "Ready to Ship",
    shipped: "Shipped",
    completed: "Completed",
    cancelled: "Cancelled",
    waiting_payment: "Waiting for Payment",
    ready_to_ship: "Ready to Ship",
  };
  return map[status] || status;
}
