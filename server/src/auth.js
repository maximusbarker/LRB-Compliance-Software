import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import config from './config.js';
import { db } from './db.js';

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, reset_token, reset_expires, ...rest } = user;
  return rest;
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, org_id: user.org_id, role: user.role },
    config.jwtSecret,
    { expiresIn: '2h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE LOWER(email)=LOWER(?)').get(email);
}

function findOrgByCode(code) {
  return db.prepare('SELECT * FROM organizations WHERE code = ?').get(code);
}

function createUser({ email, password_hash, role = 'user', org_id }) {
  const id = uuid();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, role, org_id) VALUES (?, ?, ?, ?, ?)'
  ).run(id, email, password_hash, role, org_id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export {
  sanitizeUser,
  issueToken,
  requireAuth,
  requireAdmin,
  hashPassword,
  verifyPassword,
  findUserByEmail,
  findOrgByCode,
  createUser
};


