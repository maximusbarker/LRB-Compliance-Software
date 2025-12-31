import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveSqlitePath(url) {
  if (!url || url.startsWith('sqlite://')) {
    const raw = (url || 'sqlite://./dev.db').replace('sqlite://', '');
    // Resolve relative to project root (server/..)
    const base = path.resolve(__dirname, '..');
    return path.resolve(base, raw);
  }
  return url;
}

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || '../uploads'),
  allowOrigin: process.env.ALLOW_ORIGIN || '*',
  emailMode: (process.env.EMAIL_MODE || 'manual').toLowerCase(), // manual | smtp
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || ''
  },
  database: {
    client: 'sqlite',
    filename: resolveSqlitePath(process.env.DATABASE_URL)
  }
};

export default config;


