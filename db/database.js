const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'propflow.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'multi-family',
      units INTEGER NOT NULL DEFAULT 1,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      unit TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      lease_start TEXT NOT NULL,
      lease_end TEXT NOT NULL,
      monthly_rent REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'bank transfer',
      status TEXT NOT NULL DEFAULT 'paid',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      vendor TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      receipt_path TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tenants_property ON tenants(property_id);
    CREATE INDEX IF NOT EXISTS idx_income_property ON income(property_id);
    CREATE INDEX IF NOT EXISTS idx_income_tenant ON income(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      uploaded_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      tenant_id INTEGER,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      assigned_to TEXT DEFAULT '',
      cost REAL DEFAULT 0,
      date_reported TEXT NOT NULL,
      date_completed TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_maintenance_property ON maintenance(property_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
  `);

  // Migration: add receipt_path column to expenses if not present
  try {
    db.prepare("SELECT receipt_path FROM expenses LIMIT 1").get();
  } catch (e) {
    db.exec("ALTER TABLE expenses ADD COLUMN receipt_path TEXT DEFAULT ''");
    console.log('Migrated: added receipt_path column to expenses');
  }

  // Migration: add method2/amount2 columns to income if not present
  try {
    db.prepare("SELECT method2 FROM income LIMIT 1").get();
  } catch (e) {
    db.exec("ALTER TABLE income ADD COLUMN method2 TEXT DEFAULT ''");
    db.exec("ALTER TABLE income ADD COLUMN amount2 REAL DEFAULT 0");
    console.log('Migrated: added method2/amount2 to income');
  }

  // Seed an admin user if none exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
      'Abdul Chowdhury', 'admin@dynamicsrv.com', hash, 'admin'
    );
    console.log('Default admin created: admin@dynamicsrv.com / admin123');
  }

  // Auto-seed sample data if properties table is empty
  const propCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();
  if (propCount.count === 0) {
    console.log('No properties found — running seed data...');
    try {
      const seedDatabase = require('./seed');
      seedDatabase(db);
    } catch (e) {
      console.log('Seed script not found or failed:', e.message);
    }
  }
}

module.exports = { db, initialize };
