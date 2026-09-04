'use strict';
/** Crée ou met à jour un administrateur :
 *  node src/scripts/create-admin.js email@exemple.com "MotDePasseFort123" "Nom"
 *  (ou via les variables ADMIN_EMAIL / ADMIN_PASSWORD)
 */
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const config = require('../config');

(async () => {
  const email = (process.argv[2] || config.auth.bootstrapEmail || '').toLowerCase().trim();
  const password = process.argv[3] || config.auth.bootstrapPassword;
  const name = process.argv[4] || config.auth.bootstrapName;
  if (!email || !password) {
    console.error('Usage : node src/scripts/create-admin.js <email> <mot-de-passe> [nom]');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Mot de passe trop court (10 caractères minimum).');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
  if (existing) {
    db.prepare("UPDATE admins SET password_hash = ?, name = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?")
      .run(hash, name, existing.id);
    console.log(`Mot de passe mis à jour pour ${email}.`);
  } else {
    db.prepare('INSERT INTO admins (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(email, name, hash, 'admin');
    console.log(`Administrateur créé : ${email}`);
  }
  process.exit(0);
})();
