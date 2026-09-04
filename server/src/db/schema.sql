-- =====================================================================
--  CALEB CREATIVE — Schéma de la base de données (SQLite)
--  Toutes les données administrables du portfolio et de la boutique.
--  Les fichiers (images / vidéos) ne sont JAMAIS stockés ici :
--  la table `media` ne contient que les métadonnées + la référence.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ------------------------- ADMINISTRATEURS ---------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',      -- admin | editor
  token_version INTEGER NOT NULL DEFAULT 0,         -- incrémenté = déconnecte partout
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------ MÉDIAS -------------------------------
CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL DEFAULT 'image',      -- image | video | logo | file
  storage       TEXT NOT NULL DEFAULT 'local',      -- local | s3 | external
  storage_key   TEXT,                               -- nom du fichier / clé objet
  external_url  TEXT,                               -- si le média est hébergé ailleurs (Vimeo, CDN…)
  original_name TEXT NOT NULL DEFAULT '',
  mime          TEXT NOT NULL DEFAULT '',
  size          INTEGER NOT NULL DEFAULT 0,
  alt           TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  folder        TEXT NOT NULL DEFAULT 'general',    -- general | projets | produits | logos …
  thumb_id      INTEGER REFERENCES media(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_kind ON media(kind);

-- --------------------------- CATÉGORIES ------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  scope      TEXT NOT NULL DEFAULT 'project',       -- project | product
  slug       TEXT NOT NULL,
  label      TEXT NOT NULL,
  short_label TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'published',     -- published | hidden
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scope, slug)
);

-- ----------------------------- PROJETS -------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  video_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  video_url     TEXT NOT NULL DEFAULT '',           -- Vimeo / YouTube (embed)
  external_url  TEXT NOT NULL DEFAULT '',
  gradient      TEXT NOT NULL DEFAULT '',           -- fallback visuel si pas d'image
  project_date  TEXT NOT NULL DEFAULT '',
  tools         TEXT NOT NULL DEFAULT '[]',         -- JSON array
  status        TEXT NOT NULL DEFAULT 'published',  -- published | draft
  featured      INTEGER NOT NULL DEFAULT 0,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_cat ON projects(category_id);

CREATE TABLE IF NOT EXISTS project_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'gallery',       -- gallery | video
  position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_project_media ON project_media(project_id);

-- ---------------------------- SERVICES -------------------------------
CREATE TABLE IF NOT EXISTS services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '',             -- SVG inline (path) optionnel
  media_id    INTEGER REFERENCES media(id) ON DELETE SET NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------- COMPÉTENCES / OUTILS --------------------------
CREATE TABLE IF NOT EXISTS skills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  group_label TEXT NOT NULL DEFAULT 'LOGICIELS',
  avatar      TEXT NOT NULL DEFAULT '',             -- initiales affichées si pas de logo
  media_id    INTEGER REFERENCES media(id) ON DELETE SET NULL, -- logo de l'outil
  level       INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------- TÉMOIGNAGES -----------------------------
CREATE TABLE IF NOT EXISTS testimonials (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  author     TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,
  media_id   INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'pending',       -- pending | published | hidden
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------- STATISTIQUES ----------------------------
CREATE TABLE IF NOT EXISTS stats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  value      INTEGER NOT NULL DEFAULT 0,
  suffix     TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------- FAQ ---------------------------------
CREATE TABLE IF NOT EXISTS faqs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------- PARAMÈTRES / TEXTES DU SITE -------------------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'text',          -- text | textarea | url | email | number | boolean | media | json
  group_name  TEXT NOT NULL DEFAULT 'general',       -- general | identite | hero | about | contact | social | boutique | seo
  label       TEXT NOT NULL DEFAULT '',
  help        TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------- BOUTIQUE -------------------------------
CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  tagline      TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  highlights   TEXT NOT NULL DEFAULT '[]',           -- JSON array
  badge        TEXT NOT NULL DEFAULT '',
  avatar       TEXT NOT NULL DEFAULT '',
  gradient     TEXT NOT NULL DEFAULT '',
  image_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'published',    -- published | draft
  availability TEXT NOT NULL DEFAULT 'in_stock',     -- in_stock | out_of_stock | on_request
  featured     INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0
);

-- Formules / durées (variantes) : c'est ici que vivent les PRIX
CREATE TABLE IF NOT EXISTS product_variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  label      TEXT NOT NULL,                          -- « 4 mois », « 12 mois », « À vie »…
  price      INTEGER NOT NULL DEFAULT 0,             -- en FCFA (entier). 0 = « Prix sur demande »
  old_price  INTEGER NOT NULL DEFAULT 0,
  currency   TEXT NOT NULL DEFAULT 'FCFA',
  note       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'published',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, slug)
);

-- ----------------------------- CLIENTS -------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- ---------------------------- COMMANDES ------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ref            TEXT NOT NULL UNIQUE,
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending',    -- pending|paid|processing|completed|cancelled
  payment_status TEXT NOT NULL DEFAULT 'unpaid',     -- unpaid|pending|paid|failed|refunded
  payment_method TEXT NOT NULL DEFAULT '',           -- mtn | moov | virement | …
  payment_provider TEXT NOT NULL DEFAULT '',         -- rempli par le prestataire quand branché
  payment_reference TEXT NOT NULL DEFAULT '',        -- id de transaction du prestataire
  paid_at        TEXT,
  total          INTEGER NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'FCFA',
  note           TEXT NOT NULL DEFAULT '',
  admin_note     TEXT NOT NULL DEFAULT '',
  source         TEXT NOT NULL DEFAULT 'shop',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id    INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  variant_label TEXT NOT NULL DEFAULT '',
  unit_price    INTEGER NOT NULL DEFAULT 0,
  qty           INTEGER NOT NULL DEFAULT 1,
  line_total    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_items ON order_items(order_id);

-- ------------------- PAIEMENTS (préparation seule) -------------------
-- Aucune fausse API de paiement : on stocke seulement les tentatives et
-- ce que le prestataire (Kkiapay / FedaPay / Stripe…) confirmera plus tard.
CREATE TABLE IF NOT EXISTS payment_intents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'created',        -- created|pending|succeeded|failed|cancelled
  amount     INTEGER NOT NULL DEFAULT 0,
  currency   TEXT NOT NULL DEFAULT 'FCFA',
  reference  TEXT NOT NULL DEFAULT '',
  payload    TEXT NOT NULL DEFAULT '{}',             -- réponse brute du prestataire
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------- MESSAGES DE CONTACT -------------------------
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  subject    TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',            -- new | read | archived
  source     TEXT NOT NULL DEFAULT 'portfolio',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- --------------------------- JOURNAL ---------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  admin_name TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,                          -- create | update | delete | login | upload…
  entity     TEXT NOT NULL DEFAULT '',
  entity_id  TEXT NOT NULL DEFAULT '',
  label      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
