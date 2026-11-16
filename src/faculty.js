import { supabase, supabaseConfigError } from "./lib/supabaseClient.js";
import { fetchFaculty } from "./lib/facultyApi.js";

const host = document.querySelector("[data-faculty]");
const statusEl = document.querySelector("[data-faculty-status]");
const searchEl = document.querySelector("[data-faculty-search]");
const filterHost = document.querySelector("[data-faculty-filters]");

let people = [];
let category = "all";
let loadError = "";

function lang() {
  return document.documentElement.lang === "zh" ? "zh" : "en";
}

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(message, kind = "info") {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.classList.toggle("hidden", !message);
  statusEl.hidden = !message;
  statusEl.dataset.kind = kind;
}

function matches(person, query) {
  if (category !== "all" && person.category !== category) return false;
  if (!query) return true;
  const hay = [
    person.name,
    person.nameZh,
    person.roleEn,
    person.roleZh,
    person.specEn,
    person.specZh,
    person.eduEn,
    person.eduZh,
    person.department,
    person.departmentZh,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

function render() {
  if (!host) return;
  const zh = lang() === "zh";
  const query = (searchEl?.value || "").trim().toLowerCase();
  if (loadError) {
    host.innerHTML = "";
    setStatus(loadError, "error");
    return;
  }
  const items = people.filter((person) => matches(person, query));
  if (!people.length) {
    setStatus(zh ? "目前沒有師資資料。" : "No faculty records yet.", "info");
    host.innerHTML = "";
    return;
  }
  setStatus(items.length ? "" : zh ? "沒有符合的師資。" : "No faculty match this search.");
  host.innerHTML = items
    .map((person) => {
      const name = zh ? person.nameZh || person.name : person.name;
      const title = zh ? person.roleZh || person.roleEn : person.roleEn;
      const edu = zh ? person.eduZh || person.eduEn : person.eduEn;
      const spec = zh ? person.specZh || person.specEn : person.specEn;
      const dept = zh ? person.departmentZh || person.department : person.department;
      const photo = person.photo
        ? `<img class="faculty-photo" src="${esc(person.photo)}" alt="${esc(name)}" width="160" height="200">`
        : "";
      const web = person.web
        ? ` · <a class="link-external" href="${esc(person.web)}" target="_blank" rel="noreferrer">${zh ? "個人網站" : "Website"} ↗</a>`
        : "";
      return `
        <article class="faculty-card">
          ${photo}
          <div class="faculty-copy">
            <h3>${esc(name)}</h3>
            <p>${esc(title)}</p>
            ${dept ? `<p>${esc(dept)}</p>` : ""}
            <p>${esc(edu)}</p>
            <p>${esc(spec)}</p>
            ${person.tel ? `<p>${esc(person.tel)}</p>` : ""}
            ${person.email ? `<p><a href="mailto:${esc(person.email)}">${esc(person.email)}</a>${web}</p>` : web ? `<p>${web}</p>` : ""}
          </div>
        </article>`;
    })
    .join("");
}

async function load() {
  if (!host) return;
  if (!supabase) {
    loadError = supabaseConfigError || (lang() === "zh" ? "無法連線師資資料庫。" : "Could not reach the faculty cabinet.");
    render();
    return;
  }
  setStatus(lang() === "zh" ? "載入師資中…" : "Loading faculty…");
  try {
    people = await fetchFaculty(supabase);
    loadError = "";
    render();
  } catch (err) {
    people = [];
    loadError = err.message || (lang() === "zh" ? "無法載入師資。" : "Could not load faculty.");
    render();
  }
}

filterHost?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-faculty-filter]");
  if (!button) return;
  category = button.dataset.facultyFilter || "all";
  filterHost.querySelectorAll("[data-faculty-filter]").forEach((el) => {
    el.classList.toggle("is-active", el === button);
  });
  render();
});

searchEl?.addEventListener("input", render);
const observer = new MutationObserver(render);
observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

load();
