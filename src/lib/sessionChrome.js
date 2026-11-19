export function revealAdminSession(profile) {
  const checking = document.querySelector("[data-admin-checking]");
  const session = document.querySelector("[data-admin-session]");
  const emailEl = document.querySelector("[data-admin-email]");
  if (emailEl) emailEl.textContent = profile?.email || profile?.user?.email || "";
  if (checking) {
    checking.hidden = true;
    checking.classList.add("hidden");
  }
  if (session) {
    const on = Boolean(profile?.user);
    session.hidden = !on;
    session.classList.toggle("hidden", !on);
  }
}

export function hideAdminChecking() {
  const checking = document.querySelector("[data-admin-checking]");
  if (!checking) return;
  checking.hidden = true;
  checking.classList.add("hidden");
}
