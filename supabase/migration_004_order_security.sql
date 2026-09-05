-- =========================================================================
-- MIGRATION 004 — SÉCURISATION DES COMMANDES & FORMULES
-- -------------------------------------------------------------------------
-- À exécuter après les migrations précédentes. Purement additif.
-- =========================================================================

-- 1. Statut actif/inactif par formule (demandé : gestion fine des plans)
alter table product_plans add column if not exists active boolean not null default true;

-- 2. Index pour retrouver rapidement un client existant par contact
create index if not exists idx_customers_contact on customers (contact);

-- -------------------------------------------------------------------------
-- 3. SÉCURISATION DU PRIX — ne jamais faire confiance au navigateur
-- -------------------------------------------------------------------------
-- À l'insertion d'une ligne de commande, on ignore le prix envoyé par le
-- client et on le remplace systématiquement par le prix officiel présent
-- dans "product_plans". Même chose pour le nom du produit / de la formule
-- (évite qu'un intitulé trafiqué se retrouve dans une commande réelle).
create or replace function enforce_order_item_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  official_price numeric(12,2);
  official_plan_label text;
  official_product_id uuid;
  official_product_name text;
begin
  select pp.price, pp.label, pp.product_id, p.name
    into official_price, official_plan_label, official_product_id, official_product_name
  from product_plans pp
  join products p on p.id = pp.product_id
  where pp.id = new.plan_id;

  if official_price is null then
    raise exception 'Formule de produit invalide ou introuvable (plan_id=%)', new.plan_id;
  end if;

  if new.qty is null or new.qty < 1 then
    raise exception 'Quantité invalide';
  end if;

  -- On ignore product_id/unit_price/product_name/plan_label envoyés par le
  -- client et on les remplace par les valeurs officielles de la base.
  new.product_id := official_product_id;
  new.unit_price := official_price;
  new.product_name := official_product_name;
  new.plan_label := official_plan_label;
  new.line_total := official_price * new.qty;

  return new;
end;
$$;

drop trigger if exists trg_enforce_order_item_price on order_items;
create trigger trg_enforce_order_item_price
  before insert on order_items
  for each row execute function enforce_order_item_price();

-- -------------------------------------------------------------------------
-- 4. TOTAL DE LA COMMANDE — recalculé côté base, jamais depuis le frontend
-- -------------------------------------------------------------------------
create or replace function recalc_order_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order_id uuid;
begin
  target_order_id := coalesce(new.order_id, old.order_id);
  update orders
    set total = coalesce((select sum(line_total) from order_items where order_id = target_order_id), 0)
    where id = target_order_id;
  return null;
end;
$$;

drop trigger if exists trg_recalc_order_total on order_items;
create trigger trg_recalc_order_total
  after insert or update or delete on order_items
  for each row execute function recalc_order_total();

-- =========================================================================
-- FIN — Résultat : même si le navigateur d'un visiteur est manipulé (JS ou
-- localStorage modifiés), le prix et le total enregistrés dans Supabase
-- restent ceux réellement configurés dans product_plans. Aucune Edge
-- Function n'est nécessaire : ces triggers s'exécutent côté base de
-- données, hors de portée du client.
-- =========================================================================
