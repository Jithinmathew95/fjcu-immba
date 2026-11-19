import { requireSeller } from "./lib/auth.js";
import {
  currentMonthKey,
  formatStamp,
  itemStage,
  itemStatusLabel,
  lastTwelveMonthKeys,
  lineAmount,
  lineFee,
  listBuyerOrders,
  money,
  sellerReceive,
  monthKey,
  monthLabel,
  paymentLabel,
  sellerSaleRows,
  transactionDate,
  watchMarketplaceOrders,
} from "./lib/marketplaceApi.js";
import { bindMarketLogout, marketToolbar, productCellHtml, publicOrderCode, setStatus } from "./lib/marketplaceUi.js";

const toolbar = document.querySelector("[data-market-chrome]");
const status = document.querySelector("[data-market-status]");
const filters = document.querySelector("[data-accounting-filters]");
const monthSelect = document.querySelector("[data-month]");
const statusSelect = document.querySelector("[data-status]");
const searchInput = document.querySelector("[data-order-q]");
const summaryEl = document.querySelector("[data-summary]");
const chartEl = document.querySelector("[data-chart]");
const historyEl = document.querySelector("[data-history]");
const exportBtn = document.querySelector("[data-export-csv]");

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
  const revenue = completed.reduce((sum, row) => sum + sellerReceive(row.item), 0);
  const fees = completed.reduce((sum, row) => sum + lineFee(row.item), 0);
  const pending = rows.filter((row) => itemStage(row.item) === "waiting_payment");
  const waitingShip = rows.filter((row) => itemStage(row.item) === "ready_to_ship");
  const monthTitle = monthLabel(month);
  summaryEl.innerHTML = `
    <article class="card">
      <p class="meta"><span data-en>Monthly Sales Revenue</span><span data-zh>本月銷售營收</span></p>
      <strong>${money(revenue)}</strong>
      <p class="meta"><span data-en>Platform fees this month</span><span data-zh>本月平台手續費</span> ${money(fees)}</p>
      <p><span data-en>Completed transactions in ${monthTitle} after platform fees. Unfinished sales are not included.</span><span data-zh>${monthTitle} 已完成交易扣除平台手續費後的實收。未完成銷售不列入。</span></p>
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
      .reduce((sum, row) => sum + sellerReceive(row.item), 0)
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
          <th><span data-en>Platform fee</span><span data-zh>平台手續費</span></th>
          <th><span data-en>You receive</span><span data-zh>您實收</span></th>
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
              <td>${publicOrderCode(order)}</td>
              <td><span class="market-order-uuid">${item.id}</span></td>
              <td>${order.buyer_email || "Buyer"}</td>
              <td>${productCellHtml(item)}</td>
              <td>${item.quantity}</td>
              <td>${money(item.unit_price)}</td>
              <td>${money(amount)}</td>
              <td>${money(lineFee(item))}</td>
              <td>${money(sellerReceive(item))}</td>
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

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportHistoryCsv() {
  const headers = [
    "Order ID",
    "Transaction ID",
    "Buyer Name",
    "Product Name",
    "Quantity",
    "Unit Price",
    "Total Amount",
    "Platform fee",
    "You receive",
    "Payment Status",
    "Transaction Status",
    "Transaction Date",
  ];
  const lines = [
    headers.map(csvCell).join(","),
    ...filteredRows().map(({ order, item }) =>
      [
        order.order_code || "—",
        item.id,
        order.buyer_email || "Buyer",
        item.title,
        item.quantity,
        money(item.unit_price),
        money(lineAmount(item)),
        money(lineFee(item)),
        money(sellerReceive(item)),
        paymentLabel(item),
        itemStatusLabel(itemStage(item)),
        formatStamp(transactionDate(order, item)),
      ]
        .map(csvCell)
        .join(",")
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sales-${monthSelect.value || currentMonthKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
exportBtn?.addEventListener("click", exportHistoryCsv);

try {
  await load();
  watchMarketplaceOrders(() => {
    load().catch(() => {});
  });
} catch (err) {
  setStatus(status, err.message || "Could not load accounting.", "error");
}
