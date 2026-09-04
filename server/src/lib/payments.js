'use strict';
/**
 * PAIEMENT — architecture d'intégration, sans aucune fausse API.
 * -------------------------------------------------------------------------
 * Rien n'est simulé : tant que PAYMENT_PROVIDER n'est pas défini et qu'un
 * adaptateur n'est pas écrit, les routes de paiement répondent 501.
 * Une commande ne devient « payée » QUE via :
 *   1) un webhook signé du prestataire (verifyWebhook + parseWebhook), ou
 *   2) une confirmation manuelle de l'administrateur dans /admin.
 *
 * Pour brancher Kkiapay / FedaPay / Stripe :
 *   - créer un objet adaptateur ci-dessous ({ createIntent, verifyWebhook, parseWebhook }) ;
 *   - l'enregistrer dans `providers` ;
 *   - définir PAYMENT_PROVIDER / PAYMENT_PUBLIC_KEY / PAYMENT_SECRET_KEY /
 *     PAYMENT_WEBHOOK_SECRET dans les variables d'environnement du serveur.
 * Les clés secrètes ne quittent jamais le backend.
 */
const config = require('../config');

/** @type {Record<string, {createIntent:Function, verifyWebhook:Function, parseWebhook:Function}>} */
const providers = {
  // kkiapay: require('./providers/kkiapay'),
  // fedapay: require('./providers/fedapay'),
  // stripe:  require('./providers/stripe'),
};

function activeProvider() {
  const name = config.payments.provider;
  if (!name) return null;
  return providers[name] ? { name, adapter: providers[name] } : { name, adapter: null };
}

function publicConfig() {
  const p = activeProvider();
  return {
    provider: p?.name || null,
    configured: !!(p && p.adapter && config.payments.secretKey),
    publicKey: p ? config.payments.publicKey || null : null,   // clé publique uniquement
    currency: 'FCFA',
  };
}

module.exports = { providers, activeProvider, publicConfig };
