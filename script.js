// ─── SIDEBAR ───
function toggleSB(){document.getElementById('sidebar').classList.toggle('collapsed')}
function clickG(id){
  const sb=document.getElementById('sidebar');
  if(sb.classList.contains('collapsed')){
    sb.classList.remove('collapsed');
    setTimeout(()=>expandG(id),50);
    showPage(id);
  } else expandG(id);
}
function expandG(id){
  document.getElementById('grp-'+id).classList.toggle('open');
  document.getElementById('ch-'+id).classList.toggle('open');
}
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  document.querySelectorAll('.ng-hdr').forEach(h=>h.classList.remove('active-g'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(i=>{
    if(i.getAttribute('onclick')&&i.getAttribute('onclick').includes("'"+name+"'"))i.classList.add('active');
  });
  const titles={plan:'Planificación de Procesos',mem:'Gestión de Memoria',alm:'Gestión de Almacenamiento'};
  document.getElementById('page-title').textContent=titles[name]||name;
  document.getElementById('btns-plan').style.display=name==='plan'?'flex':'none';
  document.getElementById('btns-mem').style.display=name==='mem'?'flex':'none';
  document.getElementById('btns-alm').style.display=name==='alm'?'flex':'none';
  const memTop=document.getElementById('mem-top-controls');
  if(memTop) memTop.style.display=name==='mem'?'flex':'none';
  if(document.getElementById('grp-'+name)) document.getElementById('grp-'+name).classList.add('active-g');
}
function togColl(hdr){hdr.classList.toggle('open');hdr.nextElementSibling.classList.toggle('open');}

function applyTheme(theme){
  const isLight = theme === 'light';
  document.body.setAttribute('data-theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('theme-toggle');
  if(btn){
    btn.textContent = isLight ? '☀️ Claro' : '🌙 Oscuro';
    btn.setAttribute('aria-pressed', String(isLight));
  }
  localStorage.setItem('sim-os-theme', theme);
}
function toggleTheme(){
  const next = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(next);
}
applyTheme(localStorage.getItem('sim-os-theme') || 'dark');

// ─── DATA ───
let procesos=[], animId=null, colorMap={};
let archivos=[], almAnimId=null;
const PAL=['rgba(21,101,192,.6)','rgba(46,125,50,.6)','rgba(106,27,154,.6)','rgba(198,40,40,.6)',
           'rgba(230,81,0,.6)','rgba(0,105,92,.6)','rgba(69,39,160,.6)','rgba(173,20,87,.6)',
           'rgba(2,119,189,.6)','rgba(85,139,47,.6)'];
const MCOLS=['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c','#4527a0','#ad1457','#0277bd','#558b2f'];
const ACOLS=['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c','#4527a0','#ad1457','#0277bd','#558b2f',
             '#0097a7','#f57f17','#4e342e','#37474f','#6a4f4b'];

function getColor(pid){
  if(pid==='Idle')return 'rgba(255,255,255,.05)';
  if(!colorMap[pid]) colorMap[pid]=PAL[Object.keys(colorMap).length%PAL.length];
  return colorMap[pid];
}

// ─── CSV GLOBAL ───
function normalizarCabecera(h){
  return String(h||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
}
function parseCSVRows(txt){
  const d=txt.includes(';')?';':',';
  const lines=txt.trim().split(/\r?\n/).filter(l=>l.trim()!=='');
  if(!lines.length)return {headers:[],rows:[]};
  const headers=lines[0].split(d).map(h=>normalizarCabecera(h));
  const rows=lines.slice(1).map(line=>{
    const cols=line.split(d).map(c=>c.trim().replace(/\r/g,''));
    const row={}; headers.forEach((h,idx)=>row[h]=cols[idx]);
    return row;
  });
  return {headers,rows};
}
function cargarCSV(e){
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    const txt=ev.target.result;
    const {rows}=parseCSVRows(txt);
    const activePage=document.querySelector('.page.active')?.id||'';
    const isStorage=activePage==='page-alm';

    if(isStorage){
      archivos=[];
      rows.forEach(row=>{
        const nom=row['archivo']||row['nombre']||row['nom']||row['file']||row['id']||row['proceso'];
        const tamVal=row['tamano']||row['tam']||row['size']||row['tamanio']||row['tamaño']||row['tamkb'];
        const unidad=row['unidad']||row['u']||row['unit']||'KB';
        if(!nom||tamVal===undefined)return;
        const tamNum=parseFloat(tamVal);
        const tamKB=almKB(tamNum, unidad);
        const bloqReq=Math.ceil(tamKB/(blkKB()||4));
        archivos.push({nom:String(nom).trim(),tamKB,bloqReq,met:'',u:unidad,tam:tamNum||0});
      });
      renderTblArch();
      const aNarch=document.getElementById('a-narch'); if(aNarch)aNarch.textContent=archivos.length;
      document.getElementById('csv-inf').textContent=archivos.length+' arch.';
      return;
    }

    procesos=[];
    rows.forEach(row=>{
      const id=row['proceso']||row['id']||row['p']||row['archivo']||row['nombre']||row['nom'];
      const arr=row['tiempollegada']||row['llegada']||row['arrival']||row['tllegada'];
      const cpu=row['tiempoejecucion']||row['rafaga']||row['burst']||row['tservicio']||row['tserv'];
      const tam=row['tamano']||row['tam']||row['size']||row['tamaño']||'0';
      if(!id||arr===undefined||cpu===undefined)return;
      procesos.push({id:String(id).trim(),llegada:parseInt(arr)||0,rafaga:parseInt(cpu)||1,restante:parseInt(cpu)||1,tamano:parseInt(tam)||0});
    });
    renderTblProc();
    document.getElementById('d-procs').textContent=procesos.length;
    document.getElementById('csv-inf').textContent=procesos.length+' proc.';
  };
  r.readAsText(f); e.target.value='';
}

// ─── PLANIFICACIÓN ───
function addProc(){
  const id=document.getElementById('p-id').value.trim();
  const arr=parseInt(document.getElementById('p-arr').value);
  const cpu=parseInt(document.getElementById('p-cpu').value);
  const tam=parseInt(document.getElementById('p-tam').value)||0;
  if(!id||isNaN(arr)||isNaN(cpu)||cpu<1){alert('Completa ID, Llegada y T.Servicio.');return;}
  procesos.push({id,llegada:arr,rafaga:cpu,restante:cpu,tamano:tam});
  renderTblProc();
  document.getElementById('d-procs').textContent=procesos.length;
  ['p-id','p-arr','p-cpu','p-tam'].forEach(x=>document.getElementById(x).value='');
}

function renderTblProc(rows){
  const data=rows||procesos.map(p=>({...p,inicio:'',fin:'',espera:'',retorno:''}));
  const tb=document.getElementById('tbl-proc');
  if(!data.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:#5a5a5a;padding:14px">Sin procesos.</td></tr>';return;}
  tb.innerHTML=data.sort((a,b)=>String(a.id)>String(b.id)?1:-1).map(r=>`
    <tr><td class="pid">${r.id}</td><td>${r.llegada}</td><td>${r.rafaga}</td><td>${r.tamano||'—'}</td>
    <td>${r.inicio}</td><td>${r.fin}</td>
    <td style="color:${r.espera!==''?'#ffb74d':'inherit'}">${r.espera}</td>
    <td style="color:${r.retorno!==''?'#81c784':'inherit'}">${r.retorno}</td></tr>`).join('');
}

function setRes(rows,info){
  const res=rows.map(p=>{
    const fin=info[p.id].fin??'',ini=info[p.id].inicio??'';
    const ret=fin!==''?fin-p.llegada:'', esp=ret!==''?ret-p.rafaga:'';
    return {...p,inicio:ini,fin,espera:esp,retorno:ret};
  });
  renderTblProc(res);
  const es=res.map(r=>r.espera).filter(v=>v!=='');
  const re=res.map(r=>r.retorno).filter(v=>v!=='');
  if(es.length){
    document.getElementById('avg-e').textContent=(es.reduce((a,b)=>a+b,0)/es.length).toFixed(2);
    document.getElementById('avg-r').textContent=(re.reduce((a,b)=>a+b,0)/re.length).toFixed(2);
  }
}
function setAlgo(n,m,q,exp,t){
  document.getElementById('p-algo').textContent=n;
  document.getElementById('d-modo').textContent=m;
  document.getElementById('d-q').textContent=q;
  document.getElementById('d-exp').textContent=exp;
  document.getElementById('d-tot').textContent=t+' ut';
}

function ejFCFS(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const cp=procesos.map(p=>({...p})).sort((a,b)=>a.llegada-b.llegada);
  const info={}; cp.forEach(p=>info[p.id]={inicio:null,fin:null});
  let t=0; const g=[];
  for(const p of cp){while(t<p.llegada){g.push('Idle');t++;}info[p.id].inicio=t;for(let i=0;i<p.rafaga;i++){g.push(p.id);t++;}info[p.id].fin=t;}
  setAlgo('FCFS','No expulsivo','—',0,t); animGantt(g); setRes(cp,info);
}
function ejSPN(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const cp=procesos.map(p=>({...p,restante:p.rafaga}));
  const info={}; cp.forEach(p=>info[p.id]={inicio:null,fin:null});
  let t=0,done=0; const g=[];
  while(done<cp.length){
    const d=cp.filter(p=>p.llegada<=t&&p.restante>0);
    if(!d.length){g.push('Idle');t++;continue;}
    const p=d.reduce((a,b)=>a.rafaga<b.rafaga?a:b);
    info[p.id].inicio=t; for(let i=0;i<p.rafaga;i++){g.push(p.id);t++;} info[p.id].fin=t; p.restante=0; done++;
  }
  setAlgo('SPN','No expulsivo','—',0,t); animGantt(g); setRes(cp,info);
}
function ejSRT(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const cp=procesos.map(p=>({...p,restante:p.rafaga}));
  const info={}; cp.forEach(p=>info[p.id]={inicio:null,fin:null});
  let t=0,done=0,prev=null,exp=0; const g=[];
  while(done<cp.length){
    const d=cp.filter(p=>p.llegada<=t&&p.restante>0);
    if(d.length){
      const p=d.reduce((a,b)=>a.restante<b.restante?a:b);
      if(info[p.id].inicio===null)info[p.id].inicio=t;
      if(prev&&prev!==p.id&&prev!=='Idle')exp++;
      p.restante--;g.push(p.id);
      if(p.restante===0){info[p.id].fin=t+1;done++;}
      prev=p.id;
    } else {g.push('Idle');prev='Idle';}
    t++;
  }
  setAlgo('SRT','Expulsivo','—',exp,t); animGantt(g); setRes(cp,info);
}
function ejRR(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const q=parseInt(document.getElementById('p-q').value)||2;
  const cp=procesos.map(p=>({...p,restante:p.rafaga}));
  const info={}; cp.forEach(p=>info[p.id]={inicio:null,fin:null});
  let t=0,cola=[],g=[],exp=0; const enc=new Set();
  function encolar(ti){cp.filter(p=>p.llegada===ti&&p.restante>0&&!enc.has(p.id)).sort((a,b)=>String(a.id)>String(b.id)?1:-1).forEach(p=>{cola.push(p);enc.add(p.id);});}
  encolar(0);
  while(cp.some(p=>p.restante>0)){
    if(!cola.length){g.push('Idle');t++;encolar(t);continue;}
    const p=cola.shift(); if(info[p.id].inicio===null)info[p.id].inicio=t;
    let ej=0; while(ej<q&&p.restante>0){g.push(p.id);p.restante--;ej++;t++;encolar(t);}
    if(p.restante>0){cola.push(p);exp++;} else info[p.id].fin=t;
  }
  setAlgo(`RR (q=${q})`,'Expulsivo',q,exp,t); animGantt(g); setRes(cp,info);
}

// GANTT
function bwCalc(total){const cw=document.getElementById('g-canvas').parentElement.clientWidth-20;return Math.max(4,Math.min(60,Math.floor(cw/Math.max(total,1))));}
function animGantt(g){
  clearTimeout(animId); const cv=document.getElementById('g-canvas');
  cv.innerHTML=''; document.getElementById('g-info').textContent=g.length+' ut';
  let i=0;
  function step(){
    if(i>g.length)return;
    const sl=g.slice(0,i), w=bwCalc(g.length), wp=w+'px';
    const ip=w<=6, fs=w<12?'7px':w<20?'8px':'10px', ts=w<14?'0px':'8px', sl2=w>10;
    cv.innerHTML=sl.map((pid,idx)=>`
      <div class="gb" style="width:${wp};min-width:${wp}">
        <div class="gr-rect" style="background:${getColor(pid)};font-size:${fs};height:${ip?'10px':'36px'};border-radius:${ip?'50%':'2px'};border-color:${ip?'transparent':'rgba(255,255,255,.08)'}">
          ${sl2&&!ip?(pid==='Idle'?'—':pid):''}
        </div>
        <div class="gt" style="font-size:${ts};opacity:${ts==='0px'?0:1}">${idx}</div>
      </div>`).join('')+(i===g.length&&!ip?`<div class="gb" style="width:${wp};min-width:${wp}"><div class="gt" style="margin-top:${ip?12:39}px;font-size:${ts}">${i}</div></div>`:'');
    i++; animId=setTimeout(step,[200,120,60,25,5][parseInt(document.getElementById('vel').value)-1]);
  }
  step();
}

function reiniciar(){
  clearTimeout(animId);
  document.getElementById('g-canvas').innerHTML='<span style="color:#4a4a4a;font-size:11px">Esperando...</span>';
  document.getElementById('g-info').textContent='—';
  ['avg-e','avg-r','p-algo','d-tot','d-exp','d-modo'].forEach(id=>document.getElementById(id).textContent='—');
  renderTblProc();
}
function limpiarPlan(){
  clearTimeout(animId); procesos=[]; colorMap={};
  document.getElementById('g-canvas').innerHTML='<span style="color:#4a4a4a;font-size:11px">Esperando...</span>';
  document.getElementById('g-info').textContent='—';
  document.getElementById('csv-inf').textContent='Sin archivo';
  ['avg-e','avg-r','p-algo','d-tot','d-q','d-exp','d-modo'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('d-procs').textContent='0'; renderTblProc();
}

// ─── MEMORIA ───
let particiones=[];
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
  if(!procesos.length){alert('Sin procesos.');return;}
  const total=parseInt(document.getElementById('m-total').value)||1024;
  const fija=document.getElementById('chk-fija').checked;
  const tamPartes=Array.from(document.querySelectorAll('#part-list input')).map(i=>parseInt(i.value)||256);
  let asig=[],noAsig=[];
  if(fija){
    const sum=tamPartes.reduce((a,b)=>a+b,0);
    if(sum>total){alert(`Particiones (${sum}KB) > Memoria (${total}KB)`);return;}
    const bloques=tamPartes.map((t,i)=>({idx:i,tam:t,pid:null,usado:0}));
    for(const p of procesos){
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
    for(const p of procesos){
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

window.addEventListener('DOMContentLoaded', onAlmMetodoChange);

// ─── GESTIÓN DE ALMACENAMIENTO · TÉCNICAS AVANZADAS ───
// Multinivel, FAT, por extensión y bitmap
let memTecnica='multinivel', memColorMap={};
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

// ── Algoritmos de asignación (operan sobre el arreglo de bloques y lo mutan) ──
function asignarBitmap(bloques,p,req){
  // Vector de bits: se busca la primera corrida contigua de bloques libres (first-fit sobre el bitmap)
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
  // Asignación por extensión: usa la(s) corrida(s) contigua(s) más larga(s) disponibles,
  // permitiendo varias extensiones si no cabe en una sola.
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
  // FAT: los bloques pueden ser no contiguos; el encadenamiento se guarda en una tabla aparte (no dentro del bloque)
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
  // Paginación multinivel: los marcos pueden ser no contiguos; se organizan en
  // Directorio de Páginas -> Tabla de Páginas -> Marco físico
  const libres=[];
  for(let i=0;i<bloques.length&&libres.length<req;i++) if(bloques[i].libre) libres.push(i);
  if(libres.length<req) return null;
  libres.forEach(i=>{bloques[i].libre=false;bloques[i].pid=p.id;});
  const paginas=libres.map((marco,pagina)=>({pagina,dir:Math.floor(pagina/ptSize),pt:pagina%ptSize,marco}));
  return {asignados:libres,paginas};
}

function ejMemAvanzado(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const total=parseInt(document.getElementById('m-total').value)||1024;
  const blk=parseInt(document.getElementById('m-blk').value)||64;
  if(blk<=0){alert('Tamaño de bloque/página inválido.');return;}
  const nB=Math.max(1,Math.floor(total/blk));
  const bloques=Array.from({length:nB},(_,i)=>({id:i,libre:true,pid:null,next:undefined}));
  const ptSize=Math.max(1,Math.ceil(Math.sqrt(nB)));
  memColorMap={};
  const asig=[],noAsig=[];

  procesos.forEach(p=>{
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
  // Mapa de bloques
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

  // Tabla de asignación
  const filasAsig=asig.map(a=>`<tr><td class="pid">${a.pid}</td><td>${a.tam} KB</td><td>${a.bloqReq}</td><td>${a.asignados.join(', ')}</td><td style="color:#4caf50">Asignado</td></tr>`);
  const filasNo=noAsig.map(p=>`<tr><td class="pid">${p.id}</td><td>${p.tamano||'?'} KB</td><td>—</td><td>—</td><td style="color:#f44336">${p.motivo}</td></tr>`);
  document.getElementById('tbl-mem-avz-body').innerHTML=(filasAsig.concat(filasNo)).join('')||'<tr><td colspan="5" style="text-align:center;color:#5a5a5a;padding:14px">Sin asignaciones.</td></tr>';

  document.getElementById('tbl-noasig').innerHTML=noAsig.length?noAsig.map(p=>`<tr><td class="pid">${p.id}</td><td>${p.tamano||'?'} KB</td><td style="color:#f44336">${p.motivo}</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center;color:#5a5a5a;padding:14px">Sin rechazados.</td></tr>';

  // Estructura interna específica de cada técnica
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

// ─── ALMACENAMIENTO ───
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
