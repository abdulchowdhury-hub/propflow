/* ===== PropFlow — Rental Property Management App (API-connected) ===== */

// ===== DATA CACHE =====
var DATA = { properties: [], tenants: [], income: [], expenses: [] };

async function api(path, options) {
  var res = await fetch(path, options);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  if (!res.ok) { var err = await res.json().catch(function() { return { error: 'Request failed' }; }); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

async function loadAllData() {
  var results = await Promise.all([
    api('/api/properties'),
    api('/api/tenants'),
    api('/api/income'),
    api('/api/expenses')
  ]);
  if (!results[0]) return;
  DATA.properties = results[0];
  DATA.tenants = results[1];
  DATA.income = results[2];
  DATA.expenses = results[3];
}

// ===== HELPERS =====
function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
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

// ===== THEME TOGGLE =====
(function initTheme() {
  var root = document.documentElement;
  var theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    updateToggleIcon(toggle, theme);
    toggle.addEventListener('click', function() {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
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
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

// ===== SIDEBAR =====
(function initSidebar() {
  var sidebar = document.getElementById('sidebar');
  var hamburger = document.getElementById('hamburger');
  var closeBtn = document.getElementById('sidebar-close');
  var overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);
  function openSidebar() { sidebar.classList.add('open'); overlay.classList.add('active'); }
  function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }
  hamburger.addEventListener('click', openSidebar);
  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
})();

// ===== LOGOUT =====
document.getElementById('logout-btn').addEventListener('click', async function() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ===== MODAL =====
function openModal(title, bodyHtml) {
  var overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  overlay.hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ===== ROUTING =====
var currentPage = 'dashboard';
var chartInstances = [];

function destroyCharts() {
  chartInstances.forEach(function(c) { c.destroy(); });
  chartInstances = [];
}

function navigateTo(page) {
  currentPage = page;
  location.hash = '#' + page;
  renderPage(page);
  updateNav(page);
  document.getElementById('sidebar').classList.remove('open');
  var overlay = document.querySelector('.sidebar-overlay');
  if (overlay) overlay.classList.remove('active');
}

function updateNav(page) {
  var basePage = page.split('/')[0];
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.classList.toggle('active', item.getAttribute('data-page') === basePage);
  });
  var titles = { dashboard: 'Dashboard', properties: 'Properties', tenants: 'Tenants', income: 'Income', expenses: 'Expenses', reports: 'Reports' };
  document.getElementById('page-title').textContent = titles[basePage] || 'PropFlow';
}

async function renderPage(page) {
  destroyCharts();
  var main = document.getElementById('main-content');
  var parts = page.split('/');

  // Reload data for fresh content
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
    case 'reports': await renderReports(main); break;
    default: renderDashboard(main);
  }
  main.scrollTop = 0;
}

document.querySelectorAll('.nav-item').forEach(function(item) {
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

// ===== TABLE SORTING =====
function attachSorting(tableId, data, renderFn) {
  var table = document.getElementById(tableId);
  if (!table) return;
  var headers = table.querySelectorAll('th[data-sort]');
  headers.forEach(function(th) {
    th.addEventListener('click', function() {
      var key = this.getAttribute('data-sort');
      var dir = this.classList.contains('sorted-asc') ? 'desc' : 'asc';
      headers.forEach(function(h) { h.classList.remove('sorted', 'sorted-asc', 'sorted-desc'); });
      this.classList.add('sorted', 'sorted-' + dir);
      data.sort(function(a, b) {
        var va = a[key], vb = b[key];
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
      });
      renderFn();
    });
  });
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

  container.innerHTML = ''
    + '<div class="kpi-grid">'
    + kpiCard('Total Properties', totalProps, '')
    + kpiCard('Total Units', totalUnits, '')
    + kpiCard('Rent Collected', fmt(monthlyCollected), monthLabel)
    + kpiCard('Expenses', fmt(monthlyExpense), monthLabel)
    + kpiCard('Net Income', fmt(netIncome), netIncome >= 0 ? 'positive' : 'negative')
    + kpiCard('Occupancy', occupancyRate + '%', occupancyRate >= 90 ? 'positive' : 'neutral')
    + '</div>'
    + '<div class="quick-actions">'
    + '<button class="btn btn-primary" onclick="openAddPropertyModal()">+ Add Property</button>'
    + '<button class="btn btn-secondary" onclick="openAddPaymentModal()">+ Record Payment</button>'
    + '<button class="btn btn-secondary" onclick="openAddExpenseModal()">+ Add Expense</button>'
    + '</div>'
    + '<div class="chart-grid">'
    + '<div class="chart-card"><h3>Monthly Income vs Expenses</h3><div class="chart-container"><canvas id="chart-income-expense"></canvas></div></div>'
    + '<div class="chart-card"><h3>Recent Transactions</h3><div class="table-wrapper" style="max-height:280px;overflow-y:auto"><table><thead><tr><th>Date</th><th>Tenant</th><th>Property</th><th class="text-right">Amount</th><th>Status</th></tr></thead><tbody id="recent-txns"></tbody></table></div></div>'
    + '</div>';

  var tbody = document.getElementById('recent-txns');
  recentTransactions.forEach(function(t) {
    tbody.innerHTML += '<tr><td>' + fmtDate(t.date) + '</td><td>' + escapeHtml(getTenantName(t.tenant_id || t.tenantId)) + '</td><td>' + escapeHtml(getPropertyName(t.property_id || t.propertyId)) + '</td><td class="text-right amount">' + fmt(t.amount) + '</td><td><span class="badge ' + badgeClass(t.status) + '">' + escapeHtml(t.status) + '</span></td></tr>';
  });

  renderIncomeExpenseChart();
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
  // Build last 6 months
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

// ===== PROPERTIES PAGE =====
function renderProperties(container) {
  container.innerHTML = ''
    + '<div class="table-card">'
    + '<div class="table-header"><h3>All Properties</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openAddPropertyModal()">+ Add Property</button></div></div>'
    + '<div class="table-wrapper"><table id="properties-table"><thead><tr>'
    + '<th data-sort="name">Name <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="address">Address <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="city">City <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="type">Type <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="units" class="text-right">Units <span class="sort-icon">&#8597;</span></th>'
    + '<th class="text-right">Total Rent</th>'
    + '<th>Status</th>'
    + '<th>Actions</th>'
    + '</tr></thead><tbody id="properties-tbody"></tbody></table></div></div>';

  fillPropertiesTable();
  attachSorting('properties-table', DATA.properties, fillPropertiesTable);
}

function fillPropertiesTable() {
  var tbody = document.getElementById('properties-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  DATA.properties.forEach(function(p) {
    var pid = p.id;
    var totalRent = DATA.tenants.filter(function(t) { return (t.property_id || t.propertyId) === pid && t.status === 'active'; }).reduce(function(s, t) { return s + (t.monthly_rent || t.monthlyRent || 0); }, 0);
    var activeUnits = DATA.tenants.filter(function(t) { return (t.property_id || t.propertyId) === pid && t.status === 'active'; }).length;
    var statusBadge = activeUnits > 0 ? '<span class="badge badge-paid">Active</span>' : '<span class="badge badge-inactive">Vacant</span>';
    tbody.innerHTML += '<tr class="clickable-row"><td onclick="navigateTo(\'properties/' + pid + '\')"><strong>' + escapeHtml(p.name) + '</strong></td><td onclick="navigateTo(\'properties/' + pid + '\')">' + escapeHtml(p.address) + '</td><td onclick="navigateTo(\'properties/' + pid + '\')">' + escapeHtml(p.city) + ', ' + escapeHtml(p.state) + '</td><td onclick="navigateTo(\'properties/' + pid + '\')">' + escapeHtml(p.type) + '</td><td onclick="navigateTo(\'properties/' + pid + '\')" class="text-right">' + p.units + '</td><td onclick="navigateTo(\'properties/' + pid + '\')" class="text-right amount">' + fmt(totalRent) + '/mo</td><td onclick="navigateTo(\'properties/' + pid + '\')">' + statusBadge + '</td>'
      + '<td class="actions-cell"><button class="btn-icon" onclick="event.stopPropagation(); openEditPropertyModal(' + pid + ')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
      + '<button class="btn-icon btn-icon-danger" onclick="event.stopPropagation(); deleteProperty(' + pid + ', \'' + escapeHtml(p.name).replace(/'/g, "\\'") + '\')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></td></tr>';
  });
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

  // Sort income and expenses by date descending
  propIncome.sort(function(a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });
  propExpenses.sort(function(a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });

  // Income summary by status
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
    // Documents section
    + '<div class="table-card" style="margin-bottom:var(--space-6)" id="prop-docs-card-' + prop.id + '">'
    + '<div class="table-header"><h3>Documents</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openPropertyDocUploadModal(' + prop.id + ')">+ Upload Document</button></div></div>'
    + '<div id="prop-docs-' + prop.id + '"><div class="doc-list-loading" style="padding:var(--space-4) var(--space-5);color:var(--color-text-muted);font-size:var(--text-sm)">Loading documents...</div></div>'
    + '</div>'
    // Tenants table with actions
    + '<div class="table-card" style="margin-bottom:var(--space-6)"><div class="table-header"><h3>Tenants (' + propTenants.length + ')</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openAddTenantModal()">+ Add Tenant</button></div></div><div class="table-wrapper"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Unit</th><th>Rent</th><th>Lease</th><th>Status</th><th>Actions</th></tr></thead><tbody>'
    + propTenants.map(function(t) {
      var rent = t.monthly_rent || t.monthlyRent || 0;
      return '<tr><td><strong>' + escapeHtml(t.name) + '</strong></td><td>' + escapeHtml(t.email) + '</td><td>' + escapeHtml(t.phone) + '</td><td>' + escapeHtml(t.unit) + '</td><td class="amount">' + fmt(rent) + '</td><td>' + fmtDate(t.lease_start || t.leaseStart) + ' \u2013 ' + fmtDate(t.lease_end || t.leaseEnd) + '</td><td><span class="badge ' + badgeClass(t.status) + '">' + escapeHtml(t.status) + '</span></td>'
        + '<td class="actions-cell"><button class="btn-icon" onclick="openEditTenantModal(' + t.id + ')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        + '<button class="btn-icon btn-icon-danger" onclick="deleteTenant(' + t.id + ', \'' + escapeHtml(t.name).replace(/'/g, "\\'") + '\')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></td></tr>';
    }).join('') + '</tbody></table></div></div>'
    // Income table - full detail with actions
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
    // Expenses table - full detail with actions
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

  document.getElementById('page-title').textContent = prop.name;
  // Async: load property documents
  loadAndRenderPropertyDocs(propId);
}

// ===== TENANTS PAGE =====
function renderTenants(container) {
  container.innerHTML = ''
    + '<div class="filter-bar"><select id="tenant-filter-property"><option value="">All Properties</option>' + DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('') + '</select>'
    + '<select id="tenant-filter-status"><option value="">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>'
    + '<div class="table-card">'
    + '<div class="table-header"><h3>All Tenants</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openAddTenantModal()">+ Add Tenant</button></div></div>'
    + '<div class="table-wrapper"><table id="tenants-table"><thead><tr>'
    + '<th data-sort="name">Name <span class="sort-icon">&#8597;</span></th>'
    + '<th>Email</th><th>Phone</th>'
    + '<th data-sort="property_id">Property <span class="sort-icon">&#8597;</span></th>'
    + '<th>Unit</th>'
    + '<th data-sort="monthly_rent" class="text-right">Rent <span class="sort-icon">&#8597;</span></th>'
    + '<th>Lease</th>'
    + '<th data-sort="status">Status <span class="sort-icon">&#8597;</span></th>'
    + '<th>Actions</th>'
    + '</tr></thead><tbody id="tenants-tbody"></tbody></table></div></div>';
  // no change to structure needed, actions cell updated in fillTenantsTable

  fillTenantsTable();
  attachSorting('tenants-table', DATA.tenants, fillTenantsTable);
  document.getElementById('tenant-filter-property').addEventListener('change', fillTenantsTable);
  document.getElementById('tenant-filter-status').addEventListener('change', fillTenantsTable);
}

function fillTenantsTable() {
  var tbody = document.getElementById('tenants-tbody');
  if (!tbody) return;
  var propVal = document.getElementById('tenant-filter-property').value;
  var statusVal = document.getElementById('tenant-filter-status').value;

  var filtered = DATA.tenants.filter(function(t) {
    var pid = t.property_id || t.propertyId;
    if (propVal && pid !== parseInt(propVal)) return false;
    if (statusVal && t.status !== statusVal) return false;
    return true;
  });

  tbody.innerHTML = '';
  filtered.forEach(function(t) {
    var pid = t.property_id || t.propertyId;
    var rent = t.monthly_rent || t.monthlyRent || 0;
    tbody.innerHTML += '<tr>'
      + '<td><strong>' + escapeHtml(t.name) + '</strong></td>'
      + '<td>' + escapeHtml(t.email) + '</td>'
      + '<td>' + escapeHtml(t.phone) + '</td>'
      + '<td>' + escapeHtml(getPropertyName(pid)) + '</td>'
      + '<td>' + escapeHtml(t.unit) + '</td>'
      + '<td class="text-right amount">' + fmt(rent) + '</td>'
      + '<td>' + fmtDate(t.lease_start || t.leaseStart) + ' \u2013 ' + fmtDate(t.lease_end || t.leaseEnd) + '</td>'
      + '<td><span class="badge ' + badgeClass(t.status) + '">' + escapeHtml(t.status) + '</span></td>'
      + '<td class="actions-cell">'
      + '<button class="btn-icon" onclick="openTenantDocsModal(' + t.id + ', \'' + escapeHtml(t.name).replace(/'/g, "\\'") + '\')" title="Documents"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></button>'
      + '<button class="btn-icon" onclick="openEditTenantModal(' + t.id + ')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
      + '<button class="btn-icon btn-icon-danger" onclick="deleteTenant(' + t.id + ', \'' + escapeHtml(t.name).replace(/'/g, "\\'") + '\')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>'
      + '</td>'
      + '</tr>';
  });
}

// ===== INCOME PAGE =====
function renderIncome(container) {
  container.innerHTML = ''
    + renderQuickCollectPanel()
    + '<div class="filter-bar">'
    + '<select id="income-filter-property"><option value="">All Properties</option>' + DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('') + '</select>'
    + '<select id="income-filter-month"><option value="">All Months</option></select>'
    + '<select id="income-filter-status"><option value="">All Statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="late">Late</option></select>'
    + '</div>'
    + '<div id="income-summary"></div>'
    + '<div class="table-card">'
    + '<div class="table-header"><h3>Rent Payments</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openAddPaymentModal()">+ Record Payment</button><button class="btn btn-secondary btn-sm" onclick="exportIncomeCSV()">Export CSV</button></div></div>'
    + '<div class="table-wrapper"><table id="income-table"><thead><tr>'
    + '<th data-sort="date">Date <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="tenant_id">Tenant <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="property_id">Property <span class="sort-icon">&#8597;</span></th>'
    + '<th>Unit</th>'
    + '<th data-sort="amount" class="text-right">Amount <span class="sort-icon">&#8597;</span></th>'
    + '<th>Method</th>'
    + '<th data-sort="status">Status <span class="sort-icon">&#8597;</span></th>'
    + '<th>Notes</th>'
    + '<th>Actions</th>'
    + '</tr></thead><tbody id="income-tbody"></tbody></table></div></div>';

  // Populate month filter dynamically
  var monthSet = {};
  DATA.income.forEach(function(i) { monthSet[i.date.slice(0, 7)] = true; });
  var monthSelect = document.getElementById('income-filter-month');
  Object.keys(monthSet).sort().reverse().forEach(function(m) {
    var d = new Date(m + '-01');
    var label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    monthSelect.innerHTML += '<option value="' + m + '">' + label + '</option>';
  });

  fillIncomeTable();
  attachSorting('income-table', DATA.income, fillIncomeTable);
  document.getElementById('income-filter-property').addEventListener('change', fillIncomeTable);
  document.getElementById('income-filter-month').addEventListener('change', fillIncomeTable);
  document.getElementById('income-filter-status').addEventListener('change', fillIncomeTable);

  // Wire up Quick Collect panel
  initQuickCollect();
}

// ===== QUICK COLLECT HELPERS =====
function renderQuickCollectPanel() {
  var today = new Date().toISOString().slice(0, 10);
  var activeTenants = DATA.tenants.filter(function(t) { return t.status === 'active'; });

  if (activeTenants.length === 0) {
    return '<div class="quick-collect"><div class="quick-collect-header" onclick="toggleQuickCollect(this)"><span>&#9650; Quick Collect</span><span class="qc-toggle-icon">&#9650;</span></div></div>';
  }

  // Group tenants by property
  var groups = {};
  activeTenants.forEach(function(t) {
    var pid = t.property_id || t.propertyId;
    if (!groups[pid]) groups[pid] = [];
    groups[pid].push(t);
  });

  var currentMonth = today.slice(0, 7);

  // Build set of tenant IDs already paid this month
  var paidThisMonth = {};
  DATA.income.forEach(function(i) {
    if (i.date && i.date.startsWith(currentMonth) && i.status === 'paid') {
      var tid = i.tenant_id || i.tenantId;
      paidThisMonth[tid] = true;
    }
  });

  var tenantRows = '';
  var propIds = Object.keys(groups);
  propIds.forEach(function(pid) {
    var propName = getPropertyName(parseInt(pid));
    tenantRows += '<div class="qc-property-group"><div class="qc-property-label">' + escapeHtml(propName) + '</div>';
    groups[pid].forEach(function(t) {
      var rent = t.monthly_rent || t.monthlyRent || 0;
      var alreadyPaid = paidThisMonth[t.id] ? true : false;
      var rowClass = alreadyPaid ? 'qc-tenant-row collected' : 'qc-tenant-row';
      var btnOrCheck = alreadyPaid
        ? '<span class="qc-check">&#10003; Collected</span>'
        : '<button class="btn btn-primary btn-sm qc-collect-btn" data-tid="' + t.id + '" data-rent="' + rent + '">Collect</button>';
      tenantRows += '<div class="' + rowClass + '" id="qc-row-' + t.id + '">'
        + '<span class="qc-tenant-name">' + escapeHtml(t.name) + '</span>'
        + '<span class="qc-unit">Unit ' + escapeHtml(t.unit) + '</span>'
        + '<span class="qc-rent">' + fmt(rent) + '</span>'
        + btnOrCheck
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
  var rent = parseFloat(btn.getAttribute('data-rent')) || 0;
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
        amount: rent,
        method: method,
        status: 'paid',
        notes: ''
      })
    });

    // Mark row as collected
    var row = document.getElementById('qc-row-' + tid);
    if (row) {
      row.className = 'qc-tenant-row collected';
      var btnEl = row.querySelector('.qc-collect-btn');
      if (btnEl) {
        var check = document.createElement('span');
        check.className = 'qc-check';
        check.innerHTML = '&#10003; Collected';
        btnEl.parentNode.replaceChild(check, btnEl);
      }
    }

    // Refresh data and income table (but not full page re-render to keep QC state)
    await loadAllData();
    fillIncomeTable();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Collect';
    alert('Failed to record payment: ' + (err.message || 'Unknown error'));
  }
}

function fillIncomeTable() {
  var tbody = document.getElementById('income-tbody');
  var summaryDiv = document.getElementById('income-summary');
  if (!tbody) return;

  var propVal = document.getElementById('income-filter-property').value;
  var monthVal = document.getElementById('income-filter-month').value;
  var statusVal = document.getElementById('income-filter-status').value;

  var filtered = DATA.income.filter(function(i) {
    var pid = i.property_id || i.propertyId;
    if (propVal && pid !== parseInt(propVal)) return false;
    if (monthVal && !i.date.startsWith(monthVal)) return false;
    if (statusVal && i.status !== statusVal) return false;
    return true;
  });

  var totalAmt = filtered.reduce(function(s, i) { return s + i.amount; }, 0);
  var paidAmt = filtered.filter(function(i) { return i.status === 'paid'; }).reduce(function(s, i) { return s + i.amount; }, 0);
  var pendingAmt = filtered.filter(function(i) { return i.status === 'pending'; }).reduce(function(s, i) { return s + i.amount; }, 0);
  var lateAmt = filtered.filter(function(i) { return i.status === 'late'; }).reduce(function(s, i) { return s + i.amount; }, 0);

  summaryDiv.innerHTML = '<div class="summary-bar">'
    + '<div class="summary-item"><span class="summary-label">Total</span><span class="summary-value">' + fmt(totalAmt) + '</span></div>'
    + '<div class="summary-item"><span class="summary-label">Paid</span><span class="summary-value" style="color:var(--color-success)">' + fmt(paidAmt) + '</span></div>'
    + '<div class="summary-item"><span class="summary-label">Pending</span><span class="summary-value" style="color:var(--color-warning)">' + fmt(pendingAmt) + '</span></div>'
    + '<div class="summary-item"><span class="summary-label">Late</span><span class="summary-value" style="color:var(--color-error)">' + fmt(lateAmt) + '</span></div>'
    + '</div>';

  tbody.innerHTML = '';
  filtered.forEach(function(i) {
    var tid = i.tenant_id || i.tenantId;
    var pid = i.property_id || i.propertyId;
    var tenant = DATA.tenants.find(function(t) { return t.id === tid; });
    var unit = tenant ? tenant.unit : '\u2014';
    tbody.innerHTML += '<tr>'
      + '<td>' + fmtDate(i.date) + '</td>'
      + '<td>' + escapeHtml(getTenantName(tid)) + '</td>'
      + '<td>' + escapeHtml(getPropertyName(pid)) + '</td>'
      + '<td>' + escapeHtml(unit) + '</td>'
      + '<td class="text-right amount">' + fmt(i.amount) + '</td>'
      + '<td>' + escapeHtml(i.method) + '</td>'
      + '<td><span class="badge ' + badgeClass(i.status) + '">' + escapeHtml(i.status) + '</span></td>'
      + '<td class="truncate">' + escapeHtml(i.notes) + '</td>'
      + '<td class="actions-cell"><button class="btn-icon" onclick="openEditIncomeModal(' + i.id + ')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
      + '<button class="btn-icon btn-icon-danger" onclick="deleteIncome(' + i.id + ')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></td>'
      + '</tr>';
  });
}

function exportIncomeCSV() {
  var headers = ['Date', 'Tenant', 'Property', 'Unit', 'Amount', 'Method', 'Status', 'Notes'];
  var rows = DATA.income.map(function(i) {
    var tid = i.tenant_id || i.tenantId;
    var pid = i.property_id || i.propertyId;
    var tenant = DATA.tenants.find(function(t) { return t.id === tid; });
    return [i.date, getTenantName(tid), getPropertyName(pid), tenant ? tenant.unit : '', i.amount, i.method, i.status, i.notes];
  });
  exportCSV('propflow-income.csv', headers, rows);
}

// ===== EXPENSES PAGE =====
function renderExpenses(container) {
  var categories = ['maintenance', 'repairs', 'insurance', 'taxes', 'utilities', 'mortgage', 'management fees', 'other'];
  var today = new Date().toISOString().slice(0, 10);

  var catOptions = categories.map(function(c) { return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('');
  var propOptions = '<option value="">Property...</option>' + DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('');

  container.innerHTML = ''
    + '<div class="filter-bar">'
    + '<select id="expense-filter-property"><option value="">All Properties</option>' + DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('') + '</select>'
    + '<select id="expense-filter-category"><option value="">All Categories</option>' + categories.map(function(c) { return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('') + '</select>'
    + '<select id="expense-filter-month"><option value="">All Months</option></select>'
    + '</div>'
    + '<div class="inline-add-bar" id="inline-expense-bar">'
    + '<select id="iab-property">' + propOptions + '</select>'
    + '<input type="date" id="iab-date" value="' + today + '">'
    + '<select id="iab-category">' + catOptions + '</select>'
    + '<input type="text" id="iab-description" placeholder="Description" class="iab-grow">'
    + '<input type="number" id="iab-amount" placeholder="Amount" min="0" step="10" class="iab-amount">'
    + '<input type="text" id="iab-vendor" placeholder="Vendor" class="iab-vendor">'
    + '<button class="btn btn-primary btn-sm" id="iab-add-btn">Add</button>'
    + '</div>'
    + '<div id="expense-summary"></div>'
    + '<div class="table-card">'
    + '<div class="table-header"><h3>All Expenses</h3><div class="table-actions"><button class="btn btn-primary btn-sm" onclick="openAddExpenseModal()">+ Add Expense</button><button class="btn btn-secondary btn-sm" onclick="openBulkExpenseModal()">+ Bulk Entry</button><button class="btn btn-secondary btn-sm" onclick="exportExpenseCSV()">Export CSV</button></div></div>'
    + '<div class="table-wrapper"><table id="expenses-table"><thead><tr>'
    + '<th data-sort="date">Date <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="property_id">Property <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="category">Category <span class="sort-icon">&#8597;</span></th>'
    + '<th>Description</th>'
    + '<th data-sort="amount" class="text-right">Amount <span class="sort-icon">&#8597;</span></th>'
    + '<th data-sort="vendor">Vendor <span class="sort-icon">&#8597;</span></th>'
    + '<th>Notes</th>'
    + '<th>Receipt</th>'
    + '<th>Actions</th>'
    + '</tr></thead><tbody id="expenses-tbody"></tbody></table></div></div>';

  // Populate month filter
  var monthSet = {};
  DATA.expenses.forEach(function(e) { monthSet[e.date.slice(0, 7)] = true; });
  var monthSelect = document.getElementById('expense-filter-month');
  Object.keys(monthSet).sort().reverse().forEach(function(m) {
    var d = new Date(m + '-01');
    var label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    monthSelect.innerHTML += '<option value="' + m + '">' + label + '</option>';
  });

  fillExpensesTable();
  attachSorting('expenses-table', DATA.expenses, fillExpensesTable);
  document.getElementById('expense-filter-property').addEventListener('change', fillExpensesTable);
  document.getElementById('expense-filter-category').addEventListener('change', fillExpensesTable);
  document.getElementById('expense-filter-month').addEventListener('change', fillExpensesTable);

  // Wire up inline add bar
  document.getElementById('iab-add-btn').addEventListener('click', submitInlineExpense);
  document.getElementById('iab-vendor').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') submitInlineExpense();
  });
  document.getElementById('iab-amount').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') submitInlineExpense();
  });
}

async function submitInlineExpense() {
  var propId = parseInt(document.getElementById('iab-property').value);
  var date = document.getElementById('iab-date').value;
  var category = document.getElementById('iab-category').value;
  var description = document.getElementById('iab-description').value.trim();
  var amount = parseFloat(document.getElementById('iab-amount').value) || 0;
  var vendor = document.getElementById('iab-vendor').value.trim();

  if (!propId) { document.getElementById('iab-property').focus(); return; }
  if (!description) { document.getElementById('iab-description').focus(); return; }
  if (!amount || amount <= 0) { document.getElementById('iab-amount').focus(); return; }

  var btn = document.getElementById('iab-add-btn');
  btn.disabled = true;
  btn.textContent = '...';

  try {
    await api('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: propId,
        date: date,
        category: category,
        description: description,
        amount: amount,
        vendor: vendor,
        notes: ''
      })
    });

    // Clear inputs
    document.getElementById('iab-description').value = '';
    document.getElementById('iab-amount').value = '';
    document.getElementById('iab-vendor').value = '';
    document.getElementById('iab-description').focus();

    // Refresh data and table
    await loadAllData();
    fillExpensesTable();

    btn.textContent = 'Added!';
    btn.style.background = 'var(--color-success)';
    setTimeout(function() {
      btn.textContent = 'Add';
      btn.style.background = '';
      btn.disabled = false;
    }, 1200);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Add';
    alert('Failed to add expense: ' + (err.message || 'Unknown error'));
  }
}

function fillExpensesTable() {
  var tbody = document.getElementById('expenses-tbody');
  var summaryDiv = document.getElementById('expense-summary');
  if (!tbody) return;

  var propVal = document.getElementById('expense-filter-property').value;
  var catVal = document.getElementById('expense-filter-category').value;
  var monthVal = document.getElementById('expense-filter-month').value;

  var filtered = DATA.expenses.filter(function(e) {
    var pid = e.property_id || e.propertyId;
    if (propVal && pid !== parseInt(propVal)) return false;
    if (catVal && e.category !== catVal) return false;
    if (monthVal && !e.date.startsWith(monthVal)) return false;
    return true;
  });

  var totalAmt = filtered.reduce(function(s, e) { return s + e.amount; }, 0);

  summaryDiv.innerHTML = '<div class="summary-bar">'
    + '<div class="summary-item"><span class="summary-label">Total Expenses</span><span class="summary-value">' + fmt(totalAmt) + '</span></div>'
    + '<div class="summary-item"><span class="summary-label">Records</span><span class="summary-value">' + filtered.length + '</span></div>'
    + '</div>';

  tbody.innerHTML = '';
  filtered.forEach(function(e) {
    var pid = e.property_id || e.propertyId;
    var receiptCell = e.receipt_path
      ? '<td class="text-center"><a href="/' + escapeHtml(e.receipt_path) + '" target="_blank" title="View receipt" class="receipt-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></a></td>'
      : '<td></td>';
    tbody.innerHTML += '<tr>'
      + '<td>' + fmtDate(e.date) + '</td>'
      + '<td>' + escapeHtml(getPropertyName(pid)) + '</td>'
      + '<td><span class="badge badge-primary">' + escapeHtml(e.category) + '</span></td>'
      + '<td>' + escapeHtml(e.description) + '</td>'
      + '<td class="text-right amount">' + fmt(e.amount) + '</td>'
      + '<td>' + escapeHtml(e.vendor) + '</td>'
      + '<td class="truncate">' + escapeHtml(e.notes) + '</td>'
      + receiptCell
      + '<td class="actions-cell"><button class="btn-icon" onclick="openEditExpenseModal(' + e.id + ')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
      + '<button class="btn-icon btn-icon-danger" onclick="deleteExpense(' + e.id + ')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></td>'
      + '</tr>';
  });
}

function exportExpenseCSV() {
  var headers = ['Date', 'Property', 'Category', 'Description', 'Amount', 'Vendor', 'Notes'];
  var rows = DATA.expenses.map(function(e) {
    return [e.date, getPropertyName(e.property_id || e.propertyId), e.category, e.description, e.amount, e.vendor, e.notes];
  });
  exportCSV('propflow-expenses.csv', headers, rows);
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
    + '<div class="table-header"><h3>Property P&L Summary</h3><div class="table-actions"><button class="btn btn-secondary btn-sm" onclick="exportPnlCSV()">Export CSV</button></div></div>'
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

// ===== MODAL FORMS =====

function propertyOptions() {
  return DATA.properties.map(function(p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('');
}

function tenantOptions() {
  return DATA.tenants.filter(function(t) { return t.status === 'active'; }).map(function(t) { return '<option value="' + t.id + '">' + escapeHtml(t.name) + ' (' + escapeHtml(getPropertyName(t.property_id || t.propertyId)) + ')</option>'; }).join('');
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
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fp-notes">' + escapeHtml(p.notes) + '</textarea></div>'
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

async function deleteProperty(id, name) {
  if (!confirm('Delete property "' + name + '"? This will also remove all tenants, payments, and expenses for this property.')) return;
  await api('/api/properties/' + id, { method: 'DELETE' });
  renderPage('properties');
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

function openAddPaymentModal() {
  var html = '<form id="add-payment-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Tenant</label><select id="fi-tenant" required>' + tenantOptions() + '</select></div>'
    + '<div class="form-group"><label>Date</label><input type="date" id="fi-date" value="' + new Date().toISOString().slice(0, 10) + '" required></div>'
    + '<div class="form-group"><label>Amount</label><input type="number" id="fi-amount" min="0" step="50" required><span class="rent-hint" id="fi-rent-hint"></span></div>'
    + '<div class="form-group"><label>Method</label><select id="fi-method"><option value="bank transfer" selected>Bank Transfer</option><option value="check">Check</option><option value="cash">Cash</option><option value="online">Online</option></select></div>'
    + '<div class="form-group"><label>Status</label><select id="fi-status"><option value="paid" selected>Paid</option><option value="pending">Pending</option><option value="late">Late</option></select></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fi-notes"></textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Record Payment</button></div>'
    + '</form>';
  openModal('Record Payment', html);

  var tenantSelect = document.getElementById('fi-tenant');
  var amountInput = document.getElementById('fi-amount');
  var rentHint = document.getElementById('fi-rent-hint');
  function fillAmount() {
    var t = DATA.tenants.find(function(x) { return x.id === parseInt(tenantSelect.value); });
    if (t) {
      var rent = t.monthly_rent || t.monthlyRent || 0;
      amountInput.value = rent;
      if (rentHint) rentHint.textContent = rent > 0 ? 'Monthly rent: ' + fmt(rent) : '';
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
        notes: document.getElementById('fi-notes').value
      })
    });
    closeModal();
    renderPage(currentPage);
  });
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

// ===== EDIT TENANT MODAL =====
function openEditTenantModal(tenantId) {
  var t = DATA.tenants.find(function(x) { return x.id === tenantId; });
  if (!t) return;
  var pid = t.property_id || t.propertyId;
  var rent = t.monthly_rent || t.monthlyRent || 0;
  var leaseStart = t.lease_start || t.leaseStart || '';
  var leaseEnd = t.lease_end || t.leaseEnd || '';
  var html = '<form id="edit-tenant-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Full Name</label><input type="text" id="ft-name" value="' + escapeHtml(t.name) + '" required></div>'
    + '<div class="form-group"><label>Email</label><input type="email" id="ft-email" value="' + escapeHtml(t.email) + '"></div>'
    + '<div class="form-group"><label>Phone</label><input type="tel" id="ft-phone" value="' + escapeHtml(t.phone) + '"></div>'
    + '<div class="form-group"><label>Property</label><select id="ft-property" required>' + DATA.properties.map(function(p) { return '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>'; }).join('') + '</select></div>'
    + '<div class="form-group"><label>Unit</label><input type="text" id="ft-unit" value="' + escapeHtml(t.unit) + '" required></div>'
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

async function deleteTenant(id, name) {
  if (!confirm('Delete tenant "' + name + '"? This will also remove all their payment records.')) return;
  await api('/api/tenants/' + id, { method: 'DELETE' });
  renderPage(currentPage);
}

// ===== EDIT INCOME MODAL =====
function openEditIncomeModal(incomeId) {
  var rec = DATA.income.find(function(x) { return x.id === incomeId; });
  if (!rec) return;
  var tid = rec.tenant_id || rec.tenantId;
  var html = '<form id="edit-income-form" class="form-grid">'
    + '<div class="form-group full-width"><label>Tenant</label><select id="fi-tenant" required>' + tenantOptions().replace('value="' + tid + '"', 'value="' + tid + '" selected') + '</select></div>'
    + '<div class="form-group"><label>Date</label><input type="date" id="fi-date" value="' + rec.date + '" required></div>'
    + '<div class="form-group"><label>Amount</label><input type="number" id="fi-amount" min="0" step="50" value="' + rec.amount + '" required></div>'
    + '<div class="form-group"><label>Method</label><select id="fi-method"><option value="bank transfer"' + (rec.method === 'bank transfer' ? ' selected' : '') + '>Bank Transfer</option><option value="check"' + (rec.method === 'check' ? ' selected' : '') + '>Check</option><option value="cash"' + (rec.method === 'cash' ? ' selected' : '') + '>Cash</option><option value="online"' + (rec.method === 'online' ? ' selected' : '') + '>Online</option></select></div>'
    + '<div class="form-group"><label>Status</label><select id="fi-status"><option value="paid"' + (rec.status === 'paid' ? ' selected' : '') + '>Paid</option><option value="pending"' + (rec.status === 'pending' ? ' selected' : '') + '>Pending</option><option value="late"' + (rec.status === 'late' ? ' selected' : '') + '>Late</option></select></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fi-notes">' + escapeHtml(rec.notes || '') + '</textarea></div>'
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>'
    + '</form>';
  openModal('Edit Payment', html);
  document.getElementById('edit-income-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var newTid = parseInt(document.getElementById('fi-tenant').value);
    var tenant = DATA.tenants.find(function(t) { return t.id === newTid; });
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
        notes: document.getElementById('fi-notes').value
      })
    });
    closeModal();
    renderPage(currentPage);
  });
}

async function deleteIncome(id) {
  if (!confirm('Delete this payment record?')) return;
  await api('/api/income/' + id, { method: 'DELETE' });
  renderPage(currentPage);
}

// ===== EDIT EXPENSE MODAL =====
function openEditExpenseModal(expenseId) {
  var rec = DATA.expenses.find(function(x) { return x.id === expenseId; });
  if (!rec) return;
  var pid = rec.property_id || rec.propertyId;
  var categories = ['maintenance', 'repairs', 'insurance', 'taxes', 'utilities', 'mortgage', 'management fees', 'other'];

  var receiptSection;
  if (rec.receipt_path) {
    var fname = rec.receipt_path.split('/').pop();
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
    + '<div class="form-group full-width"><label>Description</label><input type="text" id="fe-description" value="' + escapeHtml(rec.description) + '" required></div>'
    + '<div class="form-group"><label>Vendor</label><input type="text" id="fe-vendor" value="' + escapeHtml(rec.vendor || '') + '"></div>'
    + '<div class="form-group full-width"><label>Notes</label><textarea id="fe-notes">' + escapeHtml(rec.notes || '') + '</textarea></div>'
    + receiptSection
    + '<div class="form-actions full-width"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>'
    + '</form>';
  openModal('Edit Expense', html);

  // Remove receipt handler
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
    // Upload receipt if file selected
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

async function deleteExpense(id) {
  if (!confirm('Delete this expense record?')) return;
  await api('/api/expenses/' + id, { method: 'DELETE' });
  renderPage(currentPage);
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

function fmtFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderDocTable(docs, onDelete) {
  if (!docs || docs.length === 0) {
    return '<div class="doc-empty" style="padding:var(--space-4) var(--space-5);color:var(--color-text-muted);font-size:var(--text-sm)">No documents uploaded yet.</div>';
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
  // Store propId on container for refresh
  container.setAttribute('data-propid', propId);
}

async function deletePropertyDoc(docId) {
  if (!confirm('Delete this document?')) return;
  await deleteDocument(docId);
  // Find any prop-docs container and reload
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
  openModal('Documents — ' + tenantName, '<div id="tenant-docs-modal-body"><p style="padding:var(--space-3);color:var(--color-text-muted)">Loading...</p></div>');
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
  // Store tenantId for delete refresh
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
      // Refresh modal content
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

  var html = '<div>'
    + '<div class="form-group" style="margin-bottom:var(--space-4)">'
    + '<label style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em">Property (applies to all rows)</label>'
    + '<select id="be-property" style="margin-top:var(--space-1);padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-md);font-size:var(--text-sm);background:var(--color-bg);color:var(--color-text);min-width:260px">' + propertyOptions() + '</select>'
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

  // Set modal to wide mode
  var modal = document.getElementById('modal');
  modal.classList.add('modal-wide');
  openModal('Bulk Expense Entry', html);

  // Add row
  var rowCount = 5;
  document.getElementById('bulk-add-row').addEventListener('click', function() {
    var tbody = document.getElementById('bulk-tbody');
    var tmp = document.createElement('tbody');
    tmp.innerHTML = makeRow(rowCount++);
    var newRow = tmp.firstChild;
    if (newRow) tbody.appendChild(newRow);
  });

  // Remove wide class when modal closes
  document.getElementById('modal-close').addEventListener('click', function() {
    modal.classList.remove('modal-wide');
  }, { once: true });
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) modal.classList.remove('modal-wide');
  }, { once: true });

  // Save all
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
      var btn = document.getElementById('bulk-save-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      var result = await api('/api/expenses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: expenses })
      });
      modal.classList.remove('modal-wide');
      closeModal();
      renderPage(currentPage);
    } catch(err) {
      alert('Save failed: ' + err.message);
      var btn2 = document.getElementById('bulk-save-btn');
      if (btn2) { btn2.disabled = false; btn2.textContent = 'Save All'; }
    }
  });
}

// ===== INIT =====
(async function init() {
  // Load user info
  try {
    var userData = await api('/auth/me');
    if (userData && userData.user) {
      document.getElementById('user-name').textContent = userData.user.name;
      var initials = userData.user.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
      document.getElementById('user-avatar').textContent = initials;
    }
  } catch (e) { /* ignore */ }

  var hash = location.hash.replace('#', '') || 'dashboard';
  currentPage = hash;
  await renderPage(hash);
  updateNav(hash);
})();
