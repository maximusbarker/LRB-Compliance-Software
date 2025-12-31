import express from 'express';
import cors from 'cors';
import path from 'path';
import config from './config.js';
import './db.js'; // ensure schema/seed
import routes from './routes.js';

const app = express();

// CORS configuration - allow all origins for local development (including file://)
app.use(cors({ 
  origin: config.allowOrigin === '*' ? true : (origin, callback) => {
    // Allow null origin (file://) for local development
    if (!origin || origin === 'null') {
      return callback(null, true);
    }
    // Allow configured origin
    if (origin === config.allowOrigin) {
      return callback(null, true);
    }
    callback(null, true); // Allow all for now - can restrict in production
  },
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files locally
app.use('/uploads', express.static(path.resolve(config.uploadDir)));

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'LRB compliance API running' });
});

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});


