let DATA;

function fmtInt(n){ return n==null? '—' : n.toLocaleString('es-NI'); }
function fmtPct(n){ return n==null? '—' : n.toFixed(1)+'%'; }
function pctClass(n){ if(n==null) return ''; if(n>=95) return 'good'; if(n>=85) return 'warn'; return 'bad'; }
function barClass(n){ if(n==null) return ''; if(n>=95) return ''; if(n>=85) return 'warn'; return 'bad'; }

/* ---------------------------------------------------------
   Carga de datos: data.json debe estar en la misma carpeta.
   Si abres este archivo con doble clic (file://) el fetch
   puede ser bloqueado por el navegador; usa un servidor local
   (por ej. la extensión "Live Server" de VS Code).
--------------------------------------------------------- */
function showFatalError(msg){
  const box = document.createElement('div');
  box.style.cssText = 'max-width:900px;margin:40px auto;padding:20px 24px;background:#FCEBEA;border:1px solid #E5A9A1;border-radius:8px;color:#7A2E24;font-family:monospace;font-size:14px;white-space:pre-wrap;';
  box.textContent = '⚠ No se pudieron cargar los datos del dashboard.\n\n' + msg +
    '\n\nRevisa que "data.json" esté en la MISMA carpeta que "index.html", y que estés abriendo la página con un servidor local (Live Server / python -m http.server) y no con doble clic (file://).';
  document.body.prepend(box);
}

function showChartWarning(container, msg){
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:20px;color:#8A6D3B;font-size:13px;background:#FBF6EA;border:1px dashed #E3D4A8;border-radius:8px;">${msg}</div>`;
}

/* Intenta usar Chart.js del CDN principal; si no cargó (bloqueador de
   anuncios / Brave Shields), inyecta un CDN alterno (jsDelivr) y espera
   un poco antes de rendirse. Nunca lanza una excepción que detenga el
   resto del dashboard: solo resuelve true/false. */
function ensureChartJs(timeoutMs = 4000){
  return new Promise(resolve=>{
    if(typeof Chart !== 'undefined') return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
    let done = false;
    const finish = (ok)=>{ if(done) return; done = true; resolve(ok); };
    script.onload = ()=> finish(typeof Chart !== 'undefined');
    script.onerror = ()=> finish(false);
    document.head.appendChild(script);
    setTimeout(()=> finish(typeof Chart !== 'undefined'), timeoutMs);
  });
}

async function initDashboard(){
 try {
  const res = await fetch('data.json');
  if(!res.ok){
    throw new Error(`No se encontró data.json (HTTP ${res.status}). Verifica que el archivo esté junto a index.html.`);
  }
  DATA = await res.json();

  document.getElementById('genDate').textContent = 'Generado: ' + new Date().toLocaleDateString('es-NI', {year:'numeric',month:'long',day:'numeric'});
  
  /* ---------- HERO STATS ---------- */
  const m = DATA.municipio;
  document.getElementById('heroStats').innerHTML = `
    <div class="hero-stat"><div class="num">${fmtInt(m.MA)}</div><div class="lbl">Matrícula Actual</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.Permanencia)}</div><div class="lbl">Permanencia</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.Aprobacion)}</div><div class="lbl">Aprobación</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.AsisEstudiante)}</div><div class="lbl">Asist. Estudiantil</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.AsisDocente)}</div><div class="lbl">Asist. Docente</div></div>
  `;
  
  document.getElementById('tagCentros').textContent = `${m.NumCentros} centros · ${m.NumNER} NER`;
  
  /* ---------- KPI GRID ---------- */
  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi"><div class="kpi-label">Matrícula Inicial</div><div class="kpi-value">${fmtInt(m.MI)}</div><div class="kpi-sub">al inicio del periodo</div></div>
    <div class="kpi"><div class="kpi-label">Matrícula Actual</div><div class="kpi-value">${fmtInt(m.MA)}</div><div class="kpi-sub">estudiantes activos</div></div>
    <div class="kpi gold"><div class="kpi-label">Permanencia</div><div class="kpi-value">${fmtPct(m.Permanencia)}</div><div class="kpi-sub">MA ÷ MI</div></div>
    <div class="kpi gold"><div class="kpi-label">Aprobación</div><div class="kpi-value">${fmtPct(m.Aprobacion)}</div><div class="kpi-sub">${fmtInt(m.APR)} aprobados</div></div>
    <div class="kpi bad"><div class="kpi-label">Total Reprobados</div><div class="kpi-value">${fmtInt(m.TotalRep)}</div><div class="kpi-sub">${fmtPct(m.Reprobacion)} de la matrícula</div></div>
    <div class="kpi"><div class="kpi-label">Asist. Estudiante / Docente</div><div class="kpi-value">${fmtPct(m.AsisEstudiante)} <small>/ ${fmtPct(m.AsisDocente)}</small></div><div class="kpi-sub">promedio ene–jul 2026</div></div>
  `;
  
  /* ---------- CHARTS (no bloqueante: si falla, el resto del dashboard sigue) ---------- */
  const chartsOk = await ensureChartJs();
  if(!chartsOk){
    showChartWarning(document.getElementById('chartTrend').parentElement,
      '⚠ No se pudo cargar Chart.js (bloqueador de anuncios / Brave Shields). El resto del dashboard funciona con normalidad. Desactiva el bloqueador para este sitio y recarga para ver los gráficos.');
    showChartWarning(document.getElementById('chartPrograma').parentElement,
      '⚠ No se pudo cargar Chart.js. Ver aviso del panel anterior.');
  } else {
    Chart.defaults.font.family = "'Inter',sans-serif";
    Chart.defaults.color = '#5B6B72';

    new Chart(document.getElementById('chartTrend'), {
      type:'line',
      data:{
        labels: DATA.tendencia_mensual.map(d=>d.mes),
        datasets:[
          {label:'Estudiantes', data: DATA.tendencia_mensual.map(d=>d.estudiante), borderColor:'#2F7C74', backgroundColor:'rgba(47,124,116,.12)', tension:.35, fill:true, pointRadius:3},
          {label:'Docentes', data: DATA.tendencia_mensual.map(d=>d.docente), borderColor:'#D9A441', backgroundColor:'rgba(217,164,65,.10)', tension:.35, fill:true, pointRadius:3}
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ y:{ min:70, max:100, grid:{color:'#EEEAE0'}, ticks:{callback:v=>v+'%'} }, x:{grid:{display:false}} },
        plugins:{ legend:{position:'bottom', labels:{boxWidth:10, usePointStyle:true}} }
      }
    });

    const progLabels = DATA.programa_muni.map(p=>p.Programa);
    new Chart(document.getElementById('chartPrograma'), {
      type:'bar',
      data:{
        labels: progLabels,
        datasets:[
          {label:'Permanencia %', data: DATA.programa_muni.map(p=>p.Permanencia), backgroundColor:'#2F7C74', borderRadius:4},
          {label:'Aprobación %', data: DATA.programa_muni.map(p=>p.Aprobacion), backgroundColor:'#D9A441', borderRadius:4}
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false, indexAxis:'y',
        scales:{ x:{min:0,max:100, grid:{color:'#EEEAE0'}, ticks:{callback:v=>v+'%'}}, y:{grid:{display:false}} },
        plugins:{ legend:{position:'bottom', labels:{boxWidth:10, usePointStyle:true}} }
      }
    });
  }
  
  /* ---------- NER COMPARISON TABLE ---------- */
  let nerSort = {key:'MA', asc:false};
  function renderNerTable(){
    const rows = [...DATA.ner_list].sort((a,b)=>{
      let va=a[nerSort.key], vb=b[nerSort.key];
      if(typeof va === 'string') return nerSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      va = va==null?-Infinity:va; vb=vb==null?-Infinity:vb;
      return nerSort.asc ? va-vb : vb-va;
    });
    document.getElementById('nerTableBody').innerHTML = rows.map(r=>`
      <tr data-ner="${r.NER}">
        <td style="font-weight:600;color:var(--navy)">${r.NER}</td>
        <td>${r.NumCentros}</td>
        <td>${fmtInt(r.MI)}</td>
        <td>${fmtInt(r.MA)}</td>
        <td><span class="pct ${pctClass(r.Permanencia)}">${fmtPct(r.Permanencia)}</span></td>
        <td><span class="pct ${pctClass(r.Aprobacion)}">${fmtPct(r.Aprobacion)}</span></td>
        <td>${fmtInt(r.TotalRep)}</td>
        <td><span class="pct ${pctClass(r.AsisEstudiante)}">${fmtPct(r.AsisEstudiante)}</span></td>
        <td><span class="pct ${pctClass(r.AsisDocente)}">${fmtPct(r.AsisDocente)}</span></td>
      </tr>`).join('');
    document.querySelectorAll('#nerTable th').forEach(th=>{
      th.classList.remove('sorted','sorted-asc');
      if(th.dataset.key===nerSort.key) th.classList.add(nerSort.asc?'sorted-asc':'sorted');
    });
    document.querySelectorAll('#nerTableBody tr').forEach(tr=>{
      tr.addEventListener('click', ()=> selectNer(tr.dataset.ner));
    });
  }
  document.querySelectorAll('#nerTable th').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.dataset.key;
      if(nerSort.key===key) nerSort.asc = !nerSort.asc; else {nerSort.key=key; nerSort.asc=false;}
      renderNerTable();
    });
  });
  renderNerTable();
  
  /* ---------- NER PICKER + DETAIL ---------- */
  const nerNames = DATA.ner_list.map(n=>n.NER).sort();
  document.getElementById('nerPicker').innerHTML = nerNames.map(n=>`<span class="ner-chip" id="chip-${n.replace(/[^a-zA-Z0-9]/g,'_')}" data-ner="${n}">${n}</span>`).join('');
  document.querySelectorAll('.ner-chip').forEach(chip=>{
    chip.addEventListener('click', ()=> selectNer(chip.dataset.ner));
  });
  
  let centroSort = {key:'MA', asc:false};
  let currentNer = null;
  
  function selectNer(ner){
    currentNer = ner;
    document.querySelectorAll('.ner-chip').forEach(c=>c.classList.remove('active'));
    const chip = document.getElementById('chip-'+ner.replace(/[^a-zA-Z0-9]/g,'_'));
    if(chip) chip.classList.add('active');
  
    const info = DATA.ner_list.find(n=>n.NER===ner);
    document.getElementById('detailTitle').textContent = ner;
    document.getElementById('detailSub').textContent = `${info.NumCentros} centros escolares · NER`;
    document.getElementById('detailKpis').innerHTML = `
      <div class="detail-kpi"><div class="v">${fmtInt(info.MA)}</div><div class="l">Matrícula</div></div>
      <div class="detail-kpi"><div class="v">${fmtPct(info.Permanencia)}</div><div class="l">Permanencia</div></div>
      <div class="detail-kpi"><div class="v">${fmtPct(info.Aprobacion)}</div><div class="l">Aprobación</div></div>
      <div class="detail-kpi"><div class="v">${fmtInt(info.TotalRep)}</div><div class="l">Reprobados</div></div>
      <div class="detail-kpi"><div class="v">${fmtPct(info.AsisEstudiante)}</div><div class="l">Asist. Est.</div></div>
      <div class="detail-kpi"><div class="v">${fmtPct(info.AsisDocente)}</div><div class="l">Asist. Doc.</div></div>
    `;
    renderCentroTable();
    document.getElementById('detalle').scrollIntoView({behavior:'smooth', block:'start'});
  }
  
  function renderCentroTable(){
    if(!currentNer) return;
    const list = DATA.centros_por_ner[currentNer] || [];
    const rows = [...list].sort((a,b)=>{
      let va=a[centroSort.key], vb=b[centroSort.key];
      if(Array.isArray(va)) { va = va.join(','); vb = vb.join(','); }
      if(typeof va === 'string') return centroSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      va = va==null?-Infinity:va; vb=vb==null?-Infinity:vb;
      return centroSort.asc ? va-vb : vb-va;
    });
    document.getElementById('centroTableBody').innerHTML = rows.map(r=>`
      <tr>
        <td style="font-weight:600;color:var(--navy)">${r.Centro}</td>
        <td style="font-size:11.5px;color:var(--ink-soft)">${r.Programas.join(', ')}</td>
        <td>${fmtInt(r.MI)}</td>
        <td>${fmtInt(r.MA)}</td>
        <td>${fmtInt(r.APR)}</td>
        <td>${fmtInt(r.Rep1)}</td>
        <td>${fmtInt(r.Rep2)}</td>
        <td>${fmtInt(r.Rep3mas)}</td>
        <td><span class="pct ${pctClass(r.Permanencia)}">${fmtPct(r.Permanencia)}</span></td>
        <td><span class="pct ${pctClass(r.Aprobacion)}">${fmtPct(r.Aprobacion)}</span></td>
        <td><span class="pct ${pctClass(r.AsisEstudiante)}">${fmtPct(r.AsisEstudiante)}</span></td>
        <td><span class="pct ${pctClass(r.AsisDocente)}">${fmtPct(r.AsisDocente)}</span></td>
      </tr>`).join('');
    document.querySelectorAll('#centroTable th').forEach(th=>{
      th.classList.remove('sorted','sorted-asc');
      if(th.dataset.key===centroSort.key) th.classList.add(centroSort.asc?'sorted-asc':'sorted');
    });
  }
  document.querySelectorAll('#centroTable th').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.dataset.key;
      if(centroSort.key===key) centroSort.asc = !centroSort.asc; else {centroSort.key=key; centroSort.asc=false;}
      renderCentroTable();
    });
  });
  
  // select first NER by default
  selectNer(nerNames[0]);
  
  /* ---------- RANKINGS ---------- */
  function rankItem(r, metricKey){
    return `<li>
      <div>
        <div class="rank-name">${r.Centro}</div>
        <div class="rank-meta">${r.NER} · M.Actual ${fmtInt(r.MA)}</div>
      </div>
      <span class="pct ${pctClass(r[metricKey])}">${fmtPct(r[metricKey])}</span>
    </li>`;
  }
  document.getElementById('topAprob').innerHTML = DATA.top_aprobacion.map(r=>rankItem(r,'Aprobacion')).join('');
  document.getElementById('bottomAprob').innerHTML = DATA.bottom_aprobacion.map(r=>rankItem(r,'Aprobacion')).join('');
  document.getElementById('topPerm').innerHTML = DATA.top_permanencia.map(r=>rankItem(r,'Permanencia')).join('');
  document.getElementById('bottomPerm').innerHTML = DATA.bottom_permanencia.map(r=>rankItem(r,'Permanencia')).join('');
  
 } catch(err){
  console.error('Error al iniciar el dashboard:', err);
  showFatalError(err.message);
 }
}

initDashboard();
