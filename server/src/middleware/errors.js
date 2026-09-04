'use strict';
const { HttpError } = require('../lib/util');

function notFound(req, res, next) {
  next(new HttpError(404, `Route introuvable : ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Erreur serveur.';
  let details = err.details;

  if (err.name === 'ZodError') {
    status = 422;
    message = 'Données invalides.';
    details = (err.issues || []).map((i) => ({ field: i.path.join('.'), message: i.message }));
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'Fichier trop volumineux.';
  }
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    status = 409;
    message = 'Cette valeur existe déjà (doublon).';
  }
  // Les erreurs « attendues » (HttpError) restent lisibles ; seules les
  // erreurs imprévues affichent une pile complète.
  if (status >= 500) {
    if (err instanceof HttpError) console.warn(`[${status}] ${message}`);
    else console.error('[error]', err);
  }

  res.status(status).json({ error: message, details });
}

module.exports = { notFound, errorHandler };
