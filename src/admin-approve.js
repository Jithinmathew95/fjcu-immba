import {
  adminDeleteUser,
  listProfiles,
  requireSuperAdmin,
  setProfileRole,
  signOut,
} from "./lib/auth.js";

const profile = await requireSuperAdmin();
if (!profile) throw new Error("Super admin required.");

const status = document.querySelector("[data-admin-status]");
const emailEl = document.querySelector("[data-admin-email]");
const host = document.querySelector("[data-approve-table]");
const filterEl = document.querySelector("[data-approve-filter]");
const searchEl = document.querySelector("[data-approve-search]");

if (emailEl) emailEl.textContent = profile.email || profile.user.email || "";

let rows = [];

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(en, zh = en, kind = "info") {
  if (!status) return;
  status.innerHTML = en ? `<span data-en>${esc(en)}</span><span data-zh>${esc(zh)}</span>` : "";
  status.classList.toggle("hidden", !en);
  status.hidden = !en;
  status.dataset.kind = kind;
}

function actionsFor(row) {
  if (row.role === "super_admin") return "";
  if (row.role === "pending") {
    return `
      <button type="button" class="btn btn-navy" data-approve="${row.id}">
        <span data-en>Approve</span><span data-zh>核准</span>
      </button>
      <button type="button" class="btn btn-danger" data-reject="${row.id}">
        <span data-en>Reject</span><span data-zh>拒絕</span>
      </button>`;
  }
  if (row.role === "admin") {
    return `
      <button type="button" class="btn btn-line" data-remove="${row.id}">
        <span data-en>Remove access</span><span data-zh>移除權限</span>
      </button>`;
  }
  if (row.role === "rejected") {
    return `
      <button type="button" class="btn btn-navy" data-approve="${row.id}">
        <span data-en>Approve</span><span data-zh>核准</span>
      </button>
      <button type="button" class="btn btn-danger" data-delete="${row.id}">
        <span data-en>Delete account</span><span data-zh>刪除帳號</span>
      </button>`;
  }
  return "";
}

function visibleRows() {
  const role = filterEl?.value || "pending";
  const q = (searchEl?.value || "").trim().toLowerCase();
  return rows.filter((row) => {
    if (role !== "all" && row.role !== role) return false;
    if (q && !(row.email || "").toLowerCase().includes(q)) return false;
    return true;
  });
}

function paint() {
  const visible = visibleRows();
  if (!visible.length) {
    host.innerHTML = `<tr><td colspan="4"><span data-en>No accounts match this filter.</span><span data-zh>沒有符合的帳號。</span></td></tr>`;
    return;
  }
  host.innerHTML = visible
    .map(
      (row) => `
        <tr>
          <td>${esc(row.email)}</td>
          <td>${esc(row.role)}</td>
          <td>${esc(row.created_at ? new Date(row.created_at).toLocaleString() : "")}</td>
          <td class="admin-actions">${actionsFor(row)}</td>
        </tr>`
    )
    .join("");
}

async function load() {
  rows = await listProfiles();
  paint();
}

filterEl?.addEventListener("change", paint);
searchEl?.addEventListener("input", paint);

host?.addEventListener("click", async (event) => {
  const approve = event.target.closest("[data-approve]");
  const reject = event.target.closest("[data-reject]");
  const remove = event.target.closest("[data-remove]");
  const removeAccount = event.target.closest("[data-delete]");
  try {
    if (approve) {
      await setProfileRole(approve.dataset.approve, "admin");
      setStatus("Approved. This account is now admin.", "已核准，此帳號現為管理員。");
      await load();
    } else if (reject) {
      await setProfileRole(reject.dataset.reject, "rejected");
      setStatus("Rejected.", "已拒絕。");
      await load();
    } else if (remove) {
      await setProfileRole(remove.dataset.remove, "rejected");
      setStatus("Access removed.", "已移除權限。");
      await load();
    } else if (removeAccount) {
      const ok = window.confirm("Are you sure? This can't be undone");
      if (!ok) return;
      await adminDeleteUser(removeAccount.dataset.delete);
      setStatus("Account deleted.", "帳號已刪除。");
      await load();
    }
  } catch (err) {
    setStatus(err.message || "Could not update this account.", err.message || "無法更新此帳號。", "error");
  }
});

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await signOut();
  window.location.replace("admin-login.html");
});

try {
  await load();
} catch (err) {
  setStatus(err.message || "Could not load accounts.", err.message || "無法載入帳號。", "error");
}
