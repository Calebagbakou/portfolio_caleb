'use strict';
/**
 * CALEB CREATIVE — Serveur API + administration.
 *
 *   Frontend (portfolio + boutique)  →  API Express  →  SQLite  →  Stockage médias
 *
 * Le même processus peut servir :
 *   - le site statique existant (index.html, /boutique, /assets…)
 *   - l'interface d'administration (/admin)
 *   - l'API publique (/api/public/*) et l'API admin (/api/admin/*)
 *   - les fichiers médias (/media/:id)
 */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { db } = require('./db');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');
const { ensureSeed } = require('./db/seed');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* --------------------------- Sécurité HTTP -------------------------- */
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // le site existant utilise des scripts/styles en ligne
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'media-src': ["'self'", 'blob:', 'https:'],
      'frame-src': ["'self'", 'https://player.vimeo.com', 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      'connect-src': ["'self'", ...config.corsOrigins],
      'object-src': ["'none'"],
      'frame-ancestors': ["'self'", 'https:'],       // autorise l'aperçu en iframe
      'upgrade-insecure-requests': null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: false,
}));

/* ------------------------------- CORS ------------------------------- */
// Utile si le portfolio est hébergé ailleurs (GitHub Pages) et appelle l'API.
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                       // même origine / outils
    if (!config.corsOrigins.length) return cb(null, true);    // pas de restriction configurée
    return cb(null, config.corsOrigins.includes(origin));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

app.use(cookieParser());

// Le webhook de paiement doit recevoir le corps brut (vérification de signature).
const jsonParser = express.json({ limit: '1mb' });
app.use((req, res, next) => (req.path.startsWith('/api/payments/webhook') ? next() : jsonParser(req, res, next)));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessaie dans un instant.' },
}));

/* ------------------------------ Routes ------------------------------ */
const media = require('./routes/media');

app.get('/api/health', (req, res) => res.json({
  ok: true,
  service: 'caleb-creative-api',
  time: new Date().toISOString(),
  storage: config.storage.driver,
  payments: config.payments.provider || null,
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/payments', require('./routes/payments'));
app.use('/media', media.publicRouter);

// ---- API d'administration : tout est protégé par requireAuth ----
const admin = express.Router();
admin.use(requireAuth);
admin.use('/dashboard', require('./routes/dashboard'));
admin.use('/media', media.router);
admin.use('/messages', require('./routes/messages'));
admin.use('/', require('./routes/content'));
admin.use('/shop', require('./routes/shop'));
app.use('/api/admin', admin);

/* -------------------- Interface d'administration -------------------- */
const adminDir = path.join(config.siteRoot, 'admin');
app.use('/admin', express.static(adminDir, { index: 'index.html', extensions: ['html'] }));
app.get(/^\/admin(\/.*)?$/, (req, res) => res.sendFile(path.join(adminDir, 'index.html')));

/* ------------------------- Site statique ---------------------------- */
if (config.serveStaticSite) {
  app.use(express.static(config.siteRoot, {
    index: 'index.html',
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (/\.(png|jpe?g|webp|gif|svg|ico|mp4|webm)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  }));
}

app.use(notFound);
app.use(errorHandler);

/* ------------------------------ Boot -------------------------------- */
if (require.main === module) {
  ensureSeed();
  const server = app.listen(config.port, config.host, () => {
    console.log(`\n  Caleb Creative API`);
    console.log(`  ├─ écoute sur http://${config.host}:${config.port}`);
    console.log(`  ├─ admin      http://localhost:${config.port}/admin`);
    console.log(`  ├─ API        http://localhost:${config.port}/api/public/site`);
    console.log(`  ├─ stockage   ${config.storage.driver} (${config.storage.localDir})`);
    console.log(`  └─ base       ${config.db.file}\n`);
  });
  const shutdown = () => { server.close(() => { db.close(); process.exit(0); }); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
