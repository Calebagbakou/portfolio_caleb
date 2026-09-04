'use strict';
const express = require('express');
const { db } = require('../db');
const { asyncHandler } = require('../lib/util');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const count = (sql, ...args) => db.prepare(sql).get(...args).c;

  const stats = {
    projects: count('SELECT COUNT(*) c FROM projects'),
    projectsPublished: count("SELECT COUNT(*) c FROM projects WHERE status = 'published'"),
    products: count('SELECT COUNT(*) c FROM products'),
    productsPublished: count("SELECT COUNT(*) c FROM products WHERE status = 'published'"),
    variants: count('SELECT COUNT(*) c FROM product_variants'),
    orders: count('SELECT COUNT(*) c FROM orders'),
    ordersPending: count("SELECT COUNT(*) c FROM orders WHERE status = 'pending'"),
    ordersPaid: count("SELECT COUNT(*) c FROM orders WHERE payment_status = 'paid'"),
    revenue: db.prepare("SELECT COALESCE(SUM(total),0) c FROM orders WHERE payment_status = 'paid'").get().c,
    customers: count('SELECT COUNT(*) c FROM customers'),
    messages: count('SELECT COUNT(*) c FROM messages'),
    messagesNew: count("SELECT COUNT(*) c FROM messages WHERE status = 'new'"),
    media: count('SELECT COUNT(*) c FROM media'),
    images: count("SELECT COUNT(*) c FROM media WHERE kind IN ('image','logo')"),
    videos: count("SELECT COUNT(*) c FROM media WHERE kind = 'video'"),
    services: count('SELECT COUNT(*) c FROM services'),
    skills: count('SELECT COUNT(*) c FROM skills'),
    testimonials: count('SELECT COUNT(*) c FROM testimonials'),
    testimonialsPending: count("SELECT COUNT(*) c FROM testimonials WHERE status = 'pending'"),
    storageBytes: db.prepare('SELECT COALESCE(SUM(size),0) c FROM media').get().c,
  };

  res.json({
    data: {
      stats,
      recentOrders: db.prepare('SELECT id, ref, customer_name, total, currency, status, payment_status, created_at FROM orders ORDER BY id DESC LIMIT 5').all(),
      recentMessages: db.prepare('SELECT id, name, email, subject, status, created_at FROM messages ORDER BY id DESC LIMIT 5').all(),
      activity: db.prepare('SELECT id, admin_name, action, entity, entity_id, label, created_at FROM activity_log ORDER BY id DESC LIMIT 15').all(),
      publicStats: db.prepare('SELECT key, label, value, suffix FROM stats ORDER BY position, id').all(),
    },
  });
}));

module.exports = router;
