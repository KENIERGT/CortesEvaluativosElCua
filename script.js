let DATA;
let currentCorte = 'i_corte'; // 'i_corte' | 'ii_corte'
let charts = {};

function fmtInt(n){ return (n==null || Number.isNaN(n))? '—' : Math.round(n).toLocaleString('es-NI'); }
function fmtPct(n){ return (n==null || Number.isNaN(n))? '—' : n.toFixed(1)+'%'; }
function pctClass(n){ if(n==null) return ''; if(n>=95) return 'good'; if(n>=85) return 'warn'; return 'bad'; }
function retiroClass(n){ if(n==null) return ''; if(n<=3) return 'good'; if(n<=8) return 'warn'; return 'bad'; }

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

function destroyChart(key){
  if(charts[key]){ charts[key].destroy(); delete charts[key]; }
}

/* ---------------------------------------------------------
   Carga de datos
--------------------------------------------------------- */
async function initDashboard(){
 try {
  const res = await fetch('data.json');
  if(!res.ok){
    throw new Error(`No se encontró data.json (HTTP ${res.status}). Verifica que el archivo esté junto a index.html.`);
  }
  DATA = await res.json();

  document.getElementById('genDate').textContent = 'Generado: ' + new Date().toLocaleDateString('es-NI', {year:'numeric',month:'long',day:'numeric'});

  const chartsOk = await ensureChartJs();
  window.__chartsOk = chartsOk;
  if(chartsOk){
    Chart.defaults.font.family = "'Inter',sans-serif";
    Chart.defaults.color = '#5B6B72';
  }

  document.getElementById('corteSelect').addEventListener('change', (e)=>{
    currentCorte = e.target.value;
    renderAll();
  });

  renderAll();

 } catch(err){
  console.error('Error al iniciar el dashboard:', err);
  showFatalError(err.message);
 }
}

function renderAll(){
  const C = DATA[currentCorte];
  const label = currentCorte === 'i_corte' ? 'I Corte' : 'II Corte';
  const periodo = currentCorte === 'i_corte' ? DATA.meta.meses_i_corte : DATA.meta.meses_ii_corte;

  renderHero(C, label, periodo);
  renderKpis(C, label);
  renderTrendChart(C);
  renderProgramaChart(C);
  renderGrado(C);
  renderModalidad(C);
  renderAsignaturas();
  renderNerTable(C);
  renderRetirosNerChart(C);
  renderNerPickerAndDetail(C);
  renderTopGeneral(C);
  renderRankings(C);
  renderRetiros();
}

/* ==================================================================
   HERO + KPIs
================================================================== */
function renderHero(C, label, periodo){
  document.getElementById('heroTitle').innerHTML = `Análisis Estadístico Educativo<br>${label} 2026`;
  document.getElementById('heroSub').textContent = `Permanencia, aprobación y asistencia de estudiantes y docentes en los ${C.municipio.NumNER} Núcleos Educativos Rurales (NER) y ${C.municipio.NumCentros} centros escolares del municipio · ${periodo}.`;
  document.getElementById('resumenTitle').textContent = `Panorama Municipal — ${label}`;
  document.getElementById('resumenNote').textContent = `Indicadores consolidados de los ${C.municipio.NumCentros} centros educativos del municipio para el ${label} 2026.`;
  document.getElementById('graficosNote').textContent = `Asistencia mensual (${periodo}) y desempeño por programa educativo — ${label}.`;
  document.getElementById('gradoNote').textContent = `Reprobación y retiros por grado (Programa + Nivel) en el ${label} — para identificar en qué grados se concentran más problemas.`;

  const m = C.municipio;
  document.getElementById('heroStats').innerHTML = `
    <div class="hero-stat"><div class="num">${fmtInt(m.MA)}</div><div class="lbl">Matrícula Actual</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.Permanencia)}</div><div class="lbl">Permanencia</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.Aprobacion)}</div><div class="lbl">Aprobación</div></div>
    <div class="hero-stat"><div class="num">${fmtInt(m.Retiros)}</div><div class="lbl">Retiros del Corte</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.AsisEstudiante)}</div><div class="lbl">Asist. Estudiantil</div></div>
  `;
  document.getElementById('tagCentros').textContent = `${m.NumCentros} centros · ${m.NumNER} NER`;
}

function renderKpis(C, label){
  const m = C.municipio;
  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi"><div class="kpi-label">Matrícula Inicial</div><div class="kpi-value">${fmtInt(m.MI)}</div><div class="kpi-sub">al inicio del periodo</div></div>
    <div class="kpi"><div class="kpi-label">Matrícula Actual</div><div class="kpi-value">${fmtInt(m.MA)}</div><div class="kpi-sub">estudiantes activos</div></div>
    <div class="kpi gold"><div class="kpi-label">Permanencia</div><div class="kpi-value">${fmtPct(m.Permanencia)}</div><div class="kpi-sub">MA ÷ MI</div></div>
    <div class="kpi gold"><div class="kpi-label">Aprobación</div><div class="kpi-value">${fmtPct(m.Aprobacion)}</div><div class="kpi-sub">${fmtInt(m.APR)} aprobados</div></div>
    <div class="kpi bad"><div class="kpi-label">Retiros del Corte</div><div class="kpi-value">${fmtInt(m.Retiros)}</div><div class="kpi-sub">${fmtPct(m.TasaRetiro)} de la matrícula inicial</div></div>
    <div class="kpi"><div class="kpi-label">Asist. Estudiante / Docente</div><div class="kpi-value">${fmtPct(m.AsisEstudiante)} <small>/ ${fmtPct(m.AsisDocente)}</small></div><div class="kpi-sub">promedio del ${label}</div></div>
  `;
}

/* ==================================================================
   GRAFICOS PRINCIPALES
================================================================== */
function renderTrendChart(C){
  destroyChart('trend');
  const holder = document.getElementById('chartTrend').parentElement;
  if(!window.__chartsOk){ showChartWarning(holder, '⚠ No se pudo cargar Chart.js (bloqueador de anuncios / Brave Shields). Desactiva el bloqueador para este sitio y recarga para ver los gráficos.'); return; }
  holder.innerHTML = '<canvas id="chartTrend"></canvas>';
  charts.trend = new Chart(document.getElementById('chartTrend'), {
    type:'line',
    data:{
      labels: C.tendencia_mensual.map(d=>d.mes),
      datasets:[
        {label:'Estudiantes', data: C.tendencia_mensual.map(d=>d.estudiante), borderColor:'#2F7C74', backgroundColor:'rgba(47,124,116,.12)', tension:.35, fill:true, pointRadius:3},
        {label:'Docentes', data: C.tendencia_mensual.map(d=>d.docente), borderColor:'#D9A441', backgroundColor:'rgba(217,164,65,.10)', tension:.35, fill:true, pointRadius:3}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{ y:{ min:50, max:100, grid:{color:'#EEEAE0'}, ticks:{callback:v=>v+'%'} }, x:{grid:{display:false}} },
      plugins:{ legend:{position:'bottom', labels:{boxWidth:10, usePointStyle:true}} }
    }
  });
}

function renderProgramaChart(C){
  destroyChart('programa');
  const holder = document.getElementById('chartPrograma').parentElement;
  if(!window.__chartsOk){ showChartWarning(holder, '⚠ No se pudo cargar Chart.js.'); return; }
  holder.innerHTML = '<canvas id="chartPrograma"></canvas>';
  const progLabels = C.programa_muni.map(p=>p.Programa);
  charts.programa = new Chart(document.getElementById('chartPrograma'), {
    type:'bar',
    data:{
      labels: progLabels,
      datasets:[
        {label:'Permanencia %', data: C.programa_muni.map(p=>p.Permanencia), backgroundColor:'#2F7C74', borderRadius:4},
        {label:'Aprobación %', data: C.programa_muni.map(p=>p.Aprobacion), backgroundColor:'#D9A441', borderRadius:4}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      scales:{ x:{min:0,max:100, grid:{color:'#EEEAE0'}, ticks:{callback:v=>v+'%'}}, y:{grid:{display:false}} },
      plugins:{ legend:{position:'bottom', labels:{boxWidth:10, usePointStyle:true}} }
    }
  });
}

/* ==================================================================
   ANALISIS POR GRADO
================================================================== */
function renderGrado(C){
  const rows = C.grado_muni;

  destroyChart('gradoReprob');
  const h1 = document.getElementById('chartGradoReprob').parentElement;
  if(!window.__chartsOk){ showChartWarning(h1, '⚠ No se pudo cargar Chart.js.'); }
  else {
    h1.innerHTML = '<canvas id="chartGradoReprob"></canvas>';
    charts.gradoReprob = new Chart(document.getElementById('chartGradoReprob'), {
      type:'bar',
      data:{
        labels: rows.map(r=>r.Grado),
        datasets:[{ label:'% Reprobación', data: rows.map(r=>r.Reprobacion), backgroundColor:'#B4453A', borderRadius:4 }]
      },
      options:{
        responsive:true, maintainAspectRatio:false, indexAxis:'y',
        scales:{ x:{ grid:{color:'#EEEAE0'}, beginAtZero:true, ticks:{callback:v=>v+'%'} }, y:{grid:{display:false}, ticks:{font:{size:10.5}}} },
        plugins:{ legend:{display:false} }
      }
    });
  }

  destroyChart('gradoRetiros');
  const h2 = document.getElementById('chartGradoRetiros').parentElement;
  if(!window.__chartsOk){ showChartWarning(h2, '⚠ No se pudo cargar Chart.js.'); }
  else {
    h2.innerHTML = '<canvas id="chartGradoRetiros"></canvas>';
    charts.gradoRetiros = new Chart(document.getElementById('chartGradoRetiros'), {
      type:'bar',
      data:{
        labels: rows.map(r=>r.Grado),
        datasets:[{ label:'Retiros', data: rows.map(r=>r.Retiros), backgroundColor:'#D9A441', borderRadius:4 }]
      },
      options:{
        responsive:true, maintainAspectRatio:false, indexAxis:'y',
        scales:{ x:{ grid:{color:'#EEEAE0'}, beginAtZero:true }, y:{grid:{display:false}, ticks:{font:{size:10.5}}} },
        plugins:{ legend:{display:false} }
      }
    });
  }

  let gradoSort = {key:'TotalRep', asc:false};
  function draw(){
    const sorted = [...rows].sort((a,b)=>{
      let va=a[gradoSort.key], vb=b[gradoSort.key];
      if(typeof va === 'string') return gradoSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      va = va==null?-Infinity:va; vb=vb==null?-Infinity:vb;
      return gradoSort.asc ? va-vb : vb-va;
    });
    document.getElementById('gradoTableBody').innerHTML = sorted.map(r=>`
      <tr>
        <td style="font-weight:600;color:var(--navy)">${r.Grado}</td>
        <td>${fmtInt(r.MI)}</td>
        <td>${fmtInt(r.MA)}</td>
        <td><span class="pct ${retiroClass(r.TasaRetiro)}">${fmtInt(r.Retiros)}</span></td>
        <td>${fmtPct(r.TasaRetiro)}</td>
        <td>${fmtInt(r.TotalRep)}</td>
        <td><span class="pct ${r.Reprobacion>10?'bad':(r.Reprobacion>5?'warn':'good')}">${fmtPct(r.Reprobacion)}</span></td>
        <td><span class="pct ${pctClass(r.Aprobacion)}">${fmtPct(r.Aprobacion)}</span></td>
      </tr>`).join('');
    document.querySelectorAll('#gradoTable th').forEach(th=>{
      th.classList.remove('sorted','sorted-asc');
      if(th.dataset.key===gradoSort.key) th.classList.add(gradoSort.asc?'sorted-asc':'sorted');
    });
  }
  document.querySelectorAll('#gradoTable th').forEach(th=>{
    th.onclick = ()=>{
      const key = th.dataset.key;
      if(gradoSort.key===key) gradoSort.asc = !gradoSort.asc; else {gradoSort.key=key; gradoSort.asc=false;}
      draw();
    };
  });
  draw();
}

/* ==================================================================
   ANALISIS POR MODALIDAD
================================================================== */
function renderModalidad(C){
  const rows = C.modalidad_muni;
  let modSort = {key:'MA', asc:false};
  function draw(){
    const sorted = [...rows].sort((a,b)=>{
      let va=a[modSort.key], vb=b[modSort.key];
      if(typeof va === 'string') return modSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      va = va==null?-Infinity:va; vb=vb==null?-Infinity:vb;
      return modSort.asc ? va-vb : vb-va;
    });
    document.getElementById('modalidadTableBody').innerHTML = sorted.map(r=>`
      <tr>
        <td style="font-weight:600;color:var(--navy)">${r.Modalidad}</td>
        <td>${fmtInt(r.MI)}</td>
        <td>${fmtInt(r.MA)}</td>
        <td><span class="pct ${pctClass(r.Permanencia)}">${fmtPct(r.Permanencia)}</span></td>
        <td>${fmtInt(r.Retiros)}</td>
        <td>${fmtInt(r.TotalRep)}</td>
        <td><span class="pct ${r.Reprobacion>10?'bad':(r.Reprobacion>5?'warn':'good')}">${fmtPct(r.Reprobacion)}</span></td>
        <td><span class="pct ${pctClass(r.Aprobacion)}">${fmtPct(r.Aprobacion)}</span></td>
      </tr>`).join('');
    document.querySelectorAll('#modalidadTable th').forEach(th=>{
      th.classList.remove('sorted','sorted-asc');
      if(th.dataset.key===modSort.key) th.classList.add(modSort.asc?'sorted-asc':'sorted');
    });
  }
  document.querySelectorAll('#modalidadTable th').forEach(th=>{
    th.onclick = ()=>{
      const key = th.dataset.key;
      if(modSort.key===key) modSort.asc = !modSort.asc; else {modSort.key=key; modSort.asc=false;}
      draw();
    };
  });
  draw();
}

/* ==================================================================
   ASIGNATURAS MAS REPROBADAS
================================================================== */
function renderAsignaturas(){
  const CR = DATA.clases_reprobadas;
  let dataset, titleSuffix, note;
  if(currentCorte === 'i_corte'){
    dataset = CR.i_corte_por_asignatura;
    titleSuffix = '— I Corte';
    note = `Total de estudiantes con al menos una asignatura reprobada en el I Corte: ${fmtInt(CR.estudiantes_con_reprobadas_i)}. Un mismo estudiante puede aparecer en más de una asignatura si reprobó varias.`;
  } else {
    dataset = CR.ii_corte_por_asignatura;
    titleSuffix = '— II Corte';
    note = `Total de estudiantes con al menos una asignatura reprobada en el II Corte: ${fmtInt(CR.estudiantes_con_reprobadas_ii)}. Un mismo estudiante puede aparecer en más de una asignatura si reprobó varias.`;
  }

  document.getElementById('asigChartTitle').textContent = `Estudiantes Reprobados por Asignatura ${titleSuffix}`;
  document.getElementById('asigNote').textContent = note;

  destroyChart('asignaturas');
  const holder = document.getElementById('chartAsignaturas').parentElement;
  if(!window.__chartsOk){ showChartWarning(holder, '⚠ No se pudo cargar Chart.js.'); return; }
  holder.innerHTML = '<canvas id="chartAsignaturas"></canvas>';

  const top = dataset.slice(0, 12);
  charts.asignaturas = new Chart(document.getElementById('chartAsignaturas'), {
    type:'bar',
    data:{
      labels: top.map(d=>d.Asignatura),
      datasets:[{ label:'Estudiantes reprobados', data: top.map(d=>d.Total), backgroundColor:'#B4453A', borderRadius:4 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      scales:{ x:{ grid:{color:'#EEEAE0'}, beginAtZero:true }, y:{grid:{display:false}} },
      plugins:{ legend:{display:false} }
    }
  });
}

/* ==================================================================
   TABLA NER (incluye retiros) + GRAFICO RETIROS POR NER
================================================================== */
let nerSort = {key:'MA', asc:false};
function renderNerTable(C){
  function draw(){
    const rows = [...C.ner_list].sort((a,b)=>{
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
        <td>${fmtInt(r.Retiros)}</td>
        <td><span class="pct ${pctClass(r.AsisEstudiante)}">${fmtPct(r.AsisEstudiante)}</span></td>
        <td><span class="pct ${pctClass(r.AsisDocente)}">${fmtPct(r.AsisDocente)}</span></td>
      </tr>`).join('');
    document.querySelectorAll('#nerTable th').forEach(th=>{
      th.classList.remove('sorted','sorted-asc');
      if(th.dataset.key===nerSort.key) th.classList.add(nerSort.asc?'sorted-asc':'sorted');
    });
    document.querySelectorAll('#nerTableBody tr').forEach(tr=>{
      tr.addEventListener('click', ()=> selectNer(C, tr.dataset.ner));
    });
  }
  document.querySelectorAll('#nerTable th').forEach(th=>{
    th.onclick = ()=>{
      const key = th.dataset.key;
      if(nerSort.key===key) nerSort.asc = !nerSort.asc; else {nerSort.key=key; nerSort.asc=false;}
      draw();
    };
  });
  draw();
}

function renderRetirosNerChart(C){
  destroyChart('retirosNer');
  const holder = document.getElementById('chartRetirosNer').parentElement;
  if(!window.__chartsOk){ showChartWarning(holder, '⚠ No se pudo cargar Chart.js.'); return; }
  holder.innerHTML = '<canvas id="chartRetirosNer"></canvas>';
  const rows = C.ner_retiros;
  charts.retirosNer = new Chart(document.getElementById('chartRetirosNer'), {
    type:'bar',
    data:{
      labels: rows.map(r=>r.NER),
      datasets:[{ label:'Retiros', data: rows.map(r=>r.Retiros), backgroundColor:'#D9A441', borderRadius:4 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      scales:{ x:{ grid:{color:'#EEEAE0'}, beginAtZero:true }, y:{grid:{display:false}, ticks:{font:{size:10.5}}} },
      plugins:{ legend:{display:false} }
    }
  });
}

/* ==================================================================
   DETALLE POR NER
================================================================== */
let centroSort = {key:'MA', asc:false};
let currentNer = null;

function renderNerPickerAndDetail(C){
  const nerNames = C.ner_list.map(n=>n.NER).sort();
  document.getElementById('nerPicker').innerHTML = nerNames.map(n=>`<span class="ner-chip" id="chip-${n.replace(/[^a-zA-Z0-9]/g,'_')}" data-ner="${n}">${n}</span>`).join('');
  document.querySelectorAll('.ner-chip').forEach(chip=>{
    chip.addEventListener('click', ()=> selectNer(C, chip.dataset.ner));
  });
  const target = (currentNer && nerNames.includes(currentNer)) ? currentNer : nerNames[0];
  selectNer(C, target);
}

function selectNer(C, ner){
  currentNer = ner;
  document.querySelectorAll('.ner-chip').forEach(c=>c.classList.remove('active'));
  const chip = document.getElementById('chip-'+ner.replace(/[^a-zA-Z0-9]/g,'_'));
  if(chip) chip.classList.add('active');

  const info = C.ner_list.find(n=>n.NER===ner);
  if(!info) return;
  document.getElementById('detailTitle').textContent = ner;
  document.getElementById('detailSub').textContent = `${info.NumCentros} centros escolares · NER`;
  document.getElementById('detailKpis').innerHTML = `
    <div class="detail-kpi"><div class="v">${fmtInt(info.MA)}</div><div class="l">Matrícula</div></div>
    <div class="detail-kpi"><div class="v">${fmtPct(info.Permanencia)}</div><div class="l">Permanencia</div></div>
    <div class="detail-kpi"><div class="v">${fmtPct(info.Aprobacion)}</div><div class="l">Aprobación</div></div>
    <div class="detail-kpi"><div class="v">${fmtInt(info.Retiros)}</div><div class="l">Retiros</div></div>
    <div class="detail-kpi"><div class="v">${fmtInt(info.TotalRep)}</div><div class="l">Reprobados</div></div>
    <div class="detail-kpi"><div class="v">${fmtPct(info.AsisEstudiante)}</div><div class="l">Asist. Est.</div></div>
  `;
  renderCentroTable(C, ner);
}

function renderCentroTable(C, ner){
  function draw(){
    const list = C.centros_por_ner[ner] || [];
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
        <td>${fmtInt(r.Retiros)}</td>
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
    th.onclick = ()=>{
      const key = th.dataset.key;
      if(centroSort.key===key) centroSort.asc = !centroSort.asc; else {centroSort.key=key; centroSort.asc=false;}
      draw();
    };
  });
  draw();
}

/* ==================================================================
   TOP GENERAL + RANKINGS
================================================================== */
function renderTopGeneral(C){
  function item(r){
    return `<li>
      <div>
        <div class="rank-name">${r.Centro}</div>
        <div class="rank-meta">${r.NER} · Apr ${fmtPct(r.Aprobacion)} · Perm ${fmtPct(r.Permanencia)} · M.Actual ${fmtInt(r.MA)}</div>
      </div>
      <span class="pct ${pctClass(r.Indice)}">${fmtPct(r.Indice)}</span>
    </li>`;
  }
  document.getElementById('topGeneralTop').innerHTML = C.top_general.map(item).join('');
  document.getElementById('topGeneralBottom').innerHTML = C.bottom_general.map(item).join('');
}

function rankItem(r, metricKey){
  return `<li>
    <div>
      <div class="rank-name">${r.Centro}</div>
      <div class="rank-meta">${r.NER} · M.Actual ${fmtInt(r.MA)}</div>
    </div>
    <span class="pct ${pctClass(r[metricKey])}">${fmtPct(r[metricKey])}</span>
  </li>`;
}

function renderRankings(C){
  document.getElementById('topAprob').innerHTML = C.top_aprobacion.map(r=>rankItem(r,'Aprobacion')).join('');
  document.getElementById('bottomAprob').innerHTML = C.bottom_aprobacion.map(r=>rankItem(r,'Aprobacion')).join('');
  document.getElementById('topPerm').innerHTML = C.top_permanencia.map(r=>rankItem(r,'Permanencia')).join('');
  document.getElementById('bottomPerm').innerHTML = C.bottom_permanencia.map(r=>rankItem(r,'Permanencia')).join('');
}

/* ==================================================================
   CAUSAS DE RETIRO (dato único, no varía por corte)
================================================================== */
function renderRetiros(){
  const R = DATA.causas_retiro;
  document.getElementById('tagRetiros').textContent = `${fmtInt(R.total)} retiros registrados`;

  destroyChart('retiros');
  const holder = document.getElementById('chartRetiros').parentElement;
  if(!window.__chartsOk){ showChartWarning(holder, '⚠ No se pudo cargar Chart.js.'); return; }
  holder.innerHTML = '<canvas id="chartRetiros"></canvas>';

  const top = R.lista.slice(0, 12);
  charts.retiros = new Chart(document.getElementById('chartRetiros'), {
    type:'bar',
    data:{
      labels: top.map(d=>d.Causa),
      datasets:[{ label:'Estudiantes retirados', data: top.map(d=>d.Total), backgroundColor:'#D9A441', borderRadius:4 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      scales:{ x:{ grid:{color:'#EEEAE0'}, beginAtZero:true }, y:{grid:{display:false}} },
      plugins:{ legend:{display:false} }
    }
  });
}

initDashboard();
