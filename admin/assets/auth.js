/* =========================================================================
   AUTH ADMIN — CALEB CREATIVE
   -------------------------------------------------------------------------
   Charge ce fichier après config.js et le CDN supabase-js sur chaque page
   /admin. Fournit : getSupabase(), requireAdminSession(), logout().
   ========================================================================= */

let _supabase = null;
function getSupabase(){
  if (_supabase) return _supabase;
  if (!window.supabase){
    console.error("Le SDK supabase-js n'est pas chargé (vérifie la balise <script> du CDN).");
    return null;
  }
  _supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return _supabase;
}

/**
 * À appeler en haut de chaque page protégée (tout /admin sauf login.html).
 * Redirige vers login.html si : pas connecté, OU connecté mais pas admin.
 * Retourne l'utilisateur Supabase si tout est en ordre.
 */
async function requireAdminSession(){
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session){
    window.location.href = 'login.html';
    return null;
  }

  // Vérifie que ce compte connecté fait bien partie de la table "admins".
  // Si non-admin, la policy RLS renvoie un résultat vide (pas une erreur).
  const { data, error } = await supabase.from('admins').select('id').eq('id', session.user.id).maybeSingle();
  if (error || !data){
    await supabase.auth.signOut();
    window.location.href = 'login.html?denied=1';
    return null;
  }

  return session.user;
}

async function logout(){
  const supabase = getSupabase();
  if (supabase) await supabase.auth.signOut();
  window.location.href = 'login.html';
}
