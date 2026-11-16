import { requireStaff, signOut } from "./lib/auth.js";
import {
  deleteFaculty,
  fetchFaculty,
  migrateLocalPhoto,
  saveFaculty,
  saveFacultyOrder,
  slugifyName,
  uploadFacultyPhoto,
} from "./lib/facultyApi.js";
import { supabase } from "./lib/supabaseClient.js";

const profile = await requireStaff();
if (!profile) throw new Error("Staff sign-in required.");

const status = document.querySelector("[data-admin-status]");
const emailEl = document.querySelector("[data-admin-email]");
const form = document.querySelector("[data-faculty-form]");
const listHost = document.querySelector("[data-faculty-table]");
const migrateBtn = document.querySelector("[data-migrate-photos]");

if (emailEl) emailEl.textContent = profile.email || profile.user.email || "";

let people = [];
let editingId = "";

function setStatus(message, kind = "info") {
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("hidden", !message);
  status.hidden = !message;
  status.dataset.kind = kind;
}

function emptyPerson() {
  return {
    id: "",
    name: "",
    nameZh: "",
    roleEn: "",
    roleZh: "",
    department: "College of Management",
    departmentZh: "管理學院",
    eduEn: "",
    eduZh: "",
    specEn: "",
    specZh: "",
    email: "",
    tel: "",
    web: "",
    photo: "",
    category: "full-time",
    order: people.length + 1,
  };
}

function fillForm(person) {
  const fields = form.elements;
  fields.id.value = person.id || "";
  fields.name.value = person.name || "";
  fields.nameZh.value = person.nameZh || "";
  fields.roleEn.value = person.roleEn || "";
  fields.roleZh.value = person.roleZh || "";
  fields.department.value = person.department || "";
  fields.departmentZh.value = person.departmentZh || "";
  fields.eduEn.value = person.eduEn || "";
  fields.eduZh.value = person.eduZh || "";
  fields.specEn.value = person.specEn || "";
  fields.specZh.value = person.specZh || "";
  fields.email.value = person.email || "";
  fields.tel.value = person.tel || "";
  fields.web.value = person.web || "";
  fields.photo.value = person.photo || "";
  fields.category.value = person.category || "full-time";
  fields.order.value = person.order || people.length + 1;
}

function readForm() {
  const fields = form.elements;
  const name = fields.name.value.trim();
  return {
    id: fields.id.value.trim() || slugifyName(name),
    name,
    nameZh: fields.nameZh.value.trim(),
    roleEn: fields.roleEn.value.trim(),
    roleZh: fields.roleZh.value.trim(),
    department: fields.department.value.trim(),
    departmentZh: fields.departmentZh.value.trim(),
    eduEn: fields.eduEn.value.trim(),
    eduZh: fields.eduZh.value.trim(),
    specEn: fields.specEn.value.trim(),
    specZh: fields.specZh.value.trim(),
    email: fields.email.value.trim(),
    tel: fields.tel.value.trim(),
    web: fields.web.value.trim(),
    photo: fields.photo.value.trim(),
    category: fields.category.value,
    order: Number(fields.order.value) || people.length + 1,
  };
}

function renderList() {
  if (!listHost) return;
  listHost.innerHTML = people
    .map(
      (person, index) => `
      <tr draggable="true" data-faculty-id="${person.id}">
        <td>${index + 1}</td>
        <td>${person.photo ? `<img class="admin-thumb" src="${person.photo}" alt="">` : ""}</td>
        <td>${person.name}<br><span class="meta">${person.nameZh}</span></td>
        <td>${person.category}</td>
        <td class="admin-actions">
          <button type="button" class="btn btn-line" data-edit="${person.id}">Edit</button>
          <button type="button" class="btn btn-line" data-up="${person.id}">Up</button>
          <button type="button" class="btn btn-line" data-down="${person.id}">Down</button>
          <button type="button" class="btn btn-danger" data-delete="${person.id}">Delete</button>
        </td>
      </tr>`
    )
    .join("");
}

async function load() {
  people = await fetchFaculty(supabase);
  renderList();
}

async function persistOrder(next) {
  people = next.map((person, index) => ({ ...person, order: index + 1 }));
  await saveFacultyOrder(supabase, people);
  renderList();
}

function move(id, delta) {
  const index = people.findIndex((person) => person.id === id);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= people.length) return people;
  const next = people.slice();
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

listHost?.addEventListener("click", async (event) => {
  const editId = event.target.closest("[data-edit]")?.dataset.edit;
  const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
  const upId = event.target.closest("[data-up]")?.dataset.up;
  const downId = event.target.closest("[data-down]")?.dataset.down;
  try {
    if (editId) {
      const person = people.find((item) => item.id === editId);
      if (!person) return;
      editingId = person.id;
      fillForm(person);
      form.scrollIntoView({ behavior: "smooth" });
    } else if (deleteId && window.confirm("Delete this faculty member?")) {
      await deleteFaculty(supabase, deleteId);
      setStatus("Deleted.");
      await load();
    } else if (upId) {
      await persistOrder(move(upId, -1));
    } else if (downId) {
      await persistOrder(move(downId, 1));
    }
  } catch (err) {
    setStatus(err.message || "Could not update faculty.", "error");
  }
});

let dragId = "";
listHost?.addEventListener("dragstart", (event) => {
  dragId = event.target.closest("[data-faculty-id]")?.dataset.facultyId || "";
});
listHost?.addEventListener("dragover", (event) => {
  event.preventDefault();
});
listHost?.addEventListener("drop", async (event) => {
  event.preventDefault();
  const targetId = event.target.closest("[data-faculty-id]")?.dataset.facultyId;
  if (!dragId || !targetId || dragId === targetId) return;
  const from = people.findIndex((person) => person.id === dragId);
  const to = people.findIndex((person) => person.id === targetId);
  const next = people.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  try {
    await persistOrder(next);
  } catch (err) {
    setStatus(err.message || "Could not reorder faculty.", "error");
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const person = readForm();
  if (!person.name) return setStatus("English name is required.", "error");
  try {
    const file = form.elements.photoFile.files[0];
    if (file) {
      person.photo = await uploadFacultyPhoto(supabase, person.id, file);
    }
    await saveFaculty(supabase, person);
    editingId = person.id;
    setStatus("Saved to the faculty cabinet.");
    form.elements.photoFile.value = "";
    fillForm(person);
    await load();
  } catch (err) {
    setStatus(err.message || "Could not save faculty.", "error");
  }
});

document.querySelector("[data-faculty-reset]")?.addEventListener("click", () => {
  editingId = "";
  fillForm(emptyPerson());
});

migrateBtn?.addEventListener("click", async () => {
  try {
    setStatus("Moving local portraits into Storage…");
    for (const person of people) {
      await migrateLocalPhoto(supabase, person);
    }
    await load();
    setStatus("Local portraits are now in faculty-photos.");
  } catch (err) {
    setStatus(err.message || "Could not move portraits.", "error");
  }
});

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await signOut();
  window.location.replace("admin-login.html");
});

fillForm(emptyPerson());
try {
  await load();
} catch (err) {
  setStatus(err.message || "Could not load faculty.", "error");
}
