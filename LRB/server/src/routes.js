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
router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, orgCode } = req.body || {};
    if (!email || !password || !orgCode) {
      return res.status(400).json({ error: 'email, password, orgCode are required' });
    }
    const org = findOrgByCode(orgCode);
    if (!org) return res.status(400).json({ error: 'Invalid org code' });
    const existing = findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'User already exists' });
    const password_hash = await hashPassword(password);
    // Force client role on self-signup; internal/admin users must be provisioned separately
    const user = createUser({ email, password_hash, role: 'user', org_id: org.id });
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
    console.log('[auth/login] Attempting login for:', email ? email.toLowerCase() : 'no email');
    const user = findUserByEmail(email || '');
    if (!user) {
      console.log('[auth/login] User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      console.log('[auth/login] Password incorrect for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
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
  const { year, payload } = req.body || {};
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO submissions (id, org_id, user_id, payload_json, year, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.user.org_id, req.user.sub, JSON.stringify(payload || {}), year || null, now, now);
  const submission = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  res.json({ submission });
});

router.get('/submissions', requireAuth, (req, res) => {
  const { year } = req.query;
  const stmt =
    year ?
      db.prepare('SELECT * FROM submissions WHERE org_id=? AND year=? ORDER BY created_at DESC') :
      db.prepare('SELECT * FROM submissions WHERE org_id=? ORDER BY created_at DESC');
  const submissions = year ? stmt.all(req.user.org_id, year) : stmt.all(req.user.org_id);
  res.json({ submissions });
});

router.put('/submissions/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { year, payload } = req.body || {};
  
  // Verify submission exists and belongs to user's org
  const existing = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Submission not found' });
  if (existing.org_id !== req.user.org_id) return res.status(403).json({ error: 'Forbidden' });
  
  // Update submission
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE submissions SET payload_json=?, year=?, updated_at=? WHERE id=?'
  ).run(JSON.stringify(payload || {}), year || null, now, id);
  
  const submission = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  res.json({ submission });
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

// ---- Reports ----
router.post('/reports/tif', requireAuth, async (req, res) => {
  try {
    const { submissionId, year, projectionYears = 20 } = req.body || {};
    
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required' });
    }
    
    // Fetch submission
    const submission = db.prepare('SELECT * FROM submissions WHERE id=? AND org_id=?')
      .get(submissionId, req.user.org_id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // Fetch tax rates for this submission
    const taxRates = db.prepare(`
      SELECT * FROM tax_rates 
      WHERE org_id=? AND (submission_id=? OR submission_id IS NULL)
      ORDER BY year, entity_name
    `).all(req.user.org_id, submissionId);
    
    // Import generator
    const { generateTIFReport } = await import('./reports/tifGenerator.js');
    
    // Generate Excel file
    const excelBuffer = await generateTIFReport({
      submission: JSON.parse(submission.payload_json),
      taxRates,
      year: year || submission.year,
      projectionYears
    });
    
    // Generate filename
    const projectArea = JSON.parse(submission.payload_json).projectAreaName || 
                       JSON.parse(submission.payload_json).projectArea || 
                       'Project';
    const reportYear = year || submission.year || new Date().getFullYear();
    const filename = `TIF_Report_${projectArea.replace(/\s+/g, '_')}_${reportYear}.xlsx`;
    
    // Return as download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(excelBuffer));
    
  } catch (error) {
    console.error('[reports/tif] Error:', error);
    res.status(500).json({ error: 'TIF report generation failed', details: error.message });
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
    
    // Fetch tax rates
    const taxRates = db.prepare(`
      SELECT * FROM tax_rates 
      WHERE org_id=? AND (submission_id=? OR submission_id IS NULL)
      ORDER BY year, entity_name
    `).all(req.user.org_id, submissionId);
    
    // Import generator
    const { generateTIFReport } = await import('./reports/tifGenerator.js');
    
    // Generate Excel file
    const excelBuffer = await generateTIFReport({
      submission: JSON.parse(submission.payload_json),
      taxRates,
      year: year ? parseInt(year) : submission.year,
      projectionYears: projectionYears ? parseInt(projectionYears) : 20
    });
    
    // Generate filename
    const projectArea = JSON.parse(submission.payload_json).projectAreaName || 
                       JSON.parse(submission.payload_json).projectArea || 
                       'Project';
    const reportYear = year || submission.year || new Date().getFullYear();
    const filename = `TIF_Report_${projectArea.replace(/\s+/g, '_')}_${reportYear}.xlsx`;
    
    // Return as download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(excelBuffer));
    
  } catch (error) {
    console.error('[reports/tif/:id] Error:', error);
    res.status(500).json({ error: 'TIF report generation failed', details: error.message });
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


