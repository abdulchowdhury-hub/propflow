/**
 * PropFlow — Seed Script
 * Populates the database with sample properties, tenants, income, and expenses.
 * 
 * Can be run standalone: node db/seed.js
 * Also called automatically from database.js on first run.
 * 
 * Only inserts data if the properties table is empty (safe to re-run).
 */

function seedDatabase(db) {
  // Check if data already exists
  const propCount = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
  if (propCount > 0) {
    console.log('Database already has ' + propCount + ' properties. Skipping seed.');
    return;
  }

  console.log('Seeding database with sample data...');

  // ===== PROPERTIES =====
  const insertProperty = db.prepare(
    'INSERT INTO properties (name, address, city, state, zip, type, units, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const properties = [
    ['Maple Ridge Apartments', '2340 Maple Ridge Dr', 'Houston', 'TX', '77001', 'multi-family', 5, 'Near medical center, strong rental demand'],
    ['Lakewood Terrace', '518 Lakewood Blvd', 'Dallas', 'TX', '75201', 'multi-family', 4, 'Renovated 2024, all units updated'],
    ['Crescent Park Homes', '1205 Crescent Park Ln', 'Atlanta', 'GA', '30312', 'multi-family', 4, 'Family-friendly neighborhood'],
    ['Riverside Commons', '890 River Bend Ave', 'Charlotte', 'NC', '28202', 'multi-family', 4, 'Walking distance to uptown'],
    ['Peachtree Flats', '3100 Peachtree Rd', 'Atlanta', 'GA', '30305', 'multi-family', 3, 'Buckhead area, premium tenants'],
    ['Sunrise Plaza', '445 Sunrise Blvd', 'Nashville', 'TN', '37203', 'multi-family', 4, 'Near music row, high demand'],
    ['Guerlain Street Property', '1873 Guerlain St', 'Houston', 'TX', '77002', 'multi-family', 3, 'Personal investment property']
  ];

  const insertProperties = db.transaction(() => {
    for (const p of properties) {
      insertProperty.run(...p);
    }
  });
  insertProperties();
  console.log('  7 properties inserted');

  // ===== TENANTS =====
  const insertTenant = db.prepare(
    'INSERT INTO tenants (property_id, unit, name, email, phone, lease_start, lease_end, monthly_rent, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const tenants = [
    // Property 1 — Maple Ridge Apartments (5 units, 4 active)
    [1, '1A', 'Maria Garcia', 'maria.garcia@email.com', '(713) 555-0142', '2025-03-01', '2026-03-01', 1350, 'active', ''],
    [1, '1B', 'James Wilson', 'j.wilson@email.com', '(713) 555-0198', '2025-01-01', '2026-01-01', 1400, 'active', ''],
    [1, '2A', 'Sarah Chen', 'schen@email.com', '(713) 555-0234', '2025-02-15', '2026-02-15', 1450, 'active', 'Prefers email communication'],
    [1, '2B', 'Robert Taylor', 'r.taylor@email.com', '(713) 555-0367', '2024-06-01', '2026-06-01', 1300, 'active', '2-year lease'],
    // Property 2 — Lakewood Terrace (4 units, 4 tenants)
    [2, 'A', 'Emily Johnson', 'emily.j@email.com', '(214) 555-0445', '2025-01-01', '2026-01-01', 1600, 'active', ''],
    [2, 'B', 'David Brown', 'd.brown@email.com', '(214) 555-0521', '2025-03-01', '2026-03-01', 1550, 'active', ''],
    [2, 'C', 'Aisha Patel', 'aisha.p@email.com', '(214) 555-0618', '2025-04-01', '2026-04-01', 1500, 'active', ''],
    [2, 'D', 'Marcus Thompson', 'm.thompson@email.com', '(214) 555-0710', '2025-02-01', '2026-02-01', 1650, 'active', 'Corner unit, upgraded finishes'],
    // Property 3 — Crescent Park Homes (4 units, 4 tenants)
    [3, '101', 'Lisa Anderson', 'l.anderson@email.com', '(404) 555-0812', '2025-01-01', '2026-01-01', 1250, 'active', ''],
    [3, '102', 'Carlos Rivera', 'c.rivera@email.com', '(404) 555-0934', '2025-05-01', '2026-05-01', 1200, 'active', ''],
    [3, '201', 'Nicole Wright', 'n.wright@email.com', '(404) 555-1045', '2025-02-01', '2026-02-01', 1300, 'active', 'Top floor'],
    [3, '202', 'Brandon Lee', 'b.lee@email.com', '(404) 555-1123', '2024-09-01', '2025-09-01', 1275, 'active', ''],
    // Property 4 — Riverside Commons (4 units, 3 active + 1 inactive)
    [4, '1', 'Michael Park', 'm.park@email.com', '(704) 555-0289', '2025-01-01', '2026-01-01', 1500, 'active', ''],
    [4, '2', 'Jennifer Martinez', 'j.martinez@email.com', '(704) 555-0334', '2025-03-01', '2026-03-01', 1450, 'active', ''],
    [4, '3', 'Kevin Wright', 'k.wright@email.com', '(704) 555-0401', '2025-02-01', '2026-02-01', 1550, 'active', ''],
    [4, '4', 'Diane Foster', 'd.foster@email.com', '(704) 555-0478', '2024-06-01', '2025-12-01', 1400, 'inactive', 'Moved out early, unit being prepared'],
    // Property 5 — Peachtree Flats (3 units, 3 tenants)
    [5, 'A', 'Rachel Kim', 'r.kim@email.com', '(404) 555-1234', '2025-01-01', '2026-01-01', 2100, 'active', ''],
    [5, 'B', 'Daniel Okafor', 'd.okafor@email.com', '(404) 555-1356', '2025-04-01', '2026-04-01', 2000, 'active', ''],
    [5, 'C', 'Samantha Hill', 's.hill@email.com', '(404) 555-1478', '2025-02-01', '2026-02-01', 2150, 'active', 'Premium unit'],
    // Property 6 — Sunrise Plaza (4 units, 4 tenants)
    [6, '1A', 'Chris Evans', 'c.evans@email.com', '(615) 555-0567', '2025-01-01', '2026-01-01', 1700, 'active', ''],
    [6, '1B', 'Fatima Hassan', 'f.hassan@email.com', '(615) 555-0689', '2025-03-01', '2026-03-01', 1650, 'active', ''],
    [6, '2A', 'Trevor Banks', 't.banks@email.com', '(615) 555-0712', '2025-02-01', '2026-02-01', 1750, 'active', ''],
    [6, '2B', 'Priya Sharma', 'p.sharma@email.com', '(615) 555-0834', '2025-06-01', '2026-06-01', 1700, 'active', ''],
    // Property 7 — Guerlain Street Property (3 units, 3 tenants)
    [7, 'A', 'Omar Hussain', 'o.hussain@email.com', '(713) 555-1590', '2025-01-01', '2026-01-01', 1200, 'active', ''],
    [7, 'B', 'Tanya Morrison', 't.morrison@email.com', '(713) 555-1645', '2025-04-01', '2026-04-01', 1150, 'active', ''],
    [7, 'C', 'Derek Nguyen', 'd.nguyen@email.com', '(713) 555-1721', '2025-02-01', '2026-02-01', 1250, 'active', '']
  ];

  const insertTenants = db.transaction(() => {
    for (const t of tenants) {
      insertTenant.run(...t);
    }
  });
  insertTenants();
  console.log('  26 tenants inserted');

  // ===== INCOME =====
  const insertIncome = db.prepare(
    'INSERT INTO income (tenant_id, property_id, date, amount, method, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const incomeRecords = [
    // January 2026 — 25 tenants paying (Diane Foster id=16 is inactive)
    [1, 1, '2026-01-03', 1350, 'bank transfer', 'paid', ''],
    [2, 1, '2026-01-02', 1400, 'check', 'paid', ''],
    [3, 1, '2026-01-05', 1450, 'online', 'paid', ''],
    [4, 1, '2026-01-10', 1300, 'cash', 'late', 'Paid 10 days late'],
    [5, 2, '2026-01-01', 1600, 'bank transfer', 'paid', ''],
    [6, 2, '2026-01-04', 1550, 'online', 'paid', ''],
    [7, 2, '2026-01-03', 1500, 'bank transfer', 'paid', ''],
    [8, 2, '2026-01-02', 1650, 'check', 'paid', ''],
    [9, 3, '2026-01-01', 1250, 'bank transfer', 'paid', ''],
    [10, 3, '2026-01-03', 1200, 'online', 'paid', ''],
    [11, 3, '2026-01-02', 1300, 'bank transfer', 'paid', ''],
    [12, 3, '2026-01-08', 1275, 'cash', 'late', 'Late fee applied'],
    [13, 4, '2026-01-02', 1500, 'online', 'paid', ''],
    [14, 4, '2026-01-03', 1450, 'check', 'paid', ''],
    [15, 4, '2026-01-01', 1550, 'bank transfer', 'paid', ''],
    [17, 5, '2026-01-02', 2100, 'bank transfer', 'paid', ''],
    [18, 5, '2026-01-05', 2000, 'online', 'paid', ''],
    [19, 5, '2026-01-01', 2150, 'bank transfer', 'paid', ''],
    [20, 6, '2026-01-02', 1700, 'bank transfer', 'paid', ''],
    [21, 6, '2026-01-04', 1650, 'online', 'paid', ''],
    [22, 6, '2026-01-03', 1750, 'check', 'paid', ''],
    [23, 6, '2026-01-01', 1700, 'bank transfer', 'paid', ''],
    [24, 7, '2026-01-03', 1200, 'cash', 'paid', ''],
    [25, 7, '2026-01-05', 1150, 'bank transfer', 'paid', ''],
    [26, 7, '2026-01-02', 1250, 'online', 'paid', ''],
    // February 2026
    [1, 1, '2026-02-02', 1350, 'bank transfer', 'paid', ''],
    [2, 1, '2026-02-03', 1400, 'check', 'paid', ''],
    [3, 1, '2026-02-01', 1450, 'online', 'paid', ''],
    [4, 1, '2026-02-01', 1300, 'cash', 'paid', ''],
    [5, 2, '2026-02-01', 1600, 'bank transfer', 'paid', ''],
    [6, 2, '2026-02-03', 1550, 'online', 'paid', ''],
    [7, 2, '2026-02-02', 1500, 'bank transfer', 'paid', ''],
    [8, 2, '2026-02-04', 1650, 'check', 'paid', ''],
    [9, 3, '2026-02-01', 1250, 'bank transfer', 'paid', ''],
    [10, 3, '2026-02-02', 1200, 'online', 'paid', ''],
    [11, 3, '2026-02-01', 1300, 'bank transfer', 'paid', ''],
    [12, 3, '2026-02-03', 1275, 'cash', 'paid', ''],
    [13, 4, '2026-02-02', 1500, 'online', 'paid', ''],
    [14, 4, '2026-02-01', 1450, 'check', 'paid', ''],
    [15, 4, '2026-02-03', 1550, 'bank transfer', 'paid', ''],
    [17, 5, '2026-02-01', 2100, 'bank transfer', 'paid', ''],
    [18, 5, '2026-02-04', 2000, 'online', 'paid', ''],
    [19, 5, '2026-02-02', 2150, 'bank transfer', 'paid', ''],
    [20, 6, '2026-02-01', 1700, 'bank transfer', 'paid', ''],
    [21, 6, '2026-02-03', 1650, 'online', 'paid', ''],
    [22, 6, '2026-02-02', 1750, 'check', 'paid', ''],
    [23, 6, '2026-02-01', 1700, 'bank transfer', 'paid', ''],
    [24, 7, '2026-02-02', 1200, 'cash', 'paid', ''],
    [25, 7, '2026-02-04', 1150, 'bank transfer', 'paid', ''],
    [26, 7, '2026-02-01', 1250, 'online', 'paid', ''],
    // March 2026
    [1, 1, '2026-03-02', 1350, 'bank transfer', 'paid', ''],
    [2, 1, '2026-03-03', 1400, 'check', 'paid', ''],
    [3, 1, '2026-03-01', 1450, 'online', 'paid', ''],
    [4, 1, '2026-03-07', 1300, 'cash', 'pending', ''],
    [5, 2, '2026-03-01', 1600, 'bank transfer', 'paid', ''],
    [6, 2, '2026-03-03', 1550, 'online', 'paid', ''],
    [7, 2, '2026-03-02', 1500, 'bank transfer', 'paid', ''],
    [8, 2, '2026-03-04', 1650, 'check', 'paid', ''],
    [9, 3, '2026-03-01', 1250, 'bank transfer', 'paid', ''],
    [10, 3, '2026-03-03', 1200, 'online', 'paid', ''],
    [11, 3, '2026-03-02', 1300, 'bank transfer', 'paid', ''],
    [12, 3, '2026-03-05', 1275, 'cash', 'pending', 'Awaiting payment'],
    [13, 4, '2026-03-02', 1500, 'online', 'paid', ''],
    [14, 4, '2026-03-03', 1450, 'check', 'pending', 'Awaiting check clearance'],
    [15, 4, '2026-03-01', 1550, 'bank transfer', 'paid', ''],
    [17, 5, '2026-03-01', 2100, 'bank transfer', 'paid', ''],
    [18, 5, '2026-03-04', 2000, 'online', 'paid', ''],
    [19, 5, '2026-03-02', 2150, 'bank transfer', 'paid', ''],
    [20, 6, '2026-03-01', 1700, 'bank transfer', 'paid', ''],
    [21, 6, '2026-03-03', 1650, 'online', 'paid', ''],
    [22, 6, '2026-03-02', 1750, 'check', 'paid', ''],
    [23, 6, '2026-03-01', 1700, 'bank transfer', 'paid', ''],
    [24, 7, '2026-03-03', 1200, 'cash', 'paid', ''],
    [25, 7, '2026-03-05', 1150, 'bank transfer', 'late', 'Paid 5 days late'],
    [26, 7, '2026-03-02', 1250, 'online', 'paid', '']
  ];

  const insertIncomeRecords = db.transaction(() => {
    for (const i of incomeRecords) {
      insertIncome.run(...i);
    }
  });
  insertIncomeRecords();
  console.log('  ' + incomeRecords.length + ' income records inserted');

  // ===== EXPENSES =====
  const insertExpense = db.prepare(
    'INSERT INTO expenses (property_id, date, category, description, amount, vendor, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const expenseRecords = [
    // January 2026
    [1, '2026-01-05', 'mortgage', 'Monthly mortgage payment', 3200, 'First National Bank', ''],
    [1, '2026-01-10', 'maintenance', 'HVAC filter replacement', 320, 'CoolAir Services', ''],
    [1, '2026-01-15', 'insurance', 'Property insurance premium', 380, 'StateFarm', 'Quarterly payment'],
    [2, '2026-01-05', 'mortgage', 'Monthly mortgage payment', 3600, 'Wells Fargo', ''],
    [2, '2026-01-20', 'repairs', 'Roof leak repair', 1850, 'TopNotch Roofing', 'Emergency repair'],
    [3, '2026-01-05', 'mortgage', 'Monthly mortgage payment', 2800, 'Chase Bank', ''],
    [3, '2026-01-12', 'utilities', 'Water & sewer', 240, 'City of Atlanta', ''],
    [4, '2026-01-05', 'mortgage', 'Monthly mortgage payment', 3100, 'Bank of America', ''],
    [4, '2026-01-08', 'management fees', 'Property management fee', 450, 'Riverside PM Group', ''],
    [5, '2026-01-05', 'mortgage', 'Monthly mortgage payment', 4200, 'SunTrust', ''],
    [5, '2026-01-18', 'taxes', 'Quarterly property tax', 1800, 'Fulton County', ''],
    [6, '2026-01-05', 'mortgage', 'Monthly mortgage payment', 3800, 'Regions Bank', ''],
    [6, '2026-01-14', 'maintenance', 'Hallway lighting replacement', 275, 'BrightStar Electric', ''],
    [7, '2026-01-05', 'mortgage', 'Monthly mortgage payment', 1800, 'Frost Bank', ''],
    [7, '2026-01-22', 'utilities', 'Water bill', 165, 'City of Houston', ''],
    // February 2026
    [1, '2026-02-05', 'mortgage', 'Monthly mortgage payment', 3200, 'First National Bank', ''],
    [1, '2026-02-14', 'maintenance', 'Common area cleaning', 250, 'CleanPro Services', ''],
    [2, '2026-02-05', 'mortgage', 'Monthly mortgage payment', 3600, 'Wells Fargo', ''],
    [2, '2026-02-10', 'utilities', 'Gas & electric', 340, 'Dallas Energy', ''],
    [3, '2026-02-05', 'mortgage', 'Monthly mortgage payment', 2800, 'Chase Bank', ''],
    [3, '2026-02-22', 'repairs', 'Plumbing fix - unit 102 kitchen sink', 475, 'Quick Plumb', ''],
    [4, '2026-02-05', 'mortgage', 'Monthly mortgage payment', 3100, 'Bank of America', ''],
    [4, '2026-02-08', 'management fees', 'Property management fee', 450, 'Riverside PM Group', ''],
    [4, '2026-02-15', 'repairs', 'Unit 4 turnover paint and patch', 1200, 'ProPaint LLC', 'Preparing vacant unit'],
    [5, '2026-02-05', 'mortgage', 'Monthly mortgage payment', 4200, 'SunTrust', ''],
    [5, '2026-02-12', 'utilities', 'Electricity', 420, 'Georgia Power', ''],
    [6, '2026-02-05', 'mortgage', 'Monthly mortgage payment', 3800, 'Regions Bank', ''],
    [6, '2026-02-18', 'insurance', 'Property insurance premium', 350, 'Allstate', 'Quarterly'],
    [7, '2026-02-05', 'mortgage', 'Monthly mortgage payment', 1800, 'Frost Bank', ''],
    [7, '2026-02-20', 'maintenance', 'Pest control treatment', 185, 'BugFree Pest Control', ''],
    // March 2026
    [1, '2026-03-05', 'mortgage', 'Monthly mortgage payment', 3200, 'First National Bank', ''],
    [1, '2026-03-03', 'repairs', 'Window replacement unit 2B', 950, 'ClearView Glass', ''],
    [2, '2026-03-05', 'mortgage', 'Monthly mortgage payment', 3600, 'Wells Fargo', ''],
    [2, '2026-03-12', 'maintenance', 'Parking lot resurfacing', 2400, 'PavePro', ''],
    [3, '2026-03-05', 'mortgage', 'Monthly mortgage payment', 2800, 'Chase Bank', ''],
    [3, '2026-03-15', 'insurance', 'Property insurance premium', 310, 'StateFarm', 'Quarterly'],
    [4, '2026-03-05', 'mortgage', 'Monthly mortgage payment', 3100, 'Bank of America', ''],
    [4, '2026-03-08', 'management fees', 'Property management fee', 450, 'Riverside PM Group', ''],
    [5, '2026-03-05', 'mortgage', 'Monthly mortgage payment', 4200, 'SunTrust', ''],
    [5, '2026-03-10', 'maintenance', 'Landscape and lawn care', 350, 'GreenScape LLC', ''],
    [6, '2026-03-05', 'mortgage', 'Monthly mortgage payment', 3800, 'Regions Bank', ''],
    [6, '2026-03-16', 'taxes', 'Quarterly property tax', 1500, 'Davidson County', ''],
    [7, '2026-03-05', 'mortgage', 'Monthly mortgage payment', 1800, 'Frost Bank', ''],
    [7, '2026-03-18', 'repairs', 'Unit C bathroom faucet replacement', 210, 'Quick Plumb', '']
  ];

  const insertExpenseRecords = db.transaction(() => {
    for (const e of expenseRecords) {
      insertExpense.run(...e);
    }
  });
  insertExpenseRecords();
  console.log('  ' + expenseRecords.length + ' expense records inserted');

  console.log('Seed complete!');
}

// Allow running standalone: node db/seed.js
if (require.main === module) {
  const { db, initialize } = require('./database');
  initialize();
  seedDatabase(db);
  console.log('Login: admin@dynamicsrv.com / admin123');
}

module.exports = seedDatabase;
