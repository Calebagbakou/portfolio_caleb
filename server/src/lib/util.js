'use strict';

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function slugify(value, fallback = 'item') {
  const s = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || fallback;
}

/** Garantit un slug unique dans une table donnée. */
function uniqueSlug(db, table, base, ignoreId = null) {
  let slug = slugify(base);
  let i = 2;
  const sql = ignoreId
    ? `SELECT 1 FROM ${table} WHERE slug = ? AND id != ?`
    : `SELECT 1 FROM ${table} WHERE slug = ?`;
  const stmt = db.prepare(sql);
  while (ignoreId ? stmt.get(slug, ignoreId) : stmt.get(slug)) {
    slug = `${slugify(base)}-${i++}`;
  }
  return slug;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

/** URL stable d'un média : ne change JAMAIS, même si le fichier est remplacé. */
function mediaUrl(row) {
  if (!row) return null;
  if (row.storage === 'external' && row.external_url) return row.external_url;
  // version = date de mise à jour + taille → l'URL change dès que le fichier
  // est remplacé (cache busting), mais l'id (la référence) reste identique.
  const v = `${(row.updated_at || '').replace(/\D/g, '').slice(-6)}${row.size || 0}`;
  return `/media/${row.id}?v=${v}`;
}

function mediaPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    url: mediaUrl(row),
    alt: row.alt || row.title || '',
    title: row.title || '',
    mime: row.mime,
    size: row.size,
    folder: row.folder,
    original_name: row.original_name,
    storage: row.storage,
    external_url: row.external_url || '',
    thumb_id: row.thumb_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function orderRef() {
  const d = new Date();
  const stamp = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CC-${stamp}-${rand}`;
}

function toInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function boolInt(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()) ? 1 : 0;
}

module.exports = { HttpError, asyncHandler, slugify, uniqueSlug, parseJson, mediaUrl, mediaPublic, orderRef, toInt, boolInt };
