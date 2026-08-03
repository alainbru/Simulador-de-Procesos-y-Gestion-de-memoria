// ─── MEMORIA ───
let particiones=[];
let memTecnica='multinivel', memColorMap={};
window.procesos=window.procesos||[];
const MCOLS=['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c','#4527a0','#ad1457','#0277bd','#558b2f'];

function togFija(){
  const on=document.getElementById('chk-fija').checked;
  document.getElementById('panel-fija').style.display=on?'block':'none';
  document.getElementById('m-modo').textContent=on?'Particiones Fijas':'Dinámica';
  if(on&&particiones.length===0){addPart();addPart();addPart();}
}
function addPart(){
  const idx=particiones.length; particiones.push(256);
  const d=document.createElement('div'); d.className='part-row';
  d.innerHTML=`<div class="pdot" style="background:${MCOLS[idx%MCOLS.length]}"></div>
    <span style="font-size:11px;color:#7a7a7a;width:65px">Part. ${idx+1}</span>
    <input type="number" min="1" value="256" onchange="particiones[${idx}]=parseInt(this.value)||256">`;
  document.getElementById('part-list').appendChild(d);
}
function delPart(){
  if(!particiones.length)return; particiones.pop();
  const l=document.getElementById('part-list'); if(l.lastChild)l.removeChild(l.lastChild);
}
function ejMem(algo){
  if(!window.procesos || !window.procesos.length){alert('Sin procesos.');return;}
  const total=parseInt(document.getElementById('m-total').value)||1024;
  const fija=document.getElementById('chk-fija').checked;
  const tamPartes=Array.from(document.querySelectorAll('#part-list input')).map(i=>parseInt(i.value)||256);
  let asig=[],noAsig=[];
  if(fija){
    const sum=tamPartes.reduce((a,b)=>a+b,0);
    if(sum>total){alert(`Particiones (${sum}KB) > Memoria (${total}KB)`);return;}
    const bloques=tamPartes.map((t,i)=>({idx:i,tam:t,pid:null,usado:0}));
    for(const p of window.procesos){
      if(!p.tamano){noAsig.push({...p,motivo:'Sin tamaño'});continue;}
      const lib=bloques.filter(b=>!b.pid&&b.tam>=p.tamano);
      let el=null;
      if(algo==='ff')el=lib[0];else if(algo==='bf')el=lib.sort((a,b)=>a.tam-b.tam)[0];else el=lib.sort((a,b)=>b.tam-a.tam)[0];
      if(el){el.pid=p.id;el.usado=p.tamano;const base=tamPartes.slice(0,el.idx).reduce((a,b)=>a+b,0);asig.push({pid:p.id,tam:p.tamano,part:el.idx+1,base,limite:base+el.tam-1});}
      else noAsig.push({...p,motivo:'Sin partición'});
    }
    renderMapaFijo(bloques,tamPartes,total);
    document.getElementById('m-frag').textContent=asig.reduce((a,b)=>{const pt=tamPartes[b.part-1]||b.tam;return a+(pt-b.tam);},0)+' KB';
  } else {
    let mem=[{base:0,tam:total,pid:null}];
    for(const p of window.procesos){
      if(!p.tamano){noAsig.push({...p,motivo:'Sin tamaño'});continue;}
      const lib=mem.filter(b=>!b.pid&&b.tam>=p.tamano);
      let el=null;
      if(algo==='ff')el=lib[0];else if(algo==='bf')el=lib.sort((a,b)=>a.tam-b.tam)[0];else el=lib.sort((a,b)=>b.tam-a.tam)[0];
      if(el){const resto=el.tam-p.tamano,base=el.base;el.pid=p.id;el.tam=p.tamano;if(resto>0)mem.splice(mem.indexOf(el)+1,0,{base:base+p.tamano,tam:resto,pid:null});asig.push({pid:p.id,tam:p.tamano,part:'Dyn',base,limite:base+p.tamano-1});}
      else noAsig.push({...p,motivo:'Sin espacio'});
    }
    renderMapaDin(mem,total); document.getElementById('m-frag').textContent='—';
  }
  const usada=asig.reduce((a,b)=>a+b.tam,0);
  document.getElementById('m-usada').textContent=usada;
  document.getElementById('m-libre').textContent=total-usada;
  document.getElementById('m-algo').textContent={ff:'First Fit',bf:'Best Fit',wf:'Worst Fit'}[algo];
  document.getElementById('m-asig').textContent=asig.length;
  document.getElementById('m-rech').textContent=noAsig.length;
  document.getElementById('mem-bar').textContent=`Usado: ${usada} KB | Libre: ${total-usada} KB | Total: ${total} KB`;
  document.getElementById('tbl-mem').innerHTML=asig.length?asig.map(a=>`<tr><td class="pid">${a.pid}</td><td>${a.tam} KB</td><td>${a.part}</td><td>${a.base}</td><td>${a.limite}</td><td style="color:#4caf50">Asignado</td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:#5a5a5a;padding:14px">Sin asignaciones.</td></tr>';
  document.getElementById('tbl-noasig').innerHTML=noAsig.length?noAsig.map(p=>`<tr><td class="pid">${p.id}</td><td>${p.tamano||'?'} KB</td><td style="color:#f44336">${p.motivo}</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center;color:#5a5a5a;padding:14px">Sin rechazados.</td></tr>';
}
function renderMapaFijo(bloques,tams,total){
  document.getElementById('mem-vis').innerHTML=bloques.map((b,i)=>{
    const pct=(b.tam/total*100).toFixed(1),col=MCOLS[i%MCOLS.length];
    return b.pid?`<div class="mv" style="width:${pct}%;background:${col}99"><span>${b.pid}</span><span style="font-size:7px;opacity:.7">${b.usado}KB</span></div>`
      :`<div class="mv" style="width:${pct}%;background:#1a2a1a;color:#3a5a3a">LIBRE</div>`;
  }).join('');
}
function renderMapaDin(mem,total){
  let ci=0;
  document.getElementById('mem-vis').innerHTML=mem.map(b=>{
    const pct=(b.tam/total*100).toFixed(1);
    if(b.pid){const col=MCOLS[ci++%MCOLS.length];return `<div class="mv" style="width:${pct}%;background:${col}99"><span>${b.pid}</span><span style="font-size:7px;opacity:.7">${b.tam}KB</span></div>`;}
    return `<div class="mv" style="width:${pct}%;background:#1a2a1a;color:#3a5a3a">LIBRE</div>`;
  }).join('');
}
function limpiarMem(){
  document.getElementById('mem-vis').innerHTML='<div class="mv" style="width:100%;background:#1a2a1a;color:#3a5a3a">LIBRE</div>';
  document.getElementById('mem-bar').textContent='—';
  ['m-usada','m-libre','m-algo','m-frag'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('m-asig').textContent='0'; document.getElementById('m-rech').textContent='0';
  document.getElementById('tbl-mem').innerHTML='<tr><td colspan="6" style="text-align:center;color:#5a5a5a;padding:14px">Sin asignaciones.</td></tr>';
  document.getElementById('tbl-noasig').innerHTML='<tr><td colspan="3" style="text-align:center;color:#5a5a5a;padding:14px">Sin rechazados.</td></tr>';
  document.getElementById('m-modo').textContent=document.getElementById('chk-fija').checked?'Particiones Fijas':'Dinámica';
  // técnicas avanzadas
  document.getElementById('mem-blocks-grid').innerHTML='<div class="blk libre" style="grid-column:1/-1;text-align:center;font-size:10px;color:#3a5a3a;padding:8px">Configura y simula</div>';
  document.getElementById('mem-leyenda').innerHTML='';
  document.getElementById('mem-blk-info').textContent='';
  document.getElementById('tbl-mem-avz-body').innerHTML='<tr><td colspan="5" style="text-align:center;color:#5a5a5a;padding:14px">Sin asignaciones.</td></tr>';
  document.getElementById('mem-estructura-body').innerHTML='<span style="color:#5a5a5a;font-size:11px">Sin datos.</span>';
}

function memColor(pid){
  if(!memColorMap[pid]) memColorMap[pid]=MCOLS[Object.keys(memColorMap).length%MCOLS.length];
  return memColorMap[pid];
}
function onAlmMetodoChange(){
  memTecnica=document.getElementById('alm-metodo').value;
  const titulo=document.getElementById('mem-estructura-titulo');
  const titulos={multinivel:'Asignación multinivel',fat:'FAT',extension:'Basada en extensión',bitmap:'Bitmap'};
  if(titulo) titulo.textContent='🗂️ '+titulos[memTecnica];
}

function asignarBitmap(bloques,p,req){
  let start=-1,count=0;
  for(let i=0;i<bloques.length;i++){
    if(bloques[i].libre){count++;if(count===1)start=i;if(count===req)break;}
    else{count=0;start=-1;}
  }
  if(count<req) return null;
  const asignados=[];
  for(let i=start;i<start+req;i++){bloques[i].libre=false;bloques[i].pid=p.id;asignados.push(i);}
  return {asignados,extents:[{start,len:req}]};
}

function asignarExtension(bloques,p,req){
  const libresCount=bloques.filter(b=>b.libre).length;
  if(libresCount<req) return null;
  let restante=req; const asignados=[]; const extents=[];
  while(restante>0){
    let bestStart=-1,bestLen=0,curStart=-1,curLen=0;
    for(let i=0;i<=bloques.length;i++){
      if(i<bloques.length&&bloques[i].libre){if(curLen===0)curStart=i;curLen++;}
      else{if(curLen>bestLen){bestLen=curLen;bestStart=curStart;}curLen=0;}
    }
    if(bestLen===0)break;
    const take=Math.min(bestLen,restante);
    for(let i=bestStart;i<bestStart+take;i++){bloques[i].libre=false;bloques[i].pid=p.id;asignados.push(i);}
    extents.push({start:bestStart,len:take});
    restante-=take;
  }
  if(restante>0) return null;
  return {asignados,extents};
}

function asignarFAT(bloques,p,req){
  const libres=[];
  for(let i=0;i<bloques.length&&libres.length<req;i++) if(bloques[i].libre) libres.push(i);
  if(libres.length<req) return null;
  libres.forEach((idx,k)=>{
    bloques[idx].libre=false;
    bloques[idx].pid=p.id;
    bloques[idx].next=k<libres.length-1?libres[k+1]:'EOF';
  });
  return {asignados:libres};
}

function asignarMultinivel(bloques,p,req,ptSize){
  const libres=[];
  for(let i=0;i<bloques.length&&libres.length<req;i++) if(bloques[i].libre) libres.push(i);
  if(libres.length<req) return null;
  libres.forEach(i=>{bloques[i].libre=false;bloques[i].pid=p.id;});
  const paginas=libres.map((marco,pagina)=>({pagina,dir:Math.floor(pagina/ptSize),pt:pagina%ptSize,marco}));
  return {asignados:libres,paginas};
}

function ejMemAvanzado(){
  if(!window.procesos || !window.procesos.length){alert('Sin procesos.');return;}
  const total=parseInt(document.getElementById('m-total').value)||1024;
  const blk=parseInt(document.getElementById('m-blk').value)||64;
  if(blk<=0){alert('Tamaño de bloque/página inválido.');return;}
  const nB=Math.max(1,Math.floor(total/blk));
  const bloques=Array.from({length:nB},(_,i)=>({id:i,libre:true,pid:null,next:undefined}));
  const ptSize=Math.max(1,Math.ceil(Math.sqrt(nB)));
  memColorMap={};
  const asig=[],noAsig=[];

  window.procesos.forEach(p=>{
    if(!p.tamano){noAsig.push({...p,motivo:'Sin tamaño'});return;}
    const bloqReq=Math.ceil(p.tamano/blk);
    if(bloqReq>nB){noAsig.push({...p,motivo:'Excede memoria total'});return;}
    let res=null;
    if(memTecnica==='multinivel')      res=asignarMultinivel(bloques,p,bloqReq,ptSize);
    else if(memTecnica==='fat')        res=asignarFAT(bloques,p,bloqReq);
    else if(memTecnica==='extension')  res=asignarExtension(bloques,p,bloqReq);
    else                                res=asignarBitmap(bloques,p,bloqReq);
    if(res) asig.push({pid:p.id,tam:p.tamano,bloqReq,...res});
    else noAsig.push({...p,motivo:'Espacio insuficiente'});
  });

  renderMemAvanzado(bloques,asig,noAsig,total,blk,ptSize);
}

function renderMemAvanzado(bloques,asig,noAsig,total,blk,ptSize){
  const grid=document.getElementById('mem-blocks-grid');
  grid.innerHTML=bloques.map(b=>{
    if(b.libre) return `<div class="blk libre" title="Bloque ${b.id} — Libre">${b.id}</div>`;
    const col=memColor(b.pid);
    return `<div class="blk ocupado" style="background:${col}cc" title="Bloque ${b.id} — ${b.pid}">${b.id}<br><span style="font-size:6px">${String(b.pid).substring(0,3)}</span></div>`;
  }).join('');

  const usados=bloques.filter(b=>!b.libre).length;
  const usadaKB=usados*blk;
  document.getElementById('mem-blk-info').textContent=`(${bloques.length} bloques de ${blk}KB)`;
  document.getElementById('m-usada').textContent=usadaKB;
  document.getElementById('m-libre').textContent=total-usadaKB;
  const nombres={multinivel:'Multinivel (Paginación)',fat:'FAT',extension:'Por Extensión',bitmap:'Bitmap'};
  document.getElementById('m-algo').textContent=nombres[memTecnica];
  document.getElementById('m-modo').textContent=nombres[memTecnica];
  document.getElementById('m-asig').textContent=asig.length;
  document.getElementById('m-rech').textContent=noAsig.length;
  const frag=asig.reduce((a,b)=>a+(b.bloqReq*blk-b.tam),0);
  document.getElementById('m-frag').textContent=frag.toFixed(1)+' KB';

  document.getElementById('mem-leyenda').innerHTML=asig.map(a=>
    `<span style="color:#aaa">■ <span style="color:${memColor(a.pid)}">${a.pid}</span></span>`).join(' ');

  const filasAsig=asig.map(a=>`<tr><td class="pid">${a.pid}</td><td>${a.tam} KB</td><td>${a.bloqReq}</td><td>${a.asignados.join(', ')}</td><td style="color:#4caf50">Asignado</td></tr>`);
  const filasNo=noAsig.map(p=>`<tr><td class="pid">${p.id}</td><td>${p.tamano||'?'} KB</td><td>—</td><td>—</td><td style="color:#f44336">${p.motivo}</td></tr>`);
  document.getElementById('tbl-mem-avz-body').innerHTML=(filasAsig.concat(filasNo)).join('')||'<tr><td colspan="5" style="text-align:center;color:#5a5a5a;padding:14px">Sin asignaciones.</td></tr>';

  document.getElementById('tbl-noasig').innerHTML=noAsig.length?noAsig.map(p=>`<tr><td class="pid">${p.id}</td><td>${p.tamano||'?'} KB</td><td style="color:#f44336">${p.motivo}</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center;color:#5a5a5a;padding:14px">Sin rechazados.</td></tr>';

  const est=document.getElementById('mem-estructura-body');
  if(memTecnica==='bitmap'){
    const bits=bloques.map(b=>b.libre?'0':'1').join('');
    const agrupado=bits.match(/.{1,8}/g)?.join(' ')||bits;
    est.innerHTML=`<div style="font-size:11px;color:#7a7a7a;margin-bottom:6px">Vector de bits (0 = libre, 1 = ocupado):</div>
      <div style="font-family:monospace;font-size:12px;color:#4fc3f7;word-break:break-all;line-height:1.7">${agrupado}</div>
      <div style="font-size:10px;color:#5a5a5a;margin-top:8px">${bloques.length} bits totales — 1 bit por bloque de ${blk} KB.</div>`;
  } else if(memTecnica==='fat'){
    const filas=bloques.map(b=>`<tr><td>${b.id}</td><td class="pid">${b.libre?'—':b.pid}</td><td>${b.libre?'LIBRE':b.next}</td></tr>`).join('');
    est.innerHTML=`<div style="font-size:10px;color:#7a7a7a;margin-bottom:6px">Tabla de asignación de archivos: cada entrada apunta al siguiente bloque de la cadena (o EOF).</div>
      <div class="tw" style="max-height:220px"><table><thead><tr><th>Bloque</th><th>Proceso</th><th>Siguiente</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  } else if(memTecnica==='extension'){
    est.innerHTML=(asig.map(a=>`<div style="margin-bottom:6px"><span class="pid">${a.pid}</span>: `+
      a.extents.map(e=>`[${e.start}–${e.start+e.len-1}]`).join(' + ')+
      ` <span style="color:#7a7a7a">(${a.extents.length} extensión${a.extents.length>1?'es':''})</span></div>`).join(''))
      ||'<span style="color:#5a5a5a;font-size:11px">Sin datos.</span>';
  } else if(memTecnica==='multinivel'){
    let filas='';
    asig.forEach(a=>{a.paginas.forEach(pg=>{filas+=`<tr><td class="pid">${a.pid}</td><td>${pg.pagina}</td><td>${pg.dir}</td><td>${pg.pt}</td><td>${pg.marco}</td></tr>`;});});
    est.innerHTML=`<div style="font-size:10px;color:#7a7a7a;margin-bottom:6px">Entradas por tabla de páginas: ${ptSize} (Directorio → Tabla de Páginas → Marco)</div>
      <div class="tw" style="max-height:220px"><table><thead><tr><th>Proceso</th><th>Página</th><th>Dir.</th><th>Tabla Pág.</th><th>Marco</th></tr></thead>
      <tbody>${filas||'<tr><td colspan="5" style="text-align:center;color:#5a5a5a;padding:10px">Sin datos.</td></tr>'}</tbody></table></div>`;
  }
}

// ─── EXPOSICIÓN GLOBAL ───
window.togFija=togFija;
window.addPart=addPart;
window.delPart=delPart;
window.ejMem=ejMem;
window.renderMapaFijo=renderMapaFijo;
window.renderMapaDin=renderMapaDin;
window.limpiarMem=limpiarMem;
window.memColor=memColor;
window.onAlmMetodoChange=onAlmMetodoChange;
window.asignarBitmap=asignarBitmap;
window.asignarExtension=asignarExtension;
window.asignarFAT=asignarFAT;
window.asignarMultinivel=asignarMultinivel;
window.ejMemAvanzado=ejMemAvanzado;
window.renderMemAvanzado=renderMemAvanzado;
