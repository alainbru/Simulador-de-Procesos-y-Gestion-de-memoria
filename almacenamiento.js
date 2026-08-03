// ─── ALMACENAMIENTO ───
let archivos=[], almAnimId=null;
window.archivos=archivos;

function getMetodoAlm(){
  const sel=document.getElementById('alm-metodo');
  return sel&&sel.value?sel.value:'contigua';
}
function getMetodoLabel(metodo){
  const labels={contigua:'Contigua',enlazada:'Enlazada',indexada:'Indexada',multinivel:'Multinivel',fat:'FAT',extension:'Por extensión',bitmap:'Bitmap'};
  return labels[metodo]||'Asignación';
}
function getMetodoDescripcion(metodo){
  const desc={
    contigua:'Los bloques se ocupan en una corrida continua y clara.',
    enlazada:'Cada bloque apunta al siguiente para formar una cadena.',
    indexada:'Un bloque índice referencia a los bloques de datos.',
    multinivel:'Se organiza en niveles de tablas para localizar páginas.',
    fat:'La tabla FAT enlaza los bloques de cada archivo.',
    extension:'El archivo puede ocupar varias extensiones contiguas.',
    bitmap:'Un mapa de bits marca cuáles bloques están ocupados.'
  };
  return desc[metodo]||'Simulación de asignación de bloques.';
}
function almKB(tam,unit){return unit==='MB'?tam*1024:unit==='GB'?tam*1024*1024:tam;}
function discoTotalKB(){
  const cap=parseFloat(document.getElementById('d-cap').value)||512;
  const u=document.getElementById('d-cap-u').value;
  return almKB(cap,u);
}
function blkKB(){return parseInt(document.getElementById('d-blk').value)||4;}
function totalBloques(){return Math.floor(discoTotalKB()/blkKB());}

function addArchivo(){
  const nom=document.getElementById('a-nom').value.trim();
  const tam=parseFloat(document.getElementById('a-tam').value);
  const u=document.getElementById('a-tam-u').value;
  const met=getMetodoAlm();
  if(!nom||isNaN(tam)||tam<=0){alert('Completa nombre y tamaño.');return;}
  const tamKB=almKB(tam,u);
  const bloqReq=Math.ceil(tamKB/blkKB());
  archivos.push({nom,tamKB,bloqReq,met,u,tam});
  renderTblArch();
  document.getElementById('a-narch').textContent=archivos.length;
  document.getElementById('a-nom').value=''; document.getElementById('a-tam').value='';
}

function cargarEjemploAlm(){
  archivos=[
    {nom:'Docs', tam:220, u:'KB', tamKB:220, bloqReq:3, met:getMetodoAlm()},
    {nom:'Img', tam:120, u:'KB', tamKB:120, bloqReq:2, met:getMetodoAlm()},
    {nom:'Audio', tam:70, u:'KB', tamKB:70, bloqReq:1, met:getMetodoAlm()},
    {nom:'Video', tam:180, u:'KB', tamKB:180, bloqReq:2, met:getMetodoAlm()},
    {nom:'Backup', tam:90, u:'KB', tamKB:90, bloqReq:1, met:getMetodoAlm()}
  ];
  renderTblArch();
  document.getElementById('a-narch').textContent=archivos.length;
}

function renderTblArch(){
  const tb=document.getElementById('tbl-arch');
  if(!archivos.length){tb.innerHTML='<tr><td colspan="4" style="text-align:center;color:#5a5a5a;padding:14px">Sin archivos.</td></tr>';return;}
  tb.innerHTML=archivos.map(a=>`
    <tr><td class="pid">${a.nom}</td><td>${a.tam} ${a.u}</td><td>${a.bloqReq}</td>
    <td style="color:#4fc3f7;text-transform:capitalize">${a.met||'—'}</td></tr>`).join('');
}

function getAlmCellPos(index, cols, cellSize){
  const row=Math.floor(index/cols);
  const col=index%cols;
  return {x:col*cellSize+cellSize/2, y:row*cellSize+cellSize/2};
}
function renderAlmOverlay(disco, cols, cellSize, metodoSel){
  const occupied=disco.map((b,i)=>({ ...b, index:i })).filter(b=>!b.libre);
  const overlay=document.getElementById('disco-overlay');
  if(!overlay) return;
  const rows=Math.max(1,Math.ceil(disco.length/cols));
  const viewBoxW=cols*cellSize;
  const viewBoxH=rows*cellSize;
  overlay.setAttribute('viewBox',`0 0 ${viewBoxW} ${viewBoxH}`);
  if(!occupied.length){overlay.innerHTML='';return;}
  const defs=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#4fc3f7"/></marker></defs>`;
  const stroke='#4fc3f7';
  const stroke2='#ffb36b';
  const stroke3='#7c6cff';
  if(metodoSel==='contigua'){
    const groups={}; occupied.forEach(b=>{const key=b.archivo||'libre'; if(!groups[key]) groups[key]=[]; groups[key].push(b);});
    const parts=Object.values(groups).map(group=>{ const sorted=group.sort((a,b)=>a.index-b.index); const a=getAlmCellPos(sorted[0].index, cols, cellSize); const c=getAlmCellPos(sorted[sorted.length-1].index, cols, cellSize); return `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${stroke}" stroke-width="3" stroke-linecap="round" />`; }).join('');
    overlay.innerHTML=`${defs}<g>${parts}</g>`;
    return;
  }
  if(metodoSel==='enlazada' || metodoSel==='fat'){
    const byFile={}; occupied.forEach(b=>{const key=b.archivo||'x'; if(!byFile[key]) byFile[key]=[]; byFile[key].push(b);});
    const parts=Object.values(byFile).map(group=>{ const sorted=group.sort((a,b)=>a.index-b.index); const pts=sorted.map(b=>{ const p=getAlmCellPos(b.index, cols, cellSize); return `${p.x},${p.y}`; }).join(' '); return `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)" />`; }).join('');
    overlay.innerHTML=`${defs}<g>${parts}</g>`;
    return;
  }
  if(metodoSel==='indexada'){
    const idx=occupied.find(b=>b.tipo==='indice');
    const parts=occupied.filter(b=>b.tipo!=='indice').map(b=>{ const a=getAlmCellPos(idx.index, cols, cellSize); const c=getAlmCellPos(b.index, cols, cellSize); return `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="${stroke3}" stroke-width="2" stroke-dasharray="4 3" />`; }).join('');
    overlay.innerHTML=`${defs}<g>${parts}</g>`;
    return;
  }
  if(metodoSel==='multinivel'){
    const roots=occupied.filter(b=>b.tipo==='dir'||b.tipo==='tabla');
    const root=roots[0]||occupied[0];
    const center=getAlmCellPos(root.index, cols, cellSize);
    const parts=occupied.filter(b=>b.index!==root.index).map(b=>{ const p=getAlmCellPos(b.index, cols, cellSize); return `<line x1="${center.x}" y1="${center.y}" x2="${p.x}" y2="${p.y}" stroke="${stroke2}" stroke-width="2" stroke-dasharray="2 2" />`; }).join('');
    overlay.innerHTML=`${defs}<g>${parts}</g>`;
    return;
  }
  if(metodoSel==='extension'){
    const groups={}; occupied.forEach(b=>{const key=b.groupId||b.archivo; if(!groups[key]) groups[key]=[]; groups[key].push(b);});
    const parts=Object.entries(groups).map(([key,group])=>{ const sorted=group.sort((a,b)=>a.index-b.index); const pts=sorted.map(b=>{ const p=getAlmCellPos(b.index, cols, cellSize); return `${p.x},${p.y}`; }).join(' '); return `<polyline points="${pts}" fill="none" stroke="${stroke2}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`; }).join('');
    overlay.innerHTML=`${defs}<g>${parts}</g>`;
    return;
  }
  if(metodoSel==='bitmap'){
    const parts=occupied.map(b=>{ const p=getAlmCellPos(b.index, cols, cellSize); return `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#c8b36d" />`; }).join('');
    overlay.innerHTML=`${defs}<g>${parts}</g>`;
  }
}
function renderAlmState(disco, archColorMap, totB, bkKb, resul, noAsig, fragTotal, idxBlocks, archivos, metodoSel, stepInfo=null){
  const cols=16;
  const grid=document.getElementById('disco-grid');
  grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;
  const rows=Math.max(1,Math.ceil(disco.length/cols));
  grid.style.gridTemplateRows=`repeat(${rows}, 30px)`;
  grid.innerHTML=disco.map((b,i)=>{
    if(b.libre) return `<div class="blk libre" data-index="${i}" title="Bloque ${b.id} — Libre">${b.id}</div>`;
    const col=archColorMap[b.archivo]||'#555';
    let cls='ocupado';
    let lbl=b.archivo.substring(0,3).toUpperCase();
    if(b.tipo==='indice'){cls='idx-blk';lbl='IDX';}
    else if(b.tipo==='enlazada'||b.tipo==='enlazada-fin'){cls='ptr';lbl='↳';}
    else if(b.tipo==='bitmap'){cls='bitmap-blk';lbl='01';}
    else if(b.tipo==='extension'){cls='extension-blk';lbl='EXT';}
    else if(b.tipo==='contigua'){cls='contigua-blk';lbl='C';}
    return `<div class="blk ${cls}" data-index="${i}" style="background:${col}cc" title="Bloque ${b.id} — ${b.archivo} (${b.tipo})">${b.id}<br><span class="blk-mini">${lbl}</span></div>`;
  }).join('');
  renderAlmOverlay(disco, cols, 30, metodoSel);

  const usados=disco.filter(b=>!b.libre).length;
  const libresN=totB-usados;
  document.getElementById('a-tot').textContent=totB;
  document.getElementById('a-uso').textContent=usados;
  document.getElementById('a-lib').textContent=libresN;
  document.getElementById('a-asig').textContent=resul.length;
  document.getElementById('a-rech').textContent=noAsig.length;
  document.getElementById('a-frag').textContent=fragTotal.toFixed(1)+' KB';
  document.getElementById('a-bidx').textContent=idxBlocks;
  document.getElementById('d-cap-info').textContent=`(${totB} bloques de ${bkKb}KB)`;

  document.getElementById('leyenda-alm').innerHTML=Object.entries(archColorMap).map(([nom,col])=>
    `<span style="color:#aaa">■ <span style="color:${col}">${nom}</span></span>`).join(' ');

  const metCount={};
  archivos.forEach(a=>{metCount[a.met||(metodoSel||'—')]=(metCount[a.met||(metodoSel||'—')]||0)+1;});
  document.getElementById('a-metodos').innerHTML=Object.entries(metCount).map(([m,n])=>
    `<div style="margin-bottom:3px"><span style="color:#4fc3f7;text-transform:capitalize">${m}</span>: ${n} archivo(s)</div>`).join('');

  const allRes=[...resul,...noAsig.map(a=>({...a,bloqAsig:[],estado:'Rechazado'}))];
  document.getElementById('tbl-alm-res').innerHTML=allRes.map(a=>`
    <tr><td class="pid">${a.nom}</td><td>${a.tamKB} KB</td><td>${a.bloqReq}</td>
    <td style="color:#4fc3f7;text-transform:capitalize">${a.met||'—'}</td>
    <td>${a.bloqAsig&&a.bloqAsig.length?a.bloqAsig.join(', '):'—'}</td>
    <td style="color:${a.estado==='Asignado'?'#4caf50':'#f44336'}">${a.estado}</td></tr>`).join('');

  const simTitle=document.getElementById('alm-sim-title');
  const simMethod=document.getElementById('alm-sim-method');
  const simBody=document.getElementById('alm-sim-body');
  const simLegend=document.getElementById('alm-sim-legend');
  if(simTitle){simTitle.textContent=stepInfo?stepInfo.title:getMetodoLabel(metodoSel);}
  if(simMethod){simMethod.textContent=getMetodoLabel(metodoSel);}
  if(simBody){simBody.textContent=stepInfo?stepInfo.description:getMetodoDescripcion(metodoSel);}
  if(simLegend){simLegend.innerHTML=`<span class="legend-chip chip-free">Libre</span><span class="legend-chip chip-data">Bloque ocupado</span><span class="legend-chip chip-link">${getMetodoLabel(metodoSel)}</span>`;}
}
function asignarArchivo(disco, arch, metodoSel, bkKb){
  const libres=disco.filter(b=>b.libre);
  if(libres.length<arch.bloqReq){return {ok:false,motivo:'Espacio insuficiente'};}
  let asignados=[];
  let fragDelta=0;
  if(metodoSel==='contigua'){
    let start=-1, count=0;
    for(let i=0;i<disco.length;i++){
      if(disco[i].libre){count++;if(count===1)start=i;if(count===arch.bloqReq)break;}
      else{count=0;start=-1;}
    }
    if(count<arch.bloqReq){return {ok:false,motivo:'No hay espacio contiguo'};}
    for(let i=start;i<start+arch.bloqReq;i++){disco[i].libre=false;disco[i].archivo=arch.nom;disco[i].tipo='contigua';disco[i].groupId=`${arch.nom}:contigua`;disco[i].order=i-start;asignados.push(i);}
    const tamUltimo=arch.tamKB-(arch.bloqReq-1)*bkKb;
    fragDelta=Math.max(0,bkKb-tamUltimo);
  } else if(metodoSel==='enlazada'){
    let count=0;
    for(let i=0;i<disco.length&&count<arch.bloqReq;i++){
      if(disco[i].libre){disco[i].libre=false;disco[i].archivo=arch.nom;disco[i].tipo=count<arch.bloqReq-1?'enlazada':'enlazada-fin';disco[i].groupId=`${arch.nom}:chain`;disco[i].order=count;asignados.push(i);count++;}
    }
    const tamUltimo=arch.tamKB-(arch.bloqReq-1)*bkKb;
    fragDelta=Math.max(0,bkKb-tamUltimo);
  } else if(metodoSel==='indexada'){
    const needed=arch.bloqReq+1;
    if(libres.length<needed){return {ok:false,motivo:'Espacio insuficiente (índice)'};}
    let count=0;
    for(let i=0;i<disco.length&&count<=arch.bloqReq;i++){
      if(disco[i].libre){
        if(count===0){disco[i].libre=false;disco[i].archivo=arch.nom;disco[i].tipo='indice';disco[i].groupId=`${arch.nom}:idx`;disco[i].order=0;asignados.push(i);}
        else{disco[i].libre=false;disco[i].archivo=arch.nom;disco[i].tipo='indexada';disco[i].groupId=`${arch.nom}:idx`;disco[i].order=count;asignados.push(i);}
        count++;
      }
    }
    const tamUltimo=arch.tamKB-(arch.bloqReq-1)*bkKb;
    fragDelta=Math.max(0,bkKb-tamUltimo);
    return {ok:true,asignados,fragDelta,idxBlock:true};
  } else if(metodoSel==='multinivel'){
    const libresIdx=[];
    for(let i=0;i<disco.length&&libresIdx.length<arch.bloqReq;i++) if(disco[i].libre) libresIdx.push(i);
    if(libresIdx.length<arch.bloqReq){return {ok:false,motivo:'No hay marcos suficientes'};}
    libresIdx.forEach((idx,k)=>{
      disco[idx].libre=false; disco[idx].archivo=arch.nom; disco[idx].tipo=k===0?'dir':'pagina'; disco[idx].groupId=`${arch.nom}:multi`; disco[idx].order=k; asignados.push(idx);
    });
    const tamUltimo=arch.tamKB-(arch.bloqReq-1)*bkKb;
    fragDelta=Math.max(0,bkKb-tamUltimo);
  } else if(metodoSel==='fat'){
    const libresIdx=[];
    for(let i=0;i<disco.length&&libresIdx.length<arch.bloqReq;i++) if(disco[i].libre) libresIdx.push(i);
    if(libresIdx.length<arch.bloqReq){return {ok:false,motivo:'No hay bloques libres'};}
    libresIdx.forEach((idx,k)=>{
      disco[idx].libre=false; disco[idx].archivo=arch.nom; disco[idx].tipo=k<libresIdx.length-1?'fat':'fat-fin'; disco[idx].groupId=`${arch.nom}:fat`; disco[idx].order=k; disco[idx].next=k<libresIdx.length-1?libresIdx[k+1]:null; asignados.push(idx);
    });
    const tamUltimo=arch.tamKB-(arch.bloqReq-1)*bkKb;
    fragDelta=Math.max(0,bkKb-tamUltimo);
  } else if(metodoSel==='extension'){
    let restante=arch.bloqReq; const extents=[];
    let extentIndex=0;
    while(restante>0){
      let bestStart=-1,bestLen=0,curStart=-1,curLen=0;
      for(let i=0;i<=disco.length;i++){
        if(i<disco.length&&disco[i].libre){if(curLen===0)curStart=i;curLen++;}
        else{if(curLen>bestLen){bestLen=curLen;bestStart=curStart;}curLen=0;}
      }
      if(bestLen===0)break;
      const take=Math.min(bestLen,restante);
      for(let i=bestStart;i<bestStart+take;i++){disco[i].libre=false;disco[i].archivo=arch.nom;disco[i].tipo='extension';disco[i].groupId=`${arch.nom}:ext-${extentIndex}`;disco[i].order=i-bestStart;asignados.push(i);}
      extents.push({start:bestStart,len:take});
      restante-=take; extentIndex++;
    }
    if(restante>0){return {ok:false,motivo:'No hay extensiones contiguas suficientes'};}
    const tamUltimo=arch.tamKB-(arch.bloqReq-1)*bkKb;
    fragDelta=Math.max(0,bkKb-tamUltimo);
  } else if(metodoSel==='bitmap'){
    let start=-1,count=0;
    for(let i=0;i<disco.length;i++){
      if(disco[i].libre){count++;if(count===1)start=i;if(count===arch.bloqReq)break;}
      else{count=0;start=-1;}
    }
    if(count<arch.bloqReq){return {ok:false,motivo:'No hay corrida libre suficiente'};}
    for(let i=start;i<start+arch.bloqReq;i++){disco[i].libre=false;disco[i].archivo=arch.nom;disco[i].tipo='bitmap';disco[i].groupId=`${arch.nom}:bitmap`;disco[i].order=i-start;asignados.push(i);}
    const tamUltimo=arch.tamKB-(arch.bloqReq-1)*bkKb;
    fragDelta=Math.max(0,bkKb-tamUltimo);
  }
  return {ok:true,asignados,fragDelta};
}
function ejAlm(){
  if(!archivos.length){alert('Agrega archivos primero.');return;}
  clearTimeout(almAnimId);
  const metodoSel=getMetodoAlm();
  const totB=totalBloques();
  const bkKb=blkKB();
  const disco=Array.from({length:totB},(_,i)=>({id:i,libre:true,archivo:null,tipo:null}));
  const resul=[],noAsig=[];
  let fragTotal=0, idxBlocks=0;
  const archColorMap={};
  let ci=0;
  const pending=[];

  archivos.forEach(arch=>{
    arch.met=metodoSel;
    archColorMap[arch.nom]=ACOLS[ci++%ACOLS.length];
    pending.push({arch});
  });

  const introInfo={title:getMetodoLabel(metodoSel),description:getMetodoDescripcion(metodoSel),step:'Inicio'};
  renderAlmState(disco, archColorMap, totB, bkKb, resul, noAsig, fragTotal, idxBlocks, archivos, metodoSel, introInfo);

  let step=0;
  function tick(){
    if(step>=pending.length){return;}
    const item=pending[step++];
    const arch=item.arch;
    const result=asignarArchivo(disco, arch, metodoSel, bkKb);
    if(result.ok){
      resul.push({...arch,bloqAsig:result.asignados,estado:'Asignado'});
      fragTotal+=result.fragDelta||0;
      if(result.idxBlock) idxBlocks++;
    } else {
      noAsig.push({...arch,motivo:result.motivo||'Espacio insuficiente'});
    }
    const stepInfo={title:result.ok?`Asignando ${arch.nom}`:`${arch.nom} rechazado`,description:result.ok?`${arch.nom} ocupa ${arch.bloqReq} bloques usando ${getMetodoLabel(metodoSel).toLowerCase()}.`:`${arch.nom} no pudo asignarse: ${result.motivo||'espacio insuficiente'}.`,step:`${step}/${pending.length}`};
    renderAlmState(disco, archColorMap, totB, bkKb, resul, noAsig, fragTotal, idxBlocks, archivos, metodoSel, stepInfo);
    almAnimId=setTimeout(tick,500);
  }
  tick();
}

function limpiarAlm(){
  archivos=[];
  document.getElementById('disco-grid').innerHTML='<div class="blk libre" style="grid-column:1/-1;text-align:center;font-size:10px;color:#3a5a3a;padding:8px">Configura el disco y simula</div>';
  document.getElementById('leyenda-alm').innerHTML='';
  document.getElementById('d-cap-info').textContent='';
  ['a-tot','a-uso','a-lib','a-frag','a-bidx'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('a-asig').textContent='0'; document.getElementById('a-rech').textContent='0';
  document.getElementById('a-narch').textContent='0'; document.getElementById('a-metodos').textContent='—';
  document.getElementById('alm-sim-title').textContent='Selecciona un método';
  document.getElementById('alm-sim-method').textContent='—';
  document.getElementById('alm-sim-body').textContent='El mapa del disco mostrará cómo se asignan los bloques según el método que elijas.';
  document.getElementById('alm-sim-legend').innerHTML='<span class="legend-chip chip-free">Libre</span><span class="legend-chip chip-data">Bloque ocupando</span><span class="legend-chip chip-link">Relación</span>';
  document.getElementById('tbl-arch').innerHTML='<tr><td colspan="4" style="text-align:center;color:#5a5a5a;padding:14px">Sin archivos.</td></tr>';
  document.getElementById('tbl-alm-res').innerHTML='<tr><td colspan="6" style="text-align:center;color:#5a5a5a;padding:14px">Sin simulación.</td></tr>';
}

// ─── EXPOSICIÓN GLOBAL ───
window.getMetodoAlm=getMetodoAlm;
window.getMetodoLabel=getMetodoLabel;
window.getMetodoDescripcion=getMetodoDescripcion;
window.almKB=almKB;
window.blkKB=blkKB;
window.totalBloques=totalBloques;
window.addArchivo=addArchivo;
window.cargarEjemploAlm=cargarEjemploAlm;
window.renderTblArch=renderTblArch;
window.getAlmCellPos=getAlmCellPos;
window.renderAlmOverlay=renderAlmOverlay;
window.renderAlmState=renderAlmState;
window.asignarArchivo=asignarArchivo;
window.ejAlm=ejAlm;
window.limpiarAlm=limpiarAlm;
window.archivos=archivos;
