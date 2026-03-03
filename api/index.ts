import dotenv from "dotenv";
// Fail-safe dotenv loading: don't crash if .env is missing (e.g. on Vercel)
dotenv.config();

import express from "express";
import { sql } from "@vercel/postgres";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// --- Database Initialization ---
async function initDb() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        total_allowance INTEGER DEFAULT 28
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS holiday_requests (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        branch_id TEXT,
        name TEXT NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        prime_time_months TEXT NOT NULL, -- JSON array
        default_allowance INTEGER DEFAULT 28
      );
    `;

    // Seed initial admin if not exists
    const adminExists = await sql`SELECT * FROM users WHERE username = 'admin'`;
    if (adminExists.rowCount === 0) {
      await sql`
        INSERT INTO users (id, username, password, role, name)
        VALUES ('admin-1', 'admin', 'password123', 'HeadOffice', 'Head Office Admin')
      `;
    }

    // Seed initial config if not exists
    const configExists = await sql`SELECT * FROM system_config WHERE id = 1`;
    if (configExists.rowCount === 0) {
      await sql`
        INSERT INTO system_config (id, prime_time_months, default_allowance)
        VALUES (1, '[6, 7, 11]', 28)
      `;
    }
    
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}

// Clean up the connection string (remove accidental quotes or whitespace)
if (process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.POSTGRES_URL.trim().replace(/^["']|["']$/g, '');
}

// --- Database Initialization ---
if (process.env.POSTGRES_URL) {
  console.log("Database URL detected. Attempting to initialize...");
  initDb().catch(err => {
    console.error("Database initialization failed during startup:", err.message);
  });
} else {
  console.warn("⚠️  WARNING: POSTGRES_URL is missing.");
  console.warn("Local: Ensure your .env file exists and contains POSTGRES_URL.");
  console.warn("Cloud: Ensure you have added POSTGRES_URL to your environment variables.");
}

// --- API Routes ---

// Branches
app.get("/api/branches", async (req, res) => {
  try {
    if (!process.env.POSTGRES_URL) {
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
    const { rows } = await sql`SELECT * FROM branches`;
    res.json(rows);
  } catch (error: any) {
    console.error("Fetch branches error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch branches" });
  }
});

app.post("/api/branches", async (req, res) => {
  try {
    const branches = req.body;
    // Simple sync for demo: delete all and re-insert
    await sql`DELETE FROM branches`;
    for (const b of branches) {
      await sql`INSERT INTO branches (id, name, location) VALUES (${b.id}, ${b.name}, ${b.location})`;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update branches" });
  }
});

// Staff
app.get("/api/staff", async (req, res) => {
  try {
    if (!process.env.POSTGRES_URL) {
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
    const { rows } = await sql`SELECT id, name, category, branch_id as "branchId", total_allowance as "totalAllowance" FROM staff`;
    res.json(rows);
  } catch (error: any) {
    console.error("Fetch staff error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch staff" });
  }
});

app.post("/api/staff", async (req, res) => {
  try {
    const staffList = req.body;
    await sql`DELETE FROM staff`;
    for (const s of staffList) {
      await sql`INSERT INTO staff (id, name, category, branch_id, total_allowance) VALUES (${s.id}, ${s.name}, ${s.category}, ${s.branchId}, ${s.totalAllowance})`;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update staff" });
  }
});

// Requests
app.get("/api/requests", async (req, res) => {
  try {
    if (!process.env.POSTGRES_URL) {
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
    const { rows } = await sql`SELECT id, staff_id as "staffId", branch_id as "branchId", start_date as "startDate", end_date as "endDate", status, notes, created_at as "createdAt" FROM holiday_requests`;
    res.json(rows);
  } catch (error: any) {
    console.error("Fetch requests error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch requests" });
  }
});

app.post("/api/requests", async (req, res) => {
  try {
    const requests = req.body;
    await sql`DELETE FROM holiday_requests`;
    for (const r of requests) {
      await sql`INSERT INTO holiday_requests (id, staff_id, branch_id, start_date, end_date, status, notes, created_at) VALUES (${r.id}, ${r.staffId}, ${r.branchId}, ${r.startDate}, ${r.endDate}, ${r.status}, ${r.notes}, ${r.createdAt})`;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update requests" });
  }
});

// Users
app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await sql`SELECT id, username, password, role, branch_id as "branchId", name FROM users`;
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const users = req.body;
    await sql`DELETE FROM users`;
    for (const u of users) {
      await sql`INSERT INTO users (id, username, password, role, branch_id, name) VALUES (${u.id}, ${u.username}, ${u.password}, ${u.role}, ${u.branchId}, ${u.name})`;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update users" });
  }
});

// Config
app.get("/api/config", async (req, res) => {
  try {
    const { rows } = await sql`SELECT prime_time_months as "primeTimeMonths", default_allowance as "defaultAllowance" FROM system_config WHERE id = 1`;
    if (rows.length > 0) {
      res.json({
        primeTimeMonths: JSON.parse(rows[0].primeTimeMonths),
        defaultAllowance: rows[0].defaultAllowance
      });
    } else {
      res.status(404).json({ error: "Config not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

app.post("/api/config", async (req, res) => {
  try {
    const config = req.body;
    await sql`UPDATE system_config SET prime_time_months = ${JSON.stringify(config.primeTimeMonths)}, default_allowance = ${config.defaultAllowance} WHERE id = 1`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update config" });
  }
});

// --- Vite Middleware / Static Serving ---
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, we assume the frontend is built to /dist
    // Note: On Vercel, static files are handled by vercel.json rewrites
    // This part is for local production testing or other platforms
    const distPath = path.join(__dirname, "..", "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// Only run Vite setup if not on Vercel
if (!process.env.VERCEL) {
  setupVite();
}

// Export for Vercel
export default app;

// Listen only if run directly
if (import.meta.url === `file://${process.argv[1]}` || !process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
