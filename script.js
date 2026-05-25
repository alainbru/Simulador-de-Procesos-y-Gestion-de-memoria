// ─── SIDEBAR ───
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('collapsed')}

function clickGroup(id){
  const sb=document.getElementById('sidebar');
  if(sb.classList.contains('collapsed')){
    sb.classList.remove('collapsed');
    setTimeout(()=>expandGroup(id),50);
    showPage(id==='plan'?'procesos':'memoria');
  } else {
    expandGroup(id);
  }
}
function expandGroup(id){
  document.getElementById('grp-'+id).classList.toggle('open');
  document.getElementById('ch-'+id).classList.toggle('open');
}

function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  document.querySelectorAll('.nav-group-header').forEach(h=>h.classList.remove('active-group'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(i=>{
    if(i.getAttribute('onclick')&&i.getAttribute('onclick').includes(name))i.classList.add('active');
  });
  const titles={procesos:'Planificación de Procesos',memoria:'Gestión de Memoria'};
  document.getElementById('page-title').textContent=titles[name];
  document.getElementById('btns-plan').style.display=name==='procesos'?'flex':'none';
  document.getElementById('btns-mem').style.display=name==='memoria'?'flex':'none';
  if(name==='procesos') document.getElementById('grp-plan').classList.add('active-group');
  if(name==='memoria')  document.getElementById('grp-mem').classList.add('active-group');
}

function toggleColl(hdr){
  hdr.classList.toggle('open');
  hdr.nextElementSibling.classList.toggle('open');
}

// ─── DATA ───
let procesos=[], animId=null, colorMap={};
const PALETA=['rgba(21,101,192,0.6)','rgba(46,125,50,0.6)','rgba(106,27,154,0.6)',
              'rgba(198,40,40,0.6)','rgba(230,81,0,0.6)','rgba(0,105,92,0.6)',
              'rgba(69,39,160,0.6)','rgba(173,20,87,0.6)','rgba(2,119,189,0.6)','rgba(85,139,47,0.6)'];
const MEM_COLORS=['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c','#4527a0','#ad1457','#0277bd','#558b2f'];

function getColor(pid){
  if(pid==='Idle')return 'rgba(255,255,255,0.05)';
  if(!colorMap[pid]) colorMap[pid]=PALETA[Object.keys(colorMap).length%PALETA.length];
  return colorMap[pid];
}

// ─── CSV GLOBAL ───
function cargarCSVGlobal(e){
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    const txt=ev.target.result, d=txt.includes(';')?';':',';
    const lines=txt.trim().split('\n');
    const hdrs=lines[0].split(d).map(h=>h.trim().toLowerCase().replace(/\r/g,''));
    procesos=[];
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(d).map(c=>c.trim().replace(/\r/g,''));
      const row={}; hdrs.forEach((h,idx)=>row[h]=cols[idx]);
      const id=row['proceso']||row['id']||row['p'];
      const arr=row['tiempo_llegada']||row['llegada']||row['arrival'];
      const cpu=row['tiempo_ejecucion']||row['rafaga']||row['burst']||row['t. servicio'];
      const tam=row['tamano']||row['tamaño']||row['size']||'0';
      if(!id||arr===undefined||cpu===undefined)continue;
      procesos.push({id:id.trim(),llegada:parseInt(arr)||0,rafaga:parseInt(cpu)||1,restante:parseInt(cpu)||1,tamano:parseInt(tam)||0});
    }
    renderTabla();
    document.getElementById('d-procs').textContent=procesos.length;
    document.getElementById('csv-info').textContent=procesos.length+' proc.';
  };
  r.readAsText(f); e.target.value='';
}

// ─── AGREGAR MANUAL ───
function agregarProceso(){
  const id=document.getElementById('inp-id').value.trim();
  const arr=parseInt(document.getElementById('inp-arr').value);
  const cpu=parseInt(document.getElementById('inp-cpu').value);
  const tam=parseInt(document.getElementById('inp-tam').value)||0;
  if(!id||isNaN(arr)||isNaN(cpu)||cpu<1){alert('Completa ID, Llegada y T.Servicio.');return;}
  procesos.push({id,llegada:arr,rafaga:cpu,restante:cpu,tamano:tam});
  renderTabla();
  document.getElementById('d-procs').textContent=procesos.length;
  ['inp-id','inp-arr','inp-cpu','inp-tam'].forEach(x=>document.getElementById(x).value='');
}

// ─── RENDER TABLA ───
function renderTabla(rows){
  const data=rows||procesos.map(p=>({...p,inicio:'',fin:'',espera:'',retorno:''}));
  const tb=document.getElementById('tbl-proc');
  if(!data.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:#5a5a5a;padding:16px">Sin procesos.</td></tr>';return;}
  tb.innerHTML=data.sort((a,b)=>String(a.id)>String(b.id)?1:-1).map(r=>`
    <tr>
      <td class="pid">${r.id}</td>
      <td>${r.llegada}</td><td>${r.rafaga}</td><td>${r.tamano||'—'}</td>
      <td>${r.inicio}</td><td>${r.fin}</td>
      <td style="color:${r.espera!==''?'#ffb74d':'inherit'}">${r.espera}</td>
      <td style="color:${r.retorno!==''?'#81c784':'inherit'}">${r.retorno}</td>
    </tr>`).join('');
}

function setResultados(rows,info){
  const res=rows.map(p=>{
    const fin=info[p.id].fin??'', inicio=info[p.id].inicio??'';
    const ret=fin!==''?fin-p.llegada:'';
    const esp=ret!==''?ret-p.rafaga:'';
    return {...p,inicio,fin,espera:esp,retorno:ret};
  });
  renderTabla(res);
  const es=res.map(r=>r.espera).filter(v=>v!=='');
  const re=res.map(r=>r.retorno).filter(v=>v!=='');
  if(es.length){
    document.getElementById('avg-e').textContent=(es.reduce((a,b)=>a+b,0)/es.length).toFixed(2);
    document.getElementById('avg-r').textContent=(re.reduce((a,b)=>a+b,0)/re.length).toFixed(2);
  }
}

function setAlgo(n,m,q,exp,t){
  document.getElementById('algo-name').textContent=n;
  document.getElementById('d-modo').textContent=m;
  document.getElementById('d-q').textContent=q;
  document.getElementById('d-exp').textContent=exp;
  document.getElementById('d-total').textContent=t+' ut';
}

// ─── FCFS ───
function ejecutarFCFS(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const cp=procesos.map(p=>({...p})).sort((a,b)=>a.llegada-b.llegada);
  const info={}; cp.forEach(p=>info[p.id]={inicio:null,fin:null});
  let t=0; const g=[];
  for(const p of cp){
    while(t<p.llegada){g.push('Idle');t++;}
    info[p.id].inicio=t;
    for(let i=0;i<p.rafaga;i++){g.push(p.id);t++;}
    info[p.id].fin=t;
  }
  setAlgo('FCFS','No expulsivo','—',0,t);
  animarGantt(g); setResultados(cp,info);
}

// ─── SPN ───
function ejecutarSPN(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const cp=procesos.map(p=>({...p,restante:p.rafaga}));
  const info={}; cp.forEach(p=>info[p.id]={inicio:null,fin:null});
  let t=0,done=0; const g=[];
  while(done<cp.length){
    const disp=cp.filter(p=>p.llegada<=t&&p.restante>0);
    if(!disp.length){g.push('Idle');t++;continue;}
    const p=disp.reduce((a,b)=>a.rafaga<b.rafaga?a:b);
    info[p.id].inicio=t;
    for(let i=0;i<p.rafaga;i++){g.push(p.id);t++;}
    info[p.id].fin=t; p.restante=0; done++;
  }
  setAlgo('SPN','No expulsivo','—',0,t);
  animarGantt(g); setResultados(cp,info);
}

// ─── SRT ───
function ejecutarSRT(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const cp=procesos.map(p=>({...p,restante:p.rafaga}));
  const info={}; cp.forEach(p=>info[p.id]={inicio:null,fin:null});
  let t=0,done=0,prev=null,exp=0; const g=[];
  while(done<cp.length){
    const disp=cp.filter(p=>p.llegada<=t&&p.restante>0);
    if(disp.length){
      const p=disp.reduce((a,b)=>a.restante<b.restante?a:b);
      if(info[p.id].inicio===null) info[p.id].inicio=t;
      if(prev&&prev!==p.id&&prev!=='Idle') exp++;
      p.restante--; g.push(p.id);
      if(p.restante===0){info[p.id].fin=t+1;done++;}
      prev=p.id;
    } else {g.push('Idle');prev='Idle';}
    t++;
  }
  setAlgo('SRT','Expulsivo','—',exp,t);
  animarGantt(g); setResultados(cp,info);
}

// ─── RR ───
function ejecutarRR(){
  if(!procesos.length){alert('Sin procesos.');return;}
  const q=parseInt(document.getElementById('inp-q').value)||2;
  const cp=procesos.map(p=>({...p,restante:p.rafaga}));
  const info={}; cp.forEach(p=>info[p.id]={inicio:null,fin:null});
  let t=0,cola=[],g=[],exp=0;
  const encolados=new Set();
  function encolar(ti){
    cp.filter(p=>p.llegada===ti&&p.restante>0&&!encolados.has(p.id))
      .sort((a,b)=>String(a.id)>String(b.id)?1:-1)
      .forEach(p=>{cola.push(p);encolados.add(p.id);});
  }
  encolar(0);
  while(cp.some(p=>p.restante>0)){
    if(!cola.length){g.push('Idle');t++;encolar(t);continue;}
    const p=cola.shift();
    if(info[p.id].inicio===null) info[p.id].inicio=t;
    let ej=0;
    while(ej<q&&p.restante>0){g.push(p.id);p.restante--;ej++;t++;encolar(t);}
    if(p.restante>0){cola.push(p);exp++;}
    else info[p.id].fin=t;
  }
  setAlgo(`RR (q=${q})`,'Expulsivo',q,exp,t);
  animarGantt(g); setResultados(cp,info);
}

// ─── GANTT ───
function bw(total){
  const cw=document.getElementById('gantt-canvas').parentElement.clientWidth-20;
  return Math.max(4,Math.min(60,Math.floor(cw/Math.max(total,1))));
}

function animarGantt(g){
  clearTimeout(animId);
  const cv=document.getElementById('gantt-canvas');
  cv.innerHTML='';
  document.getElementById('gantt-info').textContent=g.length+' ut';
  // Compress consecutive same-pid into segments
  const segs=[];
  for(const pid of g){
    if(segs.length&&segs[segs.length-1].pid===pid) segs[segs.length-1].len++;
    else segs.push({pid,len:1});
  }
  let i=0,t=0;
  function step(){
    if(i>segs.length)return;
    const shown=segs.slice(0,i);
    cv.innerHTML='';
    shown.forEach((seg,si)=>{
      const blk=document.createElement('div');
      blk.className='g-block';
      blk.style.cssText=`flex:${seg.len};min-width:${Math.max(18,seg.len*14)}px;max-width:${Math.max(72,seg.len*60)}px`;
      const rect=document.createElement('div');
      rect.className='g-rect animate-in';
      rect.style.cssText=`background:${getColor(seg.pid)};animation-delay:0ms`;
      rect.style.animationDelay=si===shown.length-1?'0ms':'';
      // only animate last block
      if(si<shown.length-1) rect.classList.remove('animate-in');
      const fs=seg.len===1?'9px':seg.len<3?'10px':'12px';
      rect.innerHTML=`<span style="font-size:${fs};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90%">${seg.pid==='Idle'?'—':seg.pid}</span>`;
      blk.appendChild(rect);
      // tick
      const tick=document.createElement('div');
      tick.className='g-tick';
      tick.textContent=t;
      blk.appendChild(tick);
      cv.appendChild(blk);
      t+=seg.len;
    });
    // final tick
    if(i===segs.length&&shown.length){
      const last=cv.lastChild;
      if(last){
        const endTick=document.createElement('div');
        endTick.className='g-tick';
        endTick.style.cssText='margin-top:4px;font-size:9px;text-align:right;padding-right:2px';
        endTick.textContent=t;
        // append as separate element after last block
        const fin=document.createElement('div');
        fin.style.cssText='display:flex;flex-direction:column;align-items:center;flex:0;min-width:16px';
        fin.appendChild(endTick);
        cv.appendChild(fin);
      }
    }
    i++;
    const vel=parseInt(document.getElementById('vel').value);
    if(i<=segs.length) animId=setTimeout(step,[250,140,70,30,8][vel-1]);
  }
  step();
}

// ─── REINICIAR / LIMPIAR ───
function reiniciar(){
  clearTimeout(animId);
  document.getElementById('gantt-canvas').innerHTML='<span style="color:#4a4a4a;font-size:11px">Esperando ejecución...</span>';
  document.getElementById('gantt-info').textContent='—';
  ['avg-e','avg-r','algo-name','d-total','d-exp','d-modo'].forEach(id=>document.getElementById(id).textContent='—');
  renderTabla();
}
function limpiarTodo(){
  clearTimeout(animId); procesos=[]; colorMap={};
  document.getElementById('gantt-canvas').innerHTML='<span style="color:#4a4a4a;font-size:11px">Esperando ejecución...</span>';
  document.getElementById('gantt-info').textContent='—';
  document.getElementById('csv-info').textContent='Sin archivo';
  ['avg-e','avg-r','algo-name','d-total','d-q','d-exp','d-modo'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('d-procs').textContent='0';
  renderTabla();
}

// ─── MEMORIA ───
let particiones=[];

function toggleFija(){
  const on=document.getElementById('chk-fija').checked;
  document.getElementById('panel-fija').style.display=on?'block':'none';
  document.getElementById('m-modo').textContent=on?'Particiones Fijas':'Dinámica';
  if(on&&particiones.length===0){addPart();addPart();addPart();}
}
function addPart(){
  const idx=particiones.length; particiones.push(256);
  const d=document.createElement('div'); d.className='part-row';
  d.innerHTML=`<div class="part-dot" style="background:${MEM_COLORS[idx%MEM_COLORS.length]}"></div>
    <span style="font-size:11px;color:#7a7a7a;width:70px">Part. ${idx+1}</span>
    <input type="number" min="1" value="256" onchange="particiones[${idx}]=parseInt(this.value)||256">`;
  document.getElementById('part-list').appendChild(d);
}
function delPart(){
  if(!particiones.length)return;
  particiones.pop();
  const l=document.getElementById('part-list');
  if(l.lastChild)l.removeChild(l.lastChild);
}

function elegir(lib, algo){
  if(!lib.length) return null;
  if(algo==='ff') return lib[0]; // primero que quepa (orden en memoria)
  if(algo==='bf') return lib.reduce((a,b)=>a.tam<b.tam?a:b); // el más pequeño que quepa
  return lib.reduce((a,b)=>a.tam>b.tam?a:b); // wf: el más grande
}

function ejecutarMem(algo){
  if(!procesos.length){alert('Carga procesos primero.');return;}
  const total=parseInt(document.getElementById('mem-total').value)||1024;
  const fija=document.getElementById('chk-fija').checked;
  const tamPartes=Array.from(document.querySelectorAll('#part-list input')).map(i=>parseInt(i.value)||256);
  let asig=[], noAsig=[];

  if(fija){
    const sum=tamPartes.reduce((a,b)=>a+b,0);
    if(sum>total){alert(`Particiones (${sum}KB) > Memoria (${total}KB)`);return;}
    const bloques=tamPartes.map((t,i)=>({idx:i,tam:t,pid:null,usado:0}));
    for(const proc of procesos){
      if(!proc.tamano){noAsig.push({...proc,motivo:'Sin tamaño'});continue;}
      // lib: particiones libres que caben, en orden de memoria (para FF)
      const lib=bloques.filter(b=>!b.pid&&b.tam>=proc.tamano);
      const el=elegir(lib,algo);
      if(el){
        el.pid=proc.id; el.usado=proc.tamano;
        const base=tamPartes.slice(0,el.idx).reduce((a,b)=>a+b,0);
        asig.push({pid:proc.id,tam:proc.tamano,part:el.idx+1,base,limite:base+el.tam-1,fragInterna:el.tam-proc.tamano});
      } else noAsig.push({...proc,motivo:'Sin partición disponible'});
    }
    renderMapaFijo(bloques,tamPartes,total);
    const fragInt=asig.reduce((a,r)=>a+r.fragInterna,0);
    document.getElementById('m-frag').textContent=fragInt+' KB';
  } else {
    // Dinámica: simulamos huecos intermedios liberando procesos pares
    // para que haya múltiples huecos y los algoritmos difieran
    const mem=[{base:0,tam:total,pid:null}];
    for(const proc of procesos){
      if(!proc.tamano){noAsig.push({...proc,motivo:'Sin tamaño'});continue;}
      // lib en orden base (para FF respeta posición, BF/WF eligen por tamaño)
      const lib=mem.filter(b=>!b.pid&&b.tam>=proc.tamano)
                   .sort((a,b)=>a.base-b.base); // siempre orden posición base
      const el=elegir(lib,algo);
      if(el){
        const idx=mem.indexOf(el);
        const resto=el.tam-proc.tamano;
        const base=el.base;
        mem.splice(idx,1,{base,tam:proc.tamano,pid:proc.id});
        if(resto>0) mem.splice(idx+1,0,{base:base+proc.tamano,tam:resto,pid:null});
        asig.push({pid:proc.id,tam:proc.tamano,part:'Dyn',base,limite:base+proc.tamano-1});
      } else noAsig.push({...proc,motivo:'Sin espacio suficiente'});
    }
    renderMapaDin(mem,total);
    document.getElementById('m-frag').textContent='—';
  }

  const usada=asig.reduce((a,b)=>a+b.tam,0);
  document.getElementById('m-usada').textContent=usada;
  document.getElementById('m-libre').textContent=total-usada;
  document.getElementById('m-algo').textContent={ff:'First Fit',bf:'Best Fit',wf:'Worst Fit'}[algo];
  document.getElementById('m-asig').textContent=asig.length;
  document.getElementById('m-rech').textContent=noAsig.length;
  document.getElementById('mem-bar').textContent=`Usado: ${usada} KB | Libre: ${total-usada} KB | Total: ${total} KB`;

  // Advertencia si memoria muy grande y todos los procesos caben sin competencia
  if(!fija && total >= procesos.reduce((a,p)=>a+(p.tamano||0),0)*3){
    document.getElementById('mem-bar').textContent+=
      ' ⚠️ Memoria grande: los 3 algoritmos darán igual resultado. Reduce la memoria o usa Particiones Fijas para ver diferencias.';
  }

  const tb=document.getElementById('tbl-mem');
  tb.innerHTML=asig.length?asig.map(a=>`
    <tr><td class="pid">${a.pid}</td><td>${a.tam} KB</td><td>${a.part}</td>
    <td>${a.base}</td><td>${a.limite}</td><td style="color:#4caf50">Asignado</td></tr>`).join('')
    :'<tr><td colspan="6" style="text-align:center;color:#5a5a5a;padding:16px">Sin asignaciones.</td></tr>';

  const tb2=document.getElementById('tbl-noasig');
  tb2.innerHTML=noAsig.length?noAsig.map(p=>`
    <tr><td class="pid">${p.id}</td><td>${p.tamano||'?'} KB</td><td style="color:#f44336">${p.motivo}</td></tr>`).join('')
    :'<tr><td colspan="3" style="text-align:center;color:#5a5a5a;padding:16px">Sin rechazados.</td></tr>';
}

function animarBloquesMem(bloques){
  const el=document.getElementById('mem-visual');
  el.innerHTML='';
  bloques.forEach((b,i)=>{
    const div=document.createElement('div');
    div.className='mv-block animate-in';
    div.style.cssText=`flex:${b.flex};background:${b.bg};color:${b.color||'#fff'};animation-delay:${i*60}ms`;
    div.title=b.title;
    const fs=b.flex<0.08?'6px':b.flex<0.15?'7px':'8px';
    div.innerHTML=(b.label?`<span style="font-size:${fs};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:95%;text-align:center">${b.label}</span>`:'')
      +(b.sub?`<span style="font-size:${Math.max(5,parseInt(fs)-1)}px;opacity:.65;white-space:nowrap">${b.sub}</span>`:'');
    el.appendChild(div);
  });
}

// Color fijo por proceso, generado una sola vez y reutilizado
const PROC_COLORS={};
const COLOR_POOL=[
  '#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100',
  '#00695c','#4527a0','#ad1457','#0277bd','#558b2f',
  '#4e342e','#37474f','#f57f17','#00838f','#283593'
];
let colorIdx=0;
function getProcColor(pid){
  if(!PROC_COLORS[pid]) PROC_COLORS[pid]=COLOR_POOL[colorIdx++%COLOR_POOL.length];
  return PROC_COLORS[pid];
}

function renderMapaFijo(bloques,tams,total){
  animarBloquesMem(bloques.map((b,i)=>{
    if(b.pid)
      return{flex:b.tam/total,bg:getProcColor(b.pid)+'cc',title:`${b.pid} — Usado:${b.usado}KB / Part:${b.tam}KB`,label:b.pid,sub:b.usado+'KB/'+b.tam+'KB'};
    return{flex:b.tam/total,bg:'#1a2a1a',color:'#4caf5088',title:`Part.${i+1} LIBRE — ${b.tam}KB`,label:'LIBRE',sub:b.tam+'KB'};
  }));
}
function renderMapaDin(mem,total){
  animarBloquesMem(mem.map(b=>{
    if(b.pid)
      return{flex:b.tam/total,bg:getProcColor(b.pid)+'cc',title:`${b.pid} — ${b.tam}KB`,label:b.pid,sub:b.tam+'KB'};
    return{flex:b.tam/total,bg:'#1a2a1a',color:'#4caf5088',title:`Libre — ${b.tam}KB`,label:'LIBRE',sub:b.tam+'KB'};
  }));
}

function limpiarMem(){
  // reset colores de procesos para próxima ejecución
  Object.keys(PROC_COLORS).forEach(k=>delete PROC_COLORS[k]);
  colorIdx=0;
  document.getElementById('mem-visual').innerHTML='<div class="mv-block" style="width:100%;background:#1a2a1a;color:#3a5a3a">LIBRE</div>';
  document.getElementById('mem-bar').textContent='—';
  ['m-usada','m-libre','m-algo','m-frag'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('m-asig').textContent='0';
  document.getElementById('m-rech').textContent='0';
  document.getElementById('tbl-mem').innerHTML='<tr><td colspan="6" style="text-align:center;color:#5a5a5a;padding:16px">Sin asignaciones.</td></tr>';
  document.getElementById('tbl-noasig').innerHTML='<tr><td colspan="3" style="text-align:center;color:#5a5a5a;padding:16px">Sin rechazados.</td></tr>';
}