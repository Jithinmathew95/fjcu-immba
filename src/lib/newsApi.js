const TABLE = "announcements";
const PHOTO_BUCKET = "announcement-photos";

function publicPhotoUrl(item) {
  const photo = item.photo || "";
  return photo.startsWith("data:") ? "" : photo;
}

async function storePhotoIfNeeded(supabase, item) {
  const photo = item.photo || "";
  if (!photo.startsWith("data:")) return item;
  const response = await fetch(photo);
  if (!response.ok) throw new Error("Could not read the uploaded photo.");
  const blob = await response.blob();
  const type = blob.type || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";
  const path = `${item.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: type,
    upsert: true
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { ...item, photo: data.publicUrl };
}

export function itemToRow(item) {
  return {
    id: item.id,
    date: item.date,
    link: item.link || "",
    photo: publicPhotoUrl(item),
    sort_order: Number.isFinite(Number(item.order)) ? Number(item.order) : 1,
    status: item.status === "draft" || item.status === "hidden" ? item.status : "published",
    tag_en: item.tagEn || "News",
    tag_zh: item.tagZh || "消息",
    title_en: item.titleEn || "",
    title_zh: item.titleZh || "",
    body_en: item.bodyEn || "",
    body_zh: item.bodyZh || "",
    updated_at: new Date().toISOString(),
  };
}

export function rowToItem(row, index = 0) {
  return {
    id: row.id,
    date: row.date,
    link: row.link || "",
    photo: row.photo || "",
    order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index + 1,
    status: row.status === "draft" || row.status === "hidden" ? row.status : "published",
    tagEn: row.tag_en || "News",
    tagZh: row.tag_zh || "消息",
    titleEn: row.title_en || "",
    titleZh: row.title_zh || "",
    bodyEn: row.body_en || "",
    bodyZh: row.body_zh || "",
  };
}

export async function fetchPublishedAnnouncements(supabase) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToItem);
}

export async function fetchAllAnnouncements(supabase) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToItem);
}

export async function replaceAllAnnouncements(supabase, items) {
  const prepared = [];
  for (const item of items || []) {
    prepared.push(await storePhotoIfNeeded(supabase, item));
  }
  const rows = prepared.map(itemToRow);
  const { data: existing, error: readError } = await supabase.from(TABLE).select("id");
  if (readError) throw readError;
  const keep = new Set(rows.map((row) => row.id));
  const toDelete = (existing || []).map((row) => row.id).filter((id) => !keep.has(id));
  if (toDelete.length) {
    const { error: deleteError } = await supabase.from(TABLE).delete().in("id", toDelete);
    if (deleteError) throw deleteError;
  }
  if (!rows.length) return [];
  const { error: upsertError } = await supabase.from(TABLE).upsert(rows, { onConflict: "id" });
  if (upsertError) throw upsertError;
  return prepared;
}
