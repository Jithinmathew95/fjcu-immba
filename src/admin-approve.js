import {
  adminDeleteUser,
  listProfiles,
  requireSuperAdmin,
  setProfileRole,
  signOut,
} from "./lib/auth.js";
import { withBusy } from "./lib/marketplaceUi.js";

const profile = await requireSuperAdmin();
if (!profile) throw new Error("Super admin required.");

const status = document.querySelector("[data-admin-status]");
const emailEl = document.querySelector("[data-admin-email]");
const host = document.querySelector("[data-approve-table]");
const filterEl = document.querySelector("[data-approve-filter]");
const searchEl = document.querySelector("[data-approve-search]");

if (emailEl) emailEl.textContent = profile.email || profile.user.email || "";

let rows = [];
let lastNote = null;

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

function isMarketplaceOrderBlock(err) {
  const msg = `${err?.message || ""} ${err?.details || ""} ${err?.hint || ""} ${err?.code || ""}`;
  return /marketplace_orders|marketplace_order_items|marketplace_order_events/i.test(msg);
}

function noteFor(id) {
  if (!lastNote || lastNote.id !== id) return "";
  return `<span class="market-action-feedback" data-action-feedback data-kind="${lastNote.kind || "info"}" role="status" aria-live="polite" aria-atomic="true"><span data-en>${esc(lastNote.en)}</span><span data-zh>${esc(lastNote.zh)}</span></span>`;
}

function actionsFor(row) {
  if (row.role === "super_admin") return noteFor(row.id);
  if (row.role === "pending") {
    return `<span class="market-action-row">
      <button type="button" class="btn btn-navy" data-approve="${row.id}">
        <span data-en>Approve</span><span data-zh>核准</span>
      </button>
      <button type="button" class="btn btn-danger" data-reject="${row.id}">
        <span data-en>Reject</span><span data-zh>拒絕</span>
      </button>
      ${noteFor(row.id)}
    </span>`;
  }
  if (row.role === "admin") {
    return `<span class="market-action-row">
      <button type="button" class="btn btn-line" data-remove="${row.id}">
        <span data-en>Remove access</span><span data-zh>移除權限</span>
      </button>
      ${noteFor(row.id)}
    </span>`;
  }
  if (row.role === "rejected") {
    return `<span class="market-action-row">
      <button type="button" class="btn btn-navy" data-approve="${row.id}">
        <span data-en>Approve</span><span data-zh>核准</span>
      </button>
      <button type="button" class="btn btn-danger" data-delete="${row.id}">
        <span data-en>Delete account</span><span data-zh>刪除帳號</span>
      </button>
      ${noteFor(row.id)}
    </span>`;
  }
  return noteFor(row.id);
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
  const button = approve || reject || remove || removeAccount;
  if (!button) return;
  if (removeAccount) {
    const ok = window.confirm("Are you sure? This can't be undone");
    if (!ok) return;
  }
  const id = button.dataset.approve || button.dataset.reject || button.dataset.remove || button.dataset.delete;
  const result = await withBusy(button, async () => {
    if (approve) await setProfileRole(approve.dataset.approve, "admin");
    else if (reject) await setProfileRole(reject.dataset.reject, "rejected");
    else if (remove) await setProfileRole(remove.dataset.remove, "rejected");
    else if (removeAccount) await adminDeleteUser(removeAccount.dataset.delete);
  });
  if (result.skipped) return;
  if (result.error) {
    const blocked = removeAccount && isMarketplaceOrderBlock(result.error);
    lastNote = blocked
      ? {
          id,
          kind: "error",
          en: "This account has marketplace orders, so it can't be deleted. Use Remove access instead.",
          zh: "此帳號仍有市集訂單，無法刪除。請改用「移除權限」。",
        }
      : {
          id,
          kind: "error",
          en: result.error.message || "Could not update this account.",
          zh: result.error.message || "無法更新此帳號。",
        };
    paint();
    return;
  }
  lastNote = approve
    ? { id, en: "Approved", zh: "已核准" }
    : reject
      ? { id, en: "Rejected", zh: "已拒絕" }
      : remove
        ? { id, en: "Access removed", zh: "已移除權限" }
        : { id, en: "Account deleted", zh: "帳號已刪除" };
  if (removeAccount) setStatus(lastNote.en, lastNote.zh);
  await load();
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
