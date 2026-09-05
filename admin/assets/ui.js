/* =========================================================================
   HELPERS UI PARTAGÉS — ADMIN CALEB CREATIVE
   -------------------------------------------------------------------------
   Charger après auth.js sur chaque page protégée. Fournit :
   adminToast(message, type), adminConfirm(message), setBtnLoading(btn,bool)
   ========================================================================= */

function adminToast(message, type = 'success'){
  let el = document.querySelector('.admin-toast');
  if (!el){
    el = document.createElement('div');
    el.className = 'admin-toast';
    document.body.appendChild(el);
  }
  el.textContent = (type === 'error' ? '✕ ' : '✓ ') + message;
  el.className = 'admin-toast show ' + type;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3200);
}

/**
 * Affiche une boîte de confirmation avant une action destructrice.
 * Retourne une Promise<boolean> (true si l'utilisateur confirme).
 */
function adminConfirm(message){
  return new Promise((resolve) => {
    let overlay = document.querySelector('.admin-confirm-overlay');
    if (overlay) overlay.remove(); // évite les doublons si appelé plusieurs fois vite

    overlay = document.createElement('div');
    overlay.className = 'admin-confirm-overlay show';
    overlay.innerHTML = `
      <div class="admin-confirm-box">
        <p>${message}</p>
        <div class="admin-confirm-actions">
          <button type="button" class="btn btn-outline" data-choice="cancel">Annuler</button>
          <button type="button" class="btn btn-danger" data-choice="ok">Confirmer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      const choice = e.target.dataset.choice;
      if (!choice) return;
      overlay.remove();
      resolve(choice === 'ok');
    });
  });
}

function setBtnLoading(btn, isLoading, loadingText = 'Chargement...'){
  if (isLoading){
    btn.dataset.originalText = btn.textContent;
    btn.textContent = loadingText;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.disabled = false;
  }
}
