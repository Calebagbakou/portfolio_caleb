'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const db = new Database(config.db.file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

/** Petit helper : met à jour updated_at automatiquement lors d'un UPDATE. */
function touch(table, id) {
  try {
    db.prepare(`UPDATE ${table} SET updated_at = datetime('now') WHERE id = ?`).run(id);
  } catch (_) { /* table sans updated_at */ }
}

function logActivity(admin, action, entity, entityId, label) {
  db.prepare(
    `INSERT INTO activity_log (admin_id, admin_name, action, entity, entity_id, label)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(admin?.id ?? null, admin?.name || admin?.email || 'système', action, entity || '', String(entityId ?? ''), label || '');
}

module.exports = { db, touch, logActivity };
