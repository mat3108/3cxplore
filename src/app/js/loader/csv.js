  // ---------- CSV (RFC 4180) ----------
  // pause très courte pour laisser la page se rafraîchir (barre de progression) ; non ralentie quand la fenêtre est en arrière-plan
  const tick = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  // lecture CSV rapide : les lignes sans guillemets sont découpées directement ; les objets sont créés d'un seul coup
  // par une fonction compilée pour l'en-tête du fichier (même forme pour toutes les lignes). La lecture se fait par
  // morceaux (fonction synchrone, bien optimisée par le navigateur) avec une pause entre deux morceaux.
  function csvChunk(S, max){
    const text = S.text, n = text.length, out = S.out; let i = S.i, cnt = 0;
    const slowRow = () => { // ligne avec guillemets (peut contenir des virgules et des retours à la ligne)
      const row = []; let f = '', q = false;
      while(i < n){ const c = text.charCodeAt(i);
        if(q){ if(c === 34){ if(text.charCodeAt(i + 1) === 34){ f += '"'; i += 2; continue; } q = false; i++; continue; }
          const j = text.indexOf('"', i); if(j < 0){ f += text.slice(i); i = n; break; } f += text.slice(i, j); i = j; continue; }
        if(c === 34){ q = true; i++; }
        else if(c === 44){ row.push(f); f = ''; i++; }
        else if(c === 10 || c === 13){ if(c === 13 && text.charCodeAt(i + 1) === 10) i++; i++; break; }
        else { let j = i; while(j < n){ const d = text.charCodeAt(j); if(d === 44 || d === 10 || d === 13 || d === 34) break; j++; } f += text.slice(i, j); i = j; } }
      row.push(f); return row; };
    while(i < n && cnt < max){
      let e = text.indexOf('\n', i); if(e < 0) e = n;
      const lineEnd = e > i && text.charCodeAt(e - 1) === 13 ? e - 1 : e, line = text.slice(i, lineEnd);
      let row;
      if(line.indexOf('"') < 0){ row = line.split(','); i = e + 1; }
      else row = slowRow();
      if(!S.make){ S.make = new Function('r', 'return {' + row.map((h, k) => JSON.stringify(h) + ':r[' + k + ']??""').join(',') + '}'); continue; }
      if(row.length === 1 && row[0] === '') continue;
      out.push(S.make(row)); cnt++;
    }
    S.i = i;
  }
  async function parseCSV(text, onp){
    const S = {text, i: 0, make: null, out: []};
    while(S.i < text.length){ csvChunk(S, 20000); if(S.i < text.length){ if(onp) onp(S.i / text.length); await tick(); } }
    return S.out;
  }

