# PropFlow — Rental Property Management

A full-stack web app for tracking rental income, expenses, tenants, and properties.  
Built for **Dynamic Tax Services** by Abdul Chowdhury.

---

## Features

- **Dashboard** — KPI cards, monthly income vs. expense charts, recent transactions
- **Properties** — Add/edit properties, view per-property detail with tenants, income, and expenses
- **Tenants** — Filter by property/status, full tenant management
- **Income** — Record rent payments, filter by property/month/status, CSV export
- **Expenses** — Track by category (mortgage, maintenance, repairs, etc.), CSV export
- **Reports** — Property P&L summary, monthly trend chart, expense breakdown doughnut chart
- **Authentication** — JWT-based login, admin can add/remove staff users
- **Dark Mode** — Toggle between light and dark themes

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT tokens in httpOnly cookies |
| Frontend | Vanilla JS, Chart.js |
| CSS | Custom design system with CSS variables |

---

## Default Login

| Field | Value |
|-------|-------|
| Email | `admin@dynamicsrv.com` |
| Password | `admin123` |

**Important:** Change your password after first login by updating the user in the database, or add a new admin through the app and remove the default one.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

The database is automatically created and seeded with sample data on first run.

---

## Deploy to Railway (Recommended)

Railway is the easiest way to deploy this app permanently. Cost: ~$5-15/month.

### Step-by-Step Instructions

#### 1. Create a Railway Account
- Go to [railway.com](https://railway.com) and sign up (GitHub login works)
- Add a payment method (Hobby plan starts at $5/month)

#### 2. Install Git (if you don't have it)
- **Windows:** Download from [git-scm.com](https://git-scm.com/download/win)
- **Mac:** Run `xcode-select --install` in Terminal

#### 3. Set Up the Repository
Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
cd propflow-app
git init
git add .
git commit -m "Initial PropFlow deployment"
```

#### 4. Push to GitHub
- Go to [github.com/new](https://github.com/new) and create a new **private** repository named `propflow`
- Follow GitHub's instructions to push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/propflow.git
git branch -M main
git push -u origin main
```

#### 5. Deploy on Railway
1. Go to [railway.com/new](https://railway.com/new)
2. Click **"Deploy from GitHub Repo"**
3. Select your `propflow` repository
4. Railway will auto-detect Node.js and start deploying

#### 6. Set Environment Variables
In your Railway project dashboard:
1. Click on your service
2. Go to **Variables** tab
3. Add these variables:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | Any random string (32+ characters). Example: `mySecureRandomString2026PropFlow!` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

#### 7. Generate a Public URL
1. In Railway, go to **Settings** tab
2. Under **Networking**, click **"Generate Domain"**
3. You'll get a URL like `propflow-production.up.railway.app`

#### 8. Done!
Open your Railway URL and log in with `admin@dynamicsrv.com` / `admin123`.

---

## After Deployment — First Steps

1. **Log in** with the default admin credentials
2. **Change the admin password** (or create a new admin user and delete the default)
3. **Add staff users** — As admin, you can register new users through the API:
   ```bash
   curl -X POST https://YOUR-APP-URL/auth/register \
     -H "Content-Type: application/json" \
     -b "token=YOUR_AUTH_COOKIE" \
     -d '{"name":"Staff Name","email":"staff@dynamicsrv.com","password":"securePassword","role":"staff"}'
   ```
4. **Update sample data** — The app comes pre-loaded with your 7 properties and sample data. Edit or delete as needed through the app interface.

---

## Data Persistence

- SQLite database is stored in `db/propflow.db`
- On Railway, data persists as long as the service is running
- For extra safety, consider setting up a **Railway Volume** for the db directory:
  1. In Railway dashboard, click **"+ New"** → **"Volume"**
  2. Mount path: `/app/db`
  3. This ensures your data survives deployments and restarts

---

## Project Structure

```
propflow-app/
├── server.js              # Express server entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (local only)
├── Procfile               # Railway/Heroku process definition
├── railway.json           # Railway deployment config
├── db/
│   ├── database.js        # SQLite schema, initialization, admin seed
│   └── seed.js            # Sample data (7 properties, 26 tenants, etc.)
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   ├── auth.js            # Login, logout, register, user management
│   └── api.js             # CRUD for properties, tenants, income, expenses
└── public/
    ├── index.html          # Main app shell
    ├── login.html          # Login page
    ├── app.js              # Frontend application logic
    ├── base.css            # Design tokens and CSS variables
    ├── style.css           # Component styles
    └── app.css             # Application-specific styles
```

---

## API Reference

All API routes require authentication (JWT cookie).

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Log in |
| POST | `/auth/logout` | Log out |
| GET | `/auth/me` | Get current user |
| POST | `/auth/register` | Register user (admin only) |
| GET | `/api/properties` | List all properties |
| POST | `/api/properties` | Add property |
| PUT | `/api/properties/:id` | Update property |
| DELETE | `/api/properties/:id` | Delete property |
| GET | `/api/tenants` | List tenants (filter: property_id, status) |
| POST | `/api/tenants` | Add tenant |
| PUT | `/api/tenants/:id` | Update tenant |
| DELETE | `/api/tenants/:id` | Delete tenant |
| GET | `/api/income` | List income (filter: property_id, month, status) |
| POST | `/api/income` | Record payment |
| PUT | `/api/income/:id` | Update payment |
| DELETE | `/api/income/:id` | Delete payment |
| GET | `/api/expenses` | List expenses (filter: property_id, category, month) |
| POST | `/api/expenses` | Add expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/reports/pnl` | Property P&L report |
| GET | `/api/reports/expense-categories` | Expense category totals |

---

© 2026 PropFlow · Dynamic Tax Services
