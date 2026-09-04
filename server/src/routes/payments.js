'use strict';
const express = require('express');
const { db } = require('../db');
const config = require('../config');
const { activeProvider, publicConfig } = require('../lib/payments');
const { HttpError, asyncHandler } = require('../lib/util');

const router = express.Router();

/** Ce que le frontend a le droit de connaître (jamais de clé secrète). */
router.get('/config', (req, res) => res.json({ data: publicConfig() }));

/**
 * Démarre un paiement pour une commande existante.
 * Si aucun prestataire n'est branché → 501 explicite (aucune simulation).
 */
router.post('/intents', asyncHandler(async (req, res) => {
  const ref = String(req.body.ref || '').toUpperCase();
  const order = db.prepare('SELECT * FROM orders WHERE ref = ?').get(ref);
  if (!order) throw new HttpError(404, 'Commande introuvable.');

  const p = activeProvider();
  if (!p || !p.adapter) {
    throw new HttpError(501, "Aucun prestataire de paiement n'est configuré. La commande est enregistrée et sera confirmée manuellement.");
  }

  const intent = await p.adapter.createIntent({
    amount: order.total,
    currency: order.currency,
    reference: order.ref,
    customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
    secretKey: config.payments.secretKey,
  });

  db.prepare(
    `INSERT INTO payment_intents (order_id, provider, status, amount, currency, reference, payload)
     VALUES (?, ?, 'created', ?, ?, ?, ?)`
  ).run(order.id, p.name, order.total, order.currency, intent.reference || '', JSON.stringify(intent.raw || {}));
  db.prepare("UPDATE orders SET payment_status = 'pending', payment_provider = ?, updated_at = datetime('now') WHERE id = ?")
    .run(p.name, order.id);

  res.status(201).json({ data: intent.public || {} });
}));

/**
 * Webhook prestataire — SEULE voie automatique pour marquer « payée ».
 * La signature est vérifiée par l'adaptateur avec PAYMENT_WEBHOOK_SECRET.
 */
router.post('/webhook/:provider', express.raw({ type: '*/*', limit: '1mb' }), asyncHandler(async (req, res) => {
  const p = activeProvider();
  if (!p || !p.adapter || p.name !== req.params.provider) {
    throw new HttpError(501, 'Webhook non configuré pour ce prestataire.');
  }
  const ok = p.adapter.verifyWebhook(req.body, req.headers, config.payments.webhookSecret);
  if (!ok) throw new HttpError(401, 'Signature de webhook invalide.');

  const event = p.adapter.parseWebhook(req.body, req.headers);
  const order = db.prepare('SELECT * FROM orders WHERE ref = ?').get(event.reference);
  if (!order) return res.json({ ok: true, ignored: true });

  db.prepare(
    `INSERT INTO payment_intents (order_id, provider, status, amount, currency, reference, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(order.id, p.name, event.status, event.amount || order.total, order.currency, event.transactionId || '', JSON.stringify(event.raw || {}));

  if (event.status === 'succeeded') {
    db.prepare(
      `UPDATE orders SET payment_status = 'paid', status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END,
        payment_reference = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(event.transactionId || '', order.id);
  } else if (event.status === 'failed') {
    db.prepare("UPDATE orders SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?").run(order.id);
  }
  res.json({ ok: true });
}));

module.exports = router;
