import { listProfiles, requireSuperAdmin, setProfileRole, signOut } from "./lib/auth.js";

const profile = await requireSuperAdmin();
if (!profile) throw new Error("Super admin required.");

const status = document.querySelector("[data-admin-status]");
const emailEl = document.querySelector("[data-admin-email]");
const host = document.querySelector("[data-approve-table]");

if (emailEl) emailEl.textContent = profile.email || profile.user.email || "";

function setStatus(message, kind = "info") {
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("hidden", !message);
  status.hidden = !message;
  status.dataset.kind = kind;
}

async function render() {
  const rows = await listProfiles();
  host.innerHTML = rows
    .map((row) => {
      const self = row.id === profile.id;
      return `
        <tr>
          <td>${row.email}</td>
          <td>${row.role}</td>
          <td>${new Date(row.created_at).toLocaleString()}</td>
          <td class="admin-actions">
            ${self ? "<span class=\"meta\">You</span>" : `
              <button type="button" class="btn btn-navy" data-role="admin" data-id="${row.id}">Admin</button>
              <button type="button" class="btn btn-line" data-role="super_admin" data-id="${row.id}">Super admin</button>
              <button type="button" class="btn btn-line" data-role="pending" data-id="${row.id}">Pending</button>
              <button type="button" class="btn btn-danger" data-role="rejected" data-id="${row.id}">Reject</button>
            `}
          </td>
        </tr>`;
    })
    .join("");
}

host?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-role]");
  if (!button) return;
  try {
    await setProfileRole(button.dataset.id, button.dataset.role);
    setStatus("Role updated.");
    await render();
  } catch (err) {
    setStatus(err.message || "Could not update the role.", "error");
  }
});

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await signOut();
  window.location.replace("admin-login.html");
});

try {
  await render();
} catch (err) {
  setStatus(err.message || "Could not load accounts.", "error");
}
