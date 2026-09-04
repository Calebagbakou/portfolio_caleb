'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { db, logActivity } = require('../db');
const config = require('../config');
const { issueSession, clearSession, requireAuth } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/util');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,                       // 10 tentatives / 10 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' },
});

const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide."),
  password: z.string().min(1, 'Mot de passe requis.'),
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase().trim());
  // Même message et même coût approximatif → pas d'énumération de comptes.
  const hash = admin ? admin.password_hash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu';
  const ok = await bcrypt.compare(password, hash);
  if (!admin || !ok) throw new HttpError(401, 'Identifiants incorrects.');

  db.prepare("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?").run(admin.id);
  const { csrf } = issueSession(res, admin);
  logActivity(admin, 'login', 'admins', admin.id, admin.email);
  res.json({
    data: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    csrfToken: csrf,
  });
}));

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.admin, csrfToken: req.cookies?.[config.auth.csrfCookie] || null });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(10, 'Le nouveau mot de passe doit faire au moins 10 caractères.')
    .regex(/[a-z]/, 'Ajoute au moins une minuscule.')
    .regex(/[A-Z]/, 'Ajoute au moins une majuscule.')
    .regex(/[0-9]/, 'Ajoute au moins un chiffre.'),
});

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = passwordSchema.parse(req.body);
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  const ok = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!ok) throw new HttpError(401, 'Mot de passe actuel incorrect.');
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare(
    "UPDATE admins SET password_hash = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, admin.id);
  clearSession(res);          // toutes les sessions existantes sont invalidées
  logActivity(admin, 'update', 'admins', admin.id, 'changement de mot de passe');
  res.json({ ok: true, message: 'Mot de passe modifié. Reconnecte-toi.' });
}));

router.put('/profile', requireAuth, asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().max(120).optional(), email: z.string().email().optional() });
  const { name, email } = schema.parse(req.body);
  if (name !== undefined) db.prepare('UPDATE admins SET name = ? WHERE id = ?').run(name, req.admin.id);
  if (email !== undefined) db.prepare('UPDATE admins SET email = ? WHERE id = ?').run(email.toLowerCase(), req.admin.id);
  const admin = db.prepare('SELECT id, email, name, role FROM admins WHERE id = ?').get(req.admin.id);
  res.json({ data: admin });
}));

module.exports = router;
