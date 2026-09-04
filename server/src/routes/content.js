'use strict';
/**
 * CONTENU DU PORTFOLIO — projets, catégories, services, compétences,
 * témoignages, statistiques, FAQ, paramètres/textes du site.
 */
const express = require('express');
const { db, logActivity } = require('../db');
const { crudRouter } = require('../lib/crud');
const { HttpError, asyncHandler, parseJson, mediaPublic, toInt, uniqueSlug } = require('../lib/util');

const router = express.Router();

/* ----------------------------- helpers ----------------------------- */
function mediaById(id) {
  if (!id) return null;
  return mediaPublic(db.prepare('SELECT * FROM media WHERE id = ?').get(id));
}

function hydrateProject(row) {
  const gallery = db.prepare(
    `SELECT m.* FROM project_media pm JOIN media m ON m.id = pm.media_id
     WHERE pm.project_id = ? ORDER BY pm.position ASC, pm.id ASC`
  ).all(row.id).map(mediaPublic);
  const category = row.category_id
    ? db.prepare('SELECT id, slug, label, short_label FROM categories WHERE id = ?').get(row.category_id)
    : null;
  return {
    ...row,
    featured: !!row.featured,
    tools: parseJson(row.tools, []),
    cover: mediaById(row.cover_media_id),
    video: mediaById(row.video_media_id),
    gallery,
    category,
  };
}

function syncGallery(projectId, mediaIds) {
  if (!Array.isArray(mediaIds)) return;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM project_media WHERE project_id = ? AND role = ?').run(projectId, 'gallery');
    const stmt = db.prepare('INSERT INTO project_media (project_id, media_id, role, position) VALUES (?, ?, ?, ?)');
    mediaIds.forEach((mid, i) => {
      const id = toInt(mid, 0);
      if (id && db.prepare('SELECT 1 FROM media WHERE id = ?').get(id)) stmt.run(projectId, id, 'gallery', i);
    });
  });
  tx();
}

/* ---------------------------- CATÉGORIES ---------------------------- */
const categoryFields = [
  { name: 'scope', type: 'enum', values: ['project', 'product'], default: 'project' },
  { name: 'label', type: 'string', required: true, label: 'Libellé', maxLength: 120 },
  { name: 'short_label', type: 'string', maxLength: 60 },
  { name: 'position', type: 'int' },
  { name: 'status', type: 'enum', values: ['published', 'hidden'], default: 'published' },
];
router.use('/categories', crudRouter({
  table: 'categories',
  fields: categoryFields,
  slugFrom: 'label',
  searchColumns: ['label', 'slug'],
  orderBy: 'scope ASC, position ASC, id ASC',
  label: (r) => r.label,
  beforeDelete: (row) => {
    const used = row.scope === 'project'
      ? db.prepare('SELECT COUNT(*) c FROM projects WHERE category_id = ?').get(row.id).c
      : db.prepare('SELECT COUNT(*) c FROM products WHERE category_id = ?').get(row.id).c;
    if (used > 0) throw new HttpError(409, `Impossible : ${used} élément(s) utilisent encore cette catégorie.`);
  },
}));

/* ------------------------------ PROJETS ----------------------------- */
const projectFields = [
  { name: 'title', type: 'string', required: true, label: 'Titre', maxLength: 200 },
  { name: 'description', type: 'string', maxLength: 5000 },
  { name: 'category_id', type: 'ref' },
  { name: 'cover_media_id', type: 'ref' },
  { name: 'video_media_id', type: 'ref' },
  { name: 'video_url', type: 'string', maxLength: 500 },
  { name: 'external_url', type: 'string', maxLength: 500 },
  { name: 'gradient', type: 'string', maxLength: 200 },
  { name: 'project_date', type: 'string', maxLength: 40 },
  { name: 'tools', type: 'json', default: [] },
  { name: 'status', type: 'enum', values: ['published', 'draft'], default: 'published' },
  { name: 'featured', type: 'bool' },
  { name: 'position', type: 'int' },
];
router.use('/projects', crudRouter({
  table: 'projects',
  fields: projectFields,
  slugFrom: 'title',
  searchColumns: ['title', 'description'],
  hydrate: hydrateProject,
  label: (r) => r.title,
  afterWrite: (id, req) => {
    if (Object.prototype.hasOwnProperty.call(req.body, 'gallery_ids')) {
      syncGallery(id, parseJson(req.body.gallery_ids, req.body.gallery_ids) || []);
    }
  },
}));

/* ----------------------------- SERVICES ----------------------------- */
router.use('/services', crudRouter({
  table: 'services',
  fields: [
    { name: 'title', type: 'string', required: true, label: 'Titre', maxLength: 150 },
    { name: 'description', type: 'string', maxLength: 1500 },
    { name: 'icon', type: 'string', maxLength: 3000 },
    { name: 'media_id', type: 'ref' },
    { name: 'position', type: 'int' },
    { name: 'status', type: 'enum', values: ['published', 'hidden'], default: 'published' },
  ],
  searchColumns: ['title', 'description'],
  hydrate: (r) => ({ ...r, media: mediaById(r.media_id) }),
}));

/* -------------------------- COMPÉTENCES ----------------------------- */
router.use('/skills', crudRouter({
  table: 'skills',
  fields: [
    { name: 'name', type: 'string', required: true, label: 'Nom', maxLength: 120 },
    { name: 'group_label', type: 'string', maxLength: 80, default: 'LOGICIELS' },
    { name: 'avatar', type: 'string', maxLength: 6 },
    { name: 'media_id', type: 'ref' },
    { name: 'level', type: 'int' },
    { name: 'position', type: 'int' },
    { name: 'status', type: 'enum', values: ['published', 'hidden'], default: 'published' },
  ],
  orderBy: 'group_label DESC, position ASC, id ASC',
  searchColumns: ['name', 'group_label'],
  hydrate: (r) => ({ ...r, media: mediaById(r.media_id) }),
  label: (r) => r.name,
}));

/* --------------------------- TÉMOIGNAGES ---------------------------- */
router.use('/testimonials', crudRouter({
  table: 'testimonials',
  fields: [
    { name: 'author', type: 'string', required: true, label: 'Auteur', maxLength: 120 },
    { name: 'role', type: 'string', maxLength: 120 },
    { name: 'content', type: 'string', required: true, label: 'Commentaire', maxLength: 2000 },
    { name: 'rating', type: 'int', default: 5 },
    { name: 'media_id', type: 'ref' },
    { name: 'status', type: 'enum', values: ['pending', 'published', 'hidden'], default: 'pending' },
    { name: 'position', type: 'int' },
  ],
  orderBy: 'created_at DESC',
  searchColumns: ['author', 'content'],
  hydrate: (r) => ({ ...r, media: mediaById(r.media_id) }),
  label: (r) => r.author,
}));

/* --------------------------- STATISTIQUES --------------------------- */
router.use('/stats', crudRouter({
  table: 'stats',
  fields: [
    { name: 'key', type: 'string', required: true, label: 'Clé', maxLength: 60 },
    { name: 'label', type: 'string', required: true, label: 'Libellé', maxLength: 120 },
    { name: 'value', type: 'int' },
    { name: 'suffix', type: 'string', maxLength: 10 },
    { name: 'position', type: 'int' },
    { name: 'status', type: 'enum', values: ['published', 'hidden'], default: 'published' },
  ],
  searchColumns: ['label', 'key'],
  label: (r) => r.label,
}));

/* -------------------------------- FAQ ------------------------------- */
router.use('/faqs', crudRouter({
  table: 'faqs',
  fields: [
    { name: 'question', type: 'string', required: true, label: 'Question', maxLength: 300 },
    { name: 'answer', type: 'string', required: true, label: 'Réponse', maxLength: 3000 },
    { name: 'position', type: 'int' },
    { name: 'status', type: 'enum', values: ['published', 'hidden'], default: 'published' },
  ],
  searchColumns: ['question', 'answer'],
  label: (r) => r.question,
}));

/* ---------------------------- PARAMÈTRES ---------------------------- */
router.get('/settings', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM settings ORDER BY group_name ASC, position ASC, key ASC').all();
  res.json({ data: rows });
}));

router.put('/settings', asyncHandler(async (req, res) => {
  const values = req.body?.values && typeof req.body.values === 'object' ? req.body.values : req.body;
  if (!values || typeof values !== 'object') throw new HttpError(422, 'Aucune valeur à enregistrer.');
  const upd = db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?");
  const ins = db.prepare("INSERT INTO settings (key, value, type, group_name, label) VALUES (?, ?, 'text', 'general', ?)");
  const tx = db.transaction((entries) => {
    for (const [key, raw] of entries) {
      const value = raw === null || raw === undefined ? '' : String(raw);
      if (value.length > 20000) throw new HttpError(422, `Valeur trop longue pour « ${key} ».`);
      const info = upd.run(value, key);
      if (info.changes === 0) ins.run(key, value, key);
    }
  });
  tx(Object.entries(values));
  logActivity(req.admin, 'update', 'settings', '', Object.keys(values).join(', ').slice(0, 200));
  res.json({ data: db.prepare('SELECT * FROM settings ORDER BY group_name, position').all() });
}));

router.post('/settings', asyncHandler(async (req, res) => {
  const key = String(req.body.key || '').trim();
  if (!/^[a-z0-9_.]{2,60}$/i.test(key)) throw new HttpError(422, 'Clé invalide (a-z, 0-9, _ et . uniquement).');
  db.prepare(
    `INSERT INTO settings (key, value, type, group_name, label, help, position)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, type = excluded.type,
       group_name = excluded.group_name, label = excluded.label, help = excluded.help`
  ).run(
    key, String(req.body.value || ''), String(req.body.type || 'text'),
    String(req.body.group_name || 'general'), String(req.body.label || key),
    String(req.body.help || ''), toInt(req.body.position, 99)
  );
  res.status(201).json({ data: db.prepare('SELECT * FROM settings WHERE key = ?').get(key) });
}));

router.delete('/settings/:key', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);
  res.json({ ok: true });
}));

module.exports = router;
