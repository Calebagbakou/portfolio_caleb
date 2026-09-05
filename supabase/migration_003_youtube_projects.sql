-- =========================================================================
-- MIGRATION 003 — VIDÉOS YOUTUBE SUR LES PROJETS
-- -------------------------------------------------------------------------
-- À exécuter APRÈS schema.sql et migration_002. Purement additif.
-- =========================================================================

-- L'admin colle n'importe quel format de lien YouTube ; le JS (admin et
-- site public) extrait l'identifiant et reconstruit l'URL d'intégration.
alter table projects add column if not exists youtube_url text;
alter table projects add column if not exists youtube_id text;

-- Index utile pour la requête publique (projets vidéo publiés, triés)
create index if not exists idx_projects_published_sort
  on projects (status, sort_order)
  where status = 'published';
