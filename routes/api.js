const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads (receipts + documents)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'doc-' + Date.now() + '-' + Math.round(Math.random() * 1000) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

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
  const { tenant_id, property_id, date, amount, method, status, notes, method2, amount2 } = req.body;
  if (!tenant_id || !property_id || !date || !amount) {
    return res.status(400).json({ error: 'Required: tenant_id, property_id, date, amount' });
  }
  const result = db.prepare(
    'INSERT INTO income (tenant_id, property_id, date, amount, method, status, notes, method2, amount2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(tenant_id, property_id, date, amount, method || 'bank transfer', status || 'paid', notes || '', method2 || '', amount2 || 0);
  const row = db.prepare('SELECT * FROM income WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

router.put('/income/:id', (req, res) => {
  const { tenant_id, property_id, date, amount, method, status, notes, method2, amount2 } = req.body;
  db.prepare(
    'UPDATE income SET tenant_id=?, property_id=?, date=?, amount=?, method=?, status=?, notes=?, method2=?, amount2=? WHERE id=?'
  ).run(tenant_id, property_id, date, amount, method, status, notes || '', method2 || '', amount2 || 0, req.params.id);
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

// Bulk expense creation (spreadsheet-style)
router.post('/expenses/bulk', (req, res) => {
  const { expenses } = req.body;
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ error: 'Provide an array of expenses' });
  }
  const insert = db.prepare(
    'INSERT INTO expenses (property_id, date, category, description, amount, vendor, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const results = [];
  const insertMany = db.transaction((items) => {
    for (const e of items) {
      if (!e.property_id || !e.date || !e.category || !e.description || !e.amount) continue;
      const r = insert.run(e.property_id, e.date, e.category, e.description, e.amount, e.vendor || '', e.notes || '');
      results.push(r.lastInsertRowid);
    }
  });
  insertMany(expenses);
  const rows = results.map(id => db.prepare('SELECT * FROM expenses WHERE id = ?').get(id)).filter(Boolean);
  res.json({ inserted: rows.length, expenses: rows });
});

router.put('/expenses/:id', (req, res) => {
  const { property_id, date, category, description, amount, vendor, notes } = req.body;
  db.prepare(
    'UPDATE expenses SET property_id=?, date=?, category=?, description=?, amount=?, vendor=?, notes=? WHERE id=?'
  ).run(property_id, date, category, description, amount, vendor || '', notes || '', req.params.id);
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  res.json(row);
});

// Upload receipt for an expense
router.post('/expenses/:id/receipt', upload.single('receipt'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!expense) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Expense not found' });
  }
  // Delete old receipt if exists
  if (expense.receipt_path) {
    const oldPath = path.join(__dirname, '..', expense.receipt_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const receiptPath = 'uploads/' + req.file.filename;
  db.prepare('UPDATE expenses SET receipt_path = ? WHERE id = ?').run(receiptPath, req.params.id);
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  res.json(row);
});

// Delete receipt from an expense
router.delete('/expenses/:id/receipt', (req, res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  if (expense.receipt_path) {
    const filePath = path.join(__dirname, '..', expense.receipt_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare("UPDATE expenses SET receipt_path = '' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.delete('/expenses/:id', (req, res) => {
  // Delete associated receipt file
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (expense && expense.receipt_path) {
    const filePath = path.join(__dirname, '..', expense.receipt_path);
    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch(e) {}
  }
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== MAINTENANCE =====
router.get('/maintenance', (req, res) => {
  const { property_id, status, priority } = req.query;
  let sql = 'SELECT * FROM maintenance WHERE 1=1';
  const params = [];
  if (property_id) { sql += ' AND property_id = ?'; params.push(property_id); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (priority) { sql += ' AND priority = ?'; params.push(priority); }
  sql += ' ORDER BY date_reported DESC, id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/maintenance', (req, res) => {
  const { property_id, tenant_id, title, description, category, priority, status, assigned_to, cost, date_reported, date_completed, notes } = req.body;
  if (!property_id || !title || !date_reported) {
    return res.status(400).json({ error: 'Required: property_id, title, date_reported' });
  }
  const result = db.prepare(
    'INSERT INTO maintenance (property_id, tenant_id, title, description, category, priority, status, assigned_to, cost, date_reported, date_completed, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(property_id, tenant_id || null, title, description || '', category || 'general', priority || 'medium', status || 'open', assigned_to || '', cost || 0, date_reported, date_completed || '', notes || '');
  const row = db.prepare('SELECT * FROM maintenance WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

router.put('/maintenance/:id', (req, res) => {
  const { property_id, tenant_id, title, description, category, priority, status, assigned_to, cost, date_reported, date_completed, notes } = req.body;
  db.prepare(
    'UPDATE maintenance SET property_id=?, tenant_id=?, title=?, description=?, category=?, priority=?, status=?, assigned_to=?, cost=?, date_reported=?, date_completed=?, notes=? WHERE id=?'
  ).run(property_id, tenant_id || null, title, description || '', category || 'general', priority || 'medium', status || 'open', assigned_to || '', cost || 0, date_reported, date_completed || '', notes || '', req.params.id);
  const row = db.prepare('SELECT * FROM maintenance WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/maintenance/:id', (req, res) => {
  db.prepare('DELETE FROM maintenance WHERE id = ?').run(req.params.id);
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

  // Maintenance KPIs
  const openWorkOrders = db.prepare("SELECT COUNT(*) as count FROM maintenance WHERE status IN ('open', 'in-progress')").get().count;

  // Lease alerts: active tenants with lease_end within 60 days
  const nowTs = now.getTime();
  const allActiveTenants = db.prepare("SELECT * FROM tenants WHERE status = 'active'").all();
  const leasesExpiringSoon = allActiveTenants.filter(t => {
    if (!t.lease_end) return false;
    const endDate = new Date(t.lease_end + 'T00:00:00');
    const daysLeft = Math.ceil((endDate.getTime() - nowTs) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= 60;
  }).length;

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
    chartData,
    openWorkOrders,
    leasesExpiringSoon
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

// ===== DOCUMENTS =====
router.get('/documents', (req, res) => {
  const { entity_type, entity_id } = req.query;
  if (!entity_type || !entity_id) {
    return res.status(400).json({ error: 'Required: entity_type, entity_id' });
  }
  const rows = db.prepare(
    'SELECT * FROM documents WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC'
  ).all(entity_type, parseInt(entity_id));
  res.json(rows);
});

router.post('/documents', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { entity_type, entity_id, name } = req.body;
  if (!entity_type || !entity_id || !name) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Required: entity_type, entity_id, name' });
  }
  const filePath = 'uploads/' + req.file.filename;
  const fileType = path.extname(req.file.originalname).toLowerCase().slice(1);
  const fileSize = req.file.size;
  const result = db.prepare(
    'INSERT INTO documents (entity_type, entity_id, name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(entity_type, parseInt(entity_id), name, filePath, fileType, fileSize, req.user ? req.user.email : '');
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

router.delete('/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.file_path) {
    const filePath = path.join(__dirname, '..', doc.file_path);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch(e) {}
    }
  }
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/documents/:id/download', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const filePath = path.join(__dirname, '..', doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
  res.download(filePath, doc.name + '.' + (doc.file_type || 'bin'));
});

module.exports = router;
