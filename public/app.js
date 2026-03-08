/* ===== PropFlow — Spreadsheet UI (ES5-compatible) ===== */

// ===== DATA CACHE =====
var DATA = { properties: [], tenants: [], income: [], expenses: [], maintenance: [] };

// ===== API HELPER =====
async function api(path, options) {
  var res = await fetch(path, options);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  if (!res.ok) {
    var err = await res.json().catch(function() { return { error: 'Request failed' }; });
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function loadAllData() {
  var results = await Promise.all([
    api('/api/properties'),
    api('/api/tenants'),
    api('/api/income'),
    api('/api/expenses'),
    api('/api/maintenance')
  ]);
  if (!results[0]) return;
  DATA.properties = results[0];
  DATA.tenants = results[1];
  DATA.income = results[2];
  DATA.expenses = results[3];
  DATA.maintenance = results[4] || [];
}

// ===== HELPERS =====
function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
}

function fmtDate(dateStr) {
  if (!dateStr) return '\u2014';
  var d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPropertyName(id) {
  var p = DATA.properties.find(function(x) { return x.id === id; });
  return p ? p.name : '\u2014';
}

function getTenantName(id) {
  var t = DATA.tenants.find(function(x) { return x.id === id; });
  return t ? t.name : '\u2014';
}

function badgeClass(status) {
  var s = (status || '').toLowerCase();
  if (s === 'active' || s === 'paid') return 'badge-paid';
  if (s === 'late') return 'badge-late';
  if (s === 'pending') return 'badge-pending';
  if (s === 'inactive') return 'badge-inactive';
  return 'badge-primary';
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function fmtFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== PARTIAL PAYMENT HELPERS =====
function getTenantMonthPayments(tenantId, month) {
  return DATA.income.filter(function(i) {
    var tid = i.tenant_id || i.tenantId;
    return tid === tenantId && i.date && i.date.startsWith(month) && i.status === 'paid';
  });
}

function getTenantMonthPaid(tenantId, month) {
  return getTenantMonthPayments(tenantId, month).reduce(function(s, i) { return s + i.amount; }, 0);
}

function getTenantBalance(tenantId, month) {
  var tenant = DATA.tenants.find(function(t) { return t.id === tenantId; });
  if (!tenant) return 0;
  var rent = tenant.monthly_rent || tenant.monthlyRent || 0;
  var paid = getTenantMonthPaid(tenantId, month);
  return Math.max(0, rent - paid);
}

// ===== DATE RANGE HELPERS =====
function getDateRange(rangeType) {
  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth();
  var from, to;
  if (rangeType === 'this-month') {
    from = new Date(y, m, 1);
    to = new Date(y, m + 1, 0);
  } else if (rangeType === 'last-month') {
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 0);
  } else if (rangeType === 'this-quarter') {
    var qStart = Math.floor(m / 3) * 3;
    from = new Date(y, qStart, 1);
    to = new Date(y, qStart + 3, 0);
  } else if (rangeType === 'ytd') {
    from = new Date(y, 0, 1);
    to = new Date(y, m + 1, 0);
  } else if (rangeType === 'all') {
    return { from: '2000-01-01', to: '2099-12-31' };
  } else {
    from = new Date(y, m, 1);
    to = new Date(y, m + 1, 0);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtIso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  return { from: fmtIso(from), to: fmtIso(to) };
}

function getDefaultDateRange() {
  return getDateRange('this-month');
}

// ===== CSV EXPORT =====
function exportCSV(filename, headers, rows) {
  var csv = headers.join(',') + '\n';
  rows.forEach(function(row) {
    csv += row.map(function(cell) {
      var val = String(cell == null ? '' : cell);
      if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',') + '\n';
  });
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ===== THEME TOGGLE =====
(function initTheme() {
  var root = document.documentElement;
  var saved = localStorage.getItem('pf-theme');
  var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', theme);
  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    updateToggleIcon(toggle, theme);
    toggle.addEventListener('click', function() {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      localStorage.setItem('pf-theme', theme);
      updateToggleIcon(toggle, theme);
      if (typeof destroyCharts === 'function') destroyCharts();
      var current = location.hash.replace('#', '') || 'dashboard';
      if (current === 'dashboard' || current === 'reports') renderPage(current);
    });
  }
})();

function updateToggleIcon(btn, theme) {
  btn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
  btn.innerHTML = theme === 'dark'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

// ===== LOGOUT =====
(function initLogout() {
  function doLogout() {
    fetch('/auth/logout', { method: 'POST' }).then(function() {
      window.location.href = '/login';
    });
  }
  var btn = document.getElementById('logout-btn');
  if (btn) btn.addEventListener('click', doLogout);
  var btnM = document.getElementById('logout-btn-mobile');
  if (btnM) btnM.addEventListener('click', doLogout);
})();

// ===== MOBILE NAV =====
(function initMobileNav() {
  var menuBtn = document.getElementById('mobile-menu-btn');
  var overlay = document.getElementById('mobile-nav-overlay');
  var drawer = document.getElementById('mobile-nav-drawer');

  function openNav() {
    overlay.hidden = false;
    drawer.hidden = false;
  }

  function closeNav() {
    overlay.hidden = true;
    drawer.hidden = true;
  }

  if (menuBtn) menuBtn.addEventListener('click', openNav);
  if (overlay) overlay.addEventListener('click', closeNav);

  var mobileLinks = document.querySelectorAll('.mobile-nav-item');
  mobileLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      closeNav();
      navigateTo(this.getAttribute('data-page'));
    });
  });
})();

// ===== MODAL =====
function openModal(title, bodyHtml) {
  var overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  overlay.hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  var modal = document.getElementById('modal');
  if (modal) modal.classList.remove('modal-wide');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ===== ROUTING =====
var currentPage = 'dashboard';
var chartInstances = [];

function destroyCharts() {
  chartInstances.forEach(function(c) { try { c.destroy(); } catch(e) {} });
  chartInstances = [];
}

function navigateTo(page) {
  currentPage = page;
  location.hash = '#' + page;
  renderPage(page);
  updateNav(page);
}

function updateNav(page) {
  var basePage = page.split('/')[0];

  document.querySelectorAll('.tab-btn').forEach(function(item) {
    item.classList.toggle('active', item.getAttribute('data-page') === basePage);
  });
  document.querySelectorAll('.mobile-nav-item').forEach(function(item) {
    item.classList.toggle('active', item.getAttribute('data-page') === basePage);
  });
}

async function renderPage(page) {
  destroyCharts();
  var main = document.getElementById('main-content');
  var parts = page.split('/');

  await loadAllData();

  switch (parts[0]) {
    case 'dashboard': renderDashboard(main); break;
    case 'properties':
      if (parts[1]) renderPropertyDetail(main, parseInt(parts[1]));
      else renderProperties(main);
      break;
    case 'tenants': renderTenants(main); break;
    case 'income': renderIncome(main); break;
    case 'expenses': renderExpenses(main); break;
    case 'maintenance': renderMaintenance(main); break;
    case 'reports': await renderReports(main); break;
    default: renderDashboard(main);
  }
  main.scrollTop = 0;
}

// Tab click handlers
document.querySelectorAll('.tab-btn').forEach(function(item) {
  item.addEventListener('click', function(e) {
    e.preventDefault();
    navigateTo(this.getAttribute('data-page'));
  });
});

window.addEventListener('hashchange', function() {
  var hash = location.hash.replace('#', '') || 'dashboard';
  if (hash !== currentPage) {
    currentPage = hash;
    renderPage(hash);
    updateNav(hash);
  }
});

// ===== CHART HELPERS =====
function getChartColors() {
  var style = getComputedStyle(document.documentElement);
  return {
    primary: style.getPropertyValue('--color-primary').trim(),
    chart1: style.getPropertyValue('--color-chart-1').trim() || '#0e7490',
    chart2: style.getPropertyValue('--color-chart-2').trim() || '#6366f1',
    chart3: style.getPropertyValue('--color-chart-3').trim() || '#f59e0b',
    chart4: style.getPropertyValue('--color-chart-4').trim() || '#10b981',
    chart5: style.getPropertyValue('--color-chart-5').trim() || '#ef4444',
    chart6: style.getPropertyValue('--color-chart-6').trim() || '#8b5cf6',
    text: style.getPropertyValue('--color-text').trim(),
    textMuted: style.getPropertyValue('--color-text-muted').trim(),
    divider: style.getPropertyValue('--color-divider').trim(),
    surface: style.getPropertyValue('--color-surface').trim(),
    success: style.getPropertyValue('--color-success').trim(),
    error: style.getPropertyValue('--color-error').trim()
  };
}

function chartDefaults(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: colors.textMuted, font: { family: "'Inter', sans-serif", size: 12 }, usePointStyle: true, padding: 16 } },
      tooltip: { backgroundColor: colors.surface, titleColor: colors.text, bodyColor: colors.textMuted, borderColor: colors.divider, borderWidth: 1, padding: 12, titleFont: { family: "'Inter', sans-serif", weight: '600' }, bodyFont: { family: "'Inter', sans-serif" } }
    },
    scales: {
      x: { ticks: { color: colors.textMuted, font: { family: "'Inter', sans-serif", size: 12 } }, grid: { color: (colors.divider || '#ddd') + '40' }, border: { display: false } },
      y: { ticks: { color: colors.textMuted, font: { family: "'Inter', sans-serif", size: 12 }, callback: function(v) { return '$' + v.toLocaleString(); } }, grid: { color: (colors.divider || '#ddd') + '40' }, border: { display: false } }
    }
  };
}

// ===== DASHBOARD PAGE =====
function renderDashboard(container) {
  var totalProps = DATA.properties.length;
  var totalUnits = DATA.properties.reduce(function(s, p) { return s + p.units; }, 0);
  var now = new Date();
  var currentMonth = now.toISOString().slice(0, 7);
  var monthIncome = DATA.income.filter(function(i) { return i.date.startsWith(currentMonth); });
  var monthExpenses = DATA.expenses.filter(function(e) { return e.date.startsWith(currentMonth); });
  var monthlyCollected = monthIncome.reduce(function(s, i) { return s + i.amount; }, 0);
  var monthlyExpense = monthExpenses.reduce(function(s, e) { return s + e.amount; }, 0);
  var netIncome = monthlyCollected - monthlyExpense;
  var activeTenants = DATA.tenants.filter(function(t) { return t.status === 'active'; }).length;
  var occupancyRate = totalUnits > 0 ? Math.round((activeTenants / totalUnits) * 100) : 0;
  var monthLabel = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  var recentTransactions = DATA.income.slice().sort(function(a, b) { return b.date.localeCompare(a.date) || b.id - a.id; }).slice(0, 10);

  // New KPIs
  var openWorkOrders = DATA.maintenance.filter(function(m) { return m.status === 'open' || m.status === 'in-progress'; }).length;
  var nowTs = now.getTime();
  var leasingSoon = DATA.tenants.filter(function(t) {
    if (t.status !== 'active') return false;
    var end = t.lease_end || t.leaseEnd;
    if (!end) return false;
    var endDate = new Date(end + 'T00:00:00');
    var daysLeft = Math.ceil((endDate.getTime() - nowTs) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= 60;
  });

  container.innerHTML = ''
    + '<div class="kpi-grid">'
    + kpiCard('Total Properties', totalProps, '')
    + kpiCard('Total Units', totalUnits, '')
    + kpiCard('Rent Collected', fmt(monthlyCollected), monthLabel)
    + kpiCard('Expenses', fmt(monthlyExpense), monthLabel)
    + kpiCard('Net Income', fmt(netIncome), netIncome >= 0 ? 'positive' : 'negative')
    + kpiCard('Occupancy', occupancyRate + '%', occupancyRate >= 90 ? 'positive' : 'neutral')
    + kpiCard('Open Work Orders', openWorkOrders, openWorkOrders > 0 ? 'neutral' : 'positive')
    + kpiCard('Leases Expiring', leasingSoon.length, leasingSoon.length > 0 ? 'negative' : 'positive')
    + '</div>'
    + '<div class="quick-actions">'
    + '<button class="btn btn-primary" onclick="openAddPropertyModal()">+ Add Property</button>'
    + '<button class="btn btn-secondary" onclick="openAddPaymentModal()">+ Record Payment</button>'
    + '<button class="btn btn-secondary" onclick="openAddExpenseModal()">+ Add Expense</button>'
    + '</div>'
    + '<div class="chart-grid">'
    + '<div class="chart-card"><h3>Monthly Income vs Expenses</h3><div class="chart-container"><canvas id="chart-income-expense"></canvas></div></div>'
    + '<div class="chart-card"><h3>Recent Transactions</h3><div class="table-wrapper" style="max-height:280px;overflow-y:auto"><table><thead><tr><th>Date</th><th>Tenant</th><th>Property</th><th class="text-right">Amount</th><th>Status</th></tr></thead><tbody id="recent-txns"></tbody></table></div></div>'
    + '</div>'
    + renderLeaseAlertsSection(leasingSoon, now);

  var tbody = document.getElementById('recent-txns');
  recentTransactions.forEach(function(t) {
    var tid = t.tenant_id || t.tenantId;
    var pid = t.property_id || t.propertyId;
    tbody.innerHTML += '<tr><td>' + fmtDate(t.date) + '</td><td>' + escapeHtml(getTenantName(tid)) + '</td><td>' + escapeHtml(getPropertyName(pid)) + '</td><td class="text-right amount">' + fmt(t.amount) + '</td><td><span class="badge ' + badgeClass(t.status) + '">' + escapeHtml(t.status) + '</span></td></tr>';
  });

  renderIncomeExpenseChart();
}

function renderLeaseAlertsSection(soon, now) {
  if (!soon || soon.length === 0) return '';
  var nowTs = now.getTime();
  var rows = soon.map(function(t) {
    var end = t.lease_end || t.leaseEnd || '';
    var endDate = new Date(end + 'T00:00:00');
    var daysLeft = Math.ceil((endDate.getTime() - nowTs) / (1000 * 60 * 60 * 24));
    var daysCls = daysLeft <= 14 ? 'urgent' : daysLeft <= 30 ? 'warning' : 'ok';
    var pid = t.property_id || t.propertyId;
    return '<div class="lease-alert-row">'
      + '<div class="lease-alert-info">'
      + '<span class="lease-days ' + daysCls + '">' + daysLeft + ' days</span>'
      + '<strong>' + escapeHtml(t.name) + '</strong>'
      + '<span style="color:var(--color-text-muted)">' + escapeHtml(getPropertyName(pid)) + ' &middot; Unit ' + escapeHtml(t.unit) + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:var(--space-3)">'
      + '<span style="font-size:var(--text-xs);color:var(--color-text-muted)">Expires ' + fmtDate(end) + '</span>'
      + '<button class="btn btn-secondary btn-sm" onclick="openEditTenantModal(' + t.id + ')">Renew</button>'
      + '</div>'
      + '</div>';
  }).join('');
  return '<div class="lease-alerts">'
    + '<div class="lease-alerts-card">'
    + '<div class="lease-alerts-header"><h3>&#9888; Lease Alerts (' + soon.length + ' expiring within 60 days)</h3></div>'
    + rows
    + '</div></div>';
}

function kpiCard(label, value, extra) {
  var deltaClass = '';
  if (extra === 'positive') deltaClass = 'kpi-delta positive';
  else if (extra === 'negative') deltaClass = 'kpi-delta negative';
  else if (extra === 'neutral') deltaClass = 'kpi-delta neutral';

  var subtext = '';
  if (extra === 'positive') subtext = '<span class="' + deltaClass + '">&#9650; Positive</span>';
  else if (extra === 'negative') subtext = '<span class="' + deltaClass + '">&#9660; Negative</span>';
  else if (extra === 'neutral') subtext = '<span class="' + deltaClass + '">&#9644; Stable</span>';
  else if (extra) subtext = '<span class="kpi-delta neutral">' + escapeHtml(extra) + '</span>';

  return '<div class="kpi-card"><span class="kpi-label">' + escapeHtml(label) + '</span><span class="kpi-value">' + value + '</span>' + subtext + '</div>';
}

function renderIncomeExpenseChart() {
  var colors = getChartColors();
  var now = new Date();
  var months = [];
  var prefixes = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    prefixes.push(d.toISOString().slice(0, 7));
    months.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  }
  var incomeData = prefixes.map(function(p) {
    return DATA.income.filter(function(i) { return i.date.startsWith(p); }).reduce(function(s, i) { return s + i.amount; }, 0);
  });
  var expenseData = prefixes.map(function(p) {
    return DATA.expenses.filter(function(e) { return e.date.startsWith(p); }).reduce(function(s, e) { return s + e.amount; }, 0);
  });

  var ctx = document.getElementById('chart-income-expense');
  if (!ctx) return;
  var defaults = chartDefaults(colors);
  var chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeData, backgroundColor: colors.chart1 + 'cc', borderRadius: 4, barPercentage: 0.6 },
        { label: 'Expenses', data: expenseData, backgroundColor: colors.chart5 + '99', borderRadius: 4, barPercentage: 0.6 }
      ]
    },
    options: defaults
  });
  chartInstances.push(chart);
}

// ===== REPORTS PAGE =====
async function renderReports(container) {
  var pnl = await api('/api/reports/pnl');
  var catData = await api('/api/reports/expense-categories');

  container.innerHTML = ''
    + '<div class="report-section"><div class="chart-grid">'
    + '<div class="chart-card"><h3>Monthly Trend</h3><div class="chart-container"><canvas id="chart-trend"></canvas></div></div>'
    + '<div class="chart-card"><h3>Expense Breakdown</h3><div class="chart-container"><canvas id="chart-expense-cat"></canvas></div></div>'
    + '</div></div>'
    + '<div class="report-section"><div class="table-card">'
    + '<div class="table-header"><h3>Property P&amp;L Summary</h3><div class="table-actions"><button class="btn btn-secondary btn-sm" onclick="exportPnlCSV()">Export CSV</button></div></div>'
    + '<div class="table-wrapper"><table><thead><tr><th>Property</th><th class="text-right">Total Income</th><th class="text-right">Total Expenses</th><th class="text-right">Net Income</th><th class="text-right">Margin</th></tr></thead><tbody id="pnl-tbody"></tbody></table></div></div></div>';

  var pnlBody = document.getElementById('pnl-tbody');
  var grandIncome = 0, grandExpense = 0;
  if (pnl) {
    pnl.forEach(function(p) {
      grandIncome += p.income;
      grandExpense += p.expenses;
      pnlBody.innerHTML += '<tr><td><strong>' + escapeHtml(p.property) + '</strong></td><td class="text-right amount">' + fmt(p.income) + '</td><td class="text-right amount">' + fmt(p.expenses) + '</td><td class="text-right amount" style="color:' + (p.net >= 0 ? 'var(--color-success)' : 'var(--color-error)') + '">' + fmt(p.net) + '</td><td class="text-right">' + p.margin + '%</td></tr>';
    });
  }
  var grandNet = grandIncome - grandExpense;
  var grandMargin = grandIncome > 0 ? Math.round((grandNet / grandIncome) * 100) : 0;
  pnlBody.innerHTML += '<tr style="font-weight:700;border-top:2px solid var(--color-border)"><td>Total</td><td class="text-right amount">' + fmt(grandIncome) + '</td><td class="text-right amount">' + fmt(grandExpense) + '</td><td class="text-right amount" style="color:' + (grandNet >= 0 ? 'var(--color-success)' : 'var(--color-error)') + '">' + fmt(grandNet) + '</td><td class="text-right">' + grandMargin + '%</td></tr>';

  renderTrendChart();
  if (catData) renderExpenseCategoryChart(catData);
}

function renderTrendChart() {
  var colors = getChartColors();
  var now = new Date();
  var months = [];
  var prefixes = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    prefixes.push(d.toISOString().slice(0, 7));
    months.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  }
  var incomeData = prefixes.map(function(p) { return DATA.income.filter(function(i) { return i.date.startsWith(p); }).reduce(function(s, i) { return s + i.amount; }, 0); });
  var expenseData = prefixes.map(function(p) { return DATA.expenses.filter(function(e) { return e.date.startsWith(p); }).reduce(function(s, e) { return s + e.amount; }, 0); });
  var netData = incomeData.map(function(v, i) { return v - expenseData[i]; });

  var ctx = document.getElementById('chart-trend');
  if (!ctx) return;
  var defaults = chartDefaults(colors);
  var chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeData, borderColor: colors.chart1, backgroundColor: colors.chart1 + '20', fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 7 },
        { label: 'Expenses', data: expenseData, borderColor: colors.chart5, backgroundColor: colors.chart5 + '20', fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 7 },
        { label: 'Net Income', data: netData, borderColor: colors.chart4, backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.3, pointRadius: 5, pointHoverRadius: 7 }
      ]
    },
    options: defaults
  });
  chartInstances.push(chart);
}

function renderExpenseCategoryChart(catData) {
  var colors = getChartColors();
  var labels = catData.map(function(c) { return c.category.charAt(0).toUpperCase() + c.category.slice(1); });
  var data = catData.map(function(c) { return c.total; });
  var bgColors = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5, colors.chart6, colors.textMuted, colors.primary];

  var ctx = document.getElementById('chart-expense-cat');
  if (!ctx) return;
  var chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: bgColors.slice(0, labels.length), borderWidth: 2, borderColor: colors.surface }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: colors.textMuted, font: { family: "'Inter', sans-serif", size: 12 }, usePointStyle: true, padding: 12 } },
        tooltip: { backgroundColor: colors.surface, titleColor: colors.text, bodyColor: colors.textMuted, borderColor: colors.divider, borderWidth: 1, padding: 12, callbacks: { label: function(ctx) { return ' ' + ctx.label + ': $' + ctx.parsed.toLocaleString(); } } }
      }
    }
  });
  chartInstances.push(chart);
}

function exportPnlCSV() {
  var headers = ['Property', 'Total Income', 'Total Expenses', 'Net Income', 'Margin %'];
  var rows = DATA.properties.map(function(p) {
    var pid = p.id;
    var pIncome = DATA.income.filter(function(i) { return (i.property_id || i.propertyId) === pid; }).reduce(function(s, i) { return s + i.amount; }, 0);
    var pExpense = DATA.expenses.filter(function(e) { return (e.property_id || e.propertyId) === pid; }).reduce(function(s, e) { return s + e.amount; }, 0);
    var net = pIncome - pExpense;
    var margin = pIncome > 0 ? Math.round((net / pIncome) * 100) : 0;
    return [p.name, pIncome, pExpense, net, margin + '%'];
  });
  exportCSV('propflow-pnl.csv', headers, rows);
}

// ===== SPREADSHEET GRID ENGINE =====
// config = {
//   columns: [{key, label, type, width, options, readonly, render}]
//   data: array of row objects (each must have .id, except new row)
//   entityName: string ('properties', 'tenants', 'income', 'expenses')
//   buildPayload: function(record) -> object to PUT/POST
//   requiredForCreate: array of field keys that must be filled before POST
//   onSave: optional callback after save
//   onDelete: function(id)
//   extraActions: function(record) -> HTML string (buttons etc.)
//   filters: optional HTML string injected into toolbar left side
//   toolbarRight: optional HTML string for right side buttons
//   summary: optional function(data) -> HTML
//   onAfterRender: optional function(tbodyEl)
// }

function renderSpreadsheet(container, config) {
  var data = config.data || [];

  // Build toolbar
  var filtersHtml = config.filters || '';
  var toolbarRightHtml = config.toolbarRight || '';

  // Build summary
  var summaryHtml = '';
  if (config.summary) {
    summaryHtml = config.summary(data);
  }

  // Build column headers
  var headerCells = '';
  for (var ci = 0; ci < config.columns.length; ci++) {
    var col = config.columns[ci];
    var w = col.width ? ' style="min-width:' + col.width + ';width:' + col.width + '"' : '';
    headerCells += '<th' + w + '>' + escapeHtml(col.label) + '</th>';
  }
  // Actions column
  headerCells += '<th style="width:60px;min-width:60px"></th>';

  var html = ''
    + '<div class="grid-toolbar">'
    + '<div class="grid-filters">' + filtersHtml + '</div>'
    + '<div class="grid-actions">' + toolbarRightHtml + '</div>'
    + '</div>'
    + (summaryHtml ? '<div class="grid-summary-bar">' + summaryHtml + '</div>' : '')
    + '<div class="sheet-wrapper">'
    + '<table class="sheet-table">'
    + '<thead><tr>' + headerCells + '</tr></thead>'
    + '<tbody id="sheet-tbody-' + config.entityName + '"></tbody>'
    + '</table></div>';

  container.innerHTML = html;

  // Render rows
  var tbody = document.getElementById('sheet-tbody-' + config.entityName);
  fillSheetRows(tbody, config, data);

  if (config.onAfterRender) config.onAfterRender(tbody);
}

function fillSheetRows(tbody, config, data) {
  if (!tbody) return;
  tbody.innerHTML = '';

  // Render data rows
  for (var ri = 0; ri < data.length; ri++) {
    var row = buildDataRow(config, data[ri], ri, false);
    tbody.appendChild(row);
  }

  // Render new (add) row
  var newRow = buildDataRow(config, {}, -1, true);
  tbody.appendChild(newRow);
}

function buildDataRow(config, record, rowIdx, isNew) {
  var tr = document.createElement('tr');
  if (isNew) tr.className = 'new-row';
  tr.setAttribute('data-rowid', record.id || '');
  tr.setAttribute('data-new', isNew ? '1' : '0');

  for (var ci = 0; ci < config.columns.length; ci++) {
    var col = config.columns[ci];
    var td = document.createElement('td');
    var rawValue = record[col.key];
    if (rawValue === undefined || rawValue === null) rawValue = '';

    if (col.width) {
      td.style.minWidth = col.width;
      td.style.width = col.width;
    }

    // Build display span
    var displayVal = '';
    if (col.render) {
      displayVal = col.render(record, rawValue);
    } else if (col.type === 'select' && col.options) {
      displayVal = escapeHtml(rawValue);
    } else if (col.type === 'date') {
      displayVal = rawValue ? fmtDate(rawValue) : '';
    } else if (col.type === 'number') {
      displayVal = rawValue !== '' ? fmt(rawValue) : '';
    } else {
      displayVal = escapeHtml(String(rawValue));
    }

    var span = document.createElement('span');
    span.className = 'cell-content' + (col.readonly ? ' readonly' : '');
    span.innerHTML = displayVal || (isNew ? '' : '');
    span.setAttribute('data-col', ci);
    span.setAttribute('data-key', col.key);
    span.setAttribute('data-value', rawValue);

    td.appendChild(span);
    td.setAttribute('data-col', ci);

    // Click to edit (unless readonly)
    if (!col.readonly) {
      (function(tdEl, spanEl, colDef, rec, isNewRow, colIdx) {
        spanEl.addEventListener('click', function(e) {
          e.stopPropagation();
          activateCellEdit(tdEl, spanEl, colDef, rec, isNewRow, config, colIdx);
        });
      })(td, span, col, record, isNew, ci);
    }

    tr.appendChild(td);
  }

  // Actions cell
  var actionsTd = document.createElement('td');
  actionsTd.className = 'actions-col';

  var actionsContent = document.createElement('span');
  actionsContent.className = 'cell-content';

  if (!isNew && record.id) {
    var actionsHtml = '';
    if (config.extraActions) {
      actionsHtml += config.extraActions(record);
    }
    // Delete button
    actionsHtml += '<button class="btn-icon btn-icon-danger" data-delete-id="' + record.id + '" title="Delete">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>'
      + '</button>';
    actionsContent.innerHTML = actionsHtml;

    // Wire up delete
    var delBtn = actionsContent.querySelector('[data-delete-id]');
    if (delBtn) {
      (function(id) {
        delBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          config.onDelete(id);
        });
      })(record.id);
    }

    // Wire up extra action buttons (docs, etc.)
    var extraBtns = actionsContent.querySelectorAll('[data-extra-action]');
    for (var xi = 0; xi < extraBtns.length; xi++) {
      (function(btn, rec) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (config.onExtraAction) config.onExtraAction(btn, rec);
        });
      })(extraBtns[xi], record);
    }
  }

  actionsTd.appendChild(actionsContent);
  tr.appendChild(actionsTd);

  return tr;
}

// ===== CELL EDIT =====
var _activeCellTd = null;
var _activeCellInput = null;

function activateCellEdit(td, span, col, record, isNew, config, colIdx) {
  // Deactivate any active cell first
  deactivateCell(true);

  _activeCellTd = td;
  td.classList.add('cell-active');

  var currentVal = span.getAttribute('data-value') || '';

  var input;

  if (col.type === 'select' && col.options) {
    input = document.createElement('select');
    input.className = 'cell-input';
    var opts = col.options;
    if (!col.required) {
      var blankOpt = document.createElement('option');
      blankOpt.value = '';
      blankOpt.textContent = isNew ? ('Select ' + col.label + '...') : '';
      input.appendChild(blankOpt);
    }
    for (var oi = 0; oi < opts.length; oi++) {
      var opt = document.createElement('option');
      opt.value = opts[oi].value;
      opt.textContent = opts[oi].label;
      if (opts[oi].value == currentVal) opt.selected = true;
      input.appendChild(opt);
    }
  } else if (col.type === 'date') {
    input = document.createElement('input');
    input.type = 'date';
    input.className = 'cell-input';
    input.value = currentVal;
  } else if (col.type === 'number') {
    input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.className = 'cell-input';
    input.value = currentVal;
  } else if (col.type === 'email') {
    input = document.createElement('input');
    input.type = 'email';
    input.className = 'cell-input';
    input.value = currentVal;
  } else if (col.type === 'tel') {
    input = document.createElement('input');
    input.type = 'tel';
    input.className = 'cell-input';
    input.value = currentVal;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    input.value = currentVal;
  }

  _activeCellInput = input;
  span.style.display = 'none';
  td.appendChild(input);
  input.focus();
  if (input.select && col.type !== 'select' && col.type !== 'date') input.select();

  // Special: Income tenant select triggers property autofill
  if (config.entityName === 'income' && col.key === 'tenant_id') {
    input.addEventListener('change', function() {
      var tid = parseInt(this.value);
      if (tid) {
        var tenant = DATA.tenants.find(function(t) { return t.id === tid; });
        if (tenant) {
          var tr = td.closest('tr');
          var propSpan = tr.querySelector('[data-key="property_id"] span.cell-content, [data-key="property_name"] span.cell-content');
          // Find property_id readonly col
          var allSpans = tr.querySelectorAll('.cell-content');
          for (var si = 0; si < allSpans.length; si++) {
            var k = allSpans[si].getAttribute('data-key');
            if (k === 'property_id' || k === '_property_name') {
              allSpans[si].setAttribute('data-value', tenant.property_id || tenant.propertyId || '');
              allSpans[si].innerHTML = escapeHtml(getPropertyName(tenant.property_id || tenant.propertyId));
            }
            if (k === 'amount' && isNew) {
              var rent = tenant.monthly_rent || tenant.monthlyRent || 0;
              if (rent) {
                allSpans[si].setAttribute('data-value', rent);
                allSpans[si].innerHTML = fmt(rent);
              }
            }
          }
          // If amount input is open, set it
          var amtInput = tr.querySelector('[data-key="amount"] input.cell-input');
          if (amtInput) {
            var r = tenant.monthly_rent || tenant.monthlyRent || 0;
            if (r) amtInput.value = r;
          }
        }
      }
    });
  }

  // Tab key: save + move to next editable cell
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      saveCell(td, span, col, record, isNew, config, function() {
        moveCellFocus(td, 'right', config);
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      saveCell(td, span, col, record, isNew, config, function() {
        moveCellFocus(td, 'down', config);
      });
    } else if (e.key === 'Escape') {
      cancelCellEdit(td, span);
    }
  });

  // Blur: save
  input.addEventListener('blur', function() {
    // Small delay to allow Tab/Enter handlers to fire first
    setTimeout(function() {
      if (_activeCellInput === input) {
        saveCell(td, span, col, record, isNew, config, null);
      }
    }, 100);
  });
}

function cancelCellEdit(td, span) {
  var inp = td.querySelector('.cell-input');
  if (inp) inp.parentNode.removeChild(inp);
  span.style.display = '';
  td.classList.remove('cell-active');
  _activeCellTd = null;
  _activeCellInput = null;
}

function deactivateCell(save) {
  if (_activeCellTd && _activeCellInput) {
    var inp = _activeCellInput;
    var td = _activeCellTd;
    var span = td.querySelector('.cell-content');
    if (span) {
      inp.parentNode && inp.parentNode.removeChild(inp);
      span.style.display = '';
      td.classList.remove('cell-active');
    }
    _activeCellTd = null;
    _activeCellInput = null;
  }
}

function saveCell(td, span, col, record, isNew, config, callback) {
  var inp = td.querySelector('.cell-input');
  if (!inp) {
    if (callback) callback();
    return;
  }

  var newVal = inp.value;

  // Restore display
  inp.parentNode && inp.parentNode.removeChild(inp);
  span.style.display = '';
  td.classList.remove('cell-active');
  _activeCellTd = null;
  _activeCellInput = null;

  // Update span display
  var displayVal = '';
  if (col.type === 'select' && col.options) {
    var matched = col.options.find(function(o) { return String(o.value) === String(newVal); });
    displayVal = matched ? escapeHtml(matched.label) : escapeHtml(newVal);
  } else if (col.type === 'date') {
    displayVal = newVal ? fmtDate(newVal) : '';
  } else if (col.type === 'number') {
    displayVal = newVal !== '' ? fmt(parseFloat(newVal) || 0) : '';
  } else {
    displayVal = escapeHtml(newVal);
  }

  // Update the record object
  if (col.type === 'number') {
    record[col.key] = parseFloat(newVal) || 0;
  } else if (col.type === 'select' && (col.key === 'property_id' || col.key === 'tenant_id')) {
    record[col.key] = newVal !== '' ? parseInt(newVal) : null;
  } else {
    record[col.key] = newVal;
  }

  span.innerHTML = displayVal;
  span.setAttribute('data-value', newVal);

  if (isNew) {
    // For new row: check required fields to decide if we should POST
    var tr = td.closest('tr');
    var allSpans = tr.querySelectorAll('.cell-content');
    var allFilled = true;
    var required = config.requiredForCreate || [];
    for (var ri2 = 0; ri2 < required.length; ri2++) {
      var reqKey = required[ri2];
      var reqSpan = tr.querySelector('[data-key="' + reqKey + '"]');
      if (!reqSpan || !reqSpan.getAttribute('data-value')) {
        allFilled = false;
        break;
      }
    }

    if (allFilled && required.length > 0) {
      // Collect all values from new row
      var newRecord = {};
      for (var si2 = 0; si2 < allSpans.length; si2++) {
        var k = allSpans[si2].getAttribute('data-key');
        if (k) {
          var v = allSpans[si2].getAttribute('data-value');
          newRecord[k] = v;
        }
      }
      // POST
      var payload = config.buildPayload(newRecord);
      api('/api/' + config.entityName, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(created) {
        if (created) {
          // Flash the row green
          flashRow(tr, 'cell-saved');
          // Reload page
          renderPage(currentPage);
        }
      }).catch(function(err) {
        flashRow(tr, 'cell-error');
      });
    }

    if (callback) callback();
    return;
  }

  // Existing record: PUT
  if (!record.id) {
    if (callback) callback();
    return;
  }

  var payload = config.buildPayload(record);
  api('/api/' + config.entityName + '/' + record.id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(updated) {
    if (updated) {
      // Update local DATA
      var arr = DATA[config.entityName];
      for (var di = 0; di < arr.length; di++) {
        if (arr[di].id === updated.id) {
          var keys = Object.keys(updated);
          for (var ki = 0; ki < keys.length; ki++) {
            arr[di][keys[ki]] = updated[keys[ki]];
          }
          break;
        }
      }
      flashCell(td);
      if (config.onSave) config.onSave(updated);
    }
    if (callback) callback();
  }).catch(function(err) {
    td.classList.add('cell-error');
    setTimeout(function() { td.classList.remove('cell-error'); }, 800);
    if (callback) callback();
  });
}

function flashCell(td) {
  td.classList.remove('cell-saved');
  // Force reflow
  void td.offsetWidth;
  td.classList.add('cell-saved');
  setTimeout(function() { td.classList.remove('cell-saved'); }, 900);
}

function flashRow(tr, cls) {
  var cells = tr.querySelectorAll('td');
  for (var i = 0; i < cells.length; i++) {
    cells[i].classList.add(cls);
  }
  setTimeout(function() {
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.remove(cls);
    }
  }, 900);
}

function moveCellFocus(currentTd, direction, config) {
  var tr = currentTd.closest('tr');
  var table = currentTd.closest('table');
  if (!tr || !table) return;

  var colIdx = parseInt(currentTd.getAttribute('data-col'));
  var cols = config.columns;

  if (direction === 'right') {
    // Find next editable column in same row
    for (var ci = colIdx + 1; ci < cols.length; ci++) {
      if (!cols[ci].readonly) {
        var nextTd = tr.cells[ci];
        if (nextTd) {
          var nextSpan = nextTd.querySelector('.cell-content');
          if (nextSpan) {
            nextSpan.click();
            return;
          }
        }
      }
    }
    // Wrap to next row, first editable column
    var nextTr = tr.nextElementSibling;
    if (nextTr) {
      for (var ci2 = 0; ci2 < cols.length; ci2++) {
        if (!cols[ci2].readonly) {
          var nextTd2 = nextTr.cells[ci2];
          if (nextTd2) {
            var nextSpan2 = nextTd2.querySelector('.cell-content');
            if (nextSpan2) {
              nextSpan2.click();
              return;
            }
          }
        }
      }
    }
  } else if (direction === 'down') {
    var nextRow = tr.nextElementSibling;
    if (nextRow) {
      var sameTd = nextRow.cells[colIdx];
      if (sameTd && !cols[colIdx].readonly) {
        var sameSpan = sameTd.querySelector('.cell-content');
        if (sameSpan) sameSpan.click();
      }
    }
  }
}

// Click outside to deactivate
document.addEventListener('click', function(e) {
  if (_activeCellTd && !_activeCellTd.contains(e.target)) {
    if (_activeCellInput) {
      var inp = _activeCellInput;
      var td = _activeCellTd;
      var span = td.querySelector('.cell-content');
      // Don't double-save from blur handler
      _activeCellTd = null;
      _activeCellInput = null;
    }
  }
});

// ===== PROPERTIES SPREADSHEET =====
function renderProperties(container) {
  var columns = [
    { key: 'name', label: 'Name', type: 'text', width: '200px',
      render: function(rec, val) {
        if (!rec.id) return '';
        return '<a class="prop-name-link" onclick="navigateTo(\'properties/' + rec.id + '\')" href="#properties/' + rec.id + '">' + escapeHtml(val) + '</a>';
      }
    },
    { key: 'address', label: 'Address', type: 'text', width: '200px' },
    { key: 'city', label: 'City', type: 'text', width: '120px' },
    { key: 'state', label: 'State', type: 'text', width: '60px' },
    { key: 'zip', label: 'Zip', type: 'text', width: '80px' },
    { key: 'type', label: 'Type', type: 'select', width: '130px',
      options: [
        { value: 'single-family', label: 'Single-Family' },
        { value: 'multi-family', label: 'Multi-Family' },
        { value: 'commercial', label: 'Commercial' }
      ]
    },
    { key: 'units', label: 'Units', type: 'number', width: '60px' },
    { key: 'notes', label: 'Notes', type: 'text', width: '200px' }
  ];

  var config = {
    entityName: 'properties',
    columns: columns,
    data: DATA.properties.slice(),
    requiredForCreate: ['name', 'address', 'city', 'state', 'zip'],
    buildPayload: function(rec) {
      return {
        name: rec.name || '',
        address: rec.address || '',
        city: rec.city || '',
        state: (rec.state || '').toUpperCase(),
        zip: rec.zip || '',
        type: rec.type || 'multi-family',
        units: parseInt(rec.units) || 1,
        notes: rec.notes || ''
      };
    },
    onDelete: function(id) {
      var p = DATA.properties.find(function(x) { return x.id === id; });
      var name = p ? p.name : 'this property';
      if (!confirm('Delete property "' + name + '"? This will also remove all tenants, payments, and expenses for this property.')) return;
      api('/api/properties/' + id, { method: 'DELETE' }).then(function() {
        renderPage('properties');
      });
    },
    toolbarRight: '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'properties\')">Refresh</button>'
      + '<button class="btn btn-secondary btn-sm" onclick="exportPropertiesCSV()">Export CSV</button>'
  };

  renderSpreadsheet(container, config);
}

function exportPropertiesCSV() {
  var headers = ['Name', 'Address', 'City', 'State', 'Zip', 'Type', 'Units', 'Notes'];
  var rows = DATA.properties.map(function(p) {
    return [p.name, p.address, p.city, p.state, p.zip, p.type, p.units, p.notes];
  });
  exportCSV('propflow-properties.csv', headers, rows);
}

// ===== PROPERTY DETAIL =====
function renderPropertyDetail(container, propId) {
  var prop = DATA.properties.find(function(p) { return p.id === propId; });
  if (!prop) { renderProperties(container); return; }

  var propTenants = DATA.tenants.filter(function(t) { return (t.property_id || t.propertyId) === propId; });
  var propIncome = DATA.income.filter(function(i) { return (i.property_id || i.propertyId) === propId; });
  var propExpenses = DATA.expenses.filter(function(e) { return (e.property_id || e.propertyId) === propId; });
  var totalIncome = propIncome.reduce(function(s, i) { return s + i.amount; }, 0);
  var totalExpenses = propExpenses.reduce(function(s, e) { return s + e.amount; }, 0);

  propIncome.sort(function(a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });
  propExpenses.sort(function(a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });

  var paidAmt = propIncome.filter(function(i) { return i.status === 'paid'; }).reduce(function(s, i) { return s + i.amount; }, 0);
  var pendingAmt = propIncome.filter(function(i) { return i.status === 'pending'; }).reduce(function(s, i) { return s + i.amount; }, 0);
  var lateAmt = propIncome.filter(function(i) { return i.status === 'late'; }).reduce(function(s, i) { return s + i.amount; }, 0);

  container.innerHTML = ''
    + '<button class="detail-back" onclick="navigateTo(\'properties\')">&larr; Back to Properties</button>'
    + '<div class="detail-header"><div><h2>' + escapeHtml(prop.name) + '</h2><p class="detail-meta">' + escapeHtml(prop.address) + ', ' + escapeHtml(prop.city) + ', ' + escapeHtml(prop.state) + ' ' + escapeHtml(prop.zip) + ' &middot; ' + escapeHtml(prop.type) + ' &middot; ' + prop.units + ' unit(s)</p></div>'
    + '<button class="btn btn-secondary btn-sm" onclick="openEditPropertyModal(' + prop.id + ')">Edit Property</button></div>'
    + '<div class="kpi-grid" style="margin-bottom:var(--space-6)">'
    + kpiCard('Tenants', propTenants.length, '')
    + kpiCard('Total Income', fmt(totalIncome), 'All time')
    + kpiCard('Total Expenses', fmt(totalExpenses), 'All time')
    + kpiCard('Net', fmt(totalIncome - totalExpenses), totalIncome - totalExpenses >= 0 ? 'positive' : 'negative')
    + '</div>'
    // Documents
    + '<div class="table-card" style="margin-bottom:var(--space-6)" id="prop-docs-card-' + prop.id + '">'
    + '<div class="table-header"><h3>Documents</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openPropertyDocUploadModal(' + prop.id + ')">+ Upload Document</button></div></div>'
    + '<div id="prop-docs-' + prop.id + '"><div style="padding:var(--space-4) var(--space-5);color:var(--color-text-muted);font-size:var(--text-sm)">Loading documents...</div></div>'
    + '</div>'
    // Tenants table
    + '<div class="table-card" style="margin-bottom:var(--space-6)"><div class="table-header"><h3>Tenants (' + propTenants.length + ')</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openAddTenantModal()">+ Add Tenant</button></div></div><div class="table-wrapper"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Unit</th><th>Rent</th><th>Lease</th><th>Status</th><th>Actions</th></tr></thead><tbody>'
    + propTenants.map(function(t) {
      var rent = t.monthly_rent || t.monthlyRent || 0;
      return '<tr><td><strong>' + escapeHtml(t.name) + '</strong></td><td>' + escapeHtml(t.email) + '</td><td>' + escapeHtml(t.phone) + '</td><td>' + escapeHtml(t.unit) + '</td><td class="amount">' + fmt(rent) + '</td><td>' + fmtDate(t.lease_start || t.leaseStart) + ' \u2013 ' + fmtDate(t.lease_end || t.leaseEnd) + '</td><td><span class="badge ' + badgeClass(t.status) + '">' + escapeHtml(t.status) + '</span></td>'
        + '<td class="actions-cell"><button class="btn-icon" onclick="openTenantDocsModal(' + t.id + ', \'' + escapeHtml(t.name).replace(/'/g, "\\'") + '\')" title="Documents"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></button>'
        + '<button class="btn-icon" onclick="openEditTenantModal(' + t.id + ')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        + '<button class="btn-icon btn-icon-danger" onclick="deleteTenant(' + t.id + ', \'' + escapeHtml(t.name).replace(/'/g, "\\'") + '\')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></td></tr>';
    }).join('') + '</tbody></table></div></div>'
    // Income
    + '<div class="table-card" style="margin-bottom:var(--space-6)"><div class="table-header"><h3>Income (' + propIncome.length + ' records)</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openAddPaymentModal()">+ Record Payment</button></div></div>'
    + '<div class="summary-bar" style="margin:var(--space-3) var(--space-5)">'
    + '<div class="summary-item"><span class="summary-label">Total</span><span class="summary-value">' + fmt(totalIncome) + '</span></div>'
    + '<div class="summary-item"><span class="summary-label">Paid</span><span class="summary-value" style="color:var(--color-success)">' + fmt(paidAmt) + '</span></div>'
    + '<div class="summary-item"><span class="summary-label">Pending</span><span class="summary-value" style="color:var(--color-warning)">' + fmt(pendingAmt) + '</span></div>'
    + '<div class="summary-item"><span class="summary-label">Late</span><span class="summary-value" style="color:var(--color-error)">' + fmt(lateAmt) + '</span></div>'
    + '</div>'
    + '<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Tenant</th><th>Unit</th><th class="text-right">Amount</th><th>Method</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody>'
    + propIncome.map(function(i) {
      var tid = i.tenant_id || i.tenantId;
      var tenant = DATA.tenants.find(function(t) { return t.id === tid; });
      var unit = tenant ? tenant.unit : '\u2014';
      return '<tr><td>' + fmtDate(i.date) + '</td><td>' + escapeHtml(getTenantName(tid)) + '</td><td>' + escapeHtml(unit) + '</td><td class="text-right amount">' + fmt(i.amount) + '</td><td>' + escapeHtml(i.method) + '</td><td><span class="badge ' + badgeClass(i.status) + '">' + escapeHtml(i.status) + '</span></td><td class="truncate">' + escapeHtml(i.notes) + '</td>'
        + '<td class="actions-cell"><button class="btn-icon" onclick="openEditIncomeModal(' + i.id + ')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        + '<button class="btn-icon btn-icon-danger" onclick="deleteIncome(' + i.id + ')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></td></tr>';
    }).join('') + '</tbody></table></div></div>'
    // Expenses
    + '<div class="table-card" style="margin-bottom:var(--space-6)"><div class="table-header"><h3>Expenses (' + propExpenses.length + ' records)</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openAddExpenseModal()">+ Add Expense</button><button class="btn btn-secondary btn-sm" onclick="openBulkExpenseModal()">+ Bulk Entry</button></div></div>'
    + '<div class="summary-bar" style="margin:var(--space-3) var(--space-5)">'
    + '<div class="summary-item"><span class="summary-label">Total Expenses</span><span class="summary-value">' + fmt(totalExpenses) + '</span></div>'
    + '<div class="summary-item"><span class="summary-label">Records</span><span class="summary-value">' + propExpenses.length + '</span></div>'
    + '</div>'
    + '<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="text-right">Amount</th><th>Vendor</th><th>Notes</th><th>Receipt</th><th>Actions</th></tr></thead><tbody>'
    + propExpenses.map(function(e) {
      var rCell = e.receipt_path
        ? '<td class="text-center"><a href="/' + escapeHtml(e.receipt_path) + '" target="_blank" title="View receipt" class="receipt-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></a></td>'
        : '<td></td>';
      return '<tr><td>' + fmtDate(e.date) + '</td><td><span class="badge badge-primary">' + escapeHtml(e.category) + '</span></td><td>' + escapeHtml(e.description) + '</td><td class="text-right amount">' + fmt(e.amount) + '</td><td>' + escapeHtml(e.vendor) + '</td><td class="truncate">' + escapeHtml(e.notes) + '</td>' + rCell
        + '<td class="actions-cell"><button class="btn-icon" onclick="openEditExpenseModal(' + e.id + ')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        + '<button class="btn-icon btn-icon-danger" onclick="deleteExpense(' + e.id + ')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></td></tr>';
    }).join('') + '</tbody></table></div></div>';

  loadAndRenderPropertyDocs(propId);
}

// ===== TENANTS SPREADSHEET =====
function renderTenants(container) {
  var propFilterHtml = '<select class="grid-filter-select" id="tenant-filter-property">'
    + '<option value="">All Properties</option>'
    + DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('')
    + '</select>'
    + '<select class="grid-filter-select" id="tenant-filter-status">'
    + '<option value="">All Statuses</option>'
    + '<option value="active">Active</option>'
    + '<option value="inactive">Inactive</option>'
    + '</select>';

  var propOptions = DATA.properties.map(function(p) { return { value: p.id, label: p.name }; });

  var columns = [
    { key: 'name', label: 'Name', type: 'text', width: '160px' },
    { key: 'email', label: 'Email', type: 'email', width: '180px' },
    { key: 'phone', label: 'Phone', type: 'tel', width: '120px' },
    { key: 'property_id', label: 'Property', type: 'select', width: '160px', options: propOptions,
      render: function(rec, val) { return escapeHtml(getPropertyName(val)); }
    },
    { key: 'unit', label: 'Unit', type: 'text', width: '60px' },
    { key: 'monthly_rent', label: 'Rent', type: 'number', width: '90px',
      render: function(rec, val) { return val ? fmt(val) : ''; }
    },
    { key: 'lease_start', label: 'Lease Start', type: 'date', width: '110px',
      render: function(rec, val) { return val ? fmtDate(val) : ''; }
    },
    { key: 'lease_end', label: 'Lease End', type: 'date', width: '110px',
      render: function(rec, val) { return val ? fmtDate(val) : ''; }
    },
    { key: 'status', label: 'Status', type: 'select', width: '90px',
      options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
      render: function(rec, val) {
        if (!val) return '';
        return '<span class="badge ' + badgeClass(val) + '">' + escapeHtml(val) + '</span>';
      }
    }
  ];

  function getFilteredData() {
    var propVal = document.getElementById('tenant-filter-property') ? document.getElementById('tenant-filter-property').value : '';
    var statusVal = document.getElementById('tenant-filter-status') ? document.getElementById('tenant-filter-status').value : '';
    return DATA.tenants.filter(function(t) {
      var pid = t.property_id || t.propertyId;
      if (propVal && pid !== parseInt(propVal)) return false;
      if (statusVal && t.status !== statusVal) return false;
      return true;
    });
  }

  var config = {
    entityName: 'tenants',
    columns: columns,
    data: getFilteredData(),
    requiredForCreate: ['name', 'property_id', 'unit', 'lease_start', 'lease_end'],
    buildPayload: function(rec) {
      return {
        property_id: parseInt(rec.property_id) || null,
        unit: rec.unit || '',
        name: rec.name || '',
        email: rec.email || '',
        phone: rec.phone || '',
        lease_start: rec.lease_start || '',
        lease_end: rec.lease_end || '',
        monthly_rent: parseFloat(rec.monthly_rent) || 0,
        status: rec.status || 'active',
        notes: rec.notes || ''
      };
    },
    onDelete: function(id) {
      var t = DATA.tenants.find(function(x) { return x.id === id; });
      var name = t ? t.name : 'this tenant';
      if (!confirm('Delete tenant "' + name + '"? This will also remove all their payment records.')) return;
      api('/api/tenants/' + id, { method: 'DELETE' }).then(function() { renderPage('tenants'); });
    },
    extraActions: function(rec) {
      return '<button class="docs-btn" data-extra-action="docs" title="Documents"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> Docs</button>';
    },
    onExtraAction: function(btn, rec) {
      if (btn.getAttribute('data-extra-action') === 'docs') {
        openTenantDocsModal(rec.id, rec.name);
      }
    },
    filters: propFilterHtml,
    toolbarRight: '<button class="btn btn-primary btn-sm" onclick="openAddTenantModal()">+ Add Tenant</button>'
      + '<button class="btn btn-secondary btn-sm" onclick="exportTenantsCSV()">Export CSV</button>',
    summary: function(data) {
      var active = data.filter(function(t) { return t.status === 'active'; }).length;
      var totalRent = data.filter(function(t) { return t.status === 'active'; }).reduce(function(s, t) { return s + (t.monthly_rent || t.monthlyRent || 0); }, 0);
      return '<div class="grid-summary">'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Active Tenants</span><span class="grid-summary-value">' + active + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Total Monthly Rent</span><span class="grid-summary-value">' + fmt(totalRent) + '</span></div>'
        + '</div>';
    }
  };

  renderSpreadsheet(container, config);

  // Wire up filters to refresh grid
  setTimeout(function() {
    var propFilter = document.getElementById('tenant-filter-property');
    var statusFilter = document.getElementById('tenant-filter-status');
    if (propFilter) {
      propFilter.addEventListener('change', function() {
        var tbody = document.getElementById('sheet-tbody-tenants');
        if (tbody) fillSheetRows(tbody, config, getFilteredData());
      });
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', function() {
        var tbody = document.getElementById('sheet-tbody-tenants');
        if (tbody) fillSheetRows(tbody, config, getFilteredData());
      });
    }
  }, 50);
}

function exportTenantsCSV() {
  var headers = ['Name', 'Email', 'Phone', 'Property', 'Unit', 'Monthly Rent', 'Lease Start', 'Lease End', 'Status'];
  var rows = DATA.tenants.map(function(t) {
    return [t.name, t.email, t.phone, getPropertyName(t.property_id || t.propertyId), t.unit, t.monthly_rent || t.monthlyRent || 0, t.lease_start || t.leaseStart, t.lease_end || t.leaseEnd, t.status];
  });
  exportCSV('propflow-tenants.csv', headers, rows);
}

// ===== INCOME SPREADSHEET =====
function renderIncome(container) {
  // Quick Collect panel first
  var qcHtml = renderQuickCollectPanel();

  var activeTenants = DATA.tenants.filter(function(t) { return t.status === 'active'; });
  var tenantOptions = activeTenants.map(function(t) { return { value: t.id, label: t.name + ' (' + getPropertyName(t.property_id || t.propertyId) + ')' }; });

  // Date range defaults to current month
  var defRange = getDefaultDateRange();

  var filterHtml = '<select class="grid-filter-select" id="income-filter-property">'
    + '<option value="">All Properties</option>'
    + DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('')
    + '</select>'
    + '<div class="date-range-group">'
    + '<input type="date" id="income-filter-from" value="' + defRange.from + '">'
    + '<span class="filter-sep">to</span>'
    + '<input type="date" id="income-filter-to" value="' + defRange.to + '">'
    + '<div class="date-quick-btns">'
    + '<button class="btn btn-ghost btn-xs date-quick active" data-range="this-month" onclick="incomeSetRange(\'this-month\')">This Month</button>'
    + '<button class="btn btn-ghost btn-xs date-quick" data-range="last-month" onclick="incomeSetRange(\'last-month\')">Last Month</button>'
    + '<button class="btn btn-ghost btn-xs date-quick" data-range="this-quarter" onclick="incomeSetRange(\'this-quarter\')">This Quarter</button>'
    + '<button class="btn btn-ghost btn-xs date-quick" data-range="ytd" onclick="incomeSetRange(\'ytd\')">YTD</button>'
    + '<button class="btn btn-ghost btn-xs date-quick" data-range="all" onclick="incomeSetRange(\'all\')">All</button>'
    + '</div></div>'
    + '<select class="grid-filter-select" id="income-filter-status">'
    + '<option value="">All Statuses</option>'
    + '<option value="paid">Paid</option>'
    + '<option value="pending">Pending</option>'
    + '<option value="late">Late</option>'
    + '</select>';

  function getFilteredData() {
    var propVal = document.getElementById('income-filter-property') ? document.getElementById('income-filter-property').value : '';
    var fromVal = document.getElementById('income-filter-from') ? document.getElementById('income-filter-from').value : '';
    var toVal = document.getElementById('income-filter-to') ? document.getElementById('income-filter-to').value : '';
    var statusVal = document.getElementById('income-filter-status') ? document.getElementById('income-filter-status').value : '';
    return DATA.income.filter(function(i) {
      var pid = i.property_id || i.propertyId;
      if (propVal && pid !== parseInt(propVal)) return false;
      if (fromVal && i.date < fromVal) return false;
      if (toVal && i.date > toVal) return false;
      if (statusVal && i.status !== statusVal) return false;
      return true;
    });
  }

  var columns = [
    { key: 'date', label: 'Date', type: 'date', width: '110px',
      render: function(rec, val) { return val ? fmtDate(val) : ''; }
    },
    { key: 'tenant_id', label: 'Tenant', type: 'select', width: '160px',
      options: tenantOptions,
      render: function(rec, val) { return escapeHtml(getTenantName(val)); }
    },
    { key: '_property_name', label: 'Property', type: 'text', width: '140px', readonly: true,
      render: function(rec, val) {
        var pid = rec.property_id || rec.propertyId;
        return '<span style="color:var(--color-text-muted)">' + escapeHtml(getPropertyName(pid)) + '</span>';
      }
    },
    { key: 'amount', label: 'Amount', type: 'number', width: '90px',
      render: function(rec, val) { return val ? fmt(val) : ''; }
    },
    { key: 'method', label: 'Method', type: 'select', width: '160px',
      options: [
        { value: 'bank transfer', label: 'Bank Transfer' },
        { value: 'check', label: 'Check' },
        { value: 'cash', label: 'Cash' },
        { value: 'online', label: 'Online' }
      ],
      render: function(rec, val) {
        if (rec.method2 && rec.amount2 > 0) {
          var amt1 = rec.amount - rec.amount2;
          return escapeHtml(val) + ' <span class="split-indicator">' + fmt(amt1) + '</span>'
            + ' + ' + escapeHtml(rec.method2) + ' <span class="split-indicator">' + fmt(rec.amount2) + '</span>';
        }
        return escapeHtml(val);
      }
    },
    { key: 'status', label: 'Status', type: 'select', width: '90px',
      options: [
        { value: 'paid', label: 'Paid' },
        { value: 'pending', label: 'Pending' },
        { value: 'late', label: 'Late' }
      ],
      render: function(rec, val) {
        if (!val) return '';
        return '<span class="badge ' + badgeClass(val) + '">' + escapeHtml(val) + '</span>';
      }
    },
    { key: 'notes', label: 'Notes', type: 'text', width: '200px' }
  ];

  var config = {
    entityName: 'income',
    columns: columns,
    data: getFilteredData(),
    requiredForCreate: ['date', 'tenant_id', 'amount'],
    buildPayload: function(rec) {
      var tid = parseInt(rec.tenant_id) || null;
      var tenant = DATA.tenants.find(function(t) { return t.id === tid; });
      var pid = tenant ? (tenant.property_id || tenant.propertyId) : (parseInt(rec.property_id) || null);
      return {
        tenant_id: tid,
        property_id: pid,
        date: rec.date || new Date().toISOString().slice(0, 10),
        amount: parseFloat(rec.amount) || 0,
        method: rec.method || 'bank transfer',
        status: rec.status || 'paid',
        notes: rec.notes || ''
      };
    },
    onDelete: function(id) {
      if (!confirm('Delete this payment record?')) return;
      api('/api/income/' + id, { method: 'DELETE' }).then(function() { renderPage('income'); });
    },
    filters: filterHtml,
    toolbarRight: '<button class="btn btn-primary btn-sm" onclick="openAddPaymentModal()">+ Record Payment</button>'
      + '<button class="btn btn-secondary btn-sm" onclick="exportIncomeCSV()">Export CSV</button>',
    summary: function(data) {
      var totalAmt = data.reduce(function(s, i) { return s + i.amount; }, 0);
      var paidAmt = data.filter(function(i) { return i.status === 'paid'; }).reduce(function(s, i) { return s + i.amount; }, 0);
      var pendingAmt = data.filter(function(i) { return i.status === 'pending'; }).reduce(function(s, i) { return s + i.amount; }, 0);
      var lateAmt = data.filter(function(i) { return i.status === 'late'; }).reduce(function(s, i) { return s + i.amount; }, 0);
      // Outstanding: sum of remaining balances for active tenants in the current date range
      var fromVal = document.getElementById('income-filter-from') ? document.getElementById('income-filter-from').value : '';
      var monthPrefix = fromVal ? fromVal.slice(0, 7) : new Date().toISOString().slice(0, 7);
      var outstanding = DATA.tenants.filter(function(t) { return t.status === 'active'; }).reduce(function(s, t) {
        return s + getTenantBalance(t.id, monthPrefix);
      }, 0);
      return '<div class="grid-summary">'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Total</span><span class="grid-summary-value">' + fmt(totalAmt) + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Paid</span><span class="grid-summary-value" style="color:var(--color-success)">' + fmt(paidAmt) + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Pending</span><span class="grid-summary-value" style="color:var(--color-warning)">' + fmt(pendingAmt) + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Late</span><span class="grid-summary-value" style="color:var(--color-error)">' + fmt(lateAmt) + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Outstanding</span><span class="grid-summary-value" style="color:var(--color-warning)">' + fmt(outstanding) + '</span></div>'
        + '</div>';
    }
  };

  // Prepend Quick Collect
  var wrapper = document.createElement('div');
  wrapper.innerHTML = qcHtml;

  // Render the spreadsheet into a sub-container
  var gridContainer = document.createElement('div');
  renderSpreadsheet(gridContainer, config);

  container.innerHTML = '';
  while (wrapper.firstChild) container.appendChild(wrapper.firstChild);
  while (gridContainer.firstChild) container.appendChild(gridContainer.firstChild);

  // Wire up Quick Collect
  initQuickCollect();

  // Wire up filters
  setTimeout(function() {
    var pf = document.getElementById('income-filter-property');
    var fromF = document.getElementById('income-filter-from');
    var toF = document.getElementById('income-filter-to');
    var sf = document.getElementById('income-filter-status');
    function refilterIncome() {
      var tbody = document.getElementById('sheet-tbody-income');
      if (tbody) fillSheetRows(tbody, config, getFilteredData());
      // Update summary
      var summaryBar = container.querySelector('.grid-summary');
      if (summaryBar) summaryBar.parentNode.innerHTML = config.summary(getFilteredData());
    }
    if (pf) pf.addEventListener('change', refilterIncome);
    if (fromF) fromF.addEventListener('change', refilterIncome);
    if (toF) toF.addEventListener('change', refilterIncome);
    if (sf) sf.addEventListener('change', refilterIncome);
    // Store refilter on window for quick buttons
    window._incomeRefilter = refilterIncome;
  }, 50);
}

function incomeSetRange(rangeType) {
  var r = getDateRange(rangeType);
  var fromEl = document.getElementById('income-filter-from');
  var toEl = document.getElementById('income-filter-to');
  if (fromEl) fromEl.value = r.from;
  if (toEl) toEl.value = r.to;
  // Update active button
  var btns = document.querySelectorAll('.date-quick[data-range]');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].closest('#sheet-tbody-income') === null) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-range') === rangeType);
    }
  }
  if (window._incomeRefilter) window._incomeRefilter();
}

function exportIncomeCSV() {
  var headers = ['Date', 'Tenant', 'Property', 'Amount', 'Method', 'Status', 'Notes'];
  var rows = DATA.income.map(function(i) {
    var tid = i.tenant_id || i.tenantId;
    var pid = i.property_id || i.propertyId;
    return [i.date, getTenantName(tid), getPropertyName(pid), i.amount, i.method, i.status, i.notes];
  });
  exportCSV('propflow-income.csv', headers, rows);
}

// ===== EXPENSES SPREADSHEET =====
function renderExpenses(container) {
  var categories = ['maintenance', 'repairs', 'insurance', 'taxes', 'utilities', 'mortgage', 'management fees', 'other'];
  var catOptions = categories.map(function(c) { return { value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }; });
  var propOptions = DATA.properties.map(function(p) { return { value: p.id, label: p.name }; });

  // Date range defaults to current month
  var defRange = getDefaultDateRange();

  var filterHtml = '<select class="grid-filter-select" id="expense-filter-property">'
    + '<option value="">All Properties</option>'
    + DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('')
    + '</select>'
    + '<select class="grid-filter-select" id="expense-filter-category">'
    + '<option value="">All Categories</option>'
    + categories.map(function(c) { return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('')
    + '</select>'
    + '<div class="date-range-group">'
    + '<input type="date" id="expense-filter-from" value="' + defRange.from + '">'
    + '<span class="filter-sep">to</span>'
    + '<input type="date" id="expense-filter-to" value="' + defRange.to + '">'
    + '<div class="date-quick-btns">'
    + '<button class="btn btn-ghost btn-xs date-quick active" data-range="this-month" onclick="expenseSetRange(\'this-month\')">This Month</button>'
    + '<button class="btn btn-ghost btn-xs date-quick" data-range="last-month" onclick="expenseSetRange(\'last-month\')">Last Month</button>'
    + '<button class="btn btn-ghost btn-xs date-quick" data-range="this-quarter" onclick="expenseSetRange(\'this-quarter\')">This Quarter</button>'
    + '<button class="btn btn-ghost btn-xs date-quick" data-range="ytd" onclick="expenseSetRange(\'ytd\')">YTD</button>'
    + '<button class="btn btn-ghost btn-xs date-quick" data-range="all" onclick="expenseSetRange(\'all\')">All</button>'
    + '</div></div>';

  function getFilteredData() {
    var propVal = document.getElementById('expense-filter-property') ? document.getElementById('expense-filter-property').value : '';
    var catVal = document.getElementById('expense-filter-category') ? document.getElementById('expense-filter-category').value : '';
    var fromVal = document.getElementById('expense-filter-from') ? document.getElementById('expense-filter-from').value : '';
    var toVal = document.getElementById('expense-filter-to') ? document.getElementById('expense-filter-to').value : '';
    return DATA.expenses.filter(function(e) {
      var pid = e.property_id || e.propertyId;
      if (propVal && pid !== parseInt(propVal)) return false;
      if (catVal && e.category !== catVal) return false;
      if (fromVal && e.date < fromVal) return false;
      if (toVal && e.date > toVal) return false;
      return true;
    });
  }

  var columns = [
    { key: 'date', label: 'Date', type: 'date', width: '110px',
      render: function(rec, val) { return val ? fmtDate(val) : ''; }
    },
    { key: 'property_id', label: 'Property', type: 'select', width: '160px',
      options: propOptions,
      render: function(rec, val) { return escapeHtml(getPropertyName(val)); }
    },
    { key: 'category', label: 'Category', type: 'select', width: '130px',
      options: catOptions,
      render: function(rec, val) {
        if (!val) return '';
        return '<span class="badge badge-primary">' + escapeHtml(val) + '</span>';
      }
    },
    { key: 'description', label: 'Description', type: 'text', width: '200px' },
    { key: 'amount', label: 'Amount', type: 'number', width: '90px',
      render: function(rec, val) { return val ? fmt(val) : ''; }
    },
    { key: 'vendor', label: 'Vendor', type: 'text', width: '140px' },
    { key: 'notes', label: 'Notes', type: 'text', width: '200px' },
    { key: 'receipt_path', label: 'Receipt', type: 'text', width: '60px', readonly: true,
      render: function(rec, val) {
        if (!val) return '';
        return '<a href="/' + escapeHtml(val) + '" target="_blank" title="View receipt" class="receipt-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></a>';
      }
    }
  ];

  var config = {
    entityName: 'expenses',
    columns: columns,
    data: getFilteredData(),
    requiredForCreate: ['date', 'property_id', 'category', 'description', 'amount'],
    buildPayload: function(rec) {
      return {
        property_id: parseInt(rec.property_id) || null,
        date: rec.date || new Date().toISOString().slice(0, 10),
        category: rec.category || 'other',
        description: rec.description || '',
        amount: parseFloat(rec.amount) || 0,
        vendor: rec.vendor || '',
        notes: rec.notes || ''
      };
    },
    onDelete: function(id) {
      if (!confirm('Delete this expense record?')) return;
      api('/api/expenses/' + id, { method: 'DELETE' }).then(function() { renderPage('expenses'); });
    },
    filters: filterHtml,
    toolbarRight: '<button class="btn btn-primary btn-sm" onclick="openAddExpenseModal()">+ Add Expense</button>'
      + '<button class="btn btn-secondary btn-sm" onclick="openBulkExpenseModal()">Bulk Entry</button>'
      + '<button class="btn btn-secondary btn-sm" onclick="exportExpenseCSV()">Export CSV</button>',
    summary: function(data) {
      var totalAmt = data.reduce(function(s, e) { return s + e.amount; }, 0);
      return '<div class="grid-summary">'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Total Expenses</span><span class="grid-summary-value">' + fmt(totalAmt) + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Records</span><span class="grid-summary-value">' + data.length + '</span></div>'
        + '</div>';
    }
  };

  renderSpreadsheet(container, config);

  // Wire up filters
  setTimeout(function() {
    var pf = document.getElementById('expense-filter-property');
    var cf = document.getElementById('expense-filter-category');
    var fromF = document.getElementById('expense-filter-from');
    var toF = document.getElementById('expense-filter-to');
    function refilterExpenses() {
      var tbody = document.getElementById('sheet-tbody-expenses');
      if (tbody) fillSheetRows(tbody, config, getFilteredData());
      var summaryBar = container.querySelector('.grid-summary');
      if (summaryBar) summaryBar.parentNode.innerHTML = config.summary(getFilteredData());
    }
    if (pf) pf.addEventListener('change', refilterExpenses);
    if (cf) cf.addEventListener('change', refilterExpenses);
    if (fromF) fromF.addEventListener('change', refilterExpenses);
    if (toF) toF.addEventListener('change', refilterExpenses);
    window._expenseRefilter = refilterExpenses;
  }, 50);
}

function expenseSetRange(rangeType) {
  var r = getDateRange(rangeType);
  var fromEl = document.getElementById('expense-filter-from');
  var toEl = document.getElementById('expense-filter-to');
  if (fromEl) fromEl.value = r.from;
  if (toEl) toEl.value = r.to;
  var btns = document.querySelectorAll('.date-quick[data-range]');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].closest('#sheet-tbody-expenses') === null) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-range') === rangeType);
    }
  }
  if (window._expenseRefilter) window._expenseRefilter();
}

function exportExpenseCSV() {
  var headers = ['Date', 'Property', 'Category', 'Description', 'Amount', 'Vendor', 'Notes'];
  var rows = DATA.expenses.map(function(e) {
    return [e.date, getPropertyName(e.property_id || e.propertyId), e.category, e.description, e.amount, e.vendor, e.notes];
  });
  exportCSV('propflow-expenses.csv', headers, rows);
}

// ===== QUICK COLLECT HELPERS =====
function renderQuickCollectPanel() {
  var today = new Date().toISOString().slice(0, 10);
  var activeTenants = DATA.tenants.filter(function(t) { return t.status === 'active'; });

  if (activeTenants.length === 0) {
    return '<div class="quick-collect"><div class="quick-collect-header" onclick="toggleQuickCollect(this)"><span>&#9889; Quick Collect</span><span class="qc-toggle-icon">&#9660;</span></div></div>';
  }

  var groups = {};
  activeTenants.forEach(function(t) {
    var pid = t.property_id || t.propertyId;
    if (!groups[pid]) groups[pid] = [];
    groups[pid].push(t);
  });

  var currentMonth = today.slice(0, 7);

  var tenantRows = '';
  var propIds = Object.keys(groups);
  propIds.forEach(function(pid) {
    var propName = getPropertyName(parseInt(pid));
    tenantRows += '<div class="qc-property-group"><div class="qc-property-label">' + escapeHtml(propName) + '</div>';
    groups[pid].forEach(function(t) {
      var rent = t.monthly_rent || t.monthlyRent || 0;
      var paid = getTenantMonthPaid(t.id, currentMonth);
      var balance = Math.max(0, rent - paid);
      var fullyPaid = paid >= rent && rent > 0;
      var partial = paid > 0 && paid < rent;
      var pct = rent > 0 ? Math.min(100, Math.round((paid / rent) * 100)) : 0;

      var rowClass = fullyPaid ? 'qc-tenant-row collected' : (partial ? 'qc-tenant-row partial' : 'qc-tenant-row');
      var statusEl;
      if (fullyPaid) {
        statusEl = '<span class="qc-check">&#10003; Collected</span>';
      } else if (partial) {
        statusEl = '<span class="qc-partial">Partial</span><button class="btn btn-primary btn-sm qc-collect-btn" data-tid="' + t.id + '" data-rent="' + balance + '" data-balance="' + balance + '">Collect ' + fmt(balance) + '</button>';
      } else {
        statusEl = '<button class="btn btn-primary btn-sm qc-collect-btn" data-tid="' + t.id + '" data-rent="' + rent + '" data-balance="' + balance + '">Collect</button>';
      }

      var paidBar = rent > 0
        ? '<div class="qc-paid-bar"><div class="qc-paid-fill" style="width:' + pct + '%"></div></div>'
        : '';

      tenantRows += '<div class="' + rowClass + '" id="qc-row-' + t.id + '">'
        + '<span class="qc-tenant-name">' + escapeHtml(t.name) + '</span>'
        + '<span class="qc-unit">Unit ' + escapeHtml(t.unit) + '</span>'
        + '<span class="qc-rent">' + fmt(rent) + '</span>'
        + (paid > 0 ? '<span class="qc-paid-label">Paid: ' + fmt(paid) + '</span>' : '')
        + (balance > 0 && paid > 0 ? '<span class="qc-balance">Bal: ' + fmt(balance) + '</span>' : '')
        + statusEl
        + paidBar
        + '</div>';
    });
    tenantRows += '</div>';
  });

  return '<div class="quick-collect" id="quick-collect-panel">'
    + '<div class="quick-collect-header" onclick="toggleQuickCollect(this)">'
    + '<span>&#9889; Quick Collect</span>'
    + '<span class="qc-toggle-icon">&#9650;</span>'
    + '</div>'
    + '<div class="quick-collect-body" id="quick-collect-body">'
    + '<div class="qc-settings">'
    + '<div class="qc-settings-field"><label>Collection Date</label><input type="date" id="qc-date" value="' + today + '"></div>'
    + '<div class="qc-settings-field"><label>Payment Method</label><select id="qc-method"><option value="bank transfer">Bank Transfer</option><option value="check">Check</option><option value="cash">Cash</option><option value="online">Online</option></select></div>'
    + '</div>'
    + '<div class="qc-tenant-list">' + tenantRows + '</div>'
    + '</div>'
    + '</div>';
}

function toggleQuickCollect(header) {
  var body = document.getElementById('quick-collect-body');
  var icon = header.querySelector('.qc-toggle-icon');
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = '';
    if (icon) icon.innerHTML = '&#9650;';
  } else {
    body.style.display = 'none';
    if (icon) icon.innerHTML = '&#9660;';
  }
}

function initQuickCollect() {
  var panel = document.getElementById('quick-collect-panel');
  if (!panel) return;
  panel.addEventListener('click', function(e) {
    var btn = e.target;
    if (!btn.classList.contains('qc-collect-btn')) return;
    e.stopPropagation();
    quickCollectTenant(btn);
  });
}

async function quickCollectTenant(btn) {
  var tid = parseInt(btn.getAttribute('data-tid'));
  // Use the balance from data attribute (remaining balance after partial payments)
  var amount = parseFloat(btn.getAttribute('data-balance') || btn.getAttribute('data-rent')) || 0;
  var dateEl = document.getElementById('qc-date');
  var methodEl = document.getElementById('qc-method');
  var date = dateEl ? dateEl.value : new Date().toISOString().slice(0, 10);
  var method = methodEl ? methodEl.value : 'bank transfer';

  var tenant = DATA.tenants.find(function(t) { return t.id === tid; });
  if (!tenant) return;
  var pid = tenant.property_id || tenant.propertyId;

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await api('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tid,
        property_id: pid,
        date: date,
        amount: amount,
        method: method,
        status: 'paid',
        notes: ''
      })
    });

    await loadAllData();
    // Re-render the income page (refreshes QC panel + grid)
    renderPage('income');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Collect';
    alert('Failed to record payment: ' + (err.message || 'Unknown error'));
  }
}

// ===== DOCUMENT HELPERS =====
async function loadDocuments(entityType, entityId) {
  try {
    var docs = await api('/api/documents?entity_type=' + encodeURIComponent(entityType) + '&entity_id=' + encodeURIComponent(entityId));
    return docs || [];
  } catch(e) {
    return [];
  }
}

async function deleteDocument(docId) {
  return api('/api/documents/' + docId, { method: 'DELETE' });
}

function renderDocTable(docs, onDelete) {
  if (!docs || docs.length === 0) {
    return '<div style="padding:var(--space-4) var(--space-5);color:var(--color-text-muted);font-size:var(--text-sm)">No documents uploaded yet.</div>';
  }
  var rows = docs.map(function(d) {
    return '<tr>'
      + '<td>' + escapeHtml(d.name) + '</td>'
      + '<td><span class="badge badge-primary">' + escapeHtml(d.file_type || 'file') + '</span></td>'
      + '<td>' + fmtFileSize(d.file_size) + '</td>'
      + '<td>' + fmtDate(d.created_at ? d.created_at.slice(0, 10) : '') + '</td>'
      + '<td class="actions-cell">'
      + '<a href="/api/documents/' + d.id + '/download" class="btn-icon" title="Download"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>'
      + '<button class="btn-icon btn-icon-danger" onclick="' + onDelete + '(' + d.id + ')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>'
      + '</td>'
      + '</tr>';
  }).join('');
  return '<div class="table-wrapper"><table><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

// ===== PROPERTY DOCUMENTS =====
async function loadAndRenderPropertyDocs(propId) {
  var container = document.getElementById('prop-docs-' + propId);
  if (!container) return;
  var docs = await loadDocuments('property', propId);
  container.innerHTML = renderDocTable(docs, 'deletePropertyDoc');
  container.setAttribute('data-propid', propId);
}

async function deletePropertyDoc(docId) {
  if (!confirm('Delete this document?')) return;
  await deleteDocument(docId);
  var containers = document.querySelectorAll('[id^="prop-docs-"]');
  for (var i = 0; i < containers.length; i++) {
    var pid = containers[i].getAttribute('data-propid');
    if (pid) await loadAndRenderPropertyDocs(parseInt(pid));
  }
}

function openPropertyDocUploadModal(propId) {
  var html = '<form id="prop-doc-upload-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Document Name</label><input type="text" id="pd-name" required placeholder="e.g. Property Insurance 2026"></div>'
    + '<div class="form-group full-width"><label>Category</label>'
    + '<select id="pd-category">'
    + '<option value="lease">Lease</option>'
    + '<option value="insurance">Insurance</option>'
    + '<option value="tax document">Tax Document</option>'
    + '<option value="inspection">Inspection</option>'
    + '<option value="notice">Notice</option>'
    + '<option value="other" selected>Other</option>'
    + '</select></div>'
    + '<div class="form-group full-width"><label>File</label><input type="file" id="pd-file" required></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Upload</button></div>'
    + '</form>';
  openModal('Upload Property Document', html);
  document.getElementById('prop-doc-upload-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var nameVal = document.getElementById('pd-name').value;
    var catVal = document.getElementById('pd-category').value;
    var fileInput = document.getElementById('pd-file');
    if (!fileInput.files || !fileInput.files[0]) return;
    var fd = new FormData();
    fd.append('entity_type', 'property');
    fd.append('entity_id', propId);
    fd.append('name', nameVal + ' (' + catVal + ')');
    fd.append('file', fileInput.files[0]);
    try {
      await fetch('/api/documents', { method: 'POST', body: fd });
      closeModal();
      await loadAndRenderPropertyDocs(propId);
    } catch(err) {
      alert('Upload failed: ' + err.message);
    }
  });
}

// ===== TENANT DOCUMENTS =====
async function openTenantDocsModal(tenantId, tenantName) {
  openModal('Documents \u2014 ' + tenantName, '<div id="tenant-docs-modal-body"><p style="padding:var(--space-3);color:var(--color-text-muted)">Loading...</p></div>');
  var docs = await loadDocuments('tenant', tenantId);
  var modalBody = document.getElementById('tenant-docs-modal-body');
  if (!modalBody) return;

  var uploadForm = '<div class="doc-upload" style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--color-divider)">'
    + '<h4 style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--space-3)">Upload New Document</h4>'
    + '<form id="tenant-doc-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Document Name</label><input type="text" id="td-name" required placeholder="e.g. Lease Agreement 2026"></div>'
    + '<div class="form-group full-width"><label>Type</label>'
    + '<select id="td-category">'
    + '<option value="lease agreement">Lease Agreement</option>'
    + '<option value="ID copy">ID Copy</option>'
    + '<option value="background check">Background Check</option>'
    + '<option value="notice">Notice</option>'
    + '<option value="other" selected>Other</option>'
    + '</select></div>'
    + '<div class="form-group full-width"><label>File</label><input type="file" id="td-file" required></div>'
    + '<div class="form-actions full-width" style="margin-top:var(--space-3);padding-top:0;border-top:none">'
    + '<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>'
    + '<button type="submit" class="btn btn-primary">Upload</button>'
    + '</div></form></div>';

  modalBody.innerHTML = renderDocTable(docs, 'deleteTenantDoc') + uploadForm;
  modalBody.setAttribute('data-tenantid', tenantId);
  modalBody.setAttribute('data-tenantname', escapeHtml(tenantName));

  document.getElementById('tenant-doc-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var nameVal = document.getElementById('td-name').value;
    var catVal = document.getElementById('td-category').value;
    var fileInput = document.getElementById('td-file');
    if (!fileInput.files || !fileInput.files[0]) return;
    var fd = new FormData();
    fd.append('entity_type', 'tenant');
    fd.append('entity_id', tenantId);
    fd.append('name', nameVal + ' (' + catVal + ')');
    fd.append('file', fileInput.files[0]);
    try {
      await fetch('/api/documents', { method: 'POST', body: fd });
      var newDocs = await loadDocuments('tenant', tenantId);
      var mb = document.getElementById('tenant-docs-modal-body');
      if (mb) {
        mb.innerHTML = renderDocTable(newDocs, 'deleteTenantDoc') + uploadForm;
        mb.setAttribute('data-tenantid', tenantId);
      }
    } catch(err) {
      alert('Upload failed: ' + err.message);
    }
  });
}

async function deleteTenantDoc(docId) {
  if (!confirm('Delete this document?')) return;
  await deleteDocument(docId);
  var mb = document.getElementById('tenant-docs-modal-body');
  if (!mb) return;
  var tid = parseInt(mb.getAttribute('data-tenantid'));
  var tname = mb.getAttribute('data-tenantname') || '';
  if (tid) await openTenantDocsModal(tid, tname);
}

// ===== BULK EXPENSE MODAL =====
function openBulkExpenseModal() {
  var categories = ['maintenance', 'repairs', 'insurance', 'taxes', 'utilities', 'mortgage', 'management fees', 'other'];
  var catOptions = categories.map(function(c) { return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('');

  function makeRow(idx) {
    return '<tr class="bulk-row" data-idx="' + idx + '">'
      + '<td><input type="date" class="be-date" value="' + new Date().toISOString().slice(0, 10) + '"></td>'
      + '<td><select class="be-category">' + catOptions + '</select></td>'
      + '<td><input type="text" class="be-description" placeholder="Description"></td>'
      + '<td><input type="number" class="be-amount" min="0" step="10" placeholder="0.00"></td>'
      + '<td><input type="text" class="be-vendor" placeholder="Vendor"></td>'
      + '<td><input type="text" class="be-notes" placeholder="Notes"></td>'
      + '<td><button type="button" class="btn-icon btn-icon-danger" onclick="this.closest(\'tr\').remove()" title="Remove row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>'
      + '</tr>';
  }

  var initialRows = '';
  for (var i = 0; i < 5; i++) initialRows += makeRow(i);

  var propOpts = DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('');

  var html = '<div>'
    + '<div class="form-group" style="margin-bottom:var(--space-4)">'
    + '<label style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em">Property (applies to all rows)</label>'
    + '<select id="be-property" style="margin-top:var(--space-1);padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-md);font-size:var(--text-sm);background:var(--color-bg);color:var(--color-text);min-width:260px;font-family:inherit">' + propOpts + '</select>'
    + '</div>'
    + '<div class="bulk-grid">'
    + '<table id="bulk-table">'
    + '<thead><tr>'
    + '<th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Vendor</th><th>Notes</th><th></th>'
    + '</tr></thead>'
    + '<tbody id="bulk-tbody">' + initialRows + '</tbody>'
    + '</table></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-4)">'
    + '<button type="button" class="btn btn-ghost btn-sm" id="bulk-add-row">+ Add Row</button>'
    + '<div style="display:flex;gap:var(--space-3)">'
    + '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="btn btn-primary" id="bulk-save-btn">Save All</button>'
    + '</div></div></div>';

  var modal = document.getElementById('modal');
  modal.classList.add('modal-wide');
  openModal('Bulk Expense Entry', html);

  var rowCount = 5;
  document.getElementById('bulk-add-row').addEventListener('click', function() {
    var tbody = document.getElementById('bulk-tbody');
    var tmp = document.createElement('tbody');
    tmp.innerHTML = makeRow(rowCount++);
    var newRow = tmp.firstChild;
    if (newRow) tbody.appendChild(newRow);
  });

  document.getElementById('modal-close').addEventListener('click', function() {
    modal.classList.remove('modal-wide');
  }, { once: true });
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) modal.classList.remove('modal-wide');
  }, { once: true });

  document.getElementById('bulk-save-btn').addEventListener('click', async function() {
    var propId = parseInt(document.getElementById('be-property').value);
    if (!propId) { alert('Please select a property.'); return; }
    var rows = document.querySelectorAll('#bulk-tbody .bulk-row');
    var expenses = [];
    rows.forEach(function(row) {
      var date = row.querySelector('.be-date').value;
      var category = row.querySelector('.be-category').value;
      var description = row.querySelector('.be-description').value.trim();
      var amount = parseFloat(row.querySelector('.be-amount').value);
      var vendor = row.querySelector('.be-vendor').value.trim();
      var notes = row.querySelector('.be-notes').value.trim();
      if (description && amount > 0) {
        expenses.push({ property_id: propId, date: date, category: category, description: description, amount: amount, vendor: vendor, notes: notes });
      }
    });
    if (expenses.length === 0) { alert('No valid rows to save. Each row needs a description and amount.'); return; }
    try {
      var btn2 = document.getElementById('bulk-save-btn');
      btn2.disabled = true;
      btn2.textContent = 'Saving...';
      await api('/api/expenses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: expenses })
      });
      modal.classList.remove('modal-wide');
      closeModal();
      renderPage(currentPage);
    } catch(err) {
      alert('Save failed: ' + err.message);
      var btn3 = document.getElementById('bulk-save-btn');
      if (btn3) { btn3.disabled = false; btn3.textContent = 'Save All'; }
    }
  });
}

// ===== MODAL FORMS (Add/Edit via modal) =====

function propertyOptions() {
  return DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('');
}

function tenantSelectOptions(selectedId) {
  return DATA.tenants.filter(function(t) { return t.status === 'active'; }).map(function(t) {
    var sel = (t.id === selectedId) ? ' selected' : '';
    return '<option value="' + t.id + '"' + sel + '>' + escapeHtml(t.name) + ' (' + escapeHtml(getPropertyName(t.property_id || t.propertyId)) + ')</option>';
  }).join('');
}

function openAddPropertyModal() {
  var html = '<form id="add-property-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Property Name</label><input type="text" id="fp-name" required></div>'
    + '<div class="form-group full-width"><label>Address</label><input type="text" id="fp-address" required></div>'
    + '<div class="form-group"><label>City</label><input type="text" id="fp-city" required></div>'
    + '<div class="form-group"><label>State</label><input type="text" id="fp-state" maxlength="2" required></div>'
    + '<div class="form-group"><label>Zip</label><input type="text" id="fp-zip" required></div>'
    + '<div class="form-group"><label>Type</label><select id="fp-type"><option value="single-family">Single-Family</option><option value="multi-family" selected>Multi-Family</option><option value="commercial">Commercial</option></select></div>'
    + '<div class="form-group"><label>Units</label><input type="number" id="fp-units" min="1" value="1" required></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fp-notes"></textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Add Property</button></div>'
    + '</form>';
  openModal('Add Property', html);
  document.getElementById('add-property-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await api('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('fp-name').value,
        address: document.getElementById('fp-address').value,
        city: document.getElementById('fp-city').value,
        state: document.getElementById('fp-state').value,
        zip: document.getElementById('fp-zip').value,
        type: document.getElementById('fp-type').value,
        units: parseInt(document.getElementById('fp-units').value) || 1,
        notes: document.getElementById('fp-notes').value
      })
    });
    closeModal();
    renderPage(currentPage);
  });
}

function openEditPropertyModal(propId) {
  var p = DATA.properties.find(function(x) { return x.id === propId; });
  if (!p) return;
  var html = '<form id="edit-property-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Property Name</label><input type="text" id="fp-name" value="' + escapeHtml(p.name) + '" required></div>'
    + '<div class="form-group full-width"><label>Address</label><input type="text" id="fp-address" value="' + escapeHtml(p.address) + '" required></div>'
    + '<div class="form-group"><label>City</label><input type="text" id="fp-city" value="' + escapeHtml(p.city) + '" required></div>'
    + '<div class="form-group"><label>State</label><input type="text" id="fp-state" value="' + escapeHtml(p.state) + '" maxlength="2" required></div>'
    + '<div class="form-group"><label>Zip</label><input type="text" id="fp-zip" value="' + escapeHtml(p.zip) + '" required></div>'
    + '<div class="form-group"><label>Type</label><select id="fp-type"><option value="single-family"' + (p.type === 'single-family' ? ' selected' : '') + '>Single-Family</option><option value="multi-family"' + (p.type === 'multi-family' ? ' selected' : '') + '>Multi-Family</option><option value="commercial"' + (p.type === 'commercial' ? ' selected' : '') + '>Commercial</option></select></div>'
    + '<div class="form-group"><label>Units</label><input type="number" id="fp-units" min="1" value="' + p.units + '" required></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fp-notes">' + escapeHtml(p.notes || '') + '</textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>'
    + '</form>';
  openModal('Edit Property', html);
  document.getElementById('edit-property-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await api('/api/properties/' + propId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('fp-name').value,
        address: document.getElementById('fp-address').value,
        city: document.getElementById('fp-city').value,
        state: document.getElementById('fp-state').value,
        zip: document.getElementById('fp-zip').value,
        type: document.getElementById('fp-type').value,
        units: parseInt(document.getElementById('fp-units').value) || 1,
        notes: document.getElementById('fp-notes').value
      })
    });
    closeModal();
    renderPage(currentPage);
  });
}

function openAddTenantModal() {
  var html = '<form id="add-tenant-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Full Name</label><input type="text" id="ft-name" required></div>'
    + '<div class="form-group"><label>Email</label><input type="email" id="ft-email"></div>'
    + '<div class="form-group"><label>Phone</label><input type="tel" id="ft-phone"></div>'
    + '<div class="form-group"><label>Property</label><select id="ft-property" required>' + propertyOptions() + '</select></div>'
    + '<div class="form-group"><label>Unit</label><input type="text" id="ft-unit" required></div>'
    + '<div class="form-group"><label>Lease Start</label><input type="date" id="ft-lease-start" required></div>'
    + '<div class="form-group"><label>Lease End</label><input type="date" id="ft-lease-end" required></div>'
    + '<div class="form-group"><label>Monthly Rent</label><input type="number" id="ft-rent" min="0" step="50" required></div>'
    + '<div class="form-group"><label>Status</label><select id="ft-status"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="ft-notes"></textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Add Tenant</button></div>'
    + '</form>';
  openModal('Add Tenant', html);
  document.getElementById('add-tenant-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await api('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: parseInt(document.getElementById('ft-property').value),
        unit: document.getElementById('ft-unit').value,
        name: document.getElementById('ft-name').value,
        email: document.getElementById('ft-email').value,
        phone: document.getElementById('ft-phone').value,
        lease_start: document.getElementById('ft-lease-start').value,
        lease_end: document.getElementById('ft-lease-end').value,
        monthly_rent: parseFloat(document.getElementById('ft-rent').value) || 0,
        status: document.getElementById('ft-status').value,
        notes: document.getElementById('ft-notes').value
      })
    });
    closeModal();
    renderPage(currentPage);
  });
}

function openEditTenantModal(tenantId) {
  var t = DATA.tenants.find(function(x) { return x.id === tenantId; });
  if (!t) return;
  var pid = t.property_id || t.propertyId;
  var rent = t.monthly_rent || t.monthlyRent || 0;
  var leaseStart = t.lease_start || t.leaseStart || '';
  var leaseEnd = t.lease_end || t.leaseEnd || '';
  var html = '<form id="edit-tenant-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Full Name</label><input type="text" id="ft-name" value="' + escapeHtml(t.name) + '" required></div>'
    + '<div class="form-group"><label>Email</label><input type="email" id="ft-email" value="' + escapeHtml(t.email || '') + '"></div>'
    + '<div class="form-group"><label>Phone</label><input type="tel" id="ft-phone" value="' + escapeHtml(t.phone || '') + '"></div>'
    + '<div class="form-group"><label>Property</label><select id="ft-property" required>' + DATA.properties.map(function(p) { return '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>'; }).join('') + '</select></div>'
    + '<div class="form-group"><label>Unit</label><input type="text" id="ft-unit" value="' + escapeHtml(t.unit || '') + '" required></div>'
    + '<div class="form-group"><label>Lease Start</label><input type="date" id="ft-lease-start" value="' + leaseStart + '" required></div>'
    + '<div class="form-group"><label>Lease End</label><input type="date" id="ft-lease-end" value="' + leaseEnd + '" required></div>'
    + '<div class="form-group"><label>Monthly Rent</label><input type="number" id="ft-rent" min="0" step="50" value="' + rent + '" required></div>'
    + '<div class="form-group"><label>Status</label><select id="ft-status"><option value="active"' + (t.status === 'active' ? ' selected' : '') + '>Active</option><option value="inactive"' + (t.status === 'inactive' ? ' selected' : '') + '>Inactive</option></select></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="ft-notes">' + escapeHtml(t.notes || '') + '</textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>'
    + '</form>';
  openModal('Edit Tenant', html);
  document.getElementById('edit-tenant-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await api('/api/tenants/' + tenantId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: parseInt(document.getElementById('ft-property').value),
        unit: document.getElementById('ft-unit').value,
        name: document.getElementById('ft-name').value,
        email: document.getElementById('ft-email').value,
        phone: document.getElementById('ft-phone').value,
        lease_start: document.getElementById('ft-lease-start').value,
        lease_end: document.getElementById('ft-lease-end').value,
        monthly_rent: parseFloat(document.getElementById('ft-rent').value) || 0,
        status: document.getElementById('ft-status').value,
        notes: document.getElementById('ft-notes').value
      })
    });
    closeModal();
    renderPage(currentPage);
  });
}

function deleteTenant(id, name) {
  if (!confirm('Delete tenant "' + name + '"? This will also remove all their payment records.')) return;
  api('/api/tenants/' + id, { method: 'DELETE' }).then(function() { renderPage(currentPage); });
}

function openAddPaymentModal() {
  var splitSection = '<div class="form-group full-width" id="fi-split-section" style="display:none">'
    + '<div style="display:flex;gap:var(--space-3);flex-wrap:wrap">'
    + '<div style="flex:1;min-width:120px"><label>Method 2</label><select id="fi-method2"><option value="">None</option><option value="bank transfer">Bank Transfer</option><option value="check">Check</option><option value="cash">Cash</option><option value="online">Online</option></select></div>'
    + '<div style="flex:1;min-width:100px"><label>Amount 2</label><input type="number" id="fi-amount2" min="0" step="50" value="0"></div>'
    + '</div></div>';

  var html = '<form id="add-payment-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Tenant</label><select id="fi-tenant" required>' + tenantSelectOptions(null) + '</select></div>'
    + '<div class="form-group"><label>Date</label><input type="date" id="fi-date" value="' + new Date().toISOString().slice(0, 10) + '" required></div>'
    + '<div class="form-group"><label>Amount (Total)</label><input type="number" id="fi-amount" min="0" step="50" required><span class="rent-hint" id="fi-rent-hint"></span></div>'
    + '<div class="form-group"><label>Method</label><select id="fi-method"><option value="bank transfer" selected>Bank Transfer</option><option value="check">Check</option><option value="cash">Cash</option><option value="online">Online</option></select></div>'
    + '<div class="form-group"><label>Status</label><select id="fi-status"><option value="paid" selected>Paid</option><option value="pending">Pending</option><option value="late">Late</option></select></div>'
    + '<div class="form-group full-width"><label style="display:flex;align-items:center;gap:var(--space-2)"><input type="checkbox" id="fi-split-toggle" style="width:auto"> Split Payment (two methods)</label></div>'
    + splitSection
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fi-notes"></textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Record Payment</button></div>'
    + '</form>';
  openModal('Record Payment', html);

  var tenantSelect = document.getElementById('fi-tenant');
  var amountInput = document.getElementById('fi-amount');
  var rentHint = document.getElementById('fi-rent-hint');
  var splitToggle = document.getElementById('fi-split-toggle');
  var splitSectionEl = document.getElementById('fi-split-section');

  splitToggle.addEventListener('change', function() {
    splitSectionEl.style.display = this.checked ? '' : 'none';
  });

  function fillAmount() {
    var t = DATA.tenants.find(function(x) { return x.id === parseInt(tenantSelect.value); });
    if (t) {
      var rent = t.monthly_rent || t.monthlyRent || 0;
      var currentMonth = new Date().toISOString().slice(0, 7);
      var balance = getTenantBalance(t.id, currentMonth);
      var suggestedAmt = balance > 0 ? balance : rent;
      amountInput.value = suggestedAmt;
      if (rentHint) rentHint.textContent = rent > 0 ? 'Rent: ' + fmt(rent) + (balance < rent && balance > 0 ? ' | Remaining: ' + fmt(balance) : '') : '';
    } else {
      if (rentHint) rentHint.textContent = '';
    }
  }
  tenantSelect.addEventListener('change', fillAmount);
  fillAmount();

  document.getElementById('add-payment-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var tid = parseInt(document.getElementById('fi-tenant').value);
    var tenant = DATA.tenants.find(function(t) { return t.id === tid; });
    var isSplit = document.getElementById('fi-split-toggle').checked;
    var method2Val = isSplit ? document.getElementById('fi-method2').value : '';
    var amount2Val = isSplit ? (parseFloat(document.getElementById('fi-amount2').value) || 0) : 0;
    await api('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tid,
        property_id: tenant ? (tenant.property_id || tenant.propertyId) : 0,
        date: document.getElementById('fi-date').value,
        amount: parseFloat(document.getElementById('fi-amount').value) || 0,
        method: document.getElementById('fi-method').value,
        status: document.getElementById('fi-status').value,
        notes: document.getElementById('fi-notes').value,
        method2: method2Val,
        amount2: amount2Val
      })
    });
    closeModal();
    renderPage(currentPage);
  });
}

function openEditIncomeModal(incomeId) {
  var rec = DATA.income.find(function(x) { return x.id === incomeId; });
  if (!rec) return;
  var tid = rec.tenant_id || rec.tenantId;
  var hasSplit = rec.method2 && rec.amount2 > 0;
  var splitDisplay = hasSplit ? '' : 'none';

  var splitSection = '<div class="form-group full-width" id="fi-split-section" style="display:' + splitDisplay + '">'
    + '<div style="display:flex;gap:var(--space-3);flex-wrap:wrap">'
    + '<div style="flex:1;min-width:120px"><label>Method 2</label><select id="fi-method2">'
    + '<option value="">None</option>'
    + '<option value="bank transfer"' + (rec.method2 === 'bank transfer' ? ' selected' : '') + '>Bank Transfer</option>'
    + '<option value="check"' + (rec.method2 === 'check' ? ' selected' : '') + '>Check</option>'
    + '<option value="cash"' + (rec.method2 === 'cash' ? ' selected' : '') + '>Cash</option>'
    + '<option value="online"' + (rec.method2 === 'online' ? ' selected' : '') + '>Online</option>'
    + '</select></div>'
    + '<div style="flex:1;min-width:100px"><label>Amount 2</label><input type="number" id="fi-amount2" min="0" step="50" value="' + (rec.amount2 || 0) + '"></div>'
    + '</div></div>';

  var html = '<form id="edit-income-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Tenant</label><select id="fi-tenant" required>' + tenantSelectOptions(tid) + '</select></div>'
    + '<div class="form-group"><label>Date</label><input type="date" id="fi-date" value="' + rec.date + '" required></div>'
    + '<div class="form-group"><label>Amount (Total)</label><input type="number" id="fi-amount" min="0" step="50" value="' + rec.amount + '" required></div>'
    + '<div class="form-group"><label>Method</label><select id="fi-method"><option value="bank transfer"' + (rec.method === 'bank transfer' ? ' selected' : '') + '>Bank Transfer</option><option value="check"' + (rec.method === 'check' ? ' selected' : '') + '>Check</option><option value="cash"' + (rec.method === 'cash' ? ' selected' : '') + '>Cash</option><option value="online"' + (rec.method === 'online' ? ' selected' : '') + '>Online</option></select></div>'
    + '<div class="form-group"><label>Status</label><select id="fi-status"><option value="paid"' + (rec.status === 'paid' ? ' selected' : '') + '>Paid</option><option value="pending"' + (rec.status === 'pending' ? ' selected' : '') + '>Pending</option><option value="late"' + (rec.status === 'late' ? ' selected' : '') + '>Late</option></select></div>'
    + '<div class="form-group full-width"><label style="display:flex;align-items:center;gap:var(--space-2)"><input type="checkbox" id="fi-split-toggle" style="width:auto"' + (hasSplit ? ' checked' : '') + '> Split Payment (two methods)</label></div>'
    + splitSection
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fi-notes">' + escapeHtml(rec.notes || '') + '</textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>'
    + '</form>';
  openModal('Edit Payment', html);

  var splitToggle = document.getElementById('fi-split-toggle');
  var splitSectionEl = document.getElementById('fi-split-section');
  splitToggle.addEventListener('change', function() {
    splitSectionEl.style.display = this.checked ? '' : 'none';
  });

  document.getElementById('edit-income-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var newTid = parseInt(document.getElementById('fi-tenant').value);
    var tenant = DATA.tenants.find(function(t) { return t.id === newTid; });
    var isSplit = document.getElementById('fi-split-toggle').checked;
    var method2Val = isSplit ? document.getElementById('fi-method2').value : '';
    var amount2Val = isSplit ? (parseFloat(document.getElementById('fi-amount2').value) || 0) : 0;
    await api('/api/income/' + incomeId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: newTid,
        property_id: tenant ? (tenant.property_id || tenant.propertyId) : 0,
        date: document.getElementById('fi-date').value,
        amount: parseFloat(document.getElementById('fi-amount').value) || 0,
        method: document.getElementById('fi-method').value,
        status: document.getElementById('fi-status').value,
        notes: document.getElementById('fi-notes').value,
        method2: method2Val,
        amount2: amount2Val
      })
    });
    closeModal();
    renderPage(currentPage);
  });
}

function deleteIncome(id) {
  if (!confirm('Delete this payment record?')) return;
  api('/api/income/' + id, { method: 'DELETE' }).then(function() { renderPage(currentPage); });
}

function openAddExpenseModal() {
  var categories = ['maintenance', 'repairs', 'insurance', 'taxes', 'utilities', 'mortgage', 'management fees', 'other'];
  var html = '<form id="add-expense-form" class="form-grid">'
    + '<div class="form-group"><label>Property</label><select id="fe-property" required>' + propertyOptions() + '</select></div>'
    + '<div class="form-group"><label>Date</label><input type="date" id="fe-date" value="' + new Date().toISOString().slice(0, 10) + '" required></div>'
    + '<div class="form-group"><label>Category</label><select id="fe-category">' + categories.map(function(c) { return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('') + '</select></div>'
    + '<div class="form-group"><label>Amount</label><input type="number" id="fe-amount" min="0" step="10" required></div>'
    + '<div class="form-group full-width"><label>Description</label><input type="text" id="fe-description" required></div>'
    + '<div class="form-group"><label>Vendor</label><input type="text" id="fe-vendor"></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fe-notes"></textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Add Expense</button></div>'
    + '</form>';
  openModal('Add Expense', html);
  document.getElementById('add-expense-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await api('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: parseInt(document.getElementById('fe-property').value),
        date: document.getElementById('fe-date').value,
        category: document.getElementById('fe-category').value,
        description: document.getElementById('fe-description').value,
        amount: parseFloat(document.getElementById('fe-amount').value) || 0,
        vendor: document.getElementById('fe-vendor').value,
        notes: document.getElementById('fe-notes').value
      })
    });
    closeModal();
    renderPage(currentPage);
  });
}

function openEditExpenseModal(expenseId) {
  var rec = DATA.expenses.find(function(x) { return x.id === expenseId; });
  if (!rec) return;
  var pid = rec.property_id || rec.propertyId;
  var categories = ['maintenance', 'repairs', 'insurance', 'taxes', 'utilities', 'mortgage', 'management fees', 'other'];

  var receiptSection;
  if (rec.receipt_path) {
    receiptSection = '<div class="form-group full-width"><label>Receipt</label>'
      + '<div class="receipt-existing">'
      + '<a href="/' + escapeHtml(rec.receipt_path) + '" target="_blank" class="btn btn-ghost btn-sm">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> View Receipt'
      + '</a>'
      + '<button type="button" class="btn btn-secondary btn-sm" id="remove-receipt-btn">Remove</button>'
      + '</div></div>';
  } else {
    receiptSection = '<div class="form-group full-width"><label>Receipt (optional)</label>'
      + '<input type="file" id="fe-receipt" accept=".jpg,.jpeg,.png,.gif,.pdf,.webp">'
      + '</div>';
  }

  var html = '<form id="edit-expense-form" class="form-grid">'
    + '<div class="form-group"><label>Property</label><select id="fe-property" required>' + DATA.properties.map(function(p) { return '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>'; }).join('') + '</select></div>'
    + '<div class="form-group"><label>Date</label><input type="date" id="fe-date" value="' + rec.date + '" required></div>'
    + '<div class="form-group"><label>Category</label><select id="fe-category">' + categories.map(function(c) { return '<option value="' + c + '"' + (c === rec.category ? ' selected' : '') + '>' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('') + '</select></div>'
    + '<div class="form-group"><label>Amount</label><input type="number" id="fe-amount" min="0" step="10" value="' + rec.amount + '" required></div>'
    + '<div class="form-group full-width"><label>Description</label><input type="text" id="fe-description" value="' + escapeHtml(rec.description || '') + '" required></div>'
    + '<div class="form-group"><label>Vendor</label><input type="text" id="fe-vendor" value="' + escapeHtml(rec.vendor || '') + '"></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fe-notes">' + escapeHtml(rec.notes || '') + '</textarea></div>'
    + receiptSection
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>'
    + '</form>';
  openModal('Edit Expense', html);

  var removeBtn = document.getElementById('remove-receipt-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', async function() {
      if (!confirm('Remove this receipt?')) return;
      await api('/api/expenses/' + expenseId + '/receipt', { method: 'DELETE' });
      closeModal();
      renderPage(currentPage);
    });
  }

  document.getElementById('edit-expense-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await api('/api/expenses/' + expenseId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: parseInt(document.getElementById('fe-property').value),
        date: document.getElementById('fe-date').value,
        category: document.getElementById('fe-category').value,
        description: document.getElementById('fe-description').value,
        amount: parseFloat(document.getElementById('fe-amount').value) || 0,
        vendor: document.getElementById('fe-vendor').value,
        notes: document.getElementById('fe-notes').value
      })
    });
    var receiptInput = document.getElementById('fe-receipt');
    if (receiptInput && receiptInput.files && receiptInput.files[0]) {
      var fd = new FormData();
      fd.append('receipt', receiptInput.files[0]);
      await fetch('/api/expenses/' + expenseId + '/receipt', { method: 'POST', body: fd });
    }
    closeModal();
    renderPage(currentPage);
  });
}

function deleteExpense(id) {
  if (!confirm('Delete this expense record?')) return;
  api('/api/expenses/' + id, { method: 'DELETE' }).then(function() { renderPage(currentPage); });
}

// ===== MAINTENANCE SPREADSHEET =====
function maintenanceBadgePriority(priority) {
  var p = (priority || '').toLowerCase();
  if (p === 'urgent') return 'badge badge-urgent';
  if (p === 'high') return 'badge badge-high';
  if (p === 'medium') return 'badge badge-medium';
  if (p === 'low') return 'badge badge-low';
  return 'badge badge-medium';
}

function maintenanceBadgeStatus(status) {
  var s = (status || '').toLowerCase();
  if (s === 'open') return 'badge badge-open';
  if (s === 'in-progress') return 'badge badge-in-progress';
  if (s === 'completed') return 'badge badge-completed';
  if (s === 'cancelled') return 'badge badge-cancelled';
  return 'badge badge-open';
}

function renderMaintenance(container) {
  var propOptions = DATA.properties.map(function(p) { return { value: p.id, label: p.name }; });
  var tenantOptionsM = [{value: '', label: '(None)'}].concat(
    DATA.tenants.filter(function(t) { return t.status === 'active'; }).map(function(t) {
      return { value: t.id, label: t.name + ' (' + getPropertyName(t.property_id || t.propertyId) + ')' };
    })
  );

  var filterHtml = '<select class="grid-filter-select" id="maint-filter-property">'
    + '<option value="">All Properties</option>'
    + DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('')
    + '</select>'
    + '<select class="grid-filter-select" id="maint-filter-status">'
    + '<option value="">All Statuses</option>'
    + '<option value="open">Open</option>'
    + '<option value="in-progress">In Progress</option>'
    + '<option value="completed">Completed</option>'
    + '<option value="cancelled">Cancelled</option>'
    + '</select>'
    + '<select class="grid-filter-select" id="maint-filter-priority">'
    + '<option value="">All Priorities</option>'
    + '<option value="urgent">Urgent</option>'
    + '<option value="high">High</option>'
    + '<option value="medium">Medium</option>'
    + '<option value="low">Low</option>'
    + '</select>';

  function getFilteredData() {
    var propVal = document.getElementById('maint-filter-property') ? document.getElementById('maint-filter-property').value : '';
    var statusVal = document.getElementById('maint-filter-status') ? document.getElementById('maint-filter-status').value : '';
    var priorityVal = document.getElementById('maint-filter-priority') ? document.getElementById('maint-filter-priority').value : '';
    return DATA.maintenance.filter(function(m) {
      if (propVal && m.property_id !== parseInt(propVal)) return false;
      if (statusVal && m.status !== statusVal) return false;
      if (priorityVal && m.priority !== priorityVal) return false;
      return true;
    });
  }

  var columns = [
    { key: 'date_reported', label: 'Date Reported', type: 'date', width: '120px',
      render: function(rec, val) { return val ? fmtDate(val) : ''; }
    },
    { key: 'property_id', label: 'Property', type: 'select', width: '150px',
      options: propOptions,
      render: function(rec, val) { return escapeHtml(getPropertyName(val)); }
    },
    { key: 'tenant_id', label: 'Tenant', type: 'select', width: '140px',
      options: tenantOptionsM,
      render: function(rec, val) {
        if (!val) return '<span style="color:var(--color-text-muted)">None</span>';
        return escapeHtml(getTenantName(val));
      }
    },
    { key: 'title', label: 'Title', type: 'text', width: '180px' },
    { key: 'category', label: 'Category', type: 'select', width: '110px',
      options: [
        { value: 'plumbing', label: 'Plumbing' },
        { value: 'electrical', label: 'Electrical' },
        { value: 'appliance', label: 'Appliance' },
        { value: 'hvac', label: 'HVAC' },
        { value: 'structural', label: 'Structural' },
        { value: 'general', label: 'General' },
        { value: 'landscaping', label: 'Landscaping' },
        { value: 'pest control', label: 'Pest Control' },
        { value: 'other', label: 'Other' }
      ]
    },
    { key: 'priority', label: 'Priority', type: 'select', width: '90px',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' }
      ],
      render: function(rec, val) {
        if (!val) return '';
        return '<span class="' + maintenanceBadgePriority(val) + '">' + escapeHtml(val) + '</span>';
      }
    },
    { key: 'status', label: 'Status', type: 'select', width: '100px',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' }
      ],
      render: function(rec, val) {
        if (!val) return '';
        return '<span class="' + maintenanceBadgeStatus(val) + '">' + escapeHtml(val) + '</span>';
      }
    },
    { key: 'assigned_to', label: 'Assigned To', type: 'text', width: '130px' },
    { key: 'cost', label: 'Cost', type: 'number', width: '80px',
      render: function(rec, val) { return val ? fmt(val) : ''; }
    },
    { key: 'notes', label: 'Notes', type: 'text', width: '180px' }
  ];

  var config = {
    entityName: 'maintenance',
    columns: columns,
    data: getFilteredData(),
    requiredForCreate: ['date_reported', 'property_id', 'title'],
    buildPayload: function(rec) {
      return {
        property_id: parseInt(rec.property_id) || null,
        tenant_id: rec.tenant_id ? parseInt(rec.tenant_id) : null,
        title: rec.title || '',
        description: rec.description || '',
        category: rec.category || 'general',
        priority: rec.priority || 'medium',
        status: rec.status || 'open',
        assigned_to: rec.assigned_to || '',
        cost: parseFloat(rec.cost) || 0,
        date_reported: rec.date_reported || new Date().toISOString().slice(0, 10),
        date_completed: rec.date_completed || '',
        notes: rec.notes || ''
      };
    },
    onDelete: function(id) {
      if (!confirm('Delete this maintenance record?')) return;
      api('/api/maintenance/' + id, { method: 'DELETE' }).then(function() { renderPage('maintenance'); });
    },
    filters: filterHtml,
    toolbarRight: '<button class="btn btn-primary btn-sm" onclick="openAddMaintenanceModal()">+ Add Work Order</button>'
      + '<button class="btn btn-secondary btn-sm" onclick="exportMaintenanceCSV()">Export CSV</button>',
    summary: function(data) {
      var openCount = data.filter(function(m) { return m.status === 'open'; }).length;
      var inProgressCount = data.filter(function(m) { return m.status === 'in-progress'; }).length;
      var completedCount = data.filter(function(m) { return m.status === 'completed'; }).length;
      var totalCost = data.reduce(function(s, m) { return s + (m.cost || 0); }, 0);
      return '<div class="grid-summary">'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Open</span><span class="grid-summary-value" style="color:var(--color-primary)">' + openCount + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">In Progress</span><span class="grid-summary-value" style="color:var(--color-warning)">' + inProgressCount + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Completed</span><span class="grid-summary-value" style="color:var(--color-success)">' + completedCount + '</span></div>'
        + '<div class="grid-summary-item"><span class="grid-summary-label">Total Cost</span><span class="grid-summary-value">' + fmt(totalCost) + '</span></div>'
        + '</div>';
    },
    extraActions: function(rec) {
      return '<button class="btn-icon" data-extra-action="edit-maint" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
    },
    onExtraAction: function(btn, rec) {
      if (btn.getAttribute('data-extra-action') === 'edit-maint') {
        openEditMaintenanceModal(rec.id);
      }
    }
  };

  renderSpreadsheet(container, config);

  // Wire up filters
  setTimeout(function() {
    var pf = document.getElementById('maint-filter-property');
    var sf = document.getElementById('maint-filter-status');
    var prf = document.getElementById('maint-filter-priority');
    function refilterMaint() {
      var tbody = document.getElementById('sheet-tbody-maintenance');
      if (tbody) fillSheetRows(tbody, config, getFilteredData());
      var summaryBar = container.querySelector('.grid-summary');
      if (summaryBar) summaryBar.parentNode.innerHTML = config.summary(getFilteredData());
    }
    if (pf) pf.addEventListener('change', refilterMaint);
    if (sf) sf.addEventListener('change', refilterMaint);
    if (prf) prf.addEventListener('change', refilterMaint);
  }, 50);
}

function openAddMaintenanceModal() {
  var propOpts = DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('');
  var tenantOpts = '<option value="">None</option>'
    + DATA.tenants.filter(function(t) { return t.status === 'active'; }).map(function(t) {
      return '<option value="' + t.id + '">' + escapeHtml(t.name) + ' (' + escapeHtml(getPropertyName(t.property_id || t.propertyId)) + ')</option>';
    }).join('');

  var html = '<form id="add-maint-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Title</label><input type="text" id="fm-title" required placeholder="e.g. Leaking faucet in unit 2B"></div>'
    + '<div class="form-group"><label>Property</label><select id="fm-property" required>' + propOpts + '</select></div>'
    + '<div class="form-group"><label>Tenant (optional)</label><select id="fm-tenant">' + tenantOpts + '</select></div>'
    + '<div class="form-group"><label>Date Reported</label><input type="date" id="fm-date" value="' + new Date().toISOString().slice(0, 10) + '" required></div>'
    + '<div class="form-group"><label>Category</label><select id="fm-category">'
    + '<option value="general">General</option><option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="appliance">Appliance</option><option value="hvac">HVAC</option><option value="structural">Structural</option><option value="landscaping">Landscaping</option><option value="pest control">Pest Control</option><option value="other">Other</option>'
    + '</select></div>'
    + '<div class="form-group"><label>Priority</label><select id="fm-priority">'
    + '<option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option>'
    + '</select></div>'
    + '<div class="form-group"><label>Status</label><select id="fm-status">'
    + '<option value="open" selected>Open</option><option value="in-progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>'
    + '</select></div>'
    + '<div class="form-group"><label>Assigned To</label><input type="text" id="fm-assigned" placeholder="Contractor or staff name"></div>'
    + '<div class="form-group"><label>Estimated Cost</label><input type="number" id="fm-cost" min="0" step="10" value="0"></div>'
    + '<div class="form-group"><label>Date Completed</label><input type="date" id="fm-completed"></div>'
    + '<div class="form-group full-width"><label>Description</label><textarea id="fm-description" placeholder="Details about the issue..."></textarea></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fm-notes"></textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Add Work Order</button></div>'
    + '</form>';

  var modal = document.getElementById('modal');
  modal.classList.add('modal-wide');
  openModal('Add Work Order', html);

  document.getElementById('modal-close').addEventListener('click', function() {
    modal.classList.remove('modal-wide');
  }, { once: true });

  document.getElementById('add-maint-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await api('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: parseInt(document.getElementById('fm-property').value),
        tenant_id: document.getElementById('fm-tenant').value ? parseInt(document.getElementById('fm-tenant').value) : null,
        title: document.getElementById('fm-title').value,
        description: document.getElementById('fm-description').value,
        category: document.getElementById('fm-category').value,
        priority: document.getElementById('fm-priority').value,
        status: document.getElementById('fm-status').value,
        assigned_to: document.getElementById('fm-assigned').value,
        cost: parseFloat(document.getElementById('fm-cost').value) || 0,
        date_reported: document.getElementById('fm-date').value,
        date_completed: document.getElementById('fm-completed').value,
        notes: document.getElementById('fm-notes').value
      })
    });
    modal.classList.remove('modal-wide');
    closeModal();
    renderPage(currentPage);
  });
}

function openEditMaintenanceModal(maintId) {
  var rec = DATA.maintenance.find(function(x) { return x.id === maintId; });
  if (!rec) return;

  var propOpts = DATA.properties.map(function(p) {
    return '<option value="' + p.id + '"' + (p.id === rec.property_id ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>';
  }).join('');
  var tenantOpts = '<option value=""' + (!rec.tenant_id ? ' selected' : '') + '>None</option>'
    + DATA.tenants.filter(function(t) { return t.status === 'active'; }).map(function(t) {
      return '<option value="' + t.id + '"' + (t.id === rec.tenant_id ? ' selected' : '') + '>' + escapeHtml(t.name) + ' (' + escapeHtml(getPropertyName(t.property_id || t.propertyId)) + ')</option>';
    }).join('');

  function selOpt(val, arr) {
    return arr.map(function(o) {
      return '<option value="' + o.v + '"' + (o.v === val ? ' selected' : '') + '>' + o.l + '</option>';
    }).join('');
  }
  var catArr = [{v:'general',l:'General'},{v:'plumbing',l:'Plumbing'},{v:'electrical',l:'Electrical'},{v:'appliance',l:'Appliance'},{v:'hvac',l:'HVAC'},{v:'structural',l:'Structural'},{v:'landscaping',l:'Landscaping'},{v:'pest control',l:'Pest Control'},{v:'other',l:'Other'}];
  var priArr = [{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'},{v:'urgent',l:'Urgent'}];
  var staArr = [{v:'open',l:'Open'},{v:'in-progress',l:'In Progress'},{v:'completed',l:'Completed'},{v:'cancelled',l:'Cancelled'}];

  var html = '<form id="edit-maint-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Title</label><input type="text" id="fm-title" value="' + escapeHtml(rec.title || '') + '" required></div>'
    + '<div class="form-group"><label>Property</label><select id="fm-property" required>' + propOpts + '</select></div>'
    + '<div class="form-group"><label>Tenant (optional)</label><select id="fm-tenant">' + tenantOpts + '</select></div>'
    + '<div class="form-group"><label>Date Reported</label><input type="date" id="fm-date" value="' + (rec.date_reported || '') + '" required></div>'
    + '<div class="form-group"><label>Category</label><select id="fm-category">' + selOpt(rec.category, catArr) + '</select></div>'
    + '<div class="form-group"><label>Priority</label><select id="fm-priority">' + selOpt(rec.priority, priArr) + '</select></div>'
    + '<div class="form-group"><label>Status</label><select id="fm-status">' + selOpt(rec.status, staArr) + '</select></div>'
    + '<div class="form-group"><label>Assigned To</label><input type="text" id="fm-assigned" value="' + escapeHtml(rec.assigned_to || '') + '"></div>'
    + '<div class="form-group"><label>Cost</label><input type="number" id="fm-cost" min="0" step="10" value="' + (rec.cost || 0) + '"></div>'
    + '<div class="form-group"><label>Date Completed</label><input type="date" id="fm-completed" value="' + (rec.date_completed || '') + '"></div>'
    + '<div class="form-group full-width"><label>Description</label><textarea id="fm-description">' + escapeHtml(rec.description || '') + '</textarea></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fm-notes">' + escapeHtml(rec.notes || '') + '</textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>'
    + '</form>';

  var modal = document.getElementById('modal');
  modal.classList.add('modal-wide');
  openModal('Edit Work Order', html);

  document.getElementById('modal-close').addEventListener('click', function() {
    modal.classList.remove('modal-wide');
  }, { once: true });

  document.getElementById('edit-maint-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await api('/api/maintenance/' + maintId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: parseInt(document.getElementById('fm-property').value),
        tenant_id: document.getElementById('fm-tenant').value ? parseInt(document.getElementById('fm-tenant').value) : null,
        title: document.getElementById('fm-title').value,
        description: document.getElementById('fm-description').value,
        category: document.getElementById('fm-category').value,
        priority: document.getElementById('fm-priority').value,
        status: document.getElementById('fm-status').value,
        assigned_to: document.getElementById('fm-assigned').value,
        cost: parseFloat(document.getElementById('fm-cost').value) || 0,
        date_reported: document.getElementById('fm-date').value,
        date_completed: document.getElementById('fm-completed').value,
        notes: document.getElementById('fm-notes').value
      })
    });
    modal.classList.remove('modal-wide');
    closeModal();
    renderPage(currentPage);
  });
}

function deleteMaintenance(id) {
  if (!confirm('Delete this maintenance record?')) return;
  api('/api/maintenance/' + id, { method: 'DELETE' }).then(function() { renderPage('maintenance'); });
}

function exportMaintenanceCSV() {
  var headers = ['Date Reported', 'Property', 'Tenant', 'Title', 'Category', 'Priority', 'Status', 'Assigned To', 'Cost', 'Date Completed', 'Notes'];
  var rows = DATA.maintenance.map(function(m) {
    return [
      m.date_reported,
      getPropertyName(m.property_id),
      m.tenant_id ? getTenantName(m.tenant_id) : '',
      m.title,
      m.category,
      m.priority,
      m.status,
      m.assigned_to,
      m.cost || 0,
      m.date_completed || '',
      m.notes
    ];
  });
  exportCSV('propflow-maintenance.csv', headers, rows);
}

// ===== INIT =====
(async function init() {
  // Load user info
  try {
    var userData = await api('/auth/me');
    if (userData && userData.user) {
      var name = userData.user.name || userData.user.email || 'User';
      document.getElementById('user-name').textContent = name;
      if (document.getElementById('user-name-mobile')) document.getElementById('user-name-mobile').textContent = name;
      var initials = name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
      document.getElementById('user-avatar').textContent = initials;
      if (document.getElementById('user-avatar-mobile')) document.getElementById('user-avatar-mobile').textContent = initials;
    }
  } catch(e) { /* ignore */ }

  var hash = location.hash.replace('#', '') || 'dashboard';
  currentPage = hash;
  await renderPage(hash);
  updateNav(hash);
})();
