'use strict';
/**
 * Fabrique de routes CRUD génériques (create / read / update / delete)
 * — validation par type, tri, recherche, pagination, journalisation.
 */
const express = require('express');
const { db, logActivity } = require('../db');
const { HttpError, asyncHandler, uniqueSlug, parseJson, toInt, boolInt } = require('./util');

function coerce(field, raw) {
  switch (field.type) {
    case 'int': return toInt(raw, field.default ?? 0);
    case 'bool': return boolInt(raw);
    case 'json': {
      const val = typeof raw === 'string' ? parseJson(raw, null) : raw;
      return JSON.stringify(val ?? (field.default ?? []));
    }
    case 'ref': {
      if (raw === '' || raw === null || raw === undefined || raw === 'null') return null;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    }
    case 'enum': {
      const v = String(raw ?? '').trim();
      if (!field.values.includes(v)) return field.default ?? field.values[0];
      return v;
    }
    default: {
      const v = raw === null || raw === undefined ? '' : String(raw);
      if (field.maxLength && v.length > field.maxLength) {
        throw new HttpError(422, `Le champ « ${field.name} » dépasse ${field.maxLength} caractères.`);
      }
      return v.trim();
    }
  }
}

function buildPayload(fields, body, { partial = false } = {}) {
  const data = {};
  for (const field of fields) {
    const present = Object.prototype.hasOwnProperty.call(body, field.name);
    if (!present) {
      if (partial) continue;
      if (field.required) throw new HttpError(422, `Le champ « ${field.label || field.name} » est obligatoire.`);
      data[field.name] = field.type === 'json'
        ? JSON.stringify(field.default ?? [])
        : (field.default !== undefined ? field.default : coerce(field, ''));
      continue;
    }
    const value = coerce(field, body[field.name]);
    if (field.required && (value === '' || value === null)) {
      throw new HttpError(422, `Le champ « ${field.label || field.name} » est obligatoire.`);
    }
    data[field.name] = value;
  }
  return data;
}

function insertRow(table, data) {
  const keys = Object.keys(data);
  const stmt = db.prepare(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
  );
  const info = stmt.run(...keys.map((k) => data[k]));
  return info.lastInsertRowid;
}

function updateRow(table, id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  db.prepare(
    `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).run(...keys.map((k) => data[k]), id);
}

/**
 * @param {object} opts
 *  - table, fields, orderBy, searchColumns, slugFrom, hydrate(row), afterWrite(id, req, mode)
 */
function crudRouter(opts) {
  const {
    table,
    fields,
    orderBy = 'position ASC, id DESC',
    searchColumns = [],
    slugFrom = null,
    hydrate = (row) => row,
    label = (row) => row.title || row.name || row.label || `#${row.id}`,
    beforeDelete = null,
    scopeWhere = null,       // ex: "scope = 'project'"
    scopeValues = {},        // valeurs forcées à l'insertion
  } = opts;

  const router = express.Router();

  const baseWhere = scopeWhere ? ` WHERE ${scopeWhere}` : '';

  router.get('/', asyncHandler(async (req, res) => {
    const filters = [];
    const values = [];
    if (scopeWhere) filters.push(scopeWhere);
    if (req.query.q && searchColumns.length) {
      filters.push(`(${searchColumns.map((c) => `${c} LIKE ?`).join(' OR ')})`);
      searchColumns.forEach(() => values.push(`%${req.query.q}%`));
    }
    if (req.query.status) { filters.push('status = ?'); values.push(req.query.status); }
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM ${table}${where} ORDER BY ${orderBy}`).all(...values);
    res.json({ data: rows.map(hydrate) });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) throw new HttpError(404, 'Élément introuvable.');
    res.json({ data: hydrate(row) });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const data = { ...buildPayload(fields, req.body), ...scopeValues };
    if (slugFrom) {
      data.slug = uniqueSlug(db, table, req.body.slug || req.body[slugFrom] || 'item');
    }
    const id = insertRow(table, data);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    logActivity(req.admin, 'create', table, id, label(row));
    if (opts.afterWrite) opts.afterWrite(id, req, 'create');
    res.status(201).json({ data: hydrate(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)) });
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) throw new HttpError(404, 'Élément introuvable.');
    const data = buildPayload(fields, req.body, { partial: true });
    if (slugFrom && (req.body.slug || req.body[slugFrom])) {
      data.slug = uniqueSlug(db, table, req.body.slug || req.body[slugFrom], existing.id);
    }
    updateRow(table, existing.id, data);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(existing.id);
    logActivity(req.admin, 'update', table, existing.id, label(row));
    if (opts.afterWrite) opts.afterWrite(existing.id, req, 'update');
    res.json({ data: hydrate(row) });
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) throw new HttpError(404, 'Élément introuvable.');
    if (beforeDelete) await beforeDelete(row, req);
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
    logActivity(req.admin, 'delete', table, row.id, label(row));
    res.json({ ok: true });
  }));

  /** Réordonnancement en masse : [{id, position}] */
  router.post('/reorder', asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const stmt = db.prepare(`UPDATE ${table} SET position = ?, updated_at = datetime('now') WHERE id = ?`);
    const run = db.transaction((list) => list.forEach((it, i) => stmt.run(toInt(it.position, i), toInt(it.id))));
    run(items);
    res.json({ ok: true });
  }));

  router.baseWhere = baseWhere;
  return router;
}

module.exports = { crudRouter, buildPayload, insertRow, updateRow };
