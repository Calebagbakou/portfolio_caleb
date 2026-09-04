'use strict';
/**
 * Configuration centrale — tout vient des variables d'environnement.
 * Aucun secret n'est écrit en dur dans le code.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');                 // /server
const SITE_ROOT = path.join(ROOT, '..');                 // racine du dépôt (portfolio statique)

function bool(v, def = false) {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}
function int(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

const isProd = process.env.NODE_ENV === 'production';

// JWT_SECRET : obligatoire en production. En dev, on en génère un éphémère
// (les sessions ne survivent alors pas à un redémarrage — c'est voulu).
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    console.error('[FATAL] JWT_SECRET est obligatoire en production. Ajoute-le dans les variables d\'environnement.');
    process.exit(1);
  }
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[warn] JWT_SECRET absent : secret temporaire généré pour le développement.');
}

const config = {
  isProd,
  port: int(process.env.PORT, 4000),
  host: process.env.HOST || '0.0.0.0',
  siteRoot: SITE_ROOT,
  serverRoot: ROOT,
  publicUrl: process.env.PUBLIC_URL || '',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  serveStaticSite: bool(process.env.SERVE_STATIC_SITE, true),

  db: {
    file: process.env.DATABASE_FILE || path.join(ROOT, 'data', 'caleb.db'),
  },

  auth: {
    jwtSecret,
    tokenTtl: process.env.SESSION_TTL || '7d',
    cookieName: process.env.SESSION_COOKIE || 'caleb_admin',
    csrfCookie: 'caleb_csrf',
    cookieSecure: bool(process.env.COOKIE_SECURE, isProd),
    cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
    bootstrapEmail: process.env.ADMIN_EMAIL || '',
    bootstrapPassword: process.env.ADMIN_PASSWORD || '',
    bootstrapName: process.env.ADMIN_NAME || 'Administrateur',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',   // local | s3 (s3 = à configurer)
    localDir: process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
    maxImageMb: int(process.env.MAX_IMAGE_MB, 10),
    maxVideoMb: int(process.env.MAX_VIDEO_MB, 200),
    maxFileMb: int(process.env.MAX_FILE_MB, 20),
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || '',
      endpoint: process.env.S3_ENDPOINT || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
    },
  },

  payments: {
    // Aucun prestataire n'est branché tant que PAYMENT_PROVIDER n'est pas défini.
    provider: process.env.PAYMENT_PROVIDER || '',      // '' | kkiapay | fedapay | stripe …
    publicKey: process.env.PAYMENT_PUBLIC_KEY || '',   // seule clé exposable au frontend
    secretKey: process.env.PAYMENT_SECRET_KEY || '',   // JAMAIS exposée
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
  },
};

fs.mkdirSync(path.dirname(config.db.file), { recursive: true });
fs.mkdirSync(config.storage.localDir, { recursive: true });

module.exports = config;
