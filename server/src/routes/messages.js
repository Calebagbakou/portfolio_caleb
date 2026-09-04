'use strict';
const express = require('express');
const { db, logActivity } = require('../db');
const { HttpError, asyncHandler } = require('../lib/util');

const router = express.Router();
const STATUS = ['new', 'read', 'archived'];

router.get('/', asyncHandler(async (req, res) => {
  const filters = [];
  const values = [];
  if (req.query.status && STATUS.includes(req.query.status)) { filters.push('status = ?'); values.push(req.query.status); }
  if (req.query.q) {
    filters.push('(name LIKE ? OR email LIKE ? OR message LIKE ? OR subject LIKE ?)');
    values.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
  }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  res.json({ data: db.prepare(`SELECT * FROM messages${where} ORDER BY created_at DESC, id DESC LIMIT 500`).all(...values) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Message introuvable.');
  res.json({ data: row });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Message introuvable.');
  const status = STATUS.includes(req.body.status) ? req.body.status : row.status;
  db.prepare("UPDATE messages SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, row.id);
  logActivity(req.admin, 'update', 'messages', row.id, `${row.name} → ${status}`);
  res.json({ data: db.prepare('SELECT * FROM messages WHERE id = ?').get(row.id) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Message introuvable.');
  db.prepare('DELETE FROM messages WHERE id = ?').run(row.id);
  logActivity(req.admin, 'delete', 'messages', row.id, row.name);
  res.json({ ok: true });
}));

module.exports = router;
