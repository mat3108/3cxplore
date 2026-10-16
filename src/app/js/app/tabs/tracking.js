// ---------- Suivi dans le temps ----------
// Un résumé chiffré (« point ») est calculé pour chaque backup chargé et conservé dans le navigateur.
const SUIVI_V = 1;
const SUIVI_KEY = fq => 'suivi3cx:' + (fq || '');
function suiviLoad(fq){ try{ const a = JSON.parse(localStorage.getItem(SUIVI_KEY(fq)) || '[]'); return Array.isArray(a) ? a : []; }catch(e){ return []; } }
function suiviSave(fq, arr){ try{ localStorage.setItem(SUIVI_KEY(fq), JSON.stringify(arr)); return true; }catch(e){ return false; } }
function suiviUpsert(snap){ const a = suiviLoad(snap.fqdn).filter(s => s.id !== snap.id); a.push(snap); a.sort((x, y) => (x.iso || '') < (y.iso || '') ? -1 : 1); return suiviSave(snap.fqdn, a); }
