import { requireSeller } from "./lib/auth.js";
import {
  currentMonthKey,
  formatStamp,
  itemStage,
  itemStatusLabel,
  lastTwelveMonthKeys,
  lineAmount,
  listBuyerOrders,
  money,
  monthKey,
  monthLabel,
  paymentLabel,
  sellerSaleRows,
  transactionDate,
  watchMarketplaceOrders,
} from "./lib/marketplaceApi.js";
import { bindMarketLogout, marketToolbar, setStatus } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const status = document.querySelector("[data-market-status]");
const filters = document.querySelector("[data-accounting-filters]");
const monthSelect = document.querySelector("[data-month]");
const statusSelect = document.querySelector("[data-status]");
const searchInput = document.querySelector("[data-order-q]");
const summaryEl = document.querySelector("[data-summary]");
const chartEl = document.querySelector("[data-chart]");
const historyEl = document.querySelector("[data-history]");

const profile = await requireSeller("marketplace-accounting.html");
if (!profile) throw new Error("Sign in required");
if (toolbar) toolbar.innerHTML = marketToolbar(profile, "marketplace-accounting.html");
bindMarketLogout();

let rows = [];

function uniqueOrders(list) {
  return new Set(list.map((row) => row.order.id)).size;
}

function inMonth(row, key) {
  if (!key) return true;
  return monthKey(transactionDate(row.order, row.item)) === key;
}

function fillMonths() {
  const selected = monthSelect.value || currentMonthKey();
  const keys = new Set(lastTwelveMonthKeys());
  for (const row of rows) {
    const key = monthKey(transactionDate(row.order, row.item));
    if (key) keys.add(key);
  }
  const options = ["", ...[...keys].sort().reverse()];
  monthSelect.innerHTML = options
    .map((key) => `<option value="${key}">${key ? monthLabel(key) : "All months"}</option>`)
    .join("");
  monthSelect.value = options.includes(selected) ? selected : currentMonthKey();
}

function filteredRows() {
  const month = monthSelect.value;
  const stage = statusSelect.value;
  const q = (searchInput.value || "").trim().toLowerCase();
  return rows.filter((row) => {
    if (!inMonth(row, month)) return false;
    if (stage && itemStage(row.item) !== stage) return false;
    if (!q) return true;
    const code = `${row.order.order_code || ""} ${row.order.id}`.toLowerCase();
    return code.includes(q);
  });
}

function renderSummary() {
  const month = monthSelect.value || currentMonthKey();
  const monthRows = rows.filter((row) => inMonth(row, month));
  const completed = monthRows.filter((row) => itemStage(row.item) === "completed");
  const revenue = completed.reduce((sum, row) => sum + lineAmount(row.item), 0);
  const pending = rows.filter((row) => itemStage(row.item) === "waiting_payment");
  const waitingShip = rows.filter((row) => itemStage(row.item) === "ready_to_ship");
  const monthTitle = monthLabel(month);
  summaryEl.innerHTML = `
    <article class="card">
      <p class="meta">Monthly Sales Revenue</p>
      <strong>${money(revenue)}</strong>
      <p>Completed transactions in ${monthTitle}. Unfinished sales are not included.</p>
    </article>
    <article class="card">
      <p class="meta">Total Completed Orders</p>
      <strong>${uniqueOrders(completed)}</strong>
      <p>${completed.length} completed line${completed.length === 1 ? "" : "s"} in ${monthTitle}.</p>
    </article>
    <article class="card">
      <p class="meta">Pending Payments</p>
      <strong>${uniqueOrders(pending)}</strong>
      <p>Open sales still waiting for payment confirmation.</p>
    </article>
    <article class="card">
      <p class="meta">Orders Waiting for Shipment</p>
      <strong>${uniqueOrders(waitingShip)}</strong>
      <p>Paid sales you still need to ship.</p>
    </article>`;
}

function renderChart() {
  const keys = lastTwelveMonthKeys();
  const totals = keys.map((key) =>
    rows
      .filter((row) => itemStage(row.item) === "completed" && monthKey(row.item.completed_at || row.order.created_at) === key)
      .reduce((sum, row) => sum + lineAmount(row.item), 0)
  );
  const max = Math.max(0, ...totals);
  if (!max) {
    chartEl.innerHTML = `<p class="market-chart-empty">No completed sales yet in the last 12 months.</p>`;
    return;
  }
  const width = 640;
  const height = 240;
  const padL = 48;
  const padB = 36;
  const padT = 16;
  const padR = 12;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const barW = innerW / keys.length - 10;
  const selected = monthSelect.value;
  const bars = keys
    .map((key, i) => {
      const value = totals[i];
      const h = (value / max) * innerH;
      const x = padL + i * (innerW / keys.length) + 5;
      const y = padT + innerH - h;
      const fill = key === selected ? "#c4a35a" : "#10243a";
      const [year, month] = key.split("-").map(Number);
      const label = new Date(year, month - 1, 1).toLocaleString(undefined, { month: "short" });
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 0)}" fill="${fill}">
          <title>${monthLabel(key)}: ${money(value)}</title>
        </rect>
        <text x="${x + barW / 2}" y="${height - 12}" text-anchor="middle" fill="#5c6774" font-size="11">${label}</text>`;
    })
    .join("");
  const ticks = [0, 0.5, 1]
    .map((part) => {
      const value = max * part;
      const y = padT + innerH - part * innerH;
      return `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" fill="#5c6774" font-size="11">${Math.round(value)}</text>
        <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#d7e0e8" />`;
    })
    .join("");
  chartEl.innerHTML = `<svg class="market-sales-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly completed sales revenue">
    ${ticks}
    ${bars}
  </svg>`;
}

function renderHistory() {
  const visible = filteredRows();
  if (!visible.length) {
    historyEl.innerHTML = `<p>No sales match these filters. Completed transactions stay in this history.</p>`;
    return;
  }
  historyEl.innerHTML = `<div class="admin-table-wrap">
    <table class="admin-table">
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Transaction ID</th>
          <th>Buyer Name</th>
          <th>Product Name</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Total Amount</th>
          <th>Payment Status</th>
          <th>Transaction Status</th>
          <th>Transaction Date</th>
        </tr>
      </thead>
      <tbody>
        ${visible
          .map(({ order, item }) => {
            const amount = lineAmount(item);
            return `<tr>
              <td>${order.order_code || order.id}<br><span class="meta">${order.id}</span></td>
              <td><span class="meta">${item.id}</span></td>
              <td>${order.buyer_email || "Buyer"}</td>
              <td>${item.title}</td>
              <td>${item.quantity}</td>
              <td>${money(item.unit_price)}</td>
              <td>${money(amount)}</td>
              <td>${paymentLabel(item)}</td>
              <td>${itemStatusLabel(itemStage(item))}</td>
              <td>${formatStamp(transactionDate(order, item))}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function paint() {
  renderSummary();
  renderChart();
  renderHistory();
}

async function load() {
  rows = sellerSaleRows(await listBuyerOrders(), profile.id);
  fillMonths();
  paint();
}

filters?.addEventListener("input", paint);
filters?.addEventListener("change", paint);

try {
  await load();
  watchMarketplaceOrders(() => {
    load().catch(() => {});
  });
} catch (err) {
  setStatus(status, err.message || "Could not load accounting.", "error");
}
