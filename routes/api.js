const express = require('express');
const { db } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ===== PROPERTIES =====
router.get('/properties', (req, res) => {
  const rows = db.prepare('SELECT * FROM properties ORDER BY name').all();
  res.json(rows);
});

router.get('/properties/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Property not found' });
  res.json(row);
});

router.post('/properties', (req, res) => {
  const { name, address, city, state, zip, type, units, notes } = req.body;
  if (!name || !address || !city || !state || !zip) {
    return res.status(400).json({ error: 'Required fields: name, address, city, state, zip' });
  }
  const result = db.prepare(
    'INSERT INTO properties (name, address, city, state, zip, type, units, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, address, city, state.toUpperCase(), zip, type || 'multi-family', units || 1, notes || '');
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

router.put('/properties/:id', (req, res) => {
  const { name, address, city, state, zip, type, units, notes } = req.body;
  db.prepare(
    'UPDATE properties SET name=?, address=?, city=?, state=?, zip=?, type=?, units=?, notes=? WHERE id=?'
  ).run(name, address, city, state.toUpperCase(), zip, type, units, notes || '', req.params.id);
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/properties/:id', (req, res) => {
  const id = req.params.id;
  // Cascade delete: remove income for tenants of this property, then tenants, then expenses, then property
  db.prepare('DELETE FROM income WHERE property_id = ?').run(id);
  db.prepare('DELETE FROM expenses WHERE property_id = ?').run(id);
  db.prepare('DELETE FROM tenants WHERE property_id = ?').run(id);
  db.prepare('DELETE FROM properties WHERE id = ?').run(id);
  res.json({ success: true });
});

// ===== TENANTS =====
router.get('/tenants', (req, res) => {
  const { property_id, status } = req.query;
  let sql = 'SELECT * FROM tenants WHERE 1=1';
  const params = [];
  if (property_id) { sql += ' AND property_id = ?'; params.push(property_id); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/tenants/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Tenant not found' });
  res.json(row);
});

router.post('/tenants', (req, res) => {
  const { property_id, unit, name, email, phone, lease_start, lease_end, monthly_rent, status, notes } = req.body;
  if (!property_id || !unit || !name || !lease_start || !lease_end) {
    return res.status(400).json({ error: 'Required: property_id, unit, name, lease_start, lease_end' });
  }
  const result = db.prepare(
    'INSERT INTO tenants (property_id, unit, name, email, phone, lease_start, lease_end, monthly_rent, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(property_id, unit, name, email || '', phone || '', lease_start, lease_end, monthly_rent || 0, status || 'active', notes || '');
  const row = db.prepare('SELECT * FROM tenants WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

router.put('/tenants/:id', (req, res) => {
  const { property_id, unit, name, email, phone, lease_start, lease_end, monthly_rent, status, notes } = req.body;
  db.prepare(
    'UPDATE tenants SET property_id=?, unit=?, name=?, email=?, phone=?, lease_start=?, lease_end=?, monthly_rent=?, status=?, notes=? WHERE id=?'
  ).run(property_id, unit, name, email || '', phone || '', lease_start, lease_end, monthly_rent, status, notes || '', req.params.id);
  const row = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/tenants/:id', (req, res) => {
  db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== INCOME =====
router.get('/income', (req, res) => {
  const { property_id, month, status } = req.query;
  let sql = 'SELECT * FROM income WHERE 1=1';
  const params = [];
  if (property_id) { sql += ' AND property_id = ?'; params.push(property_id); }
  if (month) { sql += ' AND date LIKE ?'; params.push(month + '%'); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY date DESC, id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/income', (req, res) => {
  const { tenant_id, property_id, date, amount, method, status, notes } = req.body;
  if (!tenant_id || !property_id || !date || !amount) {
    return res.status(400).json({ error: 'Required: tenant_id, property_id, date, amount' });
  }
  const result = db.prepare(
    'INSERT INTO income (tenant_id, property_id, date, amount, method, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(tenant_id, property_id, date, amount, method || 'bank transfer', status || 'paid', notes || '');
  const row = db.prepare('SELECT * FROM income WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

router.put('/income/:id', (req, res) => {
  const { tenant_id, property_id, date, amount, method, status, notes } = req.body;
  db.prepare(
    'UPDATE income SET tenant_id=?, property_id=?, date=?, amount=?, method=?, status=?, notes=? WHERE id=?'
  ).run(tenant_id, property_id, date, amount, method, status, notes || '', req.params.id);
  const row = db.prepare('SELECT * FROM income WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/income/:id', (req, res) => {
  db.prepare('DELETE FROM income WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== EXPENSES =====
router.get('/expenses', (req, res) => {
  const { property_id, category, month } = req.query;
  let sql = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];
  if (property_id) { sql += ' AND property_id = ?'; params.push(property_id); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (month) { sql += ' AND date LIKE ?'; params.push(month + '%'); }
  sql += ' ORDER BY date DESC, id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/expenses', (req, res) => {
  const { property_id, date, category, description, amount, vendor, notes } = req.body;
  if (!property_id || !date || !category || !description || !amount) {
    return res.status(400).json({ error: 'Required: property_id, date, category, description, amount' });
  }
  const result = db.prepare(
    'INSERT INTO expenses (property_id, date, category, description, amount, vendor, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(property_id, date, category, description, amount, vendor || '', notes || '');
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

router.put('/expenses/:id', (req, res) => {
  const { property_id, date, category, description, amount, vendor, notes } = req.body;
  db.prepare(
    'UPDATE expenses SET property_id=?, date=?, category=?, description=?, amount=?, vendor=?, notes=? WHERE id=?'
  ).run(property_id, date, category, description, amount, vendor || '', notes || '', req.params.id);
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/expenses/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== DASHBOARD STATS =====
router.get('/dashboard', (req, res) => {
  const totalProps = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
  const totalUnits = db.prepare('SELECT COALESCE(SUM(units), 0) as total FROM properties').get().total;
  const activeTenants = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'").get().count;

  // Current month stats
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const monthIncome = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE date LIKE ?').get(currentMonth + '%').total;
  const monthExpenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date LIKE ?').get(currentMonth + '%').total;

  // Recent transactions
  const recentIncome = db.prepare('SELECT * FROM income ORDER BY date DESC, id DESC LIMIT 10').all();

  // Monthly chart data (last 6 months)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  const chartData = months.map(m => {
    const inc = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE date LIKE ?').get(m + '%').total;
    const exp = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date LIKE ?').get(m + '%').total;
    const label = new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return { month: m, label, income: inc, expenses: exp };
  });

  res.json({
    totalProperties: totalProps,
    totalUnits,
    activeTenants,
    occupancyRate: totalUnits > 0 ? Math.round((activeTenants / totalUnits) * 100) : 0,
    monthlyIncome: monthIncome,
    monthlyExpenses: monthExpenses,
    netIncome: monthIncome - monthExpenses,
    currentMonth,
    recentTransactions: recentIncome,
    chartData
  });
});

// ===== REPORTS =====
router.get('/reports/pnl', (req, res) => {
  const properties = db.prepare('SELECT * FROM properties ORDER BY name').all();
  const pnl = properties.map(p => {
    const totalIncome = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE property_id = ?').get(p.id).total;
    const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE property_id = ?').get(p.id).total;
    return {
      property: p.name,
      propertyId: p.id,
      income: totalIncome,
      expenses: totalExpenses,
      net: totalIncome - totalExpenses,
      margin: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0
    };
  });
  res.json(pnl);
});

router.get('/reports/expense-categories', (req, res) => {
  const rows = db.prepare(
    'SELECT category, SUM(amount) as total FROM expenses GROUP BY category ORDER BY total DESC'
  ).all();
  res.json(rows);
});

module.exports = router;
