'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');
const { HttpError } = require('../lib/util');

const { jwtSecret, cookieName, csrfCookie, cookieSecure, cookieSameSite, tokenTtl } = config.auth;

function signToken(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role, tv: admin.token_version },
    jwtSecret,
    { expiresIn: tokenTtl }
  );
}

function issueSession(res, admin) {
  const token = signToken(admin);
  const csrf = crypto.randomBytes(24).toString('hex');
  const maxAge = 7 * 24 * 3600 * 1000;
  res.cookie(cookieName, token, {
    httpOnly: true,               // inaccessible au JavaScript → protège du vol par XSS
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge,
    path: '/',
  });
  res.cookie(csrfCookie, csrf, {
    httpOnly: false,              // lu par l'admin pour le renvoyer en en-tête (double submit)
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge,
    path: '/',
  });
  return { token, csrf };
}

function clearSession(res) {
  res.clearCookie(cookieName, { path: '/' });
  res.clearCookie(csrfCookie, { path: '/' });
}

function readToken(req) {
  const header = req.get('authorization');
  if (header && header.startsWith('Bearer ')) return { token: header.slice(7), viaCookie: false };
  const cookie = req.cookies?.[cookieName];
  if (cookie) return { token: cookie, viaCookie: true };
  return { token: null, viaCookie: false };
}

/** Vérifie la session ; rejette si l'admin n'existe plus ou si les jetons ont été révoqués. */
function requireAuth(req, res, next) {
  const { token, viaCookie } = readToken(req);
  if (!token) return next(new HttpError(401, 'Authentification requise.'));
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (_) {
    return next(new HttpError(401, 'Session expirée ou invalide.'));
  }
  const admin = db.prepare('SELECT id, email, name, role, token_version FROM admins WHERE id = ?').get(payload.sub);
  if (!admin || admin.token_version !== payload.tv) {
    return next(new HttpError(401, 'Session révoquée. Reconnecte-toi.'));
  }

  // Protection CSRF (double submit) pour les requêtes mutantes authentifiées par cookie.
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (viaCookie && mutating) {
    const sent = req.get('x-csrf-token');
    const expected = req.cookies?.[csrfCookie];
    if (!sent || !expected || sent !== expected) {
      return next(new HttpError(403, 'Jeton CSRF manquant ou invalide.'));
    }
  }

  req.admin = admin;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) return next(new HttpError(401, 'Authentification requise.'));
    if (!roles.includes(req.admin.role)) return next(new HttpError(403, 'Droits insuffisants.'));
    next();
  };
}

module.exports = { signToken, issueSession, clearSession, requireAuth, requireRole };
