-- =========================================================================
-- MIGRATION 002 — BIBLIOTHÈQUE MÉDIA
-- -------------------------------------------------------------------------
-- À exécuter APRÈS schema.sql, dans Supabase → SQL Editor.
-- Purement additif : ne touche à aucune table existante autrement que pour
-- y ajouter des colonnes optionnelles. Rien n'est supprimé.
-- =========================================================================

-- 1. Colonnes manquantes sur "media" (nom affiché + catégorie libre)
alter table media add column if not exists name text;
alter table media add column if not exists category text; -- ex: 'logo','profil','projet','produit','bannière','autre'

-- 2. Bucket de stockage "media" (public en lecture — nécessaire pour que
--    le site public affiche les images sans authentification)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 3. Règles de sécurité sur le bucket : tout le monde peut lire,
--    seuls les admins peuvent écrire/modifier/supprimer.
create policy "media bucket: lecture publique"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media bucket: upload réservé aux admins"
  on storage.objects for insert
  with check (bucket_id = 'media' and is_admin());

create policy "media bucket: modification réservée aux admins"
  on storage.objects for update
  using (bucket_id = 'media' and is_admin());

create policy "media bucket: suppression réservée aux admins"
  on storage.objects for delete
  using (bucket_id = 'media' and is_admin());

-- =========================================================================
-- FIN — si "storage.objects" a déjà des policies portant ces noms exacts,
-- Supabase renverra une erreur "policy already exists" : dans ce cas,
-- ignore-la simplement, la policy est déjà en place.
-- =========================================================================
