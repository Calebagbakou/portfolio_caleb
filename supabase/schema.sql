-- =========================================================================
-- SCHÉMA COMPLET — CALEB CREATIVE (Portfolio + Boutique)
-- -------------------------------------------------------------------------
-- À exécuter dans Supabase → SQL Editor → New query → Run.
-- Peut être exécuté en une seule fois, dans l'ordre écrit ci-dessous.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- pour gen_random_uuid()

-- -------------------------------------------------------------------------
-- 1. ADMINISTRATEURS
-- -------------------------------------------------------------------------
-- Ne remplace pas l'auth de Supabase : référence juste quels comptes
-- (auth.users) ont le droit d'administrer le site. Un visiteur qui crée un
-- compte (plus tard, pour la boutique par ex.) n'aura PAS accès à /admin
-- tant que son id n'est pas ajouté ici manuellement.
create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

-- Un admin peut voir la liste des admins (pratique pour le dashboard),
-- personne d'autre ne peut rien y faire depuis le frontend.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admins where id = auth.uid());
$$;

create policy "admins: lecture réservée aux admins"
  on admins for select
  using (is_admin());

-- -------------------------------------------------------------------------
-- 2. PARAMÈTRES DU SITE (clé/valeur — logo, réseaux sociaux, URL boutique...)
-- -------------------------------------------------------------------------
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;

create policy "settings: lecture publique"
  on settings for select
  using (true);

create policy "settings: écriture réservée aux admins"
  on settings for all
  using (is_admin())
  with check (is_admin());

-- Valeurs par défaut (modifiables ensuite depuis /admin)
insert into settings (key, value) values
  ('site_name', '"Caleb Creative"'),
  ('logo_url', 'null'),
  ('favicon_url', 'null'),
  ('shop_url', '"./boutique/index.html"'),
  ('contact_email', 'null'),
  ('contact_phone', '"+2290148135395"'),
  ('social_links', '{}')
on conflict (key) do nothing;

-- -------------------------------------------------------------------------
-- 3. MÉDIAS (images, vidéos, logos — référencés partout ailleurs)
-- -------------------------------------------------------------------------
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('image','video')),
  -- pour une image : chemin dans Supabase Storage (bucket "media")
  storage_path text,
  -- pour une vidéo hébergée ailleurs (Vimeo/YouTube) : lien direct
  external_url text,
  thumbnail_url text,
  alt_text text,
  created_at timestamptz not null default now(),
  constraint media_source_check check (storage_path is not null or external_url is not null)
);

alter table media enable row level security;

create policy "media: lecture publique"
  on media for select
  using (true);

create policy "media: écriture réservée aux admins"
  on media for all
  using (is_admin())
  with check (is_admin());

-- -------------------------------------------------------------------------
-- 4. CATÉGORIES (réutilisées pour le portfolio ET la boutique via "scope")
-- -------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('portfolio','boutique')),
  slug text not null,
  label text not null,
  sort_order int not null default 0,
  unique (scope, slug)
);

alter table categories enable row level security;

create policy "categories: lecture publique"
  on categories for select
  using (true);

create policy "categories: écriture réservée aux admins"
  on categories for all
  using (is_admin())
  with check (is_admin());

-- -------------------------------------------------------------------------
-- 5. SERVICES (section "ce que je propose" du portfolio)
-- -------------------------------------------------------------------------
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table services enable row level security;

create policy "services: lecture publique"
  on services for select
  using (true);

create policy "services: écriture réservée aux admins"
  on services for all
  using (is_admin())
  with check (is_admin());

-- -------------------------------------------------------------------------
-- 6. STATISTIQUES (compteurs animés)
-- -------------------------------------------------------------------------
create table if not exists statistics (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,       -- ex: 'projets_realises'
  label text not null,            -- ex: 'Projets réalisés'
  value int not null default 0,   -- ex: 150
  suffix text default '+',
  sort_order int not null default 0
);

alter table statistics enable row level security;

create policy "statistics: lecture publique"
  on statistics for select
  using (true);

create policy "statistics: écriture réservée aux admins"
  on statistics for all
  using (is_admin())
  with check (is_admin());

insert into statistics (key, label, value, suffix, sort_order) values
  ('projets_realises', 'Projets réalisés', 150, '+', 1),
  ('clients_satisfaits', 'Clients satisfaits', 80, '+', 2),
  ('outils_maitrises', 'Outils maîtrisés', 20, '+', 3),
  ('annees_experience', 'Années d''expérience', 4, '+', 4)
on conflict (key) do nothing;

-- -------------------------------------------------------------------------
-- 7. PROJETS (portfolio)
-- -------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  cover_media_id uuid references media(id) on delete set null,
  video_media_id uuid references media(id) on delete set null,
  external_link text,
  project_date date,
  tools text[] default '{}',
  status text not null default 'draft' check (status in ('draft','published')),
  featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table projects enable row level security;

create policy "projects: lecture publique des projets publiés"
  on projects for select
  using (status = 'published' or is_admin());

create policy "projects: écriture réservée aux admins"
  on projects for all
  using (is_admin())
  with check (is_admin());

-- Galerie d'images pour un projet (plusieurs images par projet)
create table if not exists project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  sort_order int not null default 0
);

alter table project_media enable row level security;

create policy "project_media: lecture publique"
  on project_media for select
  using (true);

create policy "project_media: écriture réservée aux admins"
  on project_media for all
  using (is_admin())
  with check (is_admin());

-- -------------------------------------------------------------------------
-- 8. PRODUITS (boutique)
-- -------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  tagline text,
  highlights text[] default '{}',
  category_id uuid references categories(id) on delete set null,
  cover_media_id uuid references media(id) on delete set null,
  badge text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products enable row level security;

create policy "products: lecture publique des produits actifs"
  on products for select
  using (status = 'active' or is_admin());

create policy "products: écriture réservée aux admins"
  on products for all
  using (is_admin())
  with check (is_admin());

-- Formules / durées d'un produit (ex: Gemini Pro → 4 mois / 12 mois / 18 mois)
create table if not exists product_plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  label text not null,            -- ex: '12 mois'
  price numeric(12,2) not null default 0,
  old_price numeric(12,2),
  currency text not null default 'FCFA',
  sort_order int not null default 0
);

alter table product_plans enable row level security;

create policy "product_plans: lecture publique"
  on product_plans for select
  using (true);

create policy "product_plans: écriture réservée aux admins"
  on product_plans for all
  using (is_admin())
  with check (is_admin());

-- -------------------------------------------------------------------------
-- 9. CLIENTS
-- -------------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,       -- téléphone / WhatsApp
  email text,
  created_at timestamptz not null default now()
);

alter table customers enable row level security;

-- Un visiteur peut créer sa fiche client au moment de commander,
-- mais ne peut ni lire ni modifier les fiches (y compris la sienne après coup).
create policy "customers: création publique (commande)"
  on customers for insert
  with check (true);

create policy "customers: lecture réservée aux admins"
  on customers for select
  using (is_admin());

create policy "customers: modification réservée aux admins"
  on customers for update
  using (is_admin())
  with check (is_admin());

create policy "customers: suppression réservée aux admins"
  on customers for delete
  using (is_admin());

-- -------------------------------------------------------------------------
-- 10. COMMANDES
-- -------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer_id uuid references customers(id) on delete set null,
  status text not null default 'en_attente'
    check (status in ('en_attente','payee','traitement','terminee','annulee')),
  payment_method text,
  payment_status text not null default 'non_confirme'
    check (payment_status in ('non_confirme','confirme')),
  total numeric(12,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

-- Un visiteur peut créer une commande (le tunnel d'achat écrit ici),
-- mais ne peut pas lire les commandes (ni les siennes, ni celles des autres)
-- depuis le frontend public — seul l'admin les consulte.
create policy "orders: création publique (checkout)"
  on orders for insert
  with check (true);

create policy "orders: lecture réservée aux admins"
  on orders for select
  using (is_admin());

create policy "orders: modification réservée aux admins"
  on orders for update
  using (is_admin())
  with check (is_admin());

create policy "orders: suppression réservée aux admins"
  on orders for delete
  using (is_admin());

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  plan_id uuid references product_plans(id) on delete set null,
  -- copie figée au moment de la commande (même si le produit change après)
  product_name text not null,
  plan_label text not null,
  unit_price numeric(12,2) not null,
  qty int not null default 1,
  line_total numeric(12,2) not null
);

alter table order_items enable row level security;

create policy "order_items: création publique (checkout)"
  on order_items for insert
  with check (true);

create policy "order_items: lecture réservée aux admins"
  on order_items for select
  using (is_admin());

create policy "order_items: modification réservée aux admins"
  on order_items for update
  using (is_admin())
  with check (is_admin());

create policy "order_items: suppression réservée aux admins"
  on order_items for delete
  using (is_admin());

-- -------------------------------------------------------------------------
-- 11. MESSAGES (formulaire de contact)
-- -------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  content text not null,
  is_read boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "messages: création publique (formulaire de contact)"
  on messages for insert
  with check (true);

create policy "messages: lecture réservée aux admins"
  on messages for select
  using (is_admin());

create policy "messages: modification réservée aux admins"
  on messages for update
  using (is_admin())
  with check (is_admin());

create policy "messages: suppression réservée aux admins"
  on messages for delete
  using (is_admin());

-- =========================================================================
-- FIN DU SCHÉMA
-- -------------------------------------------------------------------------
-- Prochaine étape : voir ADMIN_SETUP.md pour créer ton compte admin et
-- connecter le dashboard.
-- =========================================================================
