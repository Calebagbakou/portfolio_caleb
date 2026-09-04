'use strict';
/**
 * API PUBLIQUE — consommée par le portfolio et la boutique.
 * Lecture seule, sauf : formulaire de contact, avis, création de commande.
 * Les prix sont TOUJOURS recalculés côté serveur (jamais ceux du client).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const config = require('../config');
const { db } = require('../db');
const { HttpError, asyncHandler, parseJson, mediaPublic, mediaUrl, orderRef, toInt } = require('../lib/util');

const router = express.Router();

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessaie dans quelques minutes.' },
});

function mediaById(id) {
  if (!id) return null;
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  return row ? mediaPublic(row) : null;
}

function settingsMap() {
  const rows = db.prepare('SELECT key, value, type FROM settings').all();
  const out = {};
  for (const r of rows) {
    let v = r.value;
    if (r.type === 'number') v = Number(v || 0);
    else if (r.type === 'boolean') v = ['1', 'true', 'yes'].includes(String(v).toLowerCase());
    else if (r.type === 'json') v = parseJson(v, null);
    else if (r.type === 'media') {
      const m = mediaById(toInt(v, 0));
      v = m ? m.url : '';
    }
    out[r.key] = v;
  }
  return out;
}

/* ----------------------------- CONTENU ------------------------------ */
router.get('/site', asyncHandler(async (req, res) => {
  const settings = settingsMap();
  const stats = db.prepare("SELECT key, label, value, suffix FROM stats WHERE status = 'published' ORDER BY position, id").all();
  const services = db.prepare("SELECT id, title, description, icon, media_id FROM services WHERE status = 'published' ORDER BY position, id").all()
    .map((s) => ({ ...s, image: mediaById(s.media_id) }));
  const skills = db.prepare("SELECT id, name, group_label, avatar, media_id, level FROM skills WHERE status = 'published' ORDER BY position, id").all()
    .map((s) => ({ ...s, logo: mediaById(s.media_id) }));
  const faqs = db.prepare("SELECT id, question, answer FROM faqs WHERE status = 'published' ORDER BY position, id").all();
  const testimonials = db.prepare("SELECT id, author, role, content, rating, created_at FROM testimonials WHERE status = 'published' ORDER BY position, id DESC").all();
  const categories = db.prepare("SELECT id, scope, slug, label, short_label FROM categories WHERE status = 'published' ORDER BY position, id").all();

  res.json({
    data: {
      settings,
      stats,
      services,
      skills,
      faqs,
      testimonials,
      categories: categories.filter((c) => c.scope === 'project'),
      shopCategories: categories.filter((c) => c.scope === 'product'),
      generatedAt: new Date().toISOString(),
    },
  });
}));

router.get('/projects', asyncHandler(async (req, res) => {
  const rows = db.prepare(
    `SELECT p.*, c.slug AS category_slug, c.label AS category_label, c.short_label AS category_short
     FROM projects p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.status = 'published' ORDER BY p.position ASC, p.id ASC`
  ).all();
  const galleryStmt = db.prepare(
    `SELECT m.* FROM project_media pm JOIN media m ON m.id = pm.media_id
     WHERE pm.project_id = ? ORDER BY pm.position, pm.id`
  );
  res.json({
    data: rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      category: p.category_slug || '',
      categoryLabel: p.category_label || '',
      categoryShort: p.category_short || p.category_label || '',
      cover: mediaById(p.cover_media_id),
      video: mediaById(p.video_media_id),
      videoUrl: p.video_url || (p.video_media_id ? mediaUrl(db.prepare('SELECT * FROM media WHERE id = ?').get(p.video_media_id)) : ''),
      externalUrl: p.external_url,
      gradient: p.gradient,
      date: p.project_date,
      tools: parseJson(p.tools, []),
      featured: !!p.featured,
      gallery: galleryStmt.all(p.id).map(mediaPublic),
    })),
  });
}));

/* ----------------------------- BOUTIQUE ----------------------------- */
function publicProduct(p) {
  const variants = db.prepare(
    "SELECT id, slug, label, price, old_price, currency, note FROM product_variants WHERE product_id = ? AND status = 'published' ORDER BY position, id"
  ).all(p.id);
  const gallery = db.prepare(
    `SELECT m.* FROM product_media pm JOIN media m ON m.id = pm.media_id
     WHERE pm.product_id = ? ORDER BY pm.position, pm.id`
  ).all(p.id).map(mediaPublic);
  return {
    id: p.slug,
    dbId: p.id,
    name: p.name,
    category: p.category_slug || '',
    categoryLabel: p.category_label || '',
    tagline: p.tagline,
    description: p.description,
    highlights: parseJson(p.highlights, []),
    badge: p.badge || null,
    avatar: p.avatar,
    gradient: p.gradient,
    image: mediaById(p.image_media_id),
    gallery,
    availability: p.availability,
    featured: !!p.featured,
    plans: variants.map((v) => ({
      id: v.slug,
      dbId: v.id,
      label: v.label,
      price: v.price,
      oldPrice: v.old_price || 0,
      currency: v.currency,
      note: v.note,
    })),
  };
}

router.get('/shop', asyncHandler(async (req, res) => {
  const products = db.prepare(
    `SELECT p.*, c.slug AS category_slug, c.label AS category_label
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.status = 'published' ORDER BY p.position ASC, p.id ASC`
  ).all().map(publicProduct);
  const categories = db.prepare(
    "SELECT slug AS id, label FROM categories WHERE scope = 'product' AND status = 'published' ORDER BY position, id"
  ).all();
  const settings = settingsMap();
  res.json({
    data: {
      products,
      categories: [{ id: 'tous', label: 'Tous les produits' }, ...categories],
      settings: {
        shop_name: settings.shop_name || 'Boutique',
        shop_logo: settings.shop_logo || '',
        shop_hero_title: settings.shop_hero_title || '',
        shop_hero_text: settings.shop_hero_text || '',
        whatsapp_number: settings.whatsapp_number || '',
        currency: settings.currency || 'FCFA',
        contact_email: settings.contact_email || '',
        portfolio_url: settings.portfolio_url || '',
        favicon: settings.favicon || '',
      },
    },
  });
}));

/* ------------------------- FORMULAIRE CONTACT ----------------------- */
const messageSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court.').max(120),
  email: z.string().trim().email('E-mail invalide.').max(200),
  phone: z.string().trim().max(60).optional().default(''),
  subject: z.string().trim().max(200).optional().default(''),
  message: z.string().trim().min(5, 'Message trop court.').max(5000),
  company: z.string().optional(),   // honeypot anti-spam
});

router.post('/messages', writeLimiter, asyncHandler(async (req, res) => {
  const body = messageSchema.parse(req.body);
  if (body.company) return res.status(201).json({ ok: true });   // bot silencieusement ignoré
  const info = db.prepare(
    `INSERT INTO messages (name, email, phone, subject, message, source) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(body.name, body.email, body.phone, body.subject, body.message, String(req.body.source || 'portfolio').slice(0, 40));
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'Message bien reçu, merci !' });
}));

/* ------------------------------- AVIS ------------------------------- */
const testimonialSchema = z.object({
  author: z.string().trim().min(2).max(120),
  content: z.string().trim().min(5).max(1500),
  role: z.string().trim().max(120).optional().default(''),
  rating: z.coerce.number().int().min(1).max(5).optional().default(5),
  company: z.string().optional(),
});

router.post('/testimonials', writeLimiter, asyncHandler(async (req, res) => {
  const body = testimonialSchema.parse(req.body);
  if (body.company) return res.status(201).json({ ok: true });
  db.prepare('INSERT INTO testimonials (author, role, content, rating, status) VALUES (?, ?, ?, ?, ?)')
    .run(body.author, body.role, body.content, body.rating, 'pending');
  res.status(201).json({ ok: true, message: 'Merci ! Ton commentaire sera publié après validation.' });
}));

/* ----------------------------- COMMANDES ---------------------------- */
const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Nom requis.').max(150),
    email: z.string().trim().email('E-mail invalide.').max(200).optional().or(z.literal('')),
    phone: z.string().trim().min(4, 'Contact requis.').max(60),
  }),
  items: z.array(z.object({
    productId: z.string().trim().min(1),      // slug produit
    planId: z.string().trim().min(1),         // slug formule
    qty: z.coerce.number().int().min(1).max(50),
  })).min(1, 'Panier vide.'),
  paymentMethod: z.string().trim().max(60).optional().default(''),
  note: z.string().trim().max(2000).optional().default(''),
  company: z.string().optional(),
});

router.post('/orders', writeLimiter, asyncHandler(async (req, res) => {
  const body = orderSchema.parse(req.body);
  if (body.company) throw new HttpError(400, 'Requête rejetée.');

  const lines = [];
  let total = 0;
  for (const item of body.items) {
    const product = db.prepare("SELECT * FROM products WHERE slug = ? AND status = 'published'").get(item.productId);
    if (!product) throw new HttpError(422, `Produit indisponible : ${item.productId}`);
    const variant = db.prepare("SELECT * FROM product_variants WHERE product_id = ? AND slug = ? AND status = 'published'").get(product.id, item.planId);
    if (!variant) throw new HttpError(422, `Formule indisponible pour ${product.name}.`);
    const lineTotal = variant.price * item.qty;     // prix serveur, jamais celui du client
    total += lineTotal;
    lines.push({
      product_id: product.id,
      variant_id: variant.id,
      product_name: product.name,
      variant_label: variant.label,
      unit_price: variant.price,
      qty: item.qty,
      line_total: lineTotal,
    });
  }

  const ref = orderRef();
  const tx = db.transaction(() => {
    let customer = body.customer.email
      ? db.prepare('SELECT * FROM customers WHERE email = ?').get(body.customer.email)
      : null;
    if (!customer && body.customer.phone) {
      customer = db.prepare("SELECT * FROM customers WHERE phone = ? AND phone <> ''").get(body.customer.phone);
    }
    if (!customer) {
      const info = db.prepare('INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)')
        .run(body.customer.name, body.customer.email || '', body.customer.phone);
      customer = { id: info.lastInsertRowid };
    } else {
      db.prepare("UPDATE customers SET name = ?, updated_at = datetime('now') WHERE id = ?").run(body.customer.name, customer.id);
    }

    const orderInfo = db.prepare(
      `INSERT INTO orders (ref, customer_id, customer_name, customer_email, customer_phone,
         status, payment_status, payment_method, total, note)
       VALUES (?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?, ?)`
    ).run(ref, customer.id, body.customer.name, body.customer.email || '', body.customer.phone, body.paymentMethod, total, body.note);

    const itemStmt = db.prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_label, unit_price, qty, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    lines.forEach((l) => itemStmt.run(orderInfo.lastInsertRowid, l.product_id, l.variant_id, l.product_name, l.variant_label, l.unit_price, l.qty, l.line_total));
    return orderInfo.lastInsertRowid;
  });

  const orderId = tx();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.status(201).json({
    data: {
      ref: order.ref,
      total: order.total,
      currency: order.currency,
      status: order.status,
      payment_status: order.payment_status,
      created_at: order.created_at,
      items: lines.map((l) => ({ name: l.product_name, plan: l.variant_label, qty: l.qty, unitPrice: l.unit_price, lineTotal: l.line_total })),
    },
    // La commande n'est JAMAIS « payée » ici : seul un prestataire de
    // paiement (webhook) ou l'administrateur peut confirmer le paiement.
    payment: { provider: config.payments.provider || null, configured: !!config.payments.provider },
  });
}));

router.get('/orders/:ref', asyncHandler(async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE ref = ?').get(String(req.params.ref).toUpperCase());
  if (!order) throw new HttpError(404, 'Commande introuvable.');
  res.json({
    data: {
      ref: order.ref,
      status: order.status,
      payment_status: order.payment_status,
      total: order.total,
      currency: order.currency,
      created_at: order.created_at,
      items: db.prepare('SELECT product_name, variant_label, unit_price, qty, line_total FROM order_items WHERE order_id = ?').all(order.id),
    },
  });
}));

module.exports = router;
