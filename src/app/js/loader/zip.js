  // ---------- ZIP (lecture native, sans bibliothèque) ----------
  async function readZip(file){
    const tailLen = Math.min(file.size, 65557);
    const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
    let eocd = -1;
    for(let i = tailLen - 22; i >= 0; i--) if(tail.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
    if(eocd < 0) throw new Error("Ce fichier n'est pas un .zip valide.");
    let count = tail.getUint16(eocd + 10, true), cdSize = tail.getUint32(eocd + 12, true), cdOff = tail.getUint32(eocd + 16, true);
    if(cdOff === 0xFFFFFFFF || count === 0xFFFF){ // ZIP64
      const loc = eocd - 20;
      if(loc >= 0 && tail.getUint32(loc, true) === 0x07064b50){
        const z64off = Number(tail.getBigUint64(loc + 8, true));
        const z = new DataView(await file.slice(z64off, z64off + 56).arrayBuffer());
        count = Number(z.getBigUint64(32, true)); cdSize = Number(z.getBigUint64(40, true)); cdOff = Number(z.getBigUint64(48, true));
      }
    }
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const dec = new TextDecoder();
    const entries = new Map();
    let p = 0;
    for(let n = 0; n < count && p + 46 <= cd.byteLength; n++){
      if(cd.getUint32(p, true) !== 0x02014b50) break;
      const method = cd.getUint16(p + 10, true);
      let csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true);
      const nlen = cd.getUint16(p + 28, true), xlen = cd.getUint16(p + 30, true), clen = cd.getUint16(p + 32, true);
      let off = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nlen)).replace(/\\/g, '/');
      if(csize === 0xFFFFFFFF || usize === 0xFFFFFFFF || off === 0xFFFFFFFF){ // champs ZIP64 dans l'extra
        let x = p + 46 + nlen; const xe = x + xlen;
        while(x + 4 <= xe){
          const id = cd.getUint16(x, true), sz = cd.getUint16(x + 2, true);
          if(id === 1){ let q = x + 4;
            if(usize === 0xFFFFFFFF){ usize = Number(cd.getBigUint64(q, true)); q += 8; }
            if(csize === 0xFFFFFFFF){ csize = Number(cd.getBigUint64(q, true)); q += 8; }
            if(off === 0xFFFFFFFF){ off = Number(cd.getBigUint64(q, true)); }
          }
          x += 4 + sz;
        }
      }
      if(!name.endsWith('/')) entries.set(name, {name, method, csize, usize, off});
      p += 46 + nlen + xlen + clen;
    }
    async function blob(name, type){
      const e = entries.get(name);
      if(!e) return null;
      const h = new DataView(await file.slice(e.off, e.off + 30).arrayBuffer());
      const start = e.off + 30 + h.getUint16(26, true) + h.getUint16(28, true);
      const raw = file.slice(start, start + e.csize);
      if(e.method === 0) return new Blob([raw], {type: type || ''});
      if(e.method !== 8) throw new Error('Compression non prise en charge pour ' + name);
      if(typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur ne sait pas décompresser les .zip (utilisez Chrome, Edge, Safari 16.4+ ou Firefox 113+).');
      const out = await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      return new Blob([out], {type: type || ''});
    }
    return {entries, blob, text: async n => { const b = await blob(n); return b ? b.text() : null; }};
  }

  // fichiers audio des enregistrements présents dans le zip (option « inclure les enregistrements » des sauvegardes 3CX) :
  // clé = chemin 3CX de l'enregistrement (« poste/fichier »), valeur = entrée du zip
  function recIndex(z, recs){
    const want = new Set(recs.map(r => r[5])), map = {};
    for(const n of z.entries.keys()){
      if(!/\.(wav|mp3|opus|ogg|m4a)$/i.test(n)) continue;
      const p = n.split('/'); if(p.length < 2) continue;
      const k = p.slice(-2).join('/'); if(want.has(k)) map[k] = n;
    }
    return map;
  }

