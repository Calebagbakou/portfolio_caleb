-- =========================================================================
-- MIGRATION 005 — FONCTIONS RPC SÉCURISÉES (COMMANDES)
-- -------------------------------------------------------------------------
-- Pourquoi des fonctions plutôt que d'ouvrir les tables en lecture publique ?
-- "orders", "order_items" et "customers" doivent rester illisibles
-- directement par la clé anon (sinon n'importe qui pourrait lister TOUTES
-- les commandes/clients). Ces fonctions sont exécutées "security definer"
-- (elles contournent RLS en interne) mais ne renvoient jamais plus que ce
-- que l'appelant a le droit de voir : sa propre commande, par son id exact
-- (uuid non devinable), jamais une liste.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Retrouver ou créer un client par son contact (téléphone/WhatsApp)
-- -------------------------------------------------------------------------
create or replace function find_or_create_customer(p_name text, p_contact text, p_email text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Le nom est obligatoire.';
  end if;
  if p_contact is null or length(trim(p_contact)) < 6 then
    raise exception 'Numéro de téléphone invalide.';
  end if;

  select id into v_id from customers where contact = p_contact limit 1;

  if v_id is not null then
    update customers set
      name = coalesce(nullif(trim(p_name), ''), name),
      email = coalesce(nullif(trim(p_email), ''), email)
    where id = v_id;
    return v_id;
  end if;

  insert into customers (name, contact, email)
  values (trim(p_name), trim(p_contact), nullif(trim(p_email), ''))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function find_or_create_customer(text, text, text) to anon, authenticated;

-- -------------------------------------------------------------------------
-- 2. Créer une commande complète en une seule opération atomique
-- -------------------------------------------------------------------------
-- p_items : tableau JSON [{ "plan_id": "uuid", "qty": 2 }, ...]
-- Le client n'envoie JAMAIS de prix ni de nom de produit ici : le trigger
-- enforce_order_item_price() (migration 004) impose les valeurs officielles
-- de "product_plans" pour chaque ligne, quoi que le navigateur envoie.
create or replace function create_order_with_items(
  p_customer_id uuid,
  p_payment_method text,
  p_note text,
  p_items jsonb
)
returns table(order_id uuid, ref text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_ref text;
  item jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide.';
  end if;

  if not exists (select 1 from customers where id = p_customer_id) then
    raise exception 'Client invalide.';
  end if;

  v_ref := 'CC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into orders (ref, customer_id, payment_method, note, status, payment_status)
  values (v_ref, p_customer_id, p_payment_method, p_note, 'en_attente', 'non_confirme')
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    if (item->>'plan_id') is null then
      raise exception 'Formule manquante dans le panier.';
    end if;
    -- product_id/product_name/plan_label/unit_price/line_total : valeurs
    -- provisoires, systématiquement écrasées par le trigger avec les
    -- données officielles de product_plans.
    insert into order_items (order_id, plan_id, qty, product_id, product_name, plan_label, unit_price, line_total)
    values (
      v_order_id,
      (item->>'plan_id')::uuid,
      greatest(coalesce((item->>'qty')::int, 1), 1),
      (select product_id from product_plans where id = (item->>'plan_id')::uuid),
      '', '', 0, 0
    );
  end loop;

  return query select o.id, o.ref, o.total from orders o where o.id = v_order_id;
end;
$$;

grant execute on function create_order_with_items(uuid, text, text, jsonb) to anon, authenticated;

-- -------------------------------------------------------------------------
-- 3. Lire UNE commande précise pour la page de confirmation
-- -------------------------------------------------------------------------
-- Accessible via son id (uuid non devinable) — jamais une liste. C'est ce
-- que confirmation.html appelle pour afficher le récapitulatif réel.
create or replace function get_order_confirmation(p_order_id uuid)
returns table (
  id uuid, ref text, status text, payment_status text, payment_method text,
  total numeric, note text, created_at timestamptz,
  customer_name text, customer_contact text,
  items jsonb
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.ref, o.status, o.payment_status, o.payment_method, o.total, o.note, o.created_at,
         c.name, c.contact,
         (select coalesce(jsonb_agg(jsonb_build_object(
            'product_name', oi.product_name, 'plan_label', oi.plan_label,
            'unit_price', oi.unit_price, 'qty', oi.qty, 'line_total', oi.line_total
          )), '[]'::jsonb) from order_items oi where oi.order_id = o.id)
  from orders o
  left join customers c on c.id = o.customer_id
  where o.id = p_order_id;
$$;

grant execute on function get_order_confirmation(uuid) to anon, authenticated;

-- =========================================================================
-- FIN — Résumé du flux sécurisé :
-- panier (local) → find_or_create_customer() → create_order_with_items()
-- → confirmation.html appelle get_order_confirmation(id_reçu)
-- Aucune table sensible n'est ouverte en lecture publique ; tout passe par
-- ces trois fonctions, volontairement étroites dans ce qu'elles exposent.
-- =========================================================================
