const TABLE = "faculty";
const PHOTO_BUCKET = "faculty-photos";

export function slugifyName(name) {
  const base = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `faculty-${Date.now()}`;
}

export function rowToPerson(row) {
  return {
    id: row.id,
    name: row.name || "",
    nameZh: row.name_zh || "",
    roleEn: row.title || "",
    roleZh: row.title_zh || "",
    department: row.department || "",
    departmentZh: row.department_zh || "",
    eduEn: row.education || "",
    eduZh: row.education_zh || "",
    specEn: row.research_fields || "",
    specZh: row.research_fields_zh || "",
    email: row.email || "",
    tel: row.phone || "",
    web: row.website || "",
    photo: row.image_url || "",
    category: row.category === "part-time" ? "part-time" : "full-time",
    order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 1,
  };
}

export function personToRow(person) {
  return {
    id: person.id,
    name: person.name || "",
    name_zh: person.nameZh || "",
    title: person.roleEn || "",
    title_zh: person.roleZh || "",
    department: person.department || "",
    department_zh: person.departmentZh || "",
    education: person.eduEn || "",
    education_zh: person.eduZh || "",
    research_fields: person.specEn || "",
    research_fields_zh: person.specZh || "",
    email: person.email || "",
    phone: person.tel || "",
    website: person.web || "",
    image_url: person.photo || "",
    category: person.category === "part-time" ? "part-time" : "full-time",
    sort_order: Number.isFinite(Number(person.order)) ? Number(person.order) : 1,
  };
}

export async function fetchFaculty(supabase) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToPerson);
}

export async function saveFaculty(supabase, person) {
  const { error } = await supabase.from(TABLE).upsert(personToRow(person), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteFaculty(supabase, id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function saveFacultyOrder(supabase, people) {
  const rows = people.map((person, index) => ({
    ...personToRow(person),
    sort_order: index + 1,
  }));
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

function extFromType(type) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

export async function uploadFacultyPhoto(supabase, facultyId, file) {
  const type = file.type || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
    throw new Error("Please choose a JPG, PNG, or WebP photo.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Please choose a photo under 2 MB.");
  }
  const path = `${facultyId}/${Date.now()}.${extFromType(type)}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: type,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function migrateLocalPhoto(supabase, person) {
  const photo = person.photo || "";
  if (!photo || photo.startsWith("http") || photo.startsWith("data:")) return person;
  const response = await fetch(`/${photo.replace(/^\/+/, "")}`);
  if (!response.ok) return person;
  const blob = await response.blob();
  const file = new File([blob], `${person.id}.jpg`, { type: blob.type || "image/jpeg" });
  const imageUrl = await uploadFacultyPhoto(supabase, person.id, file);
  const next = { ...person, photo: imageUrl };
  await saveFaculty(supabase, next);
  return next;
}
