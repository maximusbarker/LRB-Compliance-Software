import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import XLSX from 'xlsx';
import {
  sanitizeUser,
  issueToken,
  requireAuth,
  requireAdmin,
  hashPassword,
  verifyPassword,
  findUserByEmail,
  findOrgByCode,
  createUser
} from './auth.js';
import { db } from './db.js';
import config from './config.js';
import { isSmtpConfigured, sendMail } from './mailer.js';
import {
  getClientIP,
  isBlocked,
  recordFailedAttempt,
  recordSuccess,
  getRemainingAttempts,
  getBlockedUntil
} from './utils/rateLimiter.js';

const MAX_ATTEMPTS = 5;

const router = express.Router();

// Ensure upload dir exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

function datePrefix() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes())
  );
}

function getAuthUserId(req) {
  return req.user?.sub;
}

function getAuthRole(req) {
  return req.user?.role;
}

function getRequestUserAgent(req) {
  return (req.headers['user-agent'] || '').toString().slice(0, 512);
}

function safeJsonParse(raw, fallback = {}) {
  try {
    if (!raw) return fallback;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

function computeChangedTopLevelFields(prevPayload, nextPayload) {
  const prev = prevPayload && typeof prevPayload === 'object' ? prevPayload : {};
  const next = nextPayload && typeof nextPayload === 'object' ? nextPayload : {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed = [];
  for (const k of keys) {
    const a = prev[k];
    const b = next[k];
    const aStr = typeof a === 'string' ? a : JSON.stringify(a);
    const bStr = typeof b === 'string' ? b : JSON.stringify(b);
    if (aStr !== bStr) changed.push(k);
  }
  return changed;
}

function authorizeSubmissionAccess({ submissionRow, userRow, tokenRole }) {
  if (!submissionRow || !userRow) return false;
  if (tokenRole === 'admin' || tokenRole === 'internal') return true;
  if (!userRow.county || !userRow.agency) return false;
  const payload = safeJsonParse(submissionRow.payload_json, {});
  const submissionCounty = payload.county || '';
  const submissionAgency = payload.submitterName || payload.cityCounty || payload.city || payload.agency || '';
  return submissionCounty === userRow.county && submissionAgency === userRow.agency;
}

function recordSubmissionEvent({
  submissionId,
  orgId,
  userId,
  eventType,
  changedFields = null,
  payloadSnapshot = null,
  ip = null,
  userAgent = null,
  note = null
}) {
  try {
    db.prepare(
      `INSERT INTO submission_events (id, submission_id, org_id, user_id, event_type, changed_fields_json, payload_snapshot_json, ip, user_agent, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      submissionId,
      orgId,
      userId,
      eventType,
      changedFields ? JSON.stringify(changedFields) : null,
      payloadSnapshot ? JSON.stringify(payloadSnapshot) : null,
      ip,
      userAgent,
      note
    );
  } catch (e) {
    // Don't break core workflows if audit insert fails (e.g., older DB); log and continue.
    console.warn('[submission_events] Failed to record event:', e?.message || e);
  }
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, config.uploadDir),
  filename: (_, file, cb) => {
    const prefix = datePrefix();
    const safeOriginal = file.originalname.replace(/\s+/g, '_');
    cb(null, `${prefix}_${safeOriginal}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for safety
  fileFilter: (_, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    return cb(new Error('Only PDF uploads are allowed'));
  }
});

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    message: 'LRB compliance API',
    health: '/api/health'
  });
});

router.get('/health', (_, res) => {
  res.json({ ok: true, db: !!db });
});

// ---- Auth ----
// Get available counties from scraped tax_rates data (public endpoint for signup)
router.get('/auth/counties', async (req, res) => {
  try {
    const counties = new Set();
    
    // From tax rates
    const taxCounties = db.prepare(`
      SELECT DISTINCT county 
      FROM tax_rates 
      WHERE county IS NOT NULL AND county != ''
    `).all();
    taxCounties.forEach(row => counties.add(row.county));
    
    // From submissions payloads
    const submissions = db.prepare('SELECT payload_json FROM submissions').all();
    submissions.forEach(row => {
      try {
        const payload = typeof row.payload_json === 'string'
          ? JSON.parse(row.payload_json)
          : row.payload_json || {};
        if (payload.county) counties.add(payload.county);
      } catch (err) {
        // ignore parse errors
      }
    });
    
    // From existing users
    const userCounties = db.prepare(`
      SELECT DISTINCT county 
      FROM users 
      WHERE county IS NOT NULL AND county != ''
    `).all();
    userCounties.forEach(row => counties.add(row.county));
    
    res.json({ counties: Array.from(counties).sort() });
  } catch (error) {
    console.error('[auth/counties] Error:', error);
    res.status(500).json({ error: 'Failed to fetch counties' });
  }
});

// Get available agencies for a county from scraped tax_rates data (public endpoint for signup)
router.get('/auth/agencies/:county', async (req, res) => {
  try {
    const { county } = req.params;
    const agencies = new Set();
    
    if (!county) {
      return res.json({ agencies: [] });
    }
    
    // From tax rates
    const taxAgencies = db.prepare(`
      SELECT DISTINCT agency 
      FROM tax_rates 
      WHERE county = ? AND agency IS NOT NULL AND agency != ''
    `).all(county);
    taxAgencies.forEach(row => agencies.add(row.agency));
    
    // From submissions payloads
    const submissions = db.prepare('SELECT payload_json FROM submissions').all();
    submissions.forEach(row => {
      try {
        const payload = typeof row.payload_json === 'string'
          ? JSON.parse(row.payload_json)
          : row.payload_json || {};
        if ((payload.county || '').toLowerCase() === county.toLowerCase()) {
          const agencyName =
            payload.submitterName ||
            payload.cityCounty ||
            payload.agency ||
            payload.projectArea ||
            payload.projectAreaName;
          if (agencyName) agencies.add(agencyName);
        }
      } catch (err) {
        // ignore parse errors
      }
    });
    
    // From existing users
    const userAgencies = db.prepare(`
      SELECT DISTINCT agency 
      FROM users 
      WHERE county = ? AND agency IS NOT NULL AND agency != ''
    `).all(county);
    userAgencies.forEach(row => agencies.add(row.agency));
    
    res.json({ agencies: Array.from(agencies).sort() });
  } catch (error) {
    console.error('[auth/agencies] Error:', error);
    res.status(500).json({ error: 'Failed to fetch agencies' });
  }
});

router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, county, agency } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (!county || !agency) {
      return res.status(400).json({ error: 'county and agency are required' });
    }
    
    // Auto-generate organization code from county/agency
    // Format: COUNTY_AGENCY (sanitized for use as code)
    const orgCode = `${county}_${agency}`.toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100); // Limit length
    
    // Find or create organization
    let org = findOrgByCode(orgCode);
    if (!org) {
      // Create new organization with county/agency as identifier
      const orgId = uuid();
      const orgName = `${agency} (${county})`;
      db.prepare('INSERT INTO organizations (id, name, code) VALUES (?, ?, ?)').run(orgId, orgName, orgCode);
      org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
    }
    
    const existing = findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'User already exists' });
    const password_hash = await hashPassword(password);
    // Force client role on self-signup; internal/admin users must be provisioned separately
    const user = createUser({ email, password_hash, role: 'user', org_id: org.id, county, agency });
    const token = issueToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ip = getClientIP(req);
    
    // Check if IP is blocked
    if (isBlocked(ip)) {
      const blockedUntil = getBlockedUntil(ip);
      const minutesRemaining = Math.ceil((blockedUntil - Date.now()) / 60000);
      return res.status(429).json({ 
        error: `Too many failed login attempts. IP address blocked for ${minutesRemaining} more minute(s).` 
      });
    }
    
    console.log('[auth/login] Attempting login for:', email ? email.toLowerCase() : 'no email', 'from IP:', ip);
    const user = findUserByEmail(email || '');
    if (!user) {
      console.log('[auth/login] User not found:', email);
      const record = recordFailedAttempt(ip);
      const remaining = getRemainingAttempts(ip);
      return res.status(401).json({ 
        error: 'Invalid credentials',
        remainingAttempts: remaining,
        blocked: record.count >= MAX_ATTEMPTS
      });
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      console.log('[auth/login] Password incorrect for:', email);
      const record = recordFailedAttempt(ip);
      const remaining = getRemainingAttempts(ip);
      const isNowBlocked = record.count >= MAX_ATTEMPTS;
      return res.status(401).json({ 
        error: 'Invalid credentials',
        remainingAttempts: remaining,
        blocked: isNowBlocked,
        message: isNowBlocked ? 'Too many failed attempts. IP address blocked for 5 minutes.' : undefined
      });
    }
    
    // Successful login - clear failed attempts
    recordSuccess(ip);
    console.log('[auth/login] Login successful for:', email, 'role:', user.role);
    const token = issueToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[auth/login] Error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/auth/forgot', (req, res) => {
  const { email } = req.body || {};
  const user = findUserByEmail(email || '');
  if (!user) return res.status(200).json({ ok: true }); // do not leak
  const token = uuid();
  const expires = Date.now() + 60 * 60 * 1000;
  db.prepare('UPDATE users SET reset_token=?, reset_expires=? WHERE id=?').run(token, expires, user.id);
  const resetPayload = { ok: true, message: 'Reset token generated' };
  if (isSmtpConfigured()) {
    const resetLink = `${req.headers.origin || ''}/reset-password?token=${token}`;
    sendMail({
      to: email,
      subject: 'Reset your LRB account password',
      text: `Use this link to reset your password: ${resetLink}\n\nIf you did not request this, please ignore.`,
      html: `<p>Use this link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, please ignore.</p>`
    }).catch((err) => console.error('SMTP send failed:', err));
    resetPayload.mode = 'smtp';
  } else {
    console.log(`[auth] Password reset token for ${email}: ${token}`);
    resetPayload.mode = 'manual';
    resetPayload.note = 'SMTP not configured; token logged to server console.';
  }
  return res.json(resetPayload);
});

router.post('/auth/reset', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password required' });
  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
  if (!user || !user.reset_expires || user.reset_expires < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
  const password_hash = await hashPassword(password);
  db.prepare('UPDATE users SET password_hash=?, reset_token=NULL, reset_expires=NULL WHERE id=?').run(
    password_hash,
    user.id
  );
  return res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.sub);
  return res.json({ user: sanitizeUser(user) });
});

// Email status & mode toggle
router.get('/email/status', requireAuth, requireAdmin, (_req, res) => {
  res.json({
    mode: config.emailMode || 'manual',
    smtpConfigured: isSmtpConfigured(),
    from: config.smtp.from || ''
  });
});

router.post('/email/mode', requireAuth, requireAdmin, (req, res) => {
  const { mode } = req.body || {};
  const nextMode = (mode || '').toLowerCase();
  if (!['manual', 'smtp'].includes(nextMode)) {
    return res.status(400).json({ error: 'mode must be manual or smtp' });
  }
  config.emailMode = nextMode;
  return res.json({ ok: true, mode: config.emailMode });
});

// ---- Orgs (admin) ----
router.post('/orgs', requireAuth, requireAdmin, (req, res) => {
  const { name, code } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const orgCode = code || name.toUpperCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 1000);
  const existing = findOrgByCode(orgCode);
  if (existing) return res.status(409).json({ error: 'code already exists' });
  const id = uuid();
  db.prepare('INSERT INTO organizations (id, name, code) VALUES (?, ?, ?)').run(id, name, orgCode);
  const org = db.prepare('SELECT * FROM organizations WHERE id=?').get(id);
  res.json({ org });
});

router.get('/orgs/:id', requireAuth, (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE id=?').get(req.params.id);
  if (!org || org.id !== req.user.org_id) return res.status(404).json({ error: 'Not found' });
  res.json({ org });
});

// ---- Submissions ----
router.post('/submissions', requireAuth, (req, res) => {
  const { year, payload, status } = req.body || {};
  const id = uuid();
  const now = new Date().toISOString();
  const role = getAuthRole(req);
  const normalizedStatus = (status || '').toString().toLowerCase();
  const finalStatus =
    role === 'user'
      ? 'draft'
      : (['draft', 'submitted'].includes(normalizedStatus) ? normalizedStatus : 'submitted');
  db.prepare(
    'INSERT INTO submissions (id, org_id, user_id, payload_json, year, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.user.org_id, getAuthUserId(req), JSON.stringify(payload || {}), year || null, finalStatus, now, now);
  const submission = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);

  recordSubmissionEvent({
    submissionId: id,
    orgId: req.user.org_id,
    userId: getAuthUserId(req),
    eventType: 'created',
    ip: getClientIP(req),
    userAgent: getRequestUserAgent(req)
  });

  res.json({ submission });
});

router.get('/submissions', requireAuth, async (req, res) => {
  try {
    const { year } = req.query;
    
    // Get user's county and agency from database
    const user = db.prepare('SELECT county, agency, role FROM users WHERE id=?').get(getAuthUserId(req));
    
    // Admin users can see all submissions in their org
    // Regular users can only see submissions matching their county/agency
    let query, params;
    
    if (user?.role === 'admin') {
      // Admin: see all submissions in org
      if (year) {
        query = 'SELECT * FROM submissions WHERE org_id=? AND year=? ORDER BY created_at DESC';
        params = [req.user.org_id, year];
      } else {
        query = 'SELECT * FROM submissions WHERE org_id=? ORDER BY created_at DESC';
        params = [req.user.org_id];
      }
    } else if (user?.county && user?.agency) {
      // Regular user: filter by county/agency from submission payload
      if (year) {
        query = `
          SELECT * FROM submissions 
          WHERE org_id=? AND year=?
          ORDER BY created_at DESC
        `;
        params = [req.user.org_id, year];
      } else {
        query = `
          SELECT * FROM submissions 
          WHERE org_id=?
          ORDER BY created_at DESC
        `;
        params = [req.user.org_id];
      }
    } else {
      // User without county/agency: no submissions
      return res.json({ submissions: [] });
    }
    
    let submissions = db.prepare(query).all(...params);
    
    // Filter by county/agency for non-admin users by checking payload_json
    if (user?.role !== 'admin' && user?.county && user?.agency) {
      submissions = submissions.filter(sub => {
        try {
          const payload = typeof sub.payload_json === 'string' 
            ? JSON.parse(sub.payload_json) 
            : sub.payload_json || {};
          
          const submissionCounty = payload.county || '';
          const submissionAgency = payload.submitterName || payload.cityCounty || payload.city || payload.agency || '';
          
          return submissionCounty === user.county && submissionAgency === user.agency;
        } catch (e) {
          return false;
        }
      });
    }
    
    res.json({ submissions });
  } catch (error) {
    console.error('[submissions] Error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

router.put('/submissions/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { year, payload } = req.body || {};
  
  // Verify submission exists and belongs to user's org
  const existing = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Submission not found' });
  if (existing.org_id !== req.user.org_id) return res.status(403).json({ error: 'Forbidden' });

  const tokenRole = getAuthRole(req);
  const userRow = db.prepare('SELECT county, agency, role FROM users WHERE id=?').get(getAuthUserId(req));
  if (!authorizeSubmissionAccess({ submissionRow: existing, userRow, tokenRole })) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Prevent external users from modifying finalized submissions
  if (existing.status === 'final' && tokenRole === 'user') {
    return res.status(409).json({ error: 'Submission is final and cannot be edited' });
  }
  
  // Update submission
  const now = new Date().toISOString();
  const prevPayload = safeJsonParse(existing.payload_json, {});
  const changedFields = computeChangedTopLevelFields(prevPayload, payload || {});
  db.prepare(
    'UPDATE submissions SET payload_json=?, year=?, updated_at=? WHERE id=?'
  ).run(JSON.stringify(payload || {}), year || null, now, id);
  
  const submission = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);

  recordSubmissionEvent({
    submissionId: id,
    orgId: req.user.org_id,
    userId: getAuthUserId(req),
    eventType: 'updated',
    changedFields,
    payloadSnapshot: existing.status === 'final' ? (payload || {}) : null,
    ip: getClientIP(req),
    userAgent: getRequestUserAgent(req)
  });

  res.json({ submission });
});

router.post('/submissions/:id/finalize', requireAuth, (req, res) => {
  const { id } = req.params;
  const { attestationName } = req.body || {};
  const signerName = (attestationName || '').toString().trim();
  if (!signerName) return res.status(400).json({ error: 'attestationName is required' });

  const existing = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Submission not found' });
  if (existing.org_id !== req.user.org_id) return res.status(403).json({ error: 'Forbidden' });

  const tokenRole = getAuthRole(req);
  const userRow = db.prepare('SELECT county, agency, role FROM users WHERE id=?').get(getAuthUserId(req));
  if (!authorizeSubmissionAccess({ submissionRow: existing, userRow, tokenRole })) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (existing.status === 'final') {
    return res.status(409).json({ error: 'Submission is already final' });
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE submissions
     SET status='final', updated_at=?, finalized_at=?, finalized_by_user_id=?, finalized_by_name=?, finalized_ip=?, finalized_user_agent=?
     WHERE id=?`
  ).run(now, now, getAuthUserId(req), signerName, getClientIP(req), getRequestUserAgent(req), id);

  recordSubmissionEvent({
    submissionId: id,
    orgId: req.user.org_id,
    userId: getAuthUserId(req),
    eventType: 'finalized',
    payloadSnapshot: safeJsonParse(existing.payload_json, {}),
    ip: getClientIP(req),
    userAgent: getRequestUserAgent(req),
    note: signerName
  });

  const submission = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  res.json({ submission });
});

router.delete('/submissions/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Verify submission exists and belongs to user's org
  const existing = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Submission not found' });
  if (existing.org_id !== req.user.org_id) return res.status(403).json({ error: 'Forbidden' });

  const tokenRole = getAuthRole(req);
  const userRow = db.prepare('SELECT county, agency, role FROM users WHERE id=?').get(getAuthUserId(req));
  if (!authorizeSubmissionAccess({ submissionRow: existing, userRow, tokenRole })) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (existing.status === 'final' && tokenRole === 'user') {
    return res.status(409).json({ error: 'Submission is final and cannot be deleted' });
  }
  
  // Count project-specific tax rates that will be cascade deleted
  const projectTaxRatesCount = db.prepare('SELECT COUNT(*) as count FROM tax_rates WHERE submission_id=?').get(id);
  
  // Delete submission (cascade will handle related records like uploads and project-specific tax_rates)
  // Note: Master tax rates (submission_id IS NULL) are NOT affected
  db.prepare('DELETE FROM submissions WHERE id=?').run(id);

  recordSubmissionEvent({
    submissionId: id,
    orgId: req.user.org_id,
    userId: getAuthUserId(req),
    eventType: 'deleted',
    ip: getClientIP(req),
    userAgent: getRequestUserAgent(req)
  });
  
  console.log(`[DELETE /submissions/${id}] Deleted submission. Cascade deleted ${projectTaxRatesCount.count} project-specific tax rate(s). Master tax rates (scrape DB) remain untouched.`);
  
  res.json({ 
    ok: true, 
    message: 'Submission deleted successfully',
    deletedTaxRates: projectTaxRatesCount.count 
  });
});

// ---- Uploads ----
router.post('/uploads', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const { submissionId } = req.body || {};
  if (!submissionId) return res.status(400).json({ error: 'submissionId is required' });
  const storedName = req.file.filename;
  db.prepare(
    'INSERT INTO uploads (id, submission_id, stored_name, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuid(), submissionId, storedName, req.file.originalname, req.file.mimetype, req.file.size);
  const fileUrl = `/uploads/${storedName}`;
  res.json({
    storedName,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: fileUrl
  });
});

router.get('/uploads/submission/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  const submission = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.org_id !== req.user.org_id) return res.status(403).json({ error: 'Forbidden' });

  const tokenRole = getAuthRole(req);
  const userRow = db.prepare('SELECT county, agency, role FROM users WHERE id=?').get(getAuthUserId(req));
  if (!authorizeSubmissionAccess({ submissionRow: submission, userRow, tokenRole })) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const uploads = db
    .prepare(
      `SELECT id, stored_name, original_name, mime_type, size, created_at
       FROM uploads
       WHERE submission_id=?
       ORDER BY created_at DESC`
    )
    .all(id)
    .map((u) => ({
      id: u.id,
      storedName: u.stored_name,
      originalName: u.original_name,
      mimeType: u.mime_type,
      size: u.size,
      createdAt: u.created_at,
      url: `/uploads/${u.stored_name}`
    }));

  res.json({ uploads });
});

// ---- Reports ----
router.post('/reports/tif', requireAuth, async (req, res) => {
  try {
    console.log('[reports/tif] Request received');
    const { submissionId, year, projectionYears = 20 } = req.body || {};
    
    if (!submissionId) {
      console.error('[reports/tif] Missing submissionId');
      return res.status(400).json({ error: 'submissionId is required' });
    }
    
    console.log('[reports/tif] Fetching submission:', submissionId);
    // Fetch submission
    const submission = db.prepare('SELECT * FROM submissions WHERE id=? AND org_id=?')
      .get(submissionId, req.user.org_id);
    
    if (!submission) {
      console.error('[reports/tif] Submission not found:', submissionId);
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    console.log('[reports/tif] Parsing submission payload');
    // Parse submission payload to get county/agency/project
    let submissionData;
    try {
      submissionData = JSON.parse(submission.payload_json);
    } catch (parseError) {
      console.error('[reports/tif] Failed to parse payload_json:', parseError);
      return res.status(400).json({ error: 'Invalid submission data format', details: parseError.message });
    }
    
    const county = submissionData.county;
    const agency = submissionData.submitterName || submissionData.cityCounty || submissionData.city;
    const project = submissionData.projectAreaName || submissionData.projectArea;
    const reportYear = year || submission.year || parseInt(submissionData.year) || new Date().getFullYear();
    
    console.log('[reports/tif] County:', county, 'Agency:', agency, 'Project:', project, 'Year:', reportYear);
    
    // Fetch tax rates matching county/agency/project (preferred) or fallback to org-wide
    let taxRates = [];
    if (county && agency && project) {
      console.log('[reports/tif] Fetching tax rates by county/agency/project');
      // Try to match by county/agency/project first
      taxRates = db.prepare(`
        SELECT * FROM tax_rates 
        WHERE org_id=? 
          AND county=? 
          AND agency=? 
          AND project=?
          AND year=?
        ORDER BY entity_name
      `).all(req.user.org_id, county, agency, project, reportYear);
      
      // If no exact match, try without year constraint
      if (taxRates.length === 0) {
        console.log('[reports/tif] No exact match, trying without year');
        taxRates = db.prepare(`
          SELECT * FROM tax_rates 
          WHERE org_id=? 
            AND county=? 
            AND agency=? 
            AND project=?
          ORDER BY year DESC, entity_name
        `).all(req.user.org_id, county, agency, project);
      }
      
      // If still no match, try with just county/agency
      if (taxRates.length === 0) {
        console.log('[reports/tif] No project match, trying county/agency only');
        taxRates = db.prepare(`
          SELECT * FROM tax_rates 
          WHERE org_id=? 
            AND county=? 
            AND agency=?
          AND year=?
          ORDER BY entity_name
        `).all(req.user.org_id, county, agency, reportYear);
      }
    }
    
    // Fallback: use submission_id or org-wide rates
    if (!taxRates || taxRates.length === 0) {
      console.log('[reports/tif] Using fallback: submission_id or org-wide rates');
      taxRates = db.prepare(`
        SELECT * FROM tax_rates 
        WHERE org_id=? AND (submission_id=? OR submission_id IS NULL)
        ORDER BY year DESC, entity_name
        LIMIT 100
      `).all(req.user.org_id, submissionId);
    }
    
    console.log('[reports/tif] Found', taxRates.length, 'tax rates');
    
    // Import generator
    console.log('[reports/tif] Importing TIF generator');
    const { generateTIFReport } = await import('./reports/tifGenerator.js');
    
    // Generate Excel file
    console.log('[reports/tif] Generating Excel file...');
    const excelBuffer = await generateTIFReport({
      submission: submissionData,
      taxRates,
      year: reportYear,
      projectionYears
    });
    
    console.log('[reports/tif] Excel file generated, size:', excelBuffer.length);
    
    // Generate filename with yymmddHHMM format
    const { generateReportFilename, saveReport } = await import('./utils/reportStorage.js');
    const projectArea = submissionData.projectAreaName || 
                       submissionData.projectArea || 
                       'Project';
    const filename = generateReportFilename(projectArea, 'TIF');
    
    // Save report to database and disk
    try {
      const savedReport = await saveReport({
        buffer: excelBuffer,
        reportType: 'TIF',
        filename,
        orgId: req.user.org_id,
        userId: getAuthUserId(req),
        submissionId,
        county,
        agency,
        project,
        year: reportYear
      });
      console.log('[reports/tif] Report saved:', savedReport.id);
    } catch (saveError) {
      console.error('[reports/tif] Error saving report to database:', saveError);
      // Continue even if save fails - still return the file
    }
    
    // Return as download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(excelBuffer));
    
  } catch (error) {
    console.error('[reports/tif] Error:', error);
    console.error('[reports/tif] Error stack:', error.stack);
    console.error('[reports/tif] Submission ID:', req.body?.submissionId);
    console.error('[reports/tif] User org_id:', req.user?.org_id);
    res.status(500).json({ 
      error: 'TIF report generation failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.get('/reports/tif/:submissionId', requireAuth, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { year, projectionYears = 20 } = req.query || {};
    
    // Fetch submission
    const submission = db.prepare('SELECT * FROM submissions WHERE id=? AND org_id=?')
      .get(submissionId, req.user.org_id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // Parse submission payload to get county/agency/project
    const submissionData = JSON.parse(submission.payload_json);
    const county = submissionData.county;
    const agency = submissionData.submitterName || submissionData.cityCounty || submissionData.city;
    const project = submissionData.projectAreaName || submissionData.projectArea;
    const reportYear = year ? parseInt(year) : submission.year || parseInt(submissionData.year) || new Date().getFullYear();
    
    // Fetch tax rates matching county/agency/project (preferred) or fallback to org-wide
    let taxRates;
    if (county && agency && project) {
      // Try to match by county/agency/project first
      taxRates = db.prepare(`
        SELECT * FROM tax_rates 
        WHERE org_id=? 
          AND county=? 
          AND agency=? 
          AND project=?
          AND year=?
        ORDER BY entity_name
      `).all(req.user.org_id, county, agency, project, reportYear);
      
      // If no exact match, try without year constraint
      if (taxRates.length === 0) {
        taxRates = db.prepare(`
          SELECT * FROM tax_rates 
          WHERE org_id=? 
            AND county=? 
            AND agency=? 
            AND project=?
          ORDER BY year DESC, entity_name
        `).all(req.user.org_id, county, agency, project);
      }
      
      // If still no match, try with just county/agency
      if (taxRates.length === 0) {
        taxRates = db.prepare(`
          SELECT * FROM tax_rates 
          WHERE org_id=? 
            AND county=? 
            AND agency=?
            AND year=?
          ORDER BY entity_name
        `).all(req.user.org_id, county, agency, reportYear);
      }
    }
    
    // Fallback: use submission_id or org-wide rates
    if (!taxRates || taxRates.length === 0) {
      taxRates = db.prepare(`
        SELECT * FROM tax_rates 
        WHERE org_id=? AND (submission_id=? OR submission_id IS NULL)
        ORDER BY year DESC, entity_name
        LIMIT 100
      `).all(req.user.org_id, submissionId);
    }
    
    // Import generator
    const { generateTIFReport } = await import('./reports/tifGenerator.js');
    
    // Generate Excel file
    const excelBuffer = await generateTIFReport({
      submission: submissionData,
      taxRates,
      year: reportYear,
      projectionYears: projectionYears ? parseInt(projectionYears) : 20
    });
    
    // Generate filename with yymmddHHMM format
    const { generateReportFilename, saveReport } = await import('./utils/reportStorage.js');
    const projectArea = submissionData.projectAreaName || 
                       submissionData.projectArea || 
                       'Project';
    const filename = generateReportFilename(projectArea, 'TIF');
    
    // Save report to database and disk
    try {
      const savedReport = await saveReport({
        buffer: excelBuffer,
        reportType: 'TIF',
        filename,
        orgId: req.user.org_id,
        userId: getAuthUserId(req),
        submissionId,
        county,
        agency,
        project,
        year: reportYear
      });
      console.log('[reports/tif/:id] Report saved:', savedReport.id);
    } catch (saveError) {
      console.error('[reports/tif/:id] Error saving report to database:', saveError);
      // Continue even if save fails - still return the file
    }
    
    // Return as download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(excelBuffer));
    
  } catch (error) {
    console.error('[reports/tif/:id] Error:', error);
    res.status(500).json({ error: 'TIF report generation failed', details: error.message });
  }
});

// JUN30 Report endpoint - accepts PDF buffer from frontend and saves it
router.post('/reports/jun30', requireAuth, async (req, res) => {
  try {
    const { submissionId, pdfBuffer, county, agency, project, year } = req.body || {};
    
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required' });
    }
    
    if (!pdfBuffer) {
      return res.status(400).json({ error: 'pdfBuffer is required (base64 encoded PDF)' });
    }
    
    // Fetch submission to get metadata
    const submission = db.prepare('SELECT * FROM submissions WHERE id=? AND org_id=?')
      .get(submissionId, req.user.org_id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // Parse submission payload if needed
    let submissionData = {};
    try {
      submissionData = JSON.parse(submission.payload_json);
    } catch (e) {
      // Ignore parse errors
    }
    
    // Use provided values or extract from submission
    const reportCounty = county || submissionData.county;
    const reportAgency = agency || submissionData.submitterName || submissionData.cityCounty || submissionData.city;
    const reportProject = project || submissionData.projectAreaName || submissionData.projectArea || 'Project';
    const reportYear = year || submission.year || parseInt(submissionData.year) || new Date().getFullYear();
    
    // Convert base64 buffer to actual buffer
    const pdfData = Buffer.from(pdfBuffer, 'base64');
    
    // Generate filename
    const { generateReportFilename, saveReport } = await import('./utils/reportStorage.js');
    const filename = generateReportFilename(reportProject, 'JUN30').replace('.xlsx', '.pdf');
    
    // Save report to database and disk
    const savedReport = await saveReport({
      buffer: pdfData,
      reportType: 'JUN30',
      filename,
      orgId: req.user.org_id,
      userId: getAuthUserId(req),
      submissionId,
      county: reportCounty,
      agency: reportAgency,
      project: reportProject,
      year: reportYear,
      mimeType: 'application/pdf'
    });
    
    res.json({
      success: true,
      reportId: savedReport.id,
      filename: savedReport.filename,
      message: 'JUN30 report saved successfully'
    });
    
  } catch (error) {
    console.error('[reports/jun30] Error:', error);
    res.status(500).json({ 
      error: 'JUN30 report save failed', 
      details: error.message 
    });
  }
});

// Get JUN30 report for a single project
router.post('/reports/jun30/:submissionId', requireAuth, async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    // Fetch submission
    const submission = db.prepare('SELECT * FROM submissions WHERE id=? AND org_id=?')
      .get(submissionId, req.user.org_id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // For now, return a message that this endpoint will generate the report
    // In the future, this could generate a single-project JUN30 report
    res.json({
      message: 'Single project JUN30 report generation - to be implemented',
      submissionId
    });
    
  } catch (error) {
    console.error('[reports/jun30/:id] Error:', error);
    res.status(500).json({ error: 'JUN30 report generation failed', details: error.message });
  }
});

// ---- Tax Rates ----
// Get master tax rates (org-wide, not project-specific)
router.get('/tax-rates/master', requireAuth, (req, res) => {
  try {
    const rates = db.prepare(`
      SELECT entity_name, project, year, rate, 
             real_property_rate, personal_property_rate, centrally_assessed_rate,
             county, agency
      FROM tax_rates 
      WHERE org_id=? AND (submission_id IS NULL OR submission_id = '')
      ORDER BY entity_name, project, year DESC
    `).all(req.user.org_id);
    
    res.json({ rates });
  } catch (error) {
    console.error('[tax-rates/master] Error:', error);
    res.status(500).json({ error: 'Failed to fetch master rates', details: error.message });
  }
});

// Get tax rates for a specific submission
router.get('/tax-rates/submission/:submissionId', requireAuth, (req, res) => {
  try {
    const { submissionId } = req.params;
    
    // Verify submission belongs to user's org
    const submission = db.prepare('SELECT * FROM submissions WHERE id=? AND org_id=?')
      .get(submissionId, req.user.org_id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    const rates = db.prepare(`
      SELECT * FROM tax_rates 
      WHERE org_id=? AND submission_id=?
      ORDER BY entity_name, year
    `).all(req.user.org_id, submissionId);
    
    res.json({ rates });
  } catch (error) {
    console.error('[tax-rates/submission] Error:', error);
    res.status(500).json({ error: 'Failed to fetch submission rates', details: error.message });
  }
});

// Import tax rates (master or project-specific)
router.post('/tax-rates/import', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File required' });
    }
    
    const { submissionId, isMaster } = req.body || {};
    const importAsMaster = isMaster === 'true' || isMaster === true;
    
    // If importing as master, submissionId is not required
    // If importing for project, submissionId is required
    if (!importAsMaster && !submissionId) {
      return res.status(400).json({ error: 'submissionId is required when importing project-specific rates' });
    }
    
    // If importing for project, verify submission exists
    if (!importAsMaster) {
      const submission = db.prepare('SELECT * FROM submissions WHERE id=? AND org_id=?')
        .get(submissionId, req.user.org_id);
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }
    }
    
    // Parse CSV/Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Expected format: Entity, Year, Rate
    const importedRates = [];
    const now = new Date().toISOString();
    
    // Delete existing rates
    if (importAsMaster) {
      // Delete all master rates for this org
      db.prepare('DELETE FROM tax_rates WHERE org_id=? AND (submission_id IS NULL OR submission_id = "")')
        .run(req.user.org_id);
    } else {
      // Delete rates for this submission
      db.prepare('DELETE FROM tax_rates WHERE org_id=? AND submission_id=?')
        .run(req.user.org_id, submissionId);
    }
    
    // Insert new rates
    for (const row of data) {
      const entityName = row.Entity || row['Tax Entity'] || row.entity_name || '';
      const year = parseInt(row.Year || row.year || row['Tax Year']);
      const rate = parseFloat(row.Rate || row.rate || row['Tax Rate']);
      
      if (entityName && year && !isNaN(rate)) {
        const id = uuid();
        const targetSubmissionId = importAsMaster ? null : submissionId;
        
        db.prepare(`
          INSERT INTO tax_rates (id, org_id, submission_id, entity_name, year, rate, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.user.org_id, targetSubmissionId, entityName, year, rate, now, now);
        
        importedRates.push({ entityName, year, rate });
      }
    }
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({
      ok: true,
      imported: importedRates.length,
      isMaster: importAsMaster,
      rates: importedRates
    });
    
  } catch (error) {
    console.error('[tax-rates/import] Error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Tax rate import failed', details: error.message });
  }
});

// ---- Tax Rate Scraping ----
router.post('/tax-rates/scrape', requireAuth, async (req, res) => {
  try {
    const { taxYear, county, agency, project, isMaster = false } = req.body || {};
    
    if (!taxYear || !county || !agency || !project) {
      return res.status(400).json({ 
        error: 'taxYear, county, agency, and project are required' 
      });
    }
    
    // Import scraper
    const { scrapeUtahTaxRates } = await import('./scrapers/utahTaxRates.js');
    
    // Scrape rates
    const result = await scrapeUtahTaxRates({
      taxYear: parseInt(taxYear),
      county,
      agency,
      project,
      orgId: req.user.org_id,
      submissionId: isMaster ? null : req.body.submissionId || null
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[tax-rates/scrape] Error:', error);
    res.status(500).json({ 
      error: 'Scraping failed', 
      details: error.message 
    });
  }
});

router.post('/tax-rates/scrape-all', requireAuth, async (req, res) => {
  try {
    const { taxYear = 2025, counties = null } = req.body || {};
    const countyFilters = Array.isArray(counties) && counties.length ? counties : null;
    
    // Import scraper
    const { scrapeAllUtahTaxRates } = await import('./scrapers/utahTaxRates.js');
    
    // Start bulk scraping (this will take a long time)
    // Return immediately and let it run in background
    res.json({ 
      message: 'Bulk scraping started',
      taxYear: parseInt(taxYear),
      status: 'processing'
    });
    
    // Run scraping in background (don't await - let it run)
    scrapeAllUtahTaxRates({
      taxYear: parseInt(taxYear),
      orgId: req.user.org_id,
      countyFilters,
      onProgress: (county, agency, project, ratesCount) => {
        console.log(`[bulkScrape] Progress: ${county} > ${agency} > ${project}: ${ratesCount} rates`);
      }
    }).then(results => {
      console.log('[bulkScrape] Completed:', {
        totalCounties: results.totalCounties,
        totalAgencies: results.totalAgencies,
        totalProjects: results.totalProjects,
        totalRates: results.totalRates,
        errors: results.errors.length
      });
    }).catch(error => {
      console.error('[bulkScrape] Failed:', error);
    });
    
  } catch (error) {
    console.error('[tax-rates/scrape-all] Error:', error);
    res.status(500).json({ 
      error: 'Failed to start bulk scraping', 
      details: error.message 
    });
  }
});

router.get('/tax-rates/options', requireAuth, async (req, res) => {
  try {
    // Import scraper
    const { getUtahTaxRateOptions } = await import('./scrapers/utahTaxRates.js');
    
    // Get available options
    const options = await getUtahTaxRateOptions();
    
    res.json(options);
    
  } catch (error) {
    console.error('[tax-rates/options] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get options', 
      details: error.message 
    });
  }
});

// Basic error handler
router.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Request failed' });
});

export default router;


