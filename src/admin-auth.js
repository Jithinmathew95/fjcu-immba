import { fetchAllAnnouncements, replaceAllAnnouncements } from "./lib/newsApi.js";
import { requireStaff, signOut, supabase } from "./lib/auth.js";
import { hideAdminChecking, revealAdminSession } from "./lib/sessionChrome.js";

const office = document.querySelector("[data-admin-office]");
const status = document.querySelector("[data-admin-status]");
const sessionBar = document.querySelector("[data-admin-session]");
const emailLabel = document.querySelector("[data-admin-email]");

function setVisible(el, visible) {
  if (!el) return;
  el.classList.toggle("hidden", !visible);
  el.hidden = !visible;
}

function setLoginStatus(message, kind) {
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("hidden", !message);
  status.hidden = !message;
  status.dataset.kind = kind || "info";
}

function showOffice(user) {
  hideAdminChecking();
  setVisible(office, true);
  setVisible(sessionBar, true);
  revealAdminSession({ user, email: user.email });
  if (emailLabel) emailLabel.textContent = user.email || "Signed in";
}

if (window.IMMBANews && supabase) {
  window.IMMBANews.publishRemote = async (list) => {
    return replaceAllAnnouncements(supabase, list);
  };
}

async function loadOfficeNews() {
  if (!supabase || !window.IMMBANews) return;
  try {
    const remote = await fetchAllAnnouncements(supabase);
    let list = window.IMMBANews.mergeLists(window.IMMBANews.defaults(), window.IMMBANews.getDraft(), remote);
    if (list.some((item) => String(item.photo || "").startsWith("data:")) && window.IMMBANews.publishRemote) {
      list = await window.IMMBANews.publishRemote(list);
    }
    window.IMMBANews.hydrateDraft(list);
    window.IMMBANews.hydratePublished(list.filter((item) => (item.status || "published") === "published"));
    window.IMMBANewsAdmin?.reload(list);
  } catch (err) {
    setLoginStatus(err.message || "Could not load announcements from Supabase.", "error");
  }
}

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await signOut();
  window.location.replace("admin-login.html");
});

const profile = await requireStaff();
if (profile) {
  showOffice(profile.user);
  await loadOfficeNews();
}
