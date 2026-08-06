// ─── SIDEBAR Y NAVEGACIÓN ───
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

// ─── DATA Y COLORES ───
let procesos=[], animId=null, colorMap={};
window.procesos=procesos;
const PAL=['rgba(21,101,192,.6)','rgba(46,125,50,.6)','rgba(106,27,154,.6)','rgba(198,40,40,.6)',
           'rgba(230,81,0,.6)','rgba(0,105,92,.6)','rgba(69,39,160,.6)','rgba(173,20,87,.6)',
           'rgba(2,119,189,.6)','rgba(85,139,47,.6)'];
const MCOLS=['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c','#4527a0','#ad1457','#0277bd','#558b2f'];
const ACOLS=['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c','#4527a0','#ad1457','#0277bd','#558b2f',
             '#0097a7','#f57f17','#4e342e','#37474f','#6a4f4b'];

function getColor(pid){
  if(pid==='Idle')return 'rgba(128,128,128,.18)';
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
      if(typeof window.archivos !== 'undefined') window.archivos=[]; 
      const archivosLocal=[];
      rows.forEach(row=>{
        const nom=row['archivo']||row['nombre']||row['nom']||row['file']||row['id']||row['proceso'];
        const tamVal=row['tamano']||row['tam']||row['size']||row['tamanio']||row['tamaño']||row['tamkb'];
        const unidad=row['unidad']||row['u']||row['unit']||'KB';
        if(!nom||tamVal===undefined)return;
        const tamNum=parseFloat(tamVal);
        const tamKB=window.almKB ? window.almKB(tamNum, unidad) : tamNum;
        const bloqReq=Math.ceil(tamKB/(window.blkKB ? window.blkKB() : 4));
        archivosLocal.push({nom:String(nom).trim(),tamKB,bloqReq,met:'',u:unidad,tam:tamNum||0});
      });
      window.archivos=archivosLocal;
      if(typeof window.renderTblArch === 'function') window.renderTblArch();
      const aNarch=document.getElementById('a-narch'); if(aNarch)aNarch.textContent=archivosLocal.length;
      document.getElementById('csv-inf').textContent=archivosLocal.length+' arch.';
      return;
    }

    procesos.length=0;
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
  if(!data.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--app-text-muted);padding:14px">Sin procesos.</td></tr>';return;}
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

// ─── GANTT ───
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
  document.getElementById('g-canvas').innerHTML='<span style="color:var(--app-text-muted);font-size:11px">Esperando...</span>';
  document.getElementById('g-info').textContent='—';
  ['avg-e','avg-r','p-algo','d-tot','d-exp','d-modo'].forEach(id=>document.getElementById(id).textContent='—');
  renderTblProc();
}
function limpiarPlan(){
  clearTimeout(animId); procesos.length=0; colorMap={};
  document.getElementById('g-canvas').innerHTML='<span style="color:var(--app-text-muted);font-size:11px">Esperando...</span>';
  document.getElementById('g-info').textContent='—';
  document.getElementById('csv-inf').textContent='Sin archivo';
  ['avg-e','avg-r','p-algo','d-tot','d-q','d-exp','d-modo'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('d-procs').textContent='0'; renderTblProc();
}

// ─── EXPOSICIÓN GLOBAL ───
window.toggleSB=toggleSB;
window.clickG=clickG;
window.expandG=expandG;
window.showPage=showPage;
window.togColl=togColl;
window.normalizarCabecera=normalizarCabecera;
window.parseCSVRows=parseCSVRows;
window.cargarCSV=cargarCSV;
window.addProc=addProc;
window.renderTblProc=renderTblProc;
window.setRes=setRes;
window.setAlgo=setAlgo;
window.ejFCFS=ejFCFS;
window.ejSPN=ejSPN;
window.ejSRT=ejSRT;
window.ejRR=ejRR;
window.bwCalc=bwCalc;
window.animGantt=animGantt;
window.reiniciar=reiniciar;
window.limpiarPlan=limpiarPlan;
