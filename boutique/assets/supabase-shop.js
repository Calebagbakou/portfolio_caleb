/* =========================================================================
   BOUTIQUE ← SUPABASE (source de vérité)
   -------------------------------------------------------------------------
   Remplace window.CALEB_SHOP_PRODUCTS / CALEB_SHOP_CATEGORIES par les
   vraies données Supabase (table "products" + "product_plans" +
   "categories"). Si Supabase est injoignable ou ne renvoie rien, les
   valeurs de secours définies dans products.js restent actives.

   Toutes les pages boutique doivent faire :
     await loadShopProducts();
   avant de lire window.CALEB_SHOP_PRODUCTS / CALEB_SHOP_CATEGORIES.
   ========================================================================= */

let _shopSupabase = null;
function getShopSupabase(){
  if (_shopSupabase) return _shopSupabase;
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
  _shopSupabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return _shopSupabase;
}

function shopInitials(name){
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

const SHOP_FALLBACK_GRADIENT = "linear-gradient(135deg,#2A2A2A,#111111)";

function shopMediaBackground(supabase, media){
  if (!media) return SHOP_FALLBACK_GRADIENT;
  if (media.external_url) return `url('${media.external_url}') center/cover no-repeat`;
  if (media.storage_path){
    const { data } = supabase.storage.from('media').getPublicUrl(media.storage_path);
    if (data && data.publicUrl) return `url('${data.publicUrl}') center/cover no-repeat`;
  }
  return SHOP_FALLBACK_GRADIENT;
}

let _shopProductsLoaded = false;

/**
 * Charge les produits actifs depuis Supabase et remplace
 * window.CALEB_SHOP_PRODUCTS / CALEB_SHOP_CATEGORIES.
 * Peut être appelée plusieurs fois sans effet secondaire (mise en cache
 * mémoire simple pour la durée de la page).
 */
async function loadShopProducts(){
  if (_shopProductsLoaded) return;

  const supabase = getShopSupabase();
  if (!supabase){
    console.warn('Supabase indisponible — la boutique utilise les données de secours.');
    _shopProductsLoaded = true;
    return;
  }

  try {
    const [{ data: products, error: prodErr }, { data: categories, error: catErr }] = await Promise.all([
      supabase
        .from('products')
        .select('*, product_plans(*), categories(slug, label), cover_media:media!cover_media_id(storage_path, external_url, thumbnail_url)')
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
      supabase
        .from('categories')
        .select('*')
        .eq('scope', 'boutique')
        .order('sort_order', { ascending: true }),
    ]);

    if (prodErr) throw prodErr;

    if (products && products.length){
      window.CALEB_SHOP_PRODUCTS = products.map(row => ({
        id: row.slug,
        dbId: row.id,
        name: row.name,
        category: row.categories ? row.categories.slug : 'autre',
        categoryLabel: row.categories ? row.categories.label : 'Autre',
        badge: row.badge || (row.featured ? 'Populaire' : null),
        avatar: shopInitials(row.name),
        gradient: shopMediaBackground(supabase, row.cover_media),
        tagline: row.tagline || '',
        description: row.description || '',
        highlights: row.highlights || [],
        featured: !!row.featured,
        plans: (row.product_plans || [])
          .filter(pl => pl.active !== false)
          .slice()
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(pl => ({
            id: pl.id,
            dbId: pl.id,
            label: pl.label,
            price: Number(pl.price) || 0,
            old_price: pl.old_price ? Number(pl.old_price) : null,
            currency: pl.currency || 'FCFA',
          })),
      })).filter(p => p.plans.length > 0); // un produit sans formule active n'est pas achetable
    }

    if (!catErr && categories && categories.length){
      window.CALEB_SHOP_CATEGORIES = [
        { id: 'tous', label: 'Tous les produits' },
        ...categories.map(c => ({ id: c.slug, label: c.label })),
      ];
    } else if (products && products.length){
      // pas de table categories renseignée : déduit les catégories des produits eux-mêmes
      const seen = new Map();
      products.forEach(row => {
        if (row.categories) seen.set(row.categories.slug, row.categories.label);
      });
      if (seen.size){
        window.CALEB_SHOP_CATEGORIES = [
          { id: 'tous', label: 'Tous les produits' },
          ...Array.from(seen, ([id, label]) => ({ id, label })),
        ];
      }
    }

  } catch (err){
    console.error('Chargement Supabase de la boutique impossible, repli sur les données de secours :', err.message);
    // window.CALEB_SHOP_PRODUCTS reste sur le fallback déjà assigné par products.js
  } finally {
    _shopProductsLoaded = true;
  }
}
