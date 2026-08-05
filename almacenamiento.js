// ══════════════════════════════════════════════════════════════════
// ALMACENAMIENTO — Simulación interactiva de métodos de asignación
// Drop-in replacement: no requiere tocar index.html ni styles.css,
// inyecta sus propios estilos y controles al cargar.
//
// NOVEDADES DE ESTA VERSIÓN:
//  • Panel "Agregar Archivo" en el lado derecho, encima de "Resumen".
//  • Al pasar el mouse por un bloque ocupado, se resaltan TODOS los
//    bloques de ese archivo y su línea/relación en el overlay SVG.
//  • Click en un bloque para seleccionarlo: el panel derecho muestra
//    a qué archivo pertenece y permite eliminarlo del disco.
//  • Panel "Ampliar Archivo": aumenta el tamaño de un archivo existente
//    y vuelve a simular automáticamente para reflejar el cambio.
// ══════════════════════════════════════════════════════════════════

let archivos = [];
window.archivos = archivos;

const ACOLS_FALLBACK = ['#4fc3f7', '#ffb36b', '#7c6cff', '#4caf50', '#f44336', '#c8b36d', '#e857a8', '#66bb6a'];
function coloresDisponibles() {
  return (typeof ACOLS !== 'undefined' && Array.isArray(ACOLS) && ACOLS.length) ? ACOLS : ACOLS_FALLBACK;
}

// ─── Estado de la simulación paso a paso ───
let almDisco = [];
let almResul = [];
let almNoAsig = [];
let almFragTotal = 0;
let almIdxBlocks = 0;
let almColorMap = {};
let almStep = 0;
let almPlaying = false;
let almPlayTimer = null;
let almTotB = 0;
let almBkKb = 0;
let almMetodo = 'contigua';
let almSelectedBlock = null; // índice del bloque seleccionado en el mapa

// ─── Utilidad: escapar comillas para insertar en atributos HTML ───
function escAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }

// ─── Metadatos de método ───
function getMetodoAlm() {
  const sel = document.getElementById('alm-metodo');
  return sel && sel.value ? sel.value : 'contigua';
}
function getMetodoLabel(metodo) {
  const labels = { contigua: 'Contigua', enlazada: 'Enlazada', indexada: 'Indexada', multinivel: 'Multinivel', fat: 'FAT', extension: 'Por extensión', bitmap: 'Bitmap' };
  return labels[metodo] || 'Asignación';
}
function getMetodoDescripcion(metodo) {
  const desc = {
    contigua: 'Los bloques se ocupan en una corrida continua y clara.',
    enlazada: 'Cada bloque apunta al siguiente para formar una cadena.',
    indexada: 'Un bloque índice referencia a los bloques de datos.',
    multinivel: 'Un índice principal apunta a bloques directos y, si hace falta, a índices indirectos que a su vez apuntan a más bloques.',
    fat: 'Una tabla FAT global enlaza el bloque siguiente de cada archivo.',
    extension: 'El archivo se guarda en una o varias extensiones (rachas) de bloques contiguos.',
    bitmap: 'Un mapa de bits marca con 1/0 qué bloques del disco están ocupados.'
  };
  return desc[metodo] || 'Simulación de asignación de bloques.';
}

function almKB(tam, unit) { return unit === 'MB' ? tam * 1024 : unit === 'GB' ? tam * 1024 * 1024 : tam; }
function discoTotalKB() {
  const cap = parseFloat(document.getElementById('d-cap').value) || 512;
  const u = document.getElementById('d-cap-u').value;
  return almKB(cap, u);
}
function blkKB() { return parseInt(document.getElementById('d-blk').value) || 4; }
function totalBloques() { return Math.floor(discoTotalKB() / blkKB()); }

// ─── Gestión de archivos: carga por CSV (reemplaza el formulario manual) ───
// Formato esperado por línea: nombre,tamaño,unidad   (unidad: KB | MB | GB)
// La primera línea puede ser un encabezado ("nombre,...") y se ignora.
function parseCsvArchivos(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    if (!parts.length || !parts[0]) continue;
    if (/^nombre$|^nom$/i.test(parts[0])) continue; // encabezado
    const [nom, tamStr, uRaw] = parts;
    const tam = parseFloat(tamStr);
    const u = (uRaw || 'KB').toUpperCase();
    if (!nom || isNaN(tam) || tam <= 0 || !['KB', 'MB', 'GB'].includes(u)) continue;
    rows.push({ nom, tam, u });
  }
  return rows;
}

function cargarArchivosCSV(event) {
  const input = event && event.target;
  const file = input && input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsvArchivos(reader.result);
    if (!rows.length) {
      alert('El CSV no tiene filas válidas.\nFormato esperado por línea: nombre,tamaño,unidad (KB/MB/GB).\nEj: Docs,220,KB');
    } else {
      const met = getMetodoAlm();
      rows.forEach(r => {
        if (archivos.some(a => a.nom === r.nom)) return; // evita nombres duplicados
        const tamKB = almKB(r.tam, r.u);
        const bloqReq = Math.ceil(tamKB / blkKB());
        archivos.push({ nom: r.nom, tam: r.tam, u: r.u, tamKB, bloqReq, met });
      });
      window.archivos = archivos;
      renderTblArch();
      document.getElementById('a-narch').textContent = archivos.length;
      almRefreshBoundsAfterEdit();
    }
    if (input) input.value = '';
  };
  reader.onerror = () => { alert('No se pudo leer el archivo CSV.'); if (input) input.value = ''; };
  reader.readAsText(file);
}

function cargarEjemploAlm() {
  const met = getMetodoAlm();
  archivos = [
    { nom: 'Docs', tam: 220, u: 'KB', tamKB: 220, bloqReq: 3, met },
    { nom: 'Img', tam: 120, u: 'KB', tamKB: 120, bloqReq: 2, met },
    { nom: 'Audio', tam: 70, u: 'KB', tamKB: 70, bloqReq: 1, met },
    { nom: 'Video', tam: 480, u: 'KB', tamKB: 480, bloqReq: 6, met },
    { nom: 'Backup', tam: 90, u: 'KB', tamKB: 90, bloqReq: 1, met }
  ];
  window.archivos = archivos;
  almSelectedBlock = null;
  renderTblArch();
  document.getElementById('a-narch').textContent = archivos.length;
  almRefreshBoundsAfterEdit();
}

function renderTblArch() {
  const tb = document.getElementById('tbl-arch');
  if (!archivos.length) { tb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#5a5a5a;padding:14px">Sin archivos.</td></tr>'; return; }
  tb.innerHTML = archivos.map((a, i) => `
    <tr class="${i === almStep - 1 ? 'a2-row-new' : ''}"><td class="pid">${a.nom}</td><td>${a.tam} ${a.u}</td><td>${a.bloqReq}</td>
    <td style="color:#4fc3f7;text-transform:capitalize">${a.met || '—'}</td></tr>`).join('');
}

function almRefreshBoundsAfterEdit() {
  // Si se editan archivos, la simulación en curso queda desactualizada: la reiniciamos visualmente.
  const prog = document.getElementById('a2-progress');
  if (prog) { prog.max = archivos.length; }
  refreshAmpliarSelect();
  almUpdateControls();
}

// ─── onchange del selector de método (sin correr la simulación) ───
function onAlmMetodoChange() {
  const metodoSel = getMetodoAlm();
  almPause();
  const t = document.getElementById('alm-sim-title'); if (t) t.textContent = getMetodoLabel(metodoSel);
  const m = document.getElementById('alm-sim-method'); if (m) m.textContent = getMetodoLabel(metodoSel);
  const b = document.getElementById('alm-sim-body'); if (b) b.textContent = getMetodoDescripcion(metodoSel);
  const panel = document.getElementById('alm-extra-panel');
  if (panel) { panel.innerHTML = ''; panel.style.display = 'none'; }
}

// ─── Posición de celda en la grilla del disco ───
function getAlmCellPos(index, cols, cellSize) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
}

function renderAlmOverlay(disco, cols, cellSize, metodoSel) {
  const occupied = disco.map((b, i) => ({ ...b, index: i })).filter(b => !b.libre);
  const overlay = document.getElementById('disco-overlay');
  if (!overlay) return;
  const rows = Math.max(1, Math.ceil(disco.length / cols));
  overlay.setAttribute('viewBox', `0 0 ${cols * cellSize} ${rows * cellSize}`);
  if (!occupied.length) { overlay.innerHTML = ''; return; }
  const defs = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#4fc3f7"/></marker></defs>`;
  const stroke = '#4fc3f7', stroke2 = '#ffb36b', stroke3 = '#7c6cff';

  if (metodoSel === 'contigua') {
    const groups = {}; occupied.forEach(b => { const k = b.archivo || 'x'; (groups[k] = groups[k] || []).push(b); });
    const parts = Object.entries(groups).map(([k, g]) => {
      const s = g.sort((a, b) => (a.order ?? a.index) - (b.order ?? b.index));
      const a = getAlmCellPos(s[0].index, cols, cellSize), c = getAlmCellPos(s[s.length - 1].index, cols, cellSize);
      return `<line class="a2-oline" data-archivo="${escAttr(k)}" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${stroke}" stroke-width="3" stroke-linecap="round" />`;
    }).join('');
    overlay.innerHTML = `${defs}<g>${parts}</g>`; return;
  }
  if (metodoSel === 'enlazada' || metodoSel === 'fat') {
    const byFile = {}; occupied.forEach(b => { const k = b.archivo || 'x'; (byFile[k] = byFile[k] || []).push(b); });
    const parts = Object.entries(byFile).map(([k, g]) => {
      const s = g.sort((a, b) => (a.order ?? a.index) - (b.order ?? b.index));
      const pts = s.map(b => { const p = getAlmCellPos(b.index, cols, cellSize); return `${p.x},${p.y}`; }).join(' ');
      return `<polyline class="a2-oline" data-archivo="${escAttr(k)}" points="${pts}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)" />`;
    }).join('');
    overlay.innerHTML = `${defs}<g>${parts}</g>`; return;
  }
  if (metodoSel === 'indexada') {
    const byFile = {}; occupied.forEach(b => { (byFile[b.archivo] = byFile[b.archivo] || []).push(b); });
    const parts = Object.entries(byFile).map(([k, g]) => {
      const idx = g.find(b => b.tipo === 'indice');
      if (!idx) return '';
      const a = getAlmCellPos(idx.index, cols, cellSize);
      return g.filter(b => b.tipo !== 'indice').map(b => {
        const c = getAlmCellPos(b.index, cols, cellSize);
        return `<line class="a2-oline" data-archivo="${escAttr(k)}" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${stroke3}" stroke-width="2" stroke-dasharray="4 3" />`;
      }).join('');
    }).join('');
    overlay.innerHTML = `${defs}<g>${parts}</g>`; return;
  }
  if (metodoSel === 'multinivel') {
    const parts = occupied.filter(b => b.parent != null).map(b => {
      const a = getAlmCellPos(b.parent, cols, cellSize), c = getAlmCellPos(b.index, cols, cellSize);
      const indirecto = b.tipo === 'indice-ind';
      return `<line class="a2-oline" data-archivo="${escAttr(b.archivo)}" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${indirecto ? stroke3 : stroke2}" stroke-width="2" stroke-dasharray="${indirecto ? '2 2' : '4 3'}" />`;
    }).join('');
    overlay.innerHTML = `${defs}<g>${parts}</g>`; return;
  }
  if (metodoSel === 'extension') {
    const groups = {}; occupied.forEach(b => { const k = b.groupId || b.archivo; (groups[k] = groups[k] || []).push(b); });
    const parts = Object.values(groups).map(g => {
      const s = g.sort((a, b) => (a.order ?? a.index) - (b.order ?? b.index));
      const pts = s.map(b => { const p = getAlmCellPos(b.index, cols, cellSize); return `${p.x},${p.y}`; }).join(' ');
      return `<polyline class="a2-oline" data-archivo="${escAttr(s[0].archivo)}" points="${pts}" fill="none" stroke="${stroke2}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
    }).join('');
    overlay.innerHTML = `${defs}<g>${parts}</g>`; return;
  }
  if (metodoSel === 'bitmap') {
    const parts = occupied.map(b => { const p = getAlmCellPos(b.index, cols, cellSize); return `<circle class="a2-oline" data-archivo="${escAttr(b.archivo)}" cx="${p.x}" cy="${p.y}" r="3.5" fill="#c8b36d" />`; }).join('');
    overlay.innerHTML = `${defs}<g>${parts}</g>`;
  }
}

// ─── Layout dinámico del mapa: usar todo el ancho disponible sin pasar de 5 filas ───
const ALM_MAX_ROWS = 5;
const ALM_CELL_IDEAL = 34;

function computeAlmLayout(totalBlocks) {
  const wrap = document.getElementById('disco-wrap');
  const containerWidth = (wrap && wrap.clientWidth) ? wrap.clientWidth : 480;
  const colsForRows = totalBlocks > 0 ? Math.ceil(totalBlocks / ALM_MAX_ROWS) : 10;
  const colsForWidth = Math.max(10, Math.floor(containerWidth / ALM_CELL_IDEAL));
  let cols = Math.max(colsForRows, colsForWidth);
  if (totalBlocks > 0) cols = Math.min(cols, totalBlocks);
  cols = Math.max(1, cols);
  let cellSize = ALM_CELL_IDEAL;
  const neededWidth = cols * ALM_CELL_IDEAL;
  if (neededWidth > containerWidth) cellSize = Math.max(12, Math.floor(containerWidth / cols));
  return { cols, cellSize };
}

let almLastRenderArgs = null;

// ─── Render principal (grilla + stats + tabla) ───
function renderAlmState(disco, archColorMap, totB, bkKb, resul, noAsig, fragTotal, idxBlocks, archivosRef, metodoSel, stepInfo) {
  almLastRenderArgs = { disco, archColorMap, totB, bkKb, resul, noAsig, fragTotal, idxBlocks, archivosRef, metodoSel, stepInfo };
  if (almSelectedBlock != null && almSelectedBlock >= disco.length) almSelectedBlock = null;

  const { cols, cellSize } = computeAlmLayout(disco.length);
  const grid = document.getElementById('disco-grid');
  grid.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  const rows = Math.max(1, Math.ceil(disco.length / cols));
  grid.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
  grid.innerHTML = disco.map((b, i) => {
    const selCls = (almSelectedBlock === i) ? ' a2-selected' : '';
    if (b.libre) return `<div class="blk libre${selCls}" data-index="${i}" data-archivo="" title="Bloque ${b.id} — Libre" onclick="almSelectBlock(${i})">${b.id}</div>`;
    const col = archColorMap[b.archivo] || '#555';
    let cls = 'ocupado', lbl = b.archivo.substring(0, 3).toUpperCase();
    if (b.tipo === 'indice') { cls = 'idx-blk'; lbl = 'IDX'; }
    else if (b.tipo === 'dir') { cls = 'idx-blk'; lbl = 'DIR'; }
    else if (b.tipo === 'indice-ind') { cls = 'idx-blk'; lbl = 'IDX2'; }
    else if (b.tipo === 'pagina') { cls = 'contigua-blk'; lbl = 'N' + (b.nivel || ''); }
    else if (b.tipo === 'enlazada' || b.tipo === 'enlazada-fin') { cls = 'ptr'; lbl = '↳'; }
    else if (b.tipo === 'fat' || b.tipo === 'fat-fin') { cls = 'ptr'; lbl = 'F'; }
    else if (b.tipo === 'bitmap') { cls = 'bitmap-blk'; lbl = '1'; }
    else if (b.tipo === 'extension') { cls = 'extension-blk'; lbl = 'EXT'; }
    else if (b.tipo === 'contigua') { cls = 'contigua-blk'; lbl = 'C'; }
    return `<div class="blk ${cls}${selCls}" data-index="${i}" data-archivo="${escAttr(b.archivo)}" style="background:${col}cc" title="Bloque ${b.id} — ${b.archivo} (${b.tipo})" onmouseenter="almHoverBlock(${i},true)" onmouseleave="almHoverBlock(${i},false)" onclick="almSelectBlock(${i})">${b.id}<br><span class="blk-mini">${lbl}</span></div>`;
  }).join('');
  renderAlmOverlay(disco, cols, cellSize, metodoSel);

  const usados = disco.filter(b => !b.libre).length;
  document.getElementById('a-tot').textContent = totB;
  document.getElementById('a-uso').textContent = usados;
  document.getElementById('a-lib').textContent = totB - usados;
  document.getElementById('a-asig').textContent = resul.length;
  document.getElementById('a-rech').textContent = noAsig.length;
  document.getElementById('a-frag').textContent = fragTotal.toFixed(1) + ' KB';
  document.getElementById('a-bidx').textContent = idxBlocks;
  document.getElementById('d-cap-info').textContent = `(${totB} bloques de ${bkKb}KB)`;

  document.getElementById('leyenda-alm').innerHTML = Object.entries(archColorMap).map(([nom, col]) =>
    `<span style="color:#aaa">■ <span style="color:${col}">${nom}</span></span>`).join(' ');

  const metCount = {};
  archivosRef.forEach(a => { metCount[a.met || metodoSel] = (metCount[a.met || metodoSel] || 0) + 1; });
  document.getElementById('a-metodos').innerHTML = Object.entries(metCount).map(([m, n]) =>
    `<div style="margin-bottom:3px"><span style="color:#4fc3f7;text-transform:capitalize">${m}</span>: ${n} archivo(s)</div>`).join('');

  const allRes = [...resul, ...noAsig.map(a => ({ ...a, bloqAsig: [], estado: 'Rechazado' }))];
  document.getElementById('tbl-alm-res').innerHTML = allRes.length ? allRes.map(a => `
    <tr><td class="pid">${a.nom}</td><td>${a.tamKB} KB</td><td>${a.bloqReq}</td>
    <td style="color:#4fc3f7;text-transform:capitalize">${a.met || '—'}</td>
    <td>${a.bloqAsig && a.bloqAsig.length ? a.bloqAsig.join(', ') : '—'}</td>
    <td style="color:${a.estado === 'Asignado' ? '#4caf50' : '#f44336'}">${a.estado}</td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#5a5a5a;padding:14px">Sin simulación.</td></tr>';

  const simTitle = document.getElementById('alm-sim-title');
  const simMethod = document.getElementById('alm-sim-method');
  const simBody = document.getElementById('alm-sim-body');
  if (simTitle) simTitle.textContent = stepInfo ? stepInfo.title : getMetodoLabel(metodoSel);
  if (simMethod) simMethod.textContent = getMetodoLabel(metodoSel);
  if (simBody) simBody.textContent = stepInfo ? stepInfo.description : getMetodoDescripcion(metodoSel);

  renderTblArch();
  almUpdateBlockInfo();
}

// ─── Lógica de asignación por método ───
function asignarArchivo(disco, arch, metodoSel, bkKb) {
  const libres = disco.filter(b => b.libre);
  if (libres.length < arch.bloqReq) return { ok: false, motivo: 'Espacio insuficiente' };
  let asignados = [], fragDelta = 0;
  const tamUltimoDefault = () => Math.max(0, bkKb - (arch.tamKB - (arch.bloqReq - 1) * bkKb));

  if (metodoSel === 'contigua') {
    let start = -1, count = 0;
    for (let i = 0; i < disco.length; i++) {
      if (disco[i].libre) { count++; if (count === 1) start = i; if (count === arch.bloqReq) break; }
      else { count = 0; start = -1; }
    }
    if (count < arch.bloqReq) return { ok: false, motivo: 'No hay espacio contiguo' };
    for (let i = start; i < start + arch.bloqReq; i++) { disco[i].libre = false; disco[i].archivo = arch.nom; disco[i].tipo = 'contigua'; disco[i].groupId = `${arch.nom}:contigua`; disco[i].order = i - start; asignados.push(i); }
    fragDelta = tamUltimoDefault();

  } else if (metodoSel === 'enlazada') {
    let count = 0;
    for (let i = 0; i < disco.length && count < arch.bloqReq; i++) {
      if (disco[i].libre) { disco[i].libre = false; disco[i].archivo = arch.nom; disco[i].tipo = count < arch.bloqReq - 1 ? 'enlazada' : 'enlazada-fin'; disco[i].groupId = `${arch.nom}:chain`; disco[i].order = count; asignados.push(i); count++; }
    }
    fragDelta = tamUltimoDefault();

  } else if (metodoSel === 'fat') {
    const libresIdx = [];
    for (let i = 0; i < disco.length && libresIdx.length < arch.bloqReq; i++) if (disco[i].libre) libresIdx.push(i);
    if (libresIdx.length < arch.bloqReq) return { ok: false, motivo: 'No hay bloques libres' };
    libresIdx.forEach((idx, k) => {
      disco[idx].libre = false; disco[idx].archivo = arch.nom;
      disco[idx].tipo = k < libresIdx.length - 1 ? 'fat' : 'fat-fin';
      disco[idx].groupId = `${arch.nom}:fat`; disco[idx].order = k;
      disco[idx].next = k < libresIdx.length - 1 ? libresIdx[k + 1] : null;
      asignados.push(idx);
    });
    fragDelta = tamUltimoDefault();

  } else if (metodoSel === 'indexada') {
    const needed = arch.bloqReq + 1;
    if (libres.length < needed) return { ok: false, motivo: 'Espacio insuficiente (bloque índice)' };
    let count = 0;
    for (let i = 0; i < disco.length && count <= arch.bloqReq; i++) {
      if (disco[i].libre) {
        if (count === 0) { disco[i].libre = false; disco[i].archivo = arch.nom; disco[i].tipo = 'indice'; disco[i].groupId = `${arch.nom}:idx`; disco[i].order = 0; asignados.push(i); }
        else { disco[i].libre = false; disco[i].archivo = arch.nom; disco[i].tipo = 'indexada'; disco[i].groupId = `${arch.nom}:idx`; disco[i].order = count; asignados.push(i); }
        count++;
      }
    }
    fragDelta = tamUltimoDefault();
    return { ok: true, asignados, fragDelta, idxBlockCount: 1 };

  } else if (metodoSel === 'multinivel') {
    const DIRECT_PTRS = 3, INDIRECT_PTRS = 4;
    const dataBlocks = arch.bloqReq;
    const indirectNeeded = dataBlocks > DIRECT_PTRS ? Math.ceil((dataBlocks - DIRECT_PTRS) / INDIRECT_PTRS) : 0;
    const totalNeeded = 1 + dataBlocks + indirectNeeded;
    const libresIdx = [];
    for (let i = 0; i < disco.length && libresIdx.length < totalNeeded; i++) if (disco[i].libre) libresIdx.push(i);
    if (libresIdx.length < totalNeeded) return { ok: false, motivo: 'No hay bloques suficientes (índice + datos)' };

    let p = 0;
    const dirIdx = libresIdx[p++];
    disco[dirIdx].libre = false; disco[dirIdx].archivo = arch.nom; disco[dirIdx].tipo = 'dir'; disco[dirIdx].nivel = 1; disco[dirIdx].groupId = `${arch.nom}:multi`; disco[dirIdx].order = 0;
    asignados.push(dirIdx);

    let remaining = dataBlocks;
    const directCount = Math.min(DIRECT_PTRS, remaining);
    for (let k = 0; k < directCount; k++) {
      const idx = libresIdx[p++];
      disco[idx].libre = false; disco[idx].archivo = arch.nom; disco[idx].tipo = 'pagina'; disco[idx].nivel = 2; disco[idx].parent = dirIdx; disco[idx].groupId = `${arch.nom}:multi`; disco[idx].order = asignados.length;
      asignados.push(idx);
    }
    remaining -= directCount;
    while (remaining > 0) {
      const indIdx = libresIdx[p++];
      disco[indIdx].libre = false; disco[indIdx].archivo = arch.nom; disco[indIdx].tipo = 'indice-ind'; disco[indIdx].nivel = 2; disco[indIdx].parent = dirIdx; disco[indIdx].groupId = `${arch.nom}:multi`; disco[indIdx].order = asignados.length;
      asignados.push(indIdx);
      const chunk = Math.min(INDIRECT_PTRS, remaining);
      for (let k = 0; k < chunk; k++) {
        const idx = libresIdx[p++];
        disco[idx].libre = false; disco[idx].archivo = arch.nom; disco[idx].tipo = 'pagina'; disco[idx].nivel = 3; disco[idx].parent = indIdx; disco[idx].groupId = `${arch.nom}:multi`; disco[idx].order = asignados.length;
        asignados.push(idx);
      }
      remaining -= chunk;
    }
    fragDelta = tamUltimoDefault();
    return { ok: true, asignados, fragDelta, idxBlockCount: 1 + indirectNeeded };

  } else if (metodoSel === 'extension') {
    let restante = arch.bloqReq, extentIndex = 0;
    while (restante > 0) {
      let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
      for (let i = 0; i <= disco.length; i++) {
        if (i < disco.length && disco[i].libre) { if (curLen === 0) curStart = i; curLen++; }
        else { if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; } curLen = 0; }
      }
      if (bestLen === 0) break;
      const take = Math.min(bestLen, restante);
      for (let i = bestStart; i < bestStart + take; i++) { disco[i].libre = false; disco[i].archivo = arch.nom; disco[i].tipo = 'extension'; disco[i].groupId = `${arch.nom}:ext-${extentIndex}`; disco[i].order = i - bestStart; asignados.push(i); }
      restante -= take; extentIndex++;
    }
    if (restante > 0) return { ok: false, motivo: 'No hay extensiones contiguas suficientes' };
    fragDelta = tamUltimoDefault();

  } else if (metodoSel === 'bitmap') {
    let start = -1, count = 0;
    for (let i = 0; i < disco.length; i++) {
      if (disco[i].libre) { count++; if (count === 1) start = i; if (count === arch.bloqReq) break; }
      else { count = 0; start = -1; }
    }
    if (count < arch.bloqReq) return { ok: false, motivo: 'No hay corrida libre suficiente' };
    for (let i = start; i < start + arch.bloqReq; i++) { disco[i].libre = false; disco[i].archivo = arch.nom; disco[i].tipo = 'bitmap'; disco[i].groupId = `${arch.nom}:bitmap`; disco[i].order = i - start; asignados.push(i); }
    fragDelta = tamUltimoDefault();
  }
  return { ok: true, asignados, fragDelta };
}

// ─── Panel extra por método (FAT / Bitmap / Extensión / Multinivel) ───
function renderMetodoExtra(metodoSel, disco, procesados, archColorMap, lastArch) {
  ensureAlmDOM();
  const panel = document.getElementById('alm-extra-panel');
  if (!panel) return;

  if (metodoSel === 'fat') {
    const nombres = [...new Set(disco.filter(b => !b.libre && b.archivo).map(b => b.archivo))];
    if (!nombres.length) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
    panel.style.display = 'block';
    panel.innerHTML = `<div class="a2-panel"><div class="a2-panel-title">📎 Tabla FAT (Bloque → Siguiente)</div>
      <div class="a2-fat-wrap">${nombres.map(f => {
        const chain = disco.filter(b => !b.libre && b.archivo === f).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const rows = chain.map(b => `<tr class="${lastArch && f === lastArch.nom ? 'a2-row-new' : ''}"><td>${b.id}</td><td>${b.next != null ? disco[b.next].id : 'EOF'}</td></tr>`).join('');
        return `<div class="a2-fat-file"><div class="a2-fat-file-name" style="color:${archColorMap[f]}">${f}</div>
          <table class="a2-table"><thead><tr><th>Bloque</th><th>Siguiente</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      }).join('')}</div></div>`;
    return;
  }

  if (metodoSel === 'bitmap') {
    panel.style.display = 'block';
    const bits = disco.map((b, i) => {
      const nuevo = lastArch && !b.libre && b.archivo === lastArch.nom;
      return `<div class="a2-bit ${b.libre ? 'a2-bit-0' : 'a2-bit-1'} ${nuevo ? 'a2-bit-new' : ''}" title="Bloque ${i}: ${b.libre ? '0 (libre)' : '1 (ocupado) — ' + b.archivo}">${b.libre ? 0 : 1}</div>`;
    }).join('');
    panel.innerHTML = `<div class="a2-panel"><div class="a2-panel-title">🧮 Mapa de Bits (1 = ocupado, 0 = libre)</div>
      <div class="a2-bitmap-grid">${bits}</div>
      <div class="a2-bitmap-string">${disco.map(b => b.libre ? 0 : 1).join(' ')}</div></div>`;
    return;
  }

  if (metodoSel === 'extension') {
    const extents = [];
    let i = 0;
    while (i < disco.length) {
      const b = disco[i];
      if (!b.libre && b.tipo === 'extension') {
        let j = i;
        while (j < disco.length && !disco[j].libre && disco[j].tipo === 'extension' && disco[j].groupId === b.groupId) j++;
        extents.push({ archivo: b.archivo, inicio: i, tam: j - i });
        i = j;
      } else i++;
    }
    if (!extents.length) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
    panel.style.display = 'block';
    panel.innerHTML = `<div class="a2-panel"><div class="a2-panel-title">📐 Tabla de Extensiones (Extents)</div>
      <table class="a2-table"><thead><tr><th>Archivo</th><th>Bloque inicio</th><th>Tamaño (bloques)</th></tr></thead>
      <tbody>${extents.map(e => `<tr class="${lastArch && e.archivo === lastArch.nom ? 'a2-row-new' : ''}"><td style="color:${archColorMap[e.archivo]}">${e.archivo}</td><td>${e.inicio}</td><td>${e.tam}</td></tr>`).join('')}</tbody></table></div>`;
    return;
  }

  if (metodoSel === 'multinivel') {
    const nombres = [...new Set(disco.filter(b => !b.libre && b.archivo).map(b => b.archivo))];
    if (!nombres.length) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
    panel.style.display = 'block';
    panel.innerHTML = `<div class="a2-panel"><div class="a2-panel-title">🌳 Índice Multinivel</div>
      ${nombres.map(f => {
        const blocks = disco.filter(b => !b.libre && b.archivo === f);
        const dirB = blocks.find(b => b.tipo === 'dir');
        if (!dirB) return '';
        const directos = blocks.filter(b => b.tipo === 'pagina' && b.nivel === 2);
        const indirectos = blocks.filter(b => b.tipo === 'indice-ind');
        const isCur = lastArch && f === lastArch.nom;
        return `<div class="a2-tree-file ${isCur ? 'a2-row-new' : ''}">
          <div class="a2-tree-filename" style="color:${archColorMap[f]}">${f}</div>
          <div class="a2-tree">
            <div class="a2-tree-node a2-tree-root">Índice principal · B${dirB.id}</div>
            <div class="a2-tree-children">
              ${directos.map(b => `<div class="a2-tree-node a2-tree-leaf">B${b.id} (datos)</div>`).join('')}
              ${indirectos.map(idxB => {
                const hijosReal = blocks.filter(b => b.tipo === 'pagina' && b.nivel === 3 && b.parent === idxB.id);
                return `<div class="a2-tree-node a2-tree-mid">Índice indirecto · B${idxB.id}
                  <div class="a2-tree-children">${hijosReal.map(b => `<div class="a2-tree-node a2-tree-leaf">B${b.id} (datos)</div>`).join('')}</div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;
      }).join('')}</div>`;
    return;
  }

  panel.style.display = 'none';
  panel.innerHTML = '';
}

// ─── Motor de simulación paso a paso ───
function almRunUpTo(n) {
  almDisco = Array.from({ length: almTotB }, (_, i) => ({ id: i, libre: true, archivo: null, tipo: null }));
  almResul = []; almNoAsig = []; almFragTotal = 0; almIdxBlocks = 0;
  let lastResult = null, lastArch = null;
  for (let i = 0; i < n; i++) {
    const arch = archivos[i];
    const result = asignarArchivo(almDisco, arch, almMetodo, almBkKb);
    if (result.ok) {
      almResul.push({ ...arch, bloqAsig: result.asignados, estado: 'Asignado' });
      almFragTotal += result.fragDelta || 0;
      almIdxBlocks += result.idxBlockCount || (result.idxBlock ? 1 : 0);
    } else {
      almNoAsig.push({ ...arch, motivo: result.motivo || 'Espacio insuficiente' });
    }
    lastResult = result; lastArch = arch;
  }
  almStep = n;
  let stepInfo;
  if (n === 0) {
    stepInfo = { title: getMetodoLabel(almMetodo), description: getMetodoDescripcion(almMetodo), step: `Paso 0/${archivos.length}` };
  } else {
    const ok = lastResult && lastResult.ok;
    stepInfo = {
      title: ok ? `Asignando ${lastArch.nom}` : `${lastArch.nom} rechazado`,
      description: ok
        ? `${lastArch.nom} ocupa ${lastArch.bloqReq} bloque(s) usando ${getMetodoLabel(almMetodo).toLowerCase()}.`
        : `${lastArch.nom} no pudo asignarse: ${(lastResult && lastResult.motivo) || 'espacio insuficiente'}.`,
      step: `Paso ${n}/${archivos.length}`
    };
  }
  renderAlmState(almDisco, almColorMap, almTotB, almBkKb, almResul, almNoAsig, almFragTotal, almIdxBlocks, archivos, almMetodo, stepInfo);
  renderMetodoExtra(almMetodo, almDisco, archivos.slice(0, n), almColorMap, n > 0 ? archivos[n - 1] : null);
  almUpdateControls();
}

function almUpdateControls() {
  const prog = document.getElementById('a2-progress'); if (prog) { prog.max = archivos.length; prog.value = almStep; }
  const lbl = document.getElementById('a2-progress-lbl'); if (lbl) lbl.textContent = `Paso ${almStep}/${archivos.length}`;
  const playBtn = document.getElementById('a2-btn-play'); if (playBtn) playBtn.textContent = almPlaying ? '⏸' : '▶';
  const prevBtn = document.getElementById('a2-btn-prev'); if (prevBtn) prevBtn.disabled = almStep <= 0;
  const nextBtn = document.getElementById('a2-btn-next'); if (nextBtn) nextBtn.disabled = almStep >= archivos.length;
  const resetBtn = document.getElementById('a2-btn-reset'); if (resetBtn) resetBtn.disabled = !archivos.length;
}

function almStepNext() { almPause(); if (almStep < archivos.length) almRunUpTo(almStep + 1); }
function almStepPrev() { almPause(); if (almStep > 0) almRunUpTo(almStep - 1); }
function almStepReset() { almPause(); almRunUpTo(0); }
function almStepSeek(v) { almPause(); almRunUpTo(parseInt(v) || 0); }

let almPlaySpeedMs = 900;
function almSpeedToMs(v) {
  const map = { 1: 1600, 2: 1150, 3: 700, 4: 400, 5: 220 };
  return map[v] || 700;
}
function almSetSpeed(v) {
  almPlaySpeedMs = almSpeedToMs(v);
  if (almPlaying) almScheduleNext();
}

function almScheduleNext() {
  clearTimeout(almPlayTimer);
  if (!almPlaying) return;
  if (almStep >= archivos.length) { almPlaying = false; almUpdateControls(); return; }
  almPlayTimer = setTimeout(() => { almRunUpTo(almStep + 1); almScheduleNext(); }, almPlaySpeedMs);
}
function almPlay() {
  if (!archivos.length) return;
  almPlaying = true; almUpdateControls(); almScheduleNext();
}
function almPause() { almPlaying = false; clearTimeout(almPlayTimer); almUpdateControls(); }
function almStepTogglePlay() {
  if (almPlaying) { almPause(); return; }
  if (almStep >= archivos.length) almRunUpTo(0);
  almPlay();
}

// ─── Colores: asigna color a cualquier archivo que aún no tenga uno ───
function ensureColoresArchivos() {
  const cols = coloresDisponibles();
  let ci = Object.keys(almColorMap).length;
  archivos.forEach(a => { if (!almColorMap[a.nom]) almColorMap[a.nom] = cols[ci++ % cols.length]; });
}

function getBloquesArchivo(nombre) {
  if (!almDisco || !almDisco.length) return [];
  return almDisco
    .map((b, i) => ({ ...b, index: i }))
    .filter(b => !b.libre && b.archivo === nombre)
    .sort((a, b) => a.index - b.index)
    .map(b => b.index);
}

function liberarBloquesArchivo(nombre) {
  if (!almDisco || !almDisco.length) return 0;
  let freed = 0;
  almDisco.forEach(b => {
    if (!b.libre && b.archivo === nombre) {
      b.libre = true;
      b.archivo = null;
      b.tipo = null;
      b.groupId = null;
      b.order = null;
      b.next = null;
      b.parent = null;
      b.nivel = null;
      freed++;
    }
  });
  return freed;
}

function marcarBloqueAsignado(index, archivo, metodoSel, order, tipo = 'data') {
  const block = almDisco[index];
  if (!block || !block.libre) return false;
  block.libre = false;
  block.archivo = archivo;
  block.tipo = tipo;
  block.groupId = `${archivo}:${metodoSel}`;
  block.order = order;
  delete block.next;
  delete block.parent;
  delete block.nivel;
  return true;
}

function encontrarCorridaLibre(largo, preferenciaInicio) {
  if (!almDisco || !almDisco.length) return -1;
  const starts = [];
  if (Number.isInteger(preferenciaInicio) && preferenciaInicio >= 0) starts.push(preferenciaInicio);
  for (let i = 0; i < almDisco.length; i++) starts.push(i);
  const uniqueStarts = [...new Set(starts)];

  for (const start of uniqueStarts) {
    let count = 0;
    let runStart = -1;
    for (let i = start; i < almDisco.length; i++) {
      if (almDisco[i].libre) {
        if (runStart === -1) runStart = i;
        count++;
        if (count === largo) return runStart;
      } else {
        runStart = -1;
        count = 0;
      }
    }
  }
  return -1;
}

function syncEstadoAlmDesdeDisco() {
  const activos = new Set(archivos.map(a => a.nom));
  const bloquesPorArchivo = new Map();
  almDisco.forEach((b, i) => {
    if (!b.libre && b.archivo && activos.has(b.archivo)) {
      const arr = bloquesPorArchivo.get(b.archivo) || [];
      arr.push(i);
      bloquesPorArchivo.set(b.archivo, arr);
    }
  });

  almResul = [];
  almNoAsig = [];
  almFragTotal = 0;
  almIdxBlocks = 0;

  archivos.forEach(arch => {
    const bloques = (bloquesPorArchivo.get(arch.nom) || []).sort((a, b) => a - b);
    if (bloques.length) {
      almResul.push({ ...arch, bloqAsig: bloques, estado: 'Asignado' });
      almFragTotal += Math.max(0, almBkKb - (arch.tamKB - (arch.bloqReq - 1) * almBkKb));
      if (almMetodo === 'indexada' || almMetodo === 'multinivel') {
        almIdxBlocks += bloques.filter(i => almDisco[i].tipo === 'indice' || almDisco[i].tipo === 'dir' || almDisco[i].tipo === 'indice-ind').length;
      }
    } else {
      almNoAsig.push({ ...arch, motivo: 'Sin bloques asignados' });
    }
  });
}

function agregarEspacioAlArchivo(arch, bloquesExtra) {
  if (!almDisco || !almDisco.length || bloquesExtra <= 0) return [];
  const current = getBloquesArchivo(arch.nom);
  const metodoSel = arch.met || almMetodo || 'contigua';

  if (!current.length) {
    const resultado = asignarArchivo(almDisco, arch, metodoSel, almBkKb);
    return resultado.ok ? resultado.asignados : [];
  }

  const prefStart = current[current.length - 1] + 1;
  let asignados = [];

  if (metodoSel === 'contigua' || metodoSel === 'bitmap' || metodoSel === 'extension') {
    const start = encontrarCorridaLibre(bloquesExtra, prefStart);
    if (start >= 0) {
      for (let i = start; i < start + bloquesExtra; i++) {
        if (marcarBloqueAsignado(i, arch.nom, metodoSel, current.length + asignados.length, metodoSel === 'extension' ? 'extension' : 'data')) {
          asignados.push(i);
        }
      }
    }
  } else {
    for (let i = prefStart; i < almDisco.length && asignados.length < bloquesExtra; i++) {
      if (marcarBloqueAsignado(i, arch.nom, metodoSel, current.length + asignados.length, 'data')) {
        asignados.push(i);
      }
    }
    if (asignados.length < bloquesExtra) {
      for (let i = 0; i < almDisco.length && asignados.length < bloquesExtra; i++) {
        if (marcarBloqueAsignado(i, arch.nom, metodoSel, current.length + asignados.length, 'data')) {
          asignados.push(i);
        }
      }
    }
  }

  return asignados;
}

// ─── Vuelve a simular todo el estado actual de `archivos` sin animación ───
function almResimular() {
  if (!almTotB) { almTotB = totalBloques(); almBkKb = blkKB(); almMetodo = getMetodoAlm(); }
  almPause();
  ensureColoresArchivos();
  almRunUpTo(archivos.length);
}

// ─── Punto de entrada: ejecutar simulación completa (con animación) ───
function ejAlm() {
  if (!archivos.length) { alert('Agrega archivos primero (📂 Cargar CSV, ↺ Ejemplo, o el panel "Agregar Archivo" a la derecha).'); return; }
  ensureAlmDOM();
  almPause();
  almMetodo = getMetodoAlm();
  almTotB = totalBloques();
  almBkKb = blkKB();
  almColorMap = {};
  ensureColoresArchivos();
  const prog = document.getElementById('a2-progress'); if (prog) { prog.max = archivos.length; prog.value = 0; }
  almRunUpTo(0);
  almPlay();
}

function limpiarAlm() {
  almPause();
  archivos = []; window.archivos = archivos;
  almDisco = []; almResul = []; almNoAsig = []; almFragTotal = 0; almIdxBlocks = 0; almColorMap = {}; almStep = 0;
  almSelectedBlock = null;
  document.getElementById('disco-grid').innerHTML = '<div class="blk libre" style="grid-column:1/-1;text-align:center;font-size:10px;color:#3a5a3a;padding:8px">Carga archivos con «📂 Cargar» o «↺ Ejemplo» (arriba) y presiona «▶ Simular»</div>';
  const overlay = document.getElementById('disco-overlay'); if (overlay) overlay.innerHTML = '';
  document.getElementById('leyenda-alm').innerHTML = '';
  document.getElementById('d-cap-info').textContent = '';
  ['a-tot', 'a-uso', 'a-lib', 'a-frag', 'a-bidx'].forEach(id => document.getElementById(id).textContent = '—');
  document.getElementById('a-asig').textContent = '0'; document.getElementById('a-rech').textContent = '0';
  document.getElementById('a-narch').textContent = '0'; document.getElementById('a-metodos').textContent = '—';
  document.getElementById('alm-sim-title').textContent = 'Selecciona un método';
  document.getElementById('alm-sim-method').textContent = '—';
  document.getElementById('alm-sim-body').textContent = 'El mapa del disco mostrará cómo se asignan los bloques según el método que elijas.';
  document.getElementById('tbl-arch').innerHTML = '<tr><td colspan="4" style="text-align:center;color:#5a5a5a;padding:14px">Sin archivos.</td></tr>';
  document.getElementById('tbl-alm-res').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#5a5a5a;padding:14px">Sin simulación.</td></tr>';
  const panel = document.getElementById('alm-extra-panel'); if (panel) { panel.innerHTML = ''; panel.style.display = 'none'; }
  const nomEl = document.getElementById('af-nom'); if (nomEl) nomEl.value = '';
  const tamEl = document.getElementById('af-tam'); if (tamEl) tamEl.value = '';
  almUpdateBlockInfo();
  refreshAmpliarSelect();
  almUpdateControls();
}

// ══════════════════════════════════════════════════════════════════
// GESTIÓN DE ARCHIVOS DESDE EL PANEL DERECHO
// ══════════════════════════════════════════════════════════════════

// ─── Agregar un archivo manualmente (sin CSV) ───
function agregarArchivoManual() {
  const nomEl = document.getElementById('af-nom');
  const tamEl = document.getElementById('af-tam');
  const uEl = document.getElementById('af-u');
  if (!nomEl || !tamEl || !uEl) return;
  const nom = (nomEl.value || '').trim();
  const tam = parseFloat(tamEl.value);
  const u = uEl.value;

  if (!nom) { alert('Ingresa un nombre para el archivo.'); return; }
  if (archivos.some(a => a.nom.toLowerCase() === nom.toLowerCase())) { alert(`Ya existe un archivo llamado "${nom}".`); return; }
  if (isNaN(tam) || tam <= 0) { alert('Ingresa un tamaño válido (mayor a 0).'); return; }

  const met = getMetodoAlm();
  const tamKB = almKB(tam, u);
  const bloqReq = Math.ceil(tamKB / blkKB());
  archivos.push({ nom, tam, u, tamKB, bloqReq, met });
  window.archivos = archivos;

  nomEl.value = ''; tamEl.value = '';
  renderTblArch();
  document.getElementById('a-narch').textContent = archivos.length;
  almRefreshBoundsAfterEdit();

  // Si ya había una simulación corriendo, la actualizamos al instante.
  if (almTotB) almResimular();
}

// ─── Ampliar (aumentar) el tamaño de un archivo existente ───
function ampliarArchivo() {
  const sel = document.getElementById('af-ampliar-sel');
  const tamEl = document.getElementById('af-ampliar-tam');
  const uEl = document.getElementById('af-ampliar-u');
  if (!sel || !tamEl || !uEl) return;
  const nom = sel.value;
  if (!nom) { alert('Selecciona un archivo para ampliar.'); return; }
  const arch = archivos.find(a => a.nom === nom);
  if (!arch) return;

  const tam = parseFloat(tamEl.value);
  const u = uEl.value;
  if (isNaN(tam) || tam <= 0) { alert('Ingresa un tamaño válido.'); return; }
  const nuevoTamKB = almKB(tam, u);
  if (nuevoTamKB <= arch.tamKB) { alert(`El nuevo tamaño debe ser mayor al actual (${arch.tam} ${arch.u}).`); return; }

  const bloquesActuales = getBloquesArchivo(arch.nom).length;
  const nuevoBloqReq = Math.ceil(nuevoTamKB / blkKB());
  const bloquesExtra = Math.max(0, nuevoBloqReq - bloquesActuales);

  arch.tam = tam; arch.u = u; arch.tamKB = nuevoTamKB;
  arch.bloqReq = nuevoBloqReq;

  tamEl.value = '';
  renderTblArch();

  if (almTotB && almDisco.length) {
    if (bloquesExtra > 0) {
      const agregados = agregarEspacioAlArchivo(arch, bloquesExtra);
      if (!agregados.length) {
        alert(`No hay espacio libre suficiente para ampliar "${arch.nom}" sobre su área actual.`);
        return;
      }
    }
    syncEstadoAlmDesdeDisco();
    const stepInfo = {
      title: `Ampliando ${arch.nom}`,
      description: `Se agregaron ${bloquesExtra} bloque(s) adicionales sobre el espacio ya ocupado por ${arch.nom}.`,
      step: `Paso ${archivos.length}/${archivos.length}`
    };
    renderAlmState(almDisco, almColorMap, almTotB, almBkKb, almResul, almNoAsig, almFragTotal, almIdxBlocks, archivos, almMetodo, stepInfo);
    renderMetodoExtra(almMetodo, almDisco, archivos, almColorMap, arch);
  } else {
    almRefreshBoundsAfterEdit();
    alert(`"${arch.nom}" ahora pesa ${arch.tam} ${arch.u}. Presiona ▶ Simular para asignar los bloques.`);
  }
}

// ─── Selector de "ampliar archivo": mantiene la lista de nombres actualizada ───
function refreshAmpliarSelect() {
  const sel = document.getElementById('af-ampliar-sel');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = archivos.length
    ? archivos.map(a => `<option value="${escAttr(a.nom)}">${a.nom} (${a.tam} ${a.u})</option>`).join('')
    : '<option value="">Sin archivos</option>';
  if (archivos.some(a => a.nom === prev)) sel.value = prev;
}

// ─── Resaltado al pasar el mouse: todos los bloques del mismo archivo + su línea ───
function almHoverBlock(i, entering) {
  const b = almDisco[i];
  if (!b || b.libre) return;
  const archivo = b.archivo;
  document.querySelectorAll('#disco-grid .blk').forEach(el => {
    if (el.dataset.archivo === archivo) el.classList.toggle('a2-hover', entering);
  });
  document.querySelectorAll('#disco-overlay [data-archivo]').forEach(el => {
    if (el.getAttribute('data-archivo') === archivo) el.classList.toggle('a2-line-hot', entering);
  });
}

// ─── Selección de bloque (click) ───
function almSelectBlock(i) {
  almSelectedBlock = (almSelectedBlock === i) ? null : i;
  document.querySelectorAll('#disco-grid .blk.a2-selected').forEach(el => el.classList.remove('a2-selected'));
  if (almSelectedBlock != null) {
    const el = document.querySelector(`#disco-grid .blk[data-index="${almSelectedBlock}"]`);
    if (el) el.classList.add('a2-selected');
  }
  almUpdateBlockInfo();
}

// ─── Actualiza el panel "Bloque Seleccionado" en el lado derecho ───
function almUpdateBlockInfo() {
  const info = document.getElementById('blk-sel-info');
  const delBtn = document.getElementById('btn-del-blk-archivo');
  if (!info) return;
  if (almSelectedBlock == null || !almDisco[almSelectedBlock]) {
    info.textContent = 'Haz clic en un bloque del mapa.';
    if (delBtn) delBtn.disabled = true;
    return;
  }
  const b = almDisco[almSelectedBlock];
  if (b.libre) {
    info.innerHTML = `Bloque <b>${b.id}</b>: <span style="color:#3a5a3a">Libre</span>`;
    if (delBtn) delBtn.disabled = true;
  } else {
    const col = almColorMap[b.archivo] || '#fff';
    info.innerHTML = `Bloque <b>${b.id}</b> pertenece a<br><b style="color:${col}">${b.archivo}</b> <span style="color:#7a7a7a">(${b.tipo || '—'})</span>`;
    if (delBtn) delBtn.disabled = false;
  }
}

// ─── Elimina del disco el archivo dueño del bloque seleccionado ───
function eliminarArchivoSeleccionado() {
  if (almSelectedBlock == null || !almDisco[almSelectedBlock] || almDisco[almSelectedBlock].libre) return;
  const nombre = almDisco[almSelectedBlock].archivo;
  if (!confirm(`¿Eliminar el archivo "${nombre}" del disco? Se liberarán sus bloques.`)) return;

  liberarBloquesArchivo(nombre);
  archivos = archivos.filter(a => a.nom !== nombre);
  window.archivos = archivos;
  delete almColorMap[nombre];
  almSelectedBlock = null;

  syncEstadoAlmDesdeDisco();
  const stepInfo = {
    title: `Archivo eliminado`,
    description: `Se liberaron los bloques de ${nombre} y quedaron como huecos disponibles.`,
    step: `Paso ${archivos.length}/${archivos.length}`
  };
  renderAlmState(almDisco, almColorMap, almTotB, almBkKb, almResul, almNoAsig, almFragTotal, almIdxBlocks, archivos, almMetodo, stepInfo);
  renderMetodoExtra(almMetodo, almDisco, archivos, almColorMap, null);

  document.getElementById('a-narch').textContent = archivos.length;
  refreshAmpliarSelect();
  almUpdateBlockInfo();
  almUpdateControls();
}

// ─── Inyección de DOM (controles, panel extra, gestor de archivos) y CSS, una sola vez ───
function ensureAlmDOM() {
  if (!document.getElementById('alm-step-controls')) {
    const simCard = document.getElementById('alm-sim-card');
    if (simCard) {
      simCard.insertAdjacentHTML('afterend', `
        <div id="alm-step-controls" class="a2-controls">
          <div class="a2-transport">
            <button class="btn" id="a2-btn-reset" title="Reiniciar" onclick="almStepReset()">⏮</button>
            <button class="btn" id="a2-btn-prev" title="Paso anterior" onclick="almStepPrev()">◀</button>
            <button class="btn accent" id="a2-btn-play" title="Reproducir / Pausar" onclick="almStepTogglePlay()">▶</button>
            <button class="btn" id="a2-btn-next" title="Paso siguiente" onclick="almStepNext()">▶|</button>
          </div>
          <div class="a2-speed-wrap" title="Velocidad de reproducción">
            <span class="a2-speed-ico">🐢</span>
            <input type="range" id="a2-speed" min="1" max="5" step="1" value="3" oninput="almSetSpeed(this.value)">
            <span class="a2-speed-ico">🐇</span>
          </div>
          <div class="a2-progress-wrap">
            <input type="range" id="a2-progress" min="0" max="0" value="0" oninput="almStepSeek(this.value)">
            <span id="a2-progress-lbl" class="a2-progress-lbl">Paso 0/0</span>
          </div>
        </div>`);
    }
  }
  if (!document.getElementById('alm-extra-panel')) {
    const legenda = document.getElementById('leyenda-alm');
    const row = legenda ? legenda.parentElement : null;
    if (row) row.insertAdjacentHTML('afterend', `<div id="alm-extra-panel" class="a2-extra" style="display:none"></div>`);
  }
  if (!document.getElementById('alm-file-manager')) {
    const rightPanel = document.querySelector('#page-alm .right-panel');
    if (rightPanel) {
      rightPanel.insertAdjacentHTML('afterbegin', `
        <div id="alm-file-manager">
          <div class="sec-lbl">➕ Agregar Archivo</div>
          <div class="a2-add-file">
            <input id="af-nom" type="text" placeholder="Nombre del archivo">
            <div class="a2-add-row">
              <input id="af-tam" type="number" min="1" placeholder="Tamaño">
              <select id="af-u"><option value="KB">KB</option><option value="MB">MB</option><option value="GB">GB</option></select>
            </div>
            <button class="btn accent" style="width:100%" onclick="agregarArchivoManual()">+ Agregar archivo</button>
          </div>
          <div class="div"></div>
          <div class="sec-lbl">🎯 Bloque Seleccionado</div>
          <div id="blk-sel-info" class="a2-blk-info">Haz clic en un bloque del mapa.</div>
          <button class="btn red" id="btn-del-blk-archivo" style="width:100%;margin-top:6px" disabled onclick="eliminarArchivoSeleccionado()">🗑 Eliminar archivo</button>
          <div class="div"></div>
          <div class="sec-lbl">⤢ Ampliar Archivo</div>
          <select id="af-ampliar-sel"><option value="">Sin archivos</option></select>
          <div class="a2-add-row">
            <input id="af-ampliar-tam" type="number" min="1" placeholder="Nuevo tamaño total">
            <select id="af-ampliar-u"><option value="KB">KB</option><option value="MB">MB</option><option value="GB">GB</option></select>
          </div>
          <button class="btn orange" style="width:100%;margin-top:6px" onclick="ampliarArchivo()">⤢ Ampliar archivo</button>
          <div class="div"></div>
        </div>`);
      refreshAmpliarSelect();
    }
  }
}

function injectAlmStyles() {
  if (document.getElementById('a2-styles')) return;
  const css = `
  .a2-controls{display:flex;align-items:center;gap:10px;margin:6px 0;flex-wrap:wrap;padding:4px 6px;background:var(--app-surface-2);border:1px solid var(--app-border);border-radius:6px}
  .a2-transport{display:flex;align-items:center;gap:3px}
  .a2-controls .btn{padding:2px 7px;font-size:11px;line-height:1.6}
  .a2-controls .btn:disabled{opacity:.35;cursor:not-allowed}
  .a2-speed-wrap{display:flex;align-items:center;gap:4px}
  .a2-speed-wrap input[type=range]{width:60px;accent-color:#ffb36b;height:3px;cursor:pointer}
  .a2-speed-ico{font-size:10px;opacity:.8}
  .a2-progress-wrap{display:flex;align-items:center;gap:6px;flex:1;min-width:110px}
  .a2-progress-wrap input[type=range]{flex:1;accent-color:#4fc3f7;height:3px;cursor:pointer}
  .a2-progress-lbl{font-size:10px;color:#8a8a8a;white-space:nowrap}

  .a2-extra{margin:10px 0;animation:a2-fadein .25s ease}
  @keyframes a2-fadein{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  .a2-panel{background:var(--app-surface);border:1px solid var(--app-border);border-radius:6px;padding:10px 12px}
  .a2-panel-title{font-size:12px;color:#4fc3f7;font-weight:600;margin-bottom:8px}

  .a2-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px}
  .a2-table th{text-align:left;color:var(--app-text-muted);font-weight:500;padding:3px 6px;border-bottom:1px solid var(--app-border)}
  .a2-table td{padding:3px 6px;color:var(--app-text);border-bottom:1px solid var(--app-border)}
  .a2-row-new{background:#22304a;animation:a2-pulse-bg 1s ease}
  @keyframes a2-pulse-bg{0%{background:#2b4a6e}100%{background:#22304a}}

  .a2-fat-wrap{display:flex;flex-wrap:wrap;gap:14px}
  .a2-fat-file{min-width:130px}
  .a2-fat-file-name{font-size:11px;font-weight:600;margin-bottom:2px}

  .a2-bitmap-grid{display:grid;grid-template-columns:repeat(32,1fr);gap:2px;margin-top:4px}
  .a2-bit{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:9px;border-radius:2px;color:#0a0a0a;font-weight:700}
  .a2-bit-0{background:#1a2a1a;color:#3a5a3a}
  .a2-bit-1{background:#c8b36d;color:#332b10}
  .a2-bit-new{outline:2px solid #4fc3f7;animation:a2-pulse 1s ease-out 2}
  @keyframes a2-pulse{0%{box-shadow:0 0 0 0 rgba(79,195,247,.7)}70%{box-shadow:0 0 0 6px rgba(79,195,247,0)}100%{box-shadow:0 0 0 0 rgba(79,195,247,0)}}
  .a2-bitmap-string{margin-top:8px;font-family:monospace;font-size:11px;color:#8a8a8a;letter-spacing:2px;word-break:break-all}

  .a2-tree-file{margin-bottom:14px;padding:8px;border-radius:6px}
  .a2-tree-file:last-child{margin-bottom:0}
  .a2-tree-filename{font-size:11px;font-weight:600;margin-bottom:6px}
  .a2-tree{display:flex;flex-direction:column;gap:4px}
  .a2-tree-node{padding:4px 8px;border-radius:4px;font-size:11px;width:fit-content}
  .a2-tree-root{background:#20304a;color:#4fc3f7;border:1px solid #4fc3f7}
  .a2-tree-mid{background:#241f38;color:#a99bff;border:1px solid #7c6cff}
  .a2-tree-leaf{background:#182a18;color:#7fcf7f;border:1px solid #345c34;display:inline-block}
  .a2-tree-children{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 4px 18px;padding-left:8px;border-left:2px dashed #333a55}

  /* ─── Gestor de archivos (panel derecho) ─── */
  #alm-file-manager{margin-bottom:4px}
  #alm-file-manager .a2-blk-info{background:var(--app-surface-2);border-color:var(--app-border);color:var(--app-text)}
  .a2-add-file input, .a2-add-file select,
  #af-ampliar-sel, .a2-add-row input, .a2-add-row select{
    width:100%;box-sizing:border-box;background:#2a2a2a;border:1px solid #3a3a3a;border-radius:3px;
    color:#e0e0e0;font-size:12px;padding:5px 7px;outline:none;margin-bottom:6px;
  }
  .a2-add-file input:focus, .a2-add-file select:focus,
  #af-ampliar-sel:focus, .a2-add-row input:focus, .a2-add-row select:focus{border-color:#4fc3f7}
  .a2-add-row{display:flex;gap:6px}
  .a2-add-row input{flex:2}
  .a2-add-row select{flex:1}
  .a2-blk-info{font-size:11px;color:var(--app-text);background:var(--app-surface-2);border:1px solid var(--app-border);border-radius:4px;padding:8px;min-height:34px;line-height:1.5}

  /* ─── Resaltado de bloques al pasar el mouse / seleccionar ─── */
  #disco-grid .blk{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}
  #disco-grid .blk.a2-hover{outline:2px solid #fff;box-shadow:0 0 8px rgba(255,255,255,.65);transform:scale(1.08);position:relative;z-index:5}
  #disco-grid .blk.a2-selected{outline:3px solid #4fc3f7!important;box-shadow:0 0 0 3px rgba(79,195,247,.35);position:relative;z-index:6}
  .a2-oline{transition:stroke-width .12s ease,filter .12s ease}
  .a2-line-hot{stroke-width:6!important;filter:drop-shadow(0 0 4px rgba(255,255,255,.85))}
  `;
  const style = document.createElement('style');
  style.id = 'a2-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// ─── Reajuste responsivo: si la ventana cambia de tamaño, recalcular columnas ───
let almResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(almResizeTimer);
  almResizeTimer = setTimeout(() => {
    if (!almLastRenderArgs) return;
    const a = almLastRenderArgs;
    renderAlmState(a.disco, a.archColorMap, a.totB, a.bkKb, a.resul, a.noAsig, a.fragTotal, a.idxBlocks, a.archivosRef, a.metodoSel, a.stepInfo);
    renderMetodoExtra(almMetodo, a.disco, archivos.slice(0, almStep), a.archColorMap, almStep > 0 ? archivos[almStep - 1] : null);
  }, 200);
});

// ─── Inicialización ───
injectAlmStyles();
ensureAlmDOM();
refreshAmpliarSelect();
almUpdateBlockInfo();
almUpdateControls();

// ─── Exposición global ───
window.getMetodoAlm = getMetodoAlm;
window.getMetodoLabel = getMetodoLabel;
window.getMetodoDescripcion = getMetodoDescripcion;
window.almKB = almKB;
window.blkKB = blkKB;
window.totalBloques = totalBloques;
window.computeAlmLayout = computeAlmLayout;
window.almSetSpeed = almSetSpeed;
window.parseCsvArchivos = parseCsvArchivos;
window.cargarArchivosCSV = cargarArchivosCSV;
window.cargarEjemploAlm = cargarEjemploAlm;
window.renderTblArch = renderTblArch;
window.getAlmCellPos = getAlmCellPos;
window.renderAlmOverlay = renderAlmOverlay;
window.renderAlmState = renderAlmState;
window.asignarArchivo = asignarArchivo;
window.ejAlm = ejAlm;
window.limpiarAlm = limpiarAlm;
window.onAlmMetodoChange = onAlmMetodoChange;
window.almStepReset = almStepReset;
window.almStepPrev = almStepPrev;
window.almStepNext = almStepNext;
window.almStepSeek = almStepSeek;
window.almStepTogglePlay = almStepTogglePlay;
window.agregarArchivoManual = agregarArchivoManual;
window.ampliarArchivo = ampliarArchivo;
window.refreshAmpliarSelect = refreshAmpliarSelect;
window.almHoverBlock = almHoverBlock;
window.almSelectBlock = almSelectBlock;
window.almUpdateBlockInfo = almUpdateBlockInfo;
window.eliminarArchivoSeleccionado = eliminarArchivoSeleccionado;
window.ensureColoresArchivos = ensureColoresArchivos;
window.almResimular = almResimular;
window.archivos = archivos;