'use strict';
/**
 * BOUTIQUE (admin) — produits, formules/prix, commandes, clients.
 */
const express = require('express');
const { db, logActivity } = require('../db');
const { crudRouter } = require('../lib/crud');
const { HttpError, asyncHandler, parseJson, mediaPublic, toInt, uniqueSlug, slugify } = require('../lib/util');

const router = express.Router();

const ORDER_STATUS = ['pending', 'paid', 'processing', 'completed', 'cancelled'];
const PAYMENT_STATUS = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];

function mediaById(id) {
  if (!id) return null;
  return mediaPublic(db.prepare('SELECT * FROM media WHERE id = ?').get(id));
}

function variantsOf(productId) {
  return db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY position ASC, id ASC').all(productId);
}

function hydrateProduct(row) {
  const gallery = db.prepare(
    `SELECT m.* FROM product_media pm JOIN media m ON m.id = pm.media_id
     WHERE pm.product_id = ? ORDER BY pm.position ASC, pm.id ASC`
  ).all(row.id).map(mediaPublic);
  return {
    ...row,
    featured: !!row.featured,
    highlights: parseJson(row.highlights, []),
    image: mediaById(row.image_media_id),
    gallery,
    variants: variantsOf(row.id),
    category: row.category_id ? db.prepare('SELECT id, slug, label FROM categories WHERE id = ?').get(row.category_id) : null,
  };
}

function syncProductGallery(productId, mediaIds) {
  if (!Array.isArray(mediaIds)) return;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM product_media WHERE product_id = ?').run(productId);
    const stmt = db.prepare('INSERT INTO product_media (product_id, media_id, position) VALUES (?, ?, ?)');
    mediaIds.forEach((mid, i) => {
      const id = toInt(mid, 0);
      if (id && db.prepare('SELECT 1 FROM media WHERE id = ?').get(id)) stmt.run(productId, id, i);
    });
  });
  tx();
}

/* ------------------------------ PRODUITS ---------------------------- */
router.use('/products', crudRouter({
  table: 'products',
  fields: [
    { name: 'name', type: 'string', required: true, label: 'Nom', maxLength: 150 },
    { name: 'category_id', type: 'ref' },
    { name: 'tagline', type: 'string', maxLength: 300 },
    { name: 'description', type: 'string', maxLength: 5000 },
    { name: 'highlights', type: 'json', default: [] },
    { name: 'badge', type: 'string', maxLength: 40 },
    { name: 'avatar', type: 'string', maxLength: 6 },
    { name: 'gradient', type: 'string', maxLength: 200 },
    { name: 'image_media_id', type: 'ref' },
    { name: 'status', type: 'enum', values: ['published', 'draft'], default: 'published' },
    { name: 'availability', type: 'enum', values: ['in_stock', 'out_of_stock', 'on_request'], default: 'in_stock' },
    { name: 'featured', type: 'bool' },
    { name: 'position', type: 'int' },
  ],
  slugFrom: 'name',
  searchColumns: ['name', 'tagline', 'description'],
  hydrate: hydrateProduct,
  label: (r) => r.name,
  afterWrite: (id, req) => {
    if (Object.prototype.hasOwnProperty.call(req.body, 'gallery_ids')) {
      syncProductGallery(id, parseJson(req.body.gallery_ids, req.body.gallery_ids) || []);
    }
  },
}));

/* --------------------- FORMULES / DURÉES / PRIX --------------------- */
router.get('/products/:productId/variants', asyncHandler(async (req, res) => {
  res.json({ data: variantsOf(toInt(req.params.productId)) });
}));

function variantPayload(body, product, existing = null) {
  const label = String(body.label ?? existing?.label ?? '').trim();
  if (!label) throw new HttpError(422, 'Le libellé de la formule est obligatoire (ex. « 12 mois »).');
  const price = toInt(body.price, existing?.price ?? 0);
  const oldPrice = toInt(body.old_price, existing?.old_price ?? 0);
  if (price < 0 || oldPrice < 0) throw new HttpError(422, 'Un prix ne peut pas être négatif.');
  let slug = String(body.slug || existing?.slug || slugify(label, 'formule')).trim();
  slug = slugify(slug, 'formule');
  // unicité par produit
  const clash = existing
    ? db.prepare('SELECT 1 FROM product_variants WHERE product_id = ? AND slug = ? AND id != ?').get(product.id, slug, existing.id)
    : db.prepare('SELECT 1 FROM product_variants WHERE product_id = ? AND slug = ?').get(product.id, slug);
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  return {
    label,
    slug,
    price,
    old_price: oldPrice,
    currency: String(body.currency ?? existing?.currency ?? 'FCFA').slice(0, 10),
    note: String(body.note ?? existing?.note ?? '').slice(0, 300),
    status: ['published', 'hidden'].includes(body.status) ? body.status : (existing?.status || 'published'),
    position: toInt(body.position, existing?.position ?? 0),
  };
}

router.post('/products/:productId/variants', asyncHandler(async (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId);
  if (!product) throw new HttpError(404, 'Produit introuvable.');
  const v = variantPayload(req.body, product);
  const info = db.prepare(
    `INSERT INTO product_variants (product_id, slug, label, price, old_price, currency, note, status, position)
     VALUES (@product_id, @slug, @label, @price, @old_price, @currency, @note, @status, @position)`
  ).run({ ...v, product_id: product.id });
  logActivity(req.admin, 'create', 'product_variants', info.lastInsertRowid, `${product.name} — ${v.label}`);
  res.status(201).json({ data: db.prepare('SELECT * FROM product_variants WHERE id = ?').get(info.lastInsertRowid) });
}));

router.put('/variants/:id', asyncHandler(async (req, res) => {
  const existing = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'Formule introuvable.');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.product_id);
  const v = variantPayload(req.body, product, existing);
  db.prepare(
    `UPDATE product_variants SET slug=@slug, label=@label, price=@price, old_price=@old_price,
       currency=@currency, note=@note, status=@status, position=@position, updated_at=datetime('now')
     WHERE id=@id`
  ).run({ ...v, id: existing.id });
  logActivity(req.admin, 'update', 'product_variants', existing.id, `${product.name} — ${v.label} : ${v.price} ${v.currency}`);
  res.json({ data: db.prepare('SELECT * FROM product_variants WHERE id = ?').get(existing.id) });
}));

router.delete('/variants/:id', asyncHandler(async (req, res) => {
  const existing = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'Formule introuvable.');
  db.prepare('DELETE FROM product_variants WHERE id = ?').run(existing.id);
  logActivity(req.admin, 'delete', 'product_variants', existing.id, existing.label);
  res.json({ ok: true });
}));

/* ------------------------------ CLIENTS ----------------------------- */
router.use('/customers', crudRouter({
  table: 'customers',
  fields: [
    { name: 'name', type: 'string', maxLength: 150 },
    { name: 'email', type: 'string', maxLength: 200 },
    { name: 'phone', type: 'string', maxLength: 60 },
    { name: 'note', type: 'string', maxLength: 2000 },
  ],
  orderBy: 'created_at DESC',
  searchColumns: ['name', 'email', 'phone'],
  hydrate: (r) => ({
    ...r,
    orders_count: db.prepare('SELECT COUNT(*) c FROM orders WHERE customer_id = ?').get(r.id).c,
    total_spent: db.prepare("SELECT COALESCE(SUM(total),0) t FROM orders WHERE customer_id = ? AND payment_status = 'paid'").get(r.id).t,
  }),
  label: (r) => r.name || r.email,
}));

/* ----------------------------- COMMANDES ---------------------------- */
function hydrateOrder(row) {
  return {
    ...row,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(row.id),
    payments: db.prepare('SELECT id, provider, status, amount, currency, reference, created_at FROM payment_intents WHERE order_id = ? ORDER BY id DESC').all(row.id),
  };
}

router.get('/orders', asyncHandler(async (req, res) => {
  const filters = [];
  const values = [];
  if (req.query.status) { filters.push('status = ?'); values.push(req.query.status); }
  if (req.query.payment_status) { filters.push('payment_status = ?'); values.push(req.query.payment_status); }
  if (req.query.q) {
    filters.push('(ref LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ?)');
    values.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
  }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM orders${where} ORDER BY created_at DESC, id DESC LIMIT 500`).all(...values);
  res.json({ data: rows.map(hydrateOrder) });
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Commande introuvable.');
  res.json({ data: hydrateOrder(row) });
}));

router.put('/orders/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Commande introuvable.');

  const status = ORDER_STATUS.includes(req.body.status) ? req.body.status : row.status;
  const paymentStatus = PAYMENT_STATUS.includes(req.body.payment_status) ? req.body.payment_status : row.payment_status;
  const paidAt = paymentStatus === 'paid' ? (row.paid_at || new Date().toISOString()) : null;

  db.prepare(
    `UPDATE orders SET status = ?, payment_status = ?, payment_method = ?, admin_note = ?,
       payment_reference = ?, paid_at = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    status, paymentStatus,
    String(req.body.payment_method ?? row.payment_method).slice(0, 60),
    String(req.body.admin_note ?? row.admin_note).slice(0, 3000),
    String(req.body.payment_reference ?? row.payment_reference).slice(0, 120),
    paidAt, row.id
  );
  logActivity(req.admin, 'update', 'orders', row.id, `${row.ref} → ${status}/${paymentStatus}`);
  res.json({ data: hydrateOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(row.id)) });
}));

router.delete('/orders/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) throw new HttpError(404, 'Commande introuvable.');
  db.prepare('DELETE FROM orders WHERE id = ?').run(row.id);
  logActivity(req.admin, 'delete', 'orders', row.id, row.ref);
  res.json({ ok: true });
}));

module.exports = router;
