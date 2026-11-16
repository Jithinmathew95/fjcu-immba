import { getProfile, isStaffRole, signOut } from "./lib/auth.js";

const status = document.querySelector("[data-admin-status]");
const emailEl = document.querySelector("[data-admin-email]");
const roleEl = document.querySelector("[data-admin-role]");
const staffLinks = document.querySelector("[data-staff-links]");
const pendingBox = document.querySelector("[data-pending-box]");
const rejectedBox = document.querySelector("[data-rejected-box]");

function setStatus(message, kind = "info") {
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("hidden", !message);
  status.hidden = !message;
  status.dataset.kind = kind;
}

function show(el, on) {
  if (!el) return;
  el.classList.toggle("hidden", !on);
  el.hidden = !on;
}

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await signOut();
  window.location.replace("admin-login.html");
});

try {
  const profile = await getProfile();
  if (!profile?.user) {
    window.location.replace("admin-login.html");
  } else {
    if (emailEl) emailEl.textContent = profile.email || profile.user.email || "";
    if (roleEl) roleEl.textContent = profile.role;
    show(staffLinks, isStaffRole(profile.role));
    show(pendingBox, profile.role === "pending");
    show(rejectedBox, profile.role === "rejected");
    if (profile.role === "super_admin") {
      document.querySelectorAll("[data-super-only]").forEach((el) => {
        el.classList.remove("hidden");
        el.hidden = false;
      });
    }
  }
} catch (err) {
  setStatus(err.message || "Could not load this account.", "error");
}
