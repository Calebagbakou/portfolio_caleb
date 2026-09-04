'use strict';
/**
 * MÉDIAS — upload, remplacement, suppression, métadonnées.
 * Les fichiers vont dans le stockage (disque local ou S3) ; la base ne
 * garde que la référence. L'URL publique /media/:id est STABLE : remplacer
 * un fichier ne casse aucune référence côté frontend.
 */
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const config = require('../config');
const { db, logActivity } = require('../db');
const storage = require('../lib/storage');
const { HttpError, asyncHandler, mediaPublic } = require('../lib/util');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(config.storage.maxVideoMb, config.storage.maxImageMb, config.storage.maxFileMb) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!storage.kindForMime(file.mimetype)) {
      return cb(new HttpError(415, `Type de fichier non autorisé : ${file.mimetype}`));
    }
    cb(null, true);
  },
});

function validateSize(file) {
  const max = storage.maxBytesForMime(file.mimetype);
  if (file.size > max) {
    throw new HttpError(413, `Fichier trop volumineux (${(file.size / 1048576).toFixed(1)} Mo). Limite : ${(max / 1048576).toFixed(0)} Mo.`);
  }
}

/* ------------------------------ LISTE ------------------------------ */
router.get('/', asyncHandler(async (req, res) => {
  const filters = [];
  const values = [];
  if (req.query.kind) {
    const kinds = String(req.query.kind).split(',').map((k) => k.trim()).filter(Boolean);
    filters.push(`kind IN (${kinds.map(() => '?').join(',')})`);
    values.push(...kinds);
  }
  if (req.query.folder) { filters.push('folder = ?'); values.push(req.query.folder); }
  if (req.query.q) {
    filters.push('(original_name LIKE ? OR title LIKE ? OR alt LIKE ?)');
    values.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
  }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM media${where} ORDER BY id DESC LIMIT 500`).all(...values);
  res.json({ data: rows.map(mediaPublic) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Média introuvable.');
  res.json({ data: mediaPublic(row) });
}));

/* ------------------------------ UPLOAD ----------------------------- */
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucun fichier reçu (champ « file »).');
  validateSize(req.file);

  const detectedKind = storage.kindForMime(req.file.mimetype);
  const kind = ['image', 'video', 'logo', 'file'].includes(req.body.kind) ? req.body.kind : detectedKind;
  if (kind === 'logo' && detectedKind !== 'image') throw new HttpError(415, 'Un logo doit être une image.');
  if (kind === 'video' && detectedKind !== 'video') throw new HttpError(415, 'Ce fichier n’est pas une vidéo.');

  const key = storage.safeKey(req.file.mimetype, req.file.originalname);
  const saved = await storage.driver().save(req.file.buffer, key, req.file.mimetype);

  const info = db.prepare(
    `INSERT INTO media (kind, storage, storage_key, original_name, mime, size, alt, title, folder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    kind, saved.storage, saved.storage_key,
    String(req.file.originalname || '').slice(0, 180),
    req.file.mimetype, req.file.size,
    String(req.body.alt || '').slice(0, 250),
    String(req.body.title || '').slice(0, 250),
    String(req.body.folder || 'general').slice(0, 60)
  );
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid);
  logActivity(req.admin, 'upload', 'media', row.id, row.original_name);
  res.status(201).json({ data: mediaPublic(row) });
}));

/* -------- MÉDIA EXTERNE (Vimeo, YouTube, CDN…) : simple référence ------- */
router.post('/external', asyncHandler(async (req, res) => {
  const url = String(req.body.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new HttpError(422, 'URL invalide (http/https attendu).');
  const kind = ['image', 'video', 'logo', 'file'].includes(req.body.kind) ? req.body.kind : 'video';
  const info = db.prepare(
    `INSERT INTO media (kind, storage, external_url, original_name, mime, title, alt, folder)
     VALUES (?, 'external', ?, ?, '', ?, ?, ?)`
  ).run(kind, url, url.slice(0, 180), String(req.body.title || '').slice(0, 250), String(req.body.alt || '').slice(0, 250), String(req.body.folder || 'general'));
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid);
  logActivity(req.admin, 'create', 'media', row.id, url);
  res.status(201).json({ data: mediaPublic(row) });
}));

/* --------------------------- MÉTADONNÉES --------------------------- */
router.put('/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Média introuvable.');
  db.prepare(
    `UPDATE media SET alt = ?, title = ?, folder = ?, kind = ?, thumb_id = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    String(req.body.alt ?? row.alt).slice(0, 250),
    String(req.body.title ?? row.title).slice(0, 250),
    String(req.body.folder ?? row.folder).slice(0, 60),
    ['image', 'video', 'logo', 'file'].includes(req.body.kind) ? req.body.kind : row.kind,
    req.body.thumb_id ? parseInt(req.body.thumb_id, 10) : (req.body.thumb_id === null ? null : row.thumb_id),
    row.id
  );
  res.json({ data: mediaPublic(db.prepare('SELECT * FROM media WHERE id = ?').get(row.id)) });
}));

/* ----------------- REMPLACEMENT DU FICHIER (même id) ---------------- */
router.post('/:id/file', upload.single('file'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Média introuvable.');
  if (!req.file) throw new HttpError(400, 'Aucun fichier reçu (champ « file »).');
  validateSize(req.file);
  const detectedKind = storage.kindForMime(req.file.mimetype);
  if (row.kind === 'video' && detectedKind !== 'video') throw new HttpError(415, 'Le remplacement doit rester une vidéo.');
  if (['image', 'logo'].includes(row.kind) && detectedKind !== 'image') throw new HttpError(415, 'Le remplacement doit rester une image.');

  const key = storage.safeKey(req.file.mimetype, req.file.originalname);
  const saved = await storage.driver().save(req.file.buffer, key, req.file.mimetype);
  const oldKey = row.storage === 'local' || row.storage === 's3' ? row.storage_key : null;

  db.prepare(
    `UPDATE media SET storage = ?, storage_key = ?, external_url = '', original_name = ?, mime = ?, size = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(saved.storage, saved.storage_key, String(req.file.originalname || '').slice(0, 180), req.file.mimetype, req.file.size, row.id);

  if (oldKey && oldKey !== saved.storage_key) {
    try { await storage.driver().remove(oldKey); } catch (_) { /* non bloquant */ }
  }
  logActivity(req.admin, 'replace', 'media', row.id, req.file.originalname);
  res.json({ data: mediaPublic(db.prepare('SELECT * FROM media WHERE id = ?').get(row.id)) });
}));

/* ---------------------------- SUPPRESSION --------------------------- */
router.delete('/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Média introuvable.');
  db.prepare('DELETE FROM media WHERE id = ?').run(row.id);
  if (row.storage_key) {
    try { await storage.driver().remove(row.storage_key); } catch (_) { /* non bloquant */ }
  }
  logActivity(req.admin, 'delete', 'media', row.id, row.original_name);
  res.json({ ok: true });
}));

/* ------------- SERVICE PUBLIC DES FICHIERS : /media/:id ------------- */
const publicRouter = express.Router();
publicRouter.get('/:id', (req, res, next) => {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(parseInt(req.params.id, 10) || 0);
  if (!row) return next(new HttpError(404, 'Média introuvable.'));

  if (row.storage === 'external' && row.external_url) return res.redirect(302, row.external_url);

  if (row.storage === 's3') {
    const url = storage.driver().publicUrl(row.storage_key);
    if (url) return res.redirect(302, url);
    return next(new HttpError(500, 'S3_PUBLIC_BASE_URL non configuré.'));
  }

  const filePath = require('path').join(config.storage.localDir, row.storage_key || '');
  if (!row.storage_key || !fs.existsSync(filePath)) return next(new HttpError(404, 'Fichier introuvable sur le stockage.'));

  res.setHeader('Content-Type', row.mime || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Un SVG/HTML servi depuis notre domaine ne doit rien pouvoir exécuter.
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
  res.sendFile(filePath);            // gère les requêtes Range (streaming vidéo)
});

module.exports = { router, publicRouter };
