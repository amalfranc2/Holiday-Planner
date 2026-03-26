import dotenv from "dotenv";
// Fail-safe dotenv loading: don't crash if .env is missing (e.g. on Vercel)
dotenv.config();

import express from "express";
import { sql, db } from "@vercel/postgres";
import path from "path";
import { fileURLToPath } from "url";
import { sendEmail, SmtpConfig } from "./email.js";
import { google } from "googleapis";
import multer from "multer";
import fs from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// --- Google Drive Setup (Service Account) ---
interface DriveConfig {
  client_email: string;
  private_key: string;
  folder_id: string;
}

async function getDriveConfig(): Promise<DriveConfig | null> {
  try {
    const { rows } = await sql`SELECT client_email, private_key, folder_id FROM google_drive_config WHERE id = 1`;
    return (rows[0] as DriveConfig) || null;
  } catch (err) {
    // Table might not exist yet during first run
    return null;
  }
}

async function getDriveClient() {
  const config = await getDriveConfig();
  const clientEmail = config?.client_email || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = config?.private_key || process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    return google.drive({ version: 'v3', auth });
  } catch (err) {
    console.error("Failed to initialize Google Drive client:", err);
    return null;
  }
}

// Ensure uploads directory exists
// On Vercel/Serverless, we must use /tmp
const uploadsDir = (process.env.VERCEL || process.env.NODE_ENV === 'production') 
  ? path.join(os.tmpdir(), 'uploads') 
  : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created uploads directory at: ${uploadsDir}`);
  } catch (err) {
    console.warn(`Failed to create uploads directory at ${uploadsDir}:`, err);
  }
}

const upload = multer({ dest: uploadsDir });

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
        total_allowance INTEGER DEFAULT 28,
        email TEXT
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
        created_at TEXT NOT NULL,
        attachment_url TEXT,
        attachment_id TEXT
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        branch_id TEXT,
        name TEXT NOT NULL,
        email TEXT,
        receive_notifications BOOLEAN DEFAULT FALSE
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        prime_time_months TEXT NOT NULL, -- JSON array
        default_allowance INTEGER DEFAULT 28,
        last_rotation_month TEXT -- Format: YYYY-MM
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS smtp_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        secure BOOLEAN NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        from_email TEXT NOT NULL,
        app_url TEXT NOT NULL DEFAULT ''
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS google_drive_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        client_email TEXT NOT NULL,
        private_key TEXT NOT NULL,
        folder_id TEXT NOT NULL
      );
    `;

    // Seed initial admin if not exists
    const adminExists = await sql`SELECT * FROM users WHERE username = 'admin'`;
    if (adminExists.rowCount === 0) {
      await sql`
        INSERT INTO users (id, username, password, role, name)
        VALUES ('admin-1', 'admin', 'password123', 'S-ADMIN', 'Head Office Admin')
      `;
    } else if (adminExists.rows[0].role === 'ADMIN') {
      // Upgrade existing admin to S-ADMIN if it was migrated from HeadOffice
      await sql`UPDATE users SET role = 'S-ADMIN' WHERE username = 'admin'`;
    }

    // Seed initial staff user if not exists
    const staffUserExists = await sql`SELECT * FROM users WHERE username = 'staff'`;
    if (staffUserExists.rowCount === 0) {
      await sql`
        INSERT INTO users (id, username, password, role, name)
        VALUES ('staff-shared', 'staff', 'greystone', 'Staff', 'Greystone Staff')
      `;
    }

    // Seed initial config if not exists
    const configExists = await sql`SELECT * FROM system_config WHERE id = 1`;
    if (configExists.rowCount === 0) {
      await sql`
        INSERT INTO system_config (id, prime_time_months, default_allowance, last_rotation_month)
        VALUES (1, '[6, 7, 11]', 28, '')
      `;
    }
    
    // Auto-sync branch staff users
    await syncBranchStaffUsers();
    
    // Check for password rotation
    await checkPasswordRotation();

    console.log("Database initialized successfully");

    // Migrations for existing tables
    try {
      // One-time cleanup: Remove all users under staff as requested
      // We'll use a flag in system_config to ensure this only runs once if needed, 
      // but the user specifically asked to remove them now.
      // To be safe, we'll only do it if a certain migration hasn't run.
      const staffCleanupDone = await sql`SELECT * FROM system_config WHERE id = 1 AND last_rotation_month = 'CLEANUP_DONE'`;
      if (staffCleanupDone.rowCount === 0) {
        await sql`DELETE FROM users WHERE role = 'Staff' AND id != 'staff-shared'`;
        await sql`UPDATE system_config SET last_rotation_month = 'CLEANUP_DONE' WHERE id = 1`;
        console.log("One-time staff user cleanup performed (excluding shared staff).");
      }

      // Rename HeadOffice to ADMIN for existing users
      await sql`UPDATE users SET role = 'ADMIN' WHERE role = 'HeadOffice'`;
      
      await sql`ALTER TABLE staff ADD COLUMN IF NOT EXISTS email TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_notifications BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE smtp_config ADD COLUMN IF NOT EXISTS app_url TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE holiday_requests ADD COLUMN IF NOT EXISTS attachment_url TEXT`;
      await sql`ALTER TABLE holiday_requests ADD COLUMN IF NOT EXISTS attachment_id TEXT`;
      await sql`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS last_rotation_month TEXT`;
      await sql`ALTER TABLE holiday_requests ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE holiday_requests ADD COLUMN IF NOT EXISTS is_staff_request BOOLEAN DEFAULT FALSE`;
      console.log("Database migrations applied successfully");
    } catch (migErr) {
      console.warn("Migration warning (columns might already exist):", migErr);
    }
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}

// Clean up the connection string (remove accidental quotes or whitespace)
if (process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.POSTGRES_URL.trim().replace(/^["']|["']$/g, '');
}

// --- Helper Functions for Branch Staff ---

function generateStaffPassword(branchName: string) {
  const prefix = branchName.substring(0, 4).toLowerCase().padEnd(4, 'x');
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}${random}`;
}

async function syncBranchStaffUsers() {
  // Automatic creation of branch staff users is now disabled per user request.
  // Admins will create staff profiles manually.
  return;
}

async function checkPasswordRotation() {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const { rows: config } = await sql`SELECT last_rotation_month FROM system_config WHERE id = 1`;
    const lastRotation = config[0]?.last_rotation_month;

    // If it's the 1st of the month and we haven't rotated yet
    if (now.getDate() === 1 && lastRotation !== currentMonth && lastRotation !== 'CLEANUP_DONE') {
      console.log("Rotating staff passwords for the new month...");
      const { rows: staffUsers } = await sql`SELECT id, branch_id FROM users WHERE role = 'Staff' AND branch_id IS NOT NULL`;
      
      for (const user of staffUsers) {
        const { rows: branch } = await sql`SELECT name FROM branches WHERE id = ${user.branch_id}`;
        if (branch.length > 0) {
          const newPassword = generateStaffPassword(branch[0].name);
          await sql`UPDATE users SET password = ${newPassword} WHERE id = ${user.id}`;
        }
      }

      await sql`UPDATE system_config SET last_rotation_month = ${currentMonth} WHERE id = 1`;
      console.log("Password rotation complete.");
    }
  } catch (err) {
    console.error("Password rotation check failed:", err);
  }
}

// --- Middleware for Role-Based Access Control ---
const requireRole = (roles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userRole = getHeader(req.headers['x-user-role']);
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }
    next();
  };
};

const getHeader = (val: string | string[] | undefined): string => {
  if (Array.isArray(val)) return val[0];
  return val || '';
};

const requireSAdmin = requireRole(['S-ADMIN']);
const requireAdmin = requireRole(['S-ADMIN', 'ADMIN']);
const requireManager = requireRole(['S-ADMIN', 'ADMIN', 'Manager']);

// --- API Routes ---

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!process.env.POSTGRES_URL) {
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
    const result = await sql`
      SELECT id, username, password, role, branch_id as "branchId", name, email, receive_notifications as "receiveNotifications" 
      FROM users 
      WHERE username = ${username} AND password = ${password}
    `;
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Failed to login" });
  }
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    dbConnected: !!process.env.POSTGRES_URL,
    env: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL
  });
});

// Branches
app.get("/api/branches", async (req, res) => {
  try {
    if (!process.env.POSTGRES_URL) {
      console.warn("Fetch branches: POSTGRES_URL is missing");
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
    const userRole = getHeader(req.headers['x-user-role']);
    const userBranchId = getHeader(req.headers['x-user-branch-id']);

    let rows;
    if (userRole === 'Staff' && userBranchId) {
      const result = await sql`SELECT * FROM branches WHERE id = ${userBranchId}`;
      rows = result.rows;
    } else {
      const result = await sql`SELECT * FROM branches`;
      rows = result.rows;
    }
    res.json(rows);
  } catch (error: any) {
    console.error("Fetch branches error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch branches" });
  }
});

app.post("/api/branches", requireAdmin, async (req, res) => {
  const client = await db.connect();
  try {
    const branches = req.body;
    if (!Array.isArray(branches)) return res.status(400).json({ error: "Invalid data" });
    
    const uniqueBranches = Array.from(new Map(branches.filter(b => b?.id).map(b => [b.id, b])).values());

    await client.sql`BEGIN`;
    for (const b of uniqueBranches) {
      await client.sql`
        INSERT INTO branches (id, name, location) 
        VALUES (${b.id}, ${b.name}, ${b.location})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          location = EXCLUDED.location
      `;
    }
    
    await client.sql`COMMIT`;
    
    // Sync staff users for new branches
    await syncBranchStaffUsers();
    
    res.json({ success: true });
  } catch (error) {
    try { await client.sql`ROLLBACK`; } catch (e) {}
    console.error("Sync branches error:", error);
    res.status(500).json({ error: "Failed to update branches" });
  } finally {
    client.release();
  }
});

// Staff
app.get("/api/staff", async (req, res) => {
  try {
    if (!process.env.POSTGRES_URL) {
      console.warn("Fetch staff: POSTGRES_URL is missing");
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
    const userRole = getHeader(req.headers['x-user-role']);
    const userBranchId = getHeader(req.headers['x-user-branch-id']);

    let rows;
    if (userRole === 'Staff' && userBranchId) {
      const result = await sql`SELECT id, name, category, branch_id as "branchId", total_allowance as "totalAllowance", email FROM staff WHERE branch_id = ${userBranchId}`;
      rows = result.rows;
    } else {
      const result = await sql`SELECT id, name, category, branch_id as "branchId", total_allowance as "totalAllowance", email FROM staff`;
      rows = result.rows;
    }
    res.json(rows);
  } catch (error: any) {
    console.error("Fetch staff error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch staff" });
  }
});

app.post("/api/staff", requireAdmin, async (req, res) => {
  const client = await db.connect();
  try {
    const staffList = req.body;
    if (!Array.isArray(staffList)) return res.status(400).json({ error: "Invalid data" });

    const uniqueStaff = Array.from(new Map(staffList.filter(s => s?.id).map(s => [s.id, s])).values());

    await client.sql`BEGIN`;
    for (const s of uniqueStaff) {
      await client.sql`
        INSERT INTO staff (id, name, category, branch_id, total_allowance, email) 
        VALUES (${s.id}, ${s.name}, ${s.category}, ${s.branchId}, ${s.totalAllowance}, ${s.email})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          branch_id = EXCLUDED.branch_id,
          total_allowance = EXCLUDED.total_allowance,
          email = EXCLUDED.email
      `;
    }

    await client.sql`COMMIT`;
    res.json({ success: true });
  } catch (error) {
    try { await client.sql`ROLLBACK`; } catch (e) {}
    console.error("Sync staff error:", error);
    res.status(500).json({ error: "Failed to update staff" });
  } finally {
    client.release();
  }
});

// Requests
app.get("/api/requests", async (req, res) => {
  try {
    if (!process.env.POSTGRES_URL) {
      console.warn("Fetch requests: POSTGRES_URL is missing");
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
    const userRole = getHeader(req.headers['x-user-role']);
    const userBranchId = getHeader(req.headers['x-user-branch-id']);

    let rows;
    if (userRole === 'Staff' && userBranchId) {
      const result = await sql`SELECT id, staff_id as "staffId", branch_id as "branchId", start_date as "startDate", end_date as "endDate", status, notes, created_at as "createdAt", attachment_url as "attachmentUrl", attachment_id as "attachmentId", is_urgent as "isUrgent", is_staff_request as "isStaffRequest" FROM holiday_requests WHERE branch_id = ${userBranchId}`;
      rows = result.rows;
    } else {
      const result = await sql`SELECT id, staff_id as "staffId", branch_id as "branchId", start_date as "startDate", end_date as "endDate", status, notes, created_at as "createdAt", attachment_url as "attachmentUrl", attachment_id as "attachmentId", is_urgent as "isUrgent", is_staff_request as "isStaffRequest" FROM holiday_requests`;
      rows = result.rows;
    }
    res.json(rows);
  } catch (error: any) {
    console.error("Fetch requests error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch requests" });
  }
});

app.post("/api/requests", async (req, res) => {
  const client = await db.connect();
  try {
    const newRequests = req.body;
    if (!Array.isArray(newRequests)) return res.status(400).json({ error: "Invalid data" });

    const uniqueRequests = Array.from(new Map(newRequests.filter(r => r?.id).map(r => [r.id, r])).values());
    
    const { rows: oldRequests } = await client.sql`SELECT id, status FROM holiday_requests`;
    const oldRequestsMap = new Map(oldRequests.map(r => [r.id, r]));

    await client.sql`BEGIN`;
    for (const r of uniqueRequests) {
      await client.sql`
        INSERT INTO holiday_requests (id, staff_id, branch_id, start_date, end_date, status, notes, created_at, attachment_url, attachment_id, is_urgent, is_staff_request) 
        VALUES (${r.id}, ${r.staffId}, ${r.branchId}, ${r.startDate}, ${r.endDate}, ${r.status}, ${r.notes}, ${r.createdAt}, ${r.attachmentUrl}, ${r.attachmentId}, ${r.isUrgent || false}, ${r.isStaffRequest || false})
        ON CONFLICT (id) DO UPDATE SET
          staff_id = EXCLUDED.staff_id,
          branch_id = EXCLUDED.branch_id,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          created_at = EXCLUDED.created_at,
          attachment_url = EXCLUDED.attachment_url,
          attachment_id = EXCLUDED.attachment_id,
          is_urgent = EXCLUDED.is_urgent,
          is_staff_request = EXCLUDED.is_staff_request
      `;
    }

    await client.sql`COMMIT`;

    const notificationPromises = uniqueRequests.map(async (r) => {
      const oldReq = oldRequestsMap.get(r.id);
      if (!oldReq) {
        await handleNewRequestNotification(r);
      } else if (oldReq.status !== r.status && (r.status === 'Approved' || r.status === 'Rejected')) {
        await handleStatusChangeNotification(r);
      }
    });

    await Promise.all(notificationPromises);

    res.json({ success: true });
  } catch (error) {
    try { await client.sql`ROLLBACK`; } catch (e) {}
    console.error("Sync requests error:", error);
    res.status(500).json({ error: "Failed to update requests" });
  } finally {
    client.release();
  }
});

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const { rows } = await sql`SELECT host, port, secure, username, password, from_email as "from_email", app_url as "app_url" FROM smtp_config WHERE id = 1`;
    return (rows[0] as SmtpConfig) || null;
  } catch (err) {
    console.error("Failed to fetch SMTP config from DB:", err);
    return null;
  }
}

async function handleNewRequestNotification(request: any) {
  console.log(`Processing new request notification for staff ${request.staffId}...`);
  try {
    const smtpConfig = await getSmtpConfig();
    
    // Get staff name
    const { rows: staffRows } = await sql`SELECT name FROM staff WHERE id = ${request.staffId}`;
    const staffName = staffRows[0]?.name || "A staff member";

    // Get branch name
    const { rows: branchRows } = await sql`SELECT name FROM branches WHERE id = ${request.branchId}`;
    const branchName = branchRows[0]?.name || "Unknown Branch";

    // Get users who want notifications for this branch or all branches
    const { rows: usersToNotify } = await sql`
      SELECT email, name FROM users 
      WHERE receive_notifications = TRUE 
      AND (branch_id = ${request.branchId} OR role = 'HeadOffice')
      AND email IS NOT NULL
    `;

    console.log(`Found ${usersToNotify.length} users to notify for new request.`);

    for (const user of usersToNotify) {
      console.log(`Sending new request notification to ${user.name} (${user.email})...`);
      const urgentPrefix = request.isUrgent ? "🚨 URGENT: " : "";
      await sendEmail({
        to: user.email,
        subject: `${urgentPrefix}New Holiday Request: ${staffName} (${branchName})`,
        text: `${urgentPrefix}${staffName} has submitted a new holiday request from ${request.startDate} to ${request.endDate}.${request.isUrgent ? '\n\nThis is marked as URGENT.' : ''}\n\nPlease log in to the Holiday Planner to review it.\n\n---\nThis is an unattended inbox, please do not reply to this email.`,
        html: `
          <h3 style="${request.isUrgent ? 'color: #dc2626;' : ''}">${urgentPrefix}New Holiday Request</h3>
          <p><strong>Staff:</strong> ${staffName}</p>
          <p><strong>Branch:</strong> ${branchName}</p>
          <p><strong>Dates:</strong> ${request.startDate} to ${request.endDate}</p>
          ${request.isUrgent ? '<p style="color: #dc2626; font-weight: bold;">🚨 This request is marked as URGENT.</p>' : ''}
          <p>Please log in to the <a href="${smtpConfig?.app_url || '#'}">Holiday Planner</a> to review this request.</p>
          <hr/>
          <p style="color: #666; font-size: 12px;">This is an unattended inbox, please do not reply to this email.</p>
        `,
        config: smtpConfig
      });
    }
  } catch (err) {
    console.error("Failed to send new request notification:", err);
  }
}

async function handleStatusChangeNotification(request: any) {
  console.log(`Processing status change notification for request ${request.id} (Status: ${request.status})...`);
  try {
    const smtpConfig = await getSmtpConfig();
    
    // Get staff email and name
    const { rows: staffRows } = await sql`SELECT name, email FROM staff WHERE id = ${request.staffId}`;
    const staff = staffRows[0];

    if (staff?.email) {
      console.log(`Sending status update notification to staff ${staff.name} (${staff.email})...`);
      await sendEmail({
        to: staff.email,
        subject: `Holiday Request ${request.status}`,
        text: `Hi ${staff.name},\n\nYour holiday request for ${request.startDate} to ${request.endDate} has been ${request.status.toLowerCase()}.\n\nLog in to the Holiday Planner for more details.\n\n---\nThis is an unattended inbox, please do not reply to this email.`,
        html: `
          <h3>Holiday Request Update</h3>
          <p>Hi ${staff.name},</p>
          <p>Your holiday request for <strong>${request.startDate} to ${request.endDate}</strong> has been <strong>${request.status.toLowerCase()}</strong>.</p>
          <p>Log in to the <a href="${smtpConfig?.app_url || '#'}">Holiday Planner</a> for more details.</p>
          <hr/>
          <p style="color: #666; font-size: 12px;">This is an unattended inbox, please do not reply to this email.</p>
        `,
        config: smtpConfig
      });
    } else {
      console.log(`No email found for staff ${staff?.name || request.staffId}. Skipping notification.`);
    }
  } catch (err) {
    console.error("Failed to send status change notification:", err);
  }
}

// --- Google Drive Auth Helper ---
// (OAuth2 routes removed in favor of Service Account)

// Google Drive Upload
app.post("/api/upload", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const staffName = req.body.staffName || "Staff";
    const formattedName = staffName.trim().replace(/\s+/g, '-');

    // Extract ID from URL if provided
    const drive = await getDriveClient();
    if (!drive) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: "Google Drive client not configured. Please check your Drive settings in Config." });
    }

    const config = await getDriveConfig();
    let folderId = config?.folder_id || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    
    if (folderId.includes('/folders/')) {
      folderId = folderId.split('/folders/')[1].split('?')[0];
    }

    if (!folderId) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Google Drive Folder ID is required. Please set it in the Config tab." });
    }

    // 1. Upload the file with the original name to get the file_id
    const fileMetadata: any = {
      name: req.file.originalname,
      parents: [folderId]
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path)
    };

    const createResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
      supportsAllDrives: true,
    } as any);

    const fileId = createResponse.data.id;
    if (!fileId) {
      throw new Error("Failed to retrieve file ID after upload");
    }

    // 2. Rename the file using a PATCH request to files.update
    // Format: staff firstname-dd-mm-yy-hh-mm-ss
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear().toString().slice(-2)}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    
    // Get file extension from original name
    const ext = path.extname(req.file.originalname);
    const newFileName = `${formattedName}-${timestamp}${ext}`;

    const updateResponse = await drive.files.update({
      fileId: fileId,
      requestBody: {
        name: newFileName
      },
      fields: 'id, webViewLink, name, mimeType',
      supportsAllDrives: true,
    } as any);

    // 3. Check for no malformed meta data
    if (!updateResponse.data.name || !updateResponse.data.webViewLink) {
      throw new Error("Malformed metadata received from Google Drive after update");
    }

    // Delete local file after upload
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({ 
      id: updateResponse.data.id, 
      webViewLink: updateResponse.data.webViewLink 
    });
  } catch (error: any) {
    console.error("Upload error:", error.message);
    // Clean up local file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || "Failed to upload to Google Drive" });
  }
});

// Google Drive Delete
app.post("/api/delete-file", async (req, res) => {
  const { fileId } = req.body;
  try {
    if (!fileId) return res.status(400).json({ error: "File ID is required" });

    const drive = await getDriveClient();
    if (!drive) {
      return res.status(500).json({ error: "Google Drive client not configured" });
    }

    await drive.files.update({
      fileId: fileId,
      requestBody: {
        trashed: true
      },
      supportsAllDrives: true,
    } as any);

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 404 || (error.message && error.message.toLowerCase().includes('file not found'))) {
      console.warn("File deleted or not found in Drive:", fileId);
      return res.json({ success: true, message: "File deleted or not found" });
    }
    console.error("Delete file error:", error.message);
    res.status(500).json({ error: error.message || "Failed to delete file in Google Drive" });
  }
});

// Users
app.get("/api/users", async (req, res) => {
  try {
    if (!process.env.POSTGRES_URL) {
      console.warn("Fetch users: POSTGRES_URL is missing");
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
    const userRole = getHeader(req.headers['x-user-role']);
    const userBranchId = getHeader(req.headers['x-user-branch-id']);
    const userId = getHeader(req.headers['x-user-id']);

    let rows;
    if (userRole === 'Manager' && userBranchId) {
      // Managers can see users in their branch (including the branch staff user)
      const result = await sql`SELECT id, username, password, role, branch_id as "branchId", name, email, receive_notifications as "receiveNotifications" FROM users WHERE branch_id = ${userBranchId} OR role = 'S-ADMIN' OR role = 'ADMIN'`;
      rows = result.rows;
    } else if (userRole === 'Staff') {
      // Staff can only see themselves (though they usually don't access this)
      const result = await sql`SELECT id, username, password, role, branch_id as "branchId", name, email, receive_notifications as "receiveNotifications" FROM users WHERE id = ${userId}`;
      rows = result.rows;
    } else {
      const result = await sql`SELECT id, username, password, role, branch_id as "branchId", name, email, receive_notifications as "receiveNotifications" FROM users`;
      rows = result.rows;
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/api/branch-staff-passwords", requireManager, async (req, res) => {
  try {
    const userRole = getHeader(req.headers['x-user-role']);
    const userBranchId = getHeader(req.headers['x-user-branch-id']);

    let rows;
    if ((userRole === 'S-ADMIN' || userRole === 'ADMIN')) {
      const result = await sql`SELECT b.name as "branchName", u.username, u.password FROM users u JOIN branches b ON u.branch_id = b.id WHERE u.role = 'Staff'`;
      rows = result.rows;
    } else if (userRole === 'Manager' && userBranchId) {
      const result = await sql`SELECT b.name as "branchName", u.username, u.password FROM users u JOIN branches b ON u.branch_id = b.id WHERE u.role = 'Staff' AND u.branch_id = ${userBranchId}`;
      rows = result.rows;
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch branch staff passwords" });
  }
});

app.post("/api/users", requireAdmin, async (req, res) => {
  const client = await db.connect();
  try {
    const users = req.body;
    if (!Array.isArray(users)) return res.status(400).json({ error: "Invalid data" });

    const uniqueUsers = Array.from(new Map(users.filter(u => u?.id).map(u => [u.id, u])).values());

    const userRole = req.headers['x-user-role'] as string;
    const isSAdmin = userRole === 'S-ADMIN';

    await client.sql`BEGIN`;
    for (const u of uniqueUsers) {
      // Prevent non-S-ADMIN from creating/updating S-ADMIN users
      if (!isSAdmin && u.role === 'S-ADMIN') continue;

      await client.sql`
        INSERT INTO users (id, username, password, role, branch_id, name, email, receive_notifications) 
        VALUES (${u.id}, ${u.username}, ${u.password}, ${u.role}, ${u.branchId}, ${u.name}, ${u.email}, ${u.receiveNotifications})
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          branch_id = EXCLUDED.branch_id,
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          receive_notifications = EXCLUDED.receive_notifications
      `;
    }

    await client.sql`COMMIT`;
    res.json({ success: true });
  } catch (error) {
    try { await client.sql`ROLLBACK`; } catch (e) {}
    console.error("Sync users error:", error);
    res.status(500).json({ error: "Failed to update users" });
  } finally {
    client.release();
  }
});

app.delete("/api/branches/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    await sql`DELETE FROM branches WHERE id = ${id}`;
    // Also delete staff in this branch
    await sql`DELETE FROM staff WHERE branch_id = ${id}`;
    // Also delete requests in this branch
    await sql`DELETE FROM holiday_requests WHERE branch_id = ${id}`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete branch" });
  }
});

app.delete("/api/staff/:id", requireManager, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userRole = getHeader(req.headers['x-user-role']);
    const userBranchId = getHeader(req.headers['x-user-branch-id']);

    if (userRole === 'Manager') {
      const staffResult = await sql`SELECT branch_id FROM staff WHERE id = ${id}`;
      if (staffResult.rows.length === 0) return res.status(404).json({ error: "Staff not found" });
      if (staffResult.rows[0].branch_id !== userBranchId) {
        return res.status(403).json({ error: "You can only delete staff in your own branch" });
      }
    }

    await sql`DELETE FROM staff WHERE id = ${id}`;
    // Also delete requests for this staff member
    await sql`DELETE FROM holiday_requests WHERE staff_id = ${id}`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

app.delete("/api/requests/:id", requireManager, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userRole = getHeader(req.headers['x-user-role']);
    const userBranchId = getHeader(req.headers['x-user-branch-id']);

    if (userRole === 'Manager') {
      const reqResult = await sql`SELECT branch_id FROM holiday_requests WHERE id = ${id}`;
      if (reqResult.rows.length === 0) return res.status(404).json({ error: "Request not found" });
      if (reqResult.rows[0].branch_id !== userBranchId) {
        return res.status(403).json({ error: "You can only delete requests in your own branch" });
      }
    }

    await sql`DELETE FROM holiday_requests WHERE id = ${id}`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete request" });
  }
});

app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userRole = getHeader(req.headers['x-user-role']);
    const currentUserId = getHeader(req.headers['x-user-id']);

    if (id === currentUserId) {
      return res.status(400).json({ error: "You cannot delete yourself" });
    }

    // Fetch the user to be deleted to check their role
    const targetUserResult = await sql`SELECT role FROM users WHERE id = ${id}`;
    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const targetRole = targetUserResult.rows[0].role;

    // S-ADMIN can delete anyone (except themselves, handled above)
    // ADMIN can delete Manager and Staff
    if (userRole === 'ADMIN' && (targetRole === 'S-ADMIN' || targetRole === 'ADMIN')) {
      return res.status(403).json({ error: "You do not have permission to delete this user" });
    }

    await sql`DELETE FROM users WHERE id = ${id}`;
    res.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Config
app.get("/api/email-status", async (req, res) => {
  const config = await getSmtpConfig();
  res.json({
    configured: !!config,
    details: {
      host: !!config?.host,
      user: !!config?.username,
      pass: !!config?.password,
      from: !!config?.from_email,
      appUrl: !!config?.app_url,
      port: config?.port || 'N/A',
      secure: config?.secure !== undefined ? config.secure : 'N/A',
    }
  });
});

app.get('/api/drive-status', async (req, res) => {
  const config = await getDriveConfig();
  const configured = !!(config?.client_email && config?.private_key) || !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
  const folderIdSet = !!config?.folder_id || !!process.env.GOOGLE_DRIVE_FOLDER_ID;
  let verified = false;
  let error = null;

  if (configured && folderIdSet) {
    try {
      const drive = await getDriveClient();
      if (!drive) throw new Error("Could not initialize Drive client");

      let folderId = config?.folder_id || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
      if (folderId.includes('/folders/')) {
        folderId = folderId.split('/folders/')[1].split('?')[0];
      }
      
      await drive.files.list({
        q: `'${folderId}' in parents`,
        pageSize: 1,
        fields: 'files(id, name)'
      });
      verified = true;
    } catch (err: any) {
      console.error("Drive verification failed:", err.message);
      error = err.message;
    }
  }

  res.json({
    configured,
    folderIdSet,
    verified,
    error,
    serviceAccountEmail: config?.client_email || process.env.GOOGLE_CLIENT_EMAIL
  });
});

app.get("/api/drive-config", requireSAdmin, async (req, res) => {
  try {
    const config = await getDriveConfig();
    res.json(config || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/drive-config", requireSAdmin, async (req, res) => {
  try {
    const { client_email, private_key, folder_id } = req.body;
    await sql`
      INSERT INTO google_drive_config (id, client_email, private_key, folder_id)
      VALUES (1, ${client_email}, ${private_key}, ${folder_id})
      ON CONFLICT (id) DO UPDATE SET
        client_email = EXCLUDED.client_email,
        private_key = EXCLUDED.private_key,
        folder_id = EXCLUDED.folder_id
    `;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/smtp-config", requireSAdmin, async (req, res) => {
  try {
    const config = await getSmtpConfig();
    res.json(config || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/smtp-config", requireSAdmin, async (req, res) => {
  try {
    const { host, port, secure, username, password, from_email, app_url } = req.body;
    await sql`
      INSERT INTO smtp_config (id, host, port, secure, username, password, from_email, app_url)
      VALUES (1, ${host}, ${port}, ${secure}, ${username}, ${password}, ${from_email}, ${app_url})
      ON CONFLICT (id) DO UPDATE SET
        host = EXCLUDED.host,
        port = EXCLUDED.port,
        secure = EXCLUDED.secure,
        username = EXCLUDED.username,
        password = EXCLUDED.password,
        from_email = EXCLUDED.from_email,
        app_url = EXCLUDED.app_url
    `;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/test-email", requireSAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    
    const config = await getSmtpConfig();
    
    await sendEmail({
      to: email,
      subject: "Test Email from Holiday Planner",
      text: "This is a test email to verify your SMTP settings. If you received this, your email engine is working correctly!",
      html: "<h3>Test Email</h3><p>This is a test email to verify your SMTP settings. If you received this, your email engine is working correctly!</p>",
      config: config || undefined
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/config", async (req, res) => {
  try {
    if (!process.env.POSTGRES_URL) {
      console.warn("Fetch config: POSTGRES_URL is missing");
      return res.status(500).json({ error: "POSTGRES_URL is missing" });
    }
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

app.post("/api/config", requireSAdmin, async (req, res) => {
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

// --- Startup ---
async function startServer() {
  if (process.env.POSTGRES_URL) {
    console.log("Database URL detected. Attempting to initialize...");
    await initDb().catch(err => {
      console.error("Database initialization failed during startup:", err.message);
    });
  } else {
    console.warn("⚠️  WARNING: POSTGRES_URL is missing.");
    console.warn("Local: Ensure your .env file exists and contains POSTGRES_URL.");
    console.warn("Cloud: Ensure you have added POSTGRES_URL to your environment variables.");
  }

  // Only run Vite setup if not on Vercel
  if (!process.env.VERCEL) {
    await setupVite();
  }

  // Global error handler to ensure JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global error handler:", err);
    res.status(err.status || 500).json({
      error: err.message || "An unexpected error occurred"
    });
  });

  // Listen only if not on Vercel
  if (!process.env.VERCEL) {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

// Export for Vercel
export default app;
