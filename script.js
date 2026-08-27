let DATA;
let currentCorte = 'i_corte'; // 'i_corte' | 'ii_corte' | 'comparativo'
let charts = {}; // referencias a instancias Chart.js activas, para destruir al recrear

function fmtInt(n){ return (n==null || Number.isNaN(n))? '—' : Math.round(n).toLocaleString('es-NI'); }
function fmtPct(n){ return (n==null || Number.isNaN(n))? '—' : n.toFixed(1)+'%'; }
function fmtDelta(n){ if(n==null || Number.isNaN(n)) return '—'; const s = n>0?'+':''; return s+n.toFixed(1)+' pp'; }
function pctClass(n){ if(n==null) return ''; if(n>=95) return 'good'; if(n>=85) return 'warn'; return 'bad'; }
function deltaClass(n){ if(n==null) return ''; if(n>0) return 'good'; if(n<0) return 'bad'; return 'warn'; }

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
  if(!chartsOk){
    console.warn('Chart.js no cargó; los gráficos mostrarán aviso.');
  } else {
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

/* ---------------------------------------------------------
   Render maestro: decide layout según el corte seleccionado
--------------------------------------------------------- */
function renderAll(){
  const isComparativo = currentCorte === 'comparativo';
  document.querySelectorAll('.only-comparativo').forEach(el=> el.style.display = isComparativo ? '' : 'none');
  document.querySelectorAll('.hide-comparativo').forEach(el=> el.style.display = isComparativo ? 'none' : '');

  if(isComparativo){
    renderComparativo();
  } else {
    renderCorteSimple(currentCorte);
  }

  renderAsignaturas();
  renderRetiros();
}

/* ==================================================================
   MODO: I CORTE / II CORTE (vista simple con todas las secciones)
================================================================== */
function renderCorteSimple(corteKey){
  const C = DATA[corteKey];
  const label = corteKey === 'i_corte' ? 'I Corte' : 'II Corte';
  const periodo = corteKey === 'i_corte' ? DATA.meta.meses_i_corte : DATA.meta.meses_ii_corte;

  document.getElementById('heroTitle').innerHTML = `Análisis Estadístico Educativo<br>${label} 2026`;
  document.getElementById('heroSub').textContent = `Permanencia, aprobación y asistencia de estudiantes y docentes en los ${C.municipio.NumNER} Núcleos Educativos Rurales (NER) y ${C.municipio.NumCentros} centros escolares del municipio · ${periodo}.`;
  document.getElementById('resumenTitle').textContent = `Panorama Municipal — ${label}`;
  document.getElementById('resumenNote').textContent = `Indicadores consolidados de los ${C.municipio.NumCentros} centros educativos del municipio para el ${label} 2026.`;
  document.getElementById('graficosNote').textContent = `Asistencia mensual (${periodo}) y desempeño por programa educativo — ${label}.`;

  const m = C.municipio;
  document.getElementById('heroStats').innerHTML = `
    <div class="hero-stat"><div class="num">${fmtInt(m.MA)}</div><div class="lbl">Matrícula Actual</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.Permanencia)}</div><div class="lbl">Permanencia</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.Aprobacion)}</div><div class="lbl">Aprobación</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.AsisEstudiante)}</div><div class="lbl">Asist. Estudiantil</div></div>
    <div class="hero-stat"><div class="num">${fmtPct(m.AsisDocente)}</div><div class="lbl">Asist. Docente</div></div>
  `;
  document.getElementById('tagCentros').textContent = `${m.NumCentros} centros · ${m.NumNER} NER`;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi"><div class="kpi-label">Matrícula Inicial</div><div class="kpi-value">${fmtInt(m.MI)}</div><div class="kpi-sub">al inicio del periodo</div></div>
    <div class="kpi"><div class="kpi-label">Matrícula Actual</div><div class="kpi-value">${fmtInt(m.MA)}</div><div class="kpi-sub">estudiantes activos</div></div>
    <div class="kpi gold"><div class="kpi-label">Permanencia</div><div class="kpi-value">${fmtPct(m.Permanencia)}</div><div class="kpi-sub">MA ÷ MI</div></div>
    <div class="kpi gold"><div class="kpi-label">Aprobación</div><div class="kpi-value">${fmtPct(m.Aprobacion)}</div><div class="kpi-sub">${fmtInt(m.APR)} aprobados</div></div>
    <div class="kpi bad"><div class="kpi-label">Total Reprobados</div><div class="kpi-value">${fmtInt(m.TotalRep)}</div><div class="kpi-sub">${fmtPct(m.Reprobacion)} de la matrícula</div></div>
    <div class="kpi"><div class="kpi-label">Asist. Estudiante / Docente</div><div class="kpi-value">${fmtPct(m.AsisEstudiante)} <small>/ ${fmtPct(m.AsisDocente)}</small></div><div class="kpi-sub">promedio del ${label}</div></div>
  `;

  renderTrendChart(C);
  renderProgramaChart(C);
  renderNerTable(C);
  renderNerPickerAndDetail(C);
  renderTopGeneral(corteKey);
  renderRankings(C);
}

function renderTrendChart(C){
  destroyChart('trend');
  const holder = document.getElementById('chartTrend').parentElement;
  if(!window.__chartsOk){
    showChartWarning(holder, '⚠ No se pudo cargar Chart.js (bloqueador de anuncios / Brave Shields). Desactiva el bloqueador para este sitio y recarga para ver los gráficos.');
    return;
  }
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
  if(!window.__chartsOk){
    showChartWarning(holder, '⚠ No se pudo cargar Chart.js. Ver aviso del panel anterior.');
    return;
  }
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
    <div class="detail-kpi"><div class="v">${fmtInt(info.TotalRep)}</div><div class="l">Reprobados</div></div>
    <div class="detail-kpi"><div class="v">${fmtPct(info.AsisEstudiante)}</div><div class="l">Asist. Est.</div></div>
    <div class="detail-kpi"><div class="v">${fmtPct(info.AsisDocente)}</div><div class="l">Asist. Doc.</div></div>
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

function renderTopGeneral(corteKey){
  const G = DATA.top_general[corteKey];
  function item(r){
    return `<li>
      <div>
        <div class="rank-name">${r.Centro}</div>
        <div class="rank-meta">${r.NER} · Apr ${fmtPct(r.Aprobacion)} · Perm ${fmtPct(r.Permanencia)} · M.Actual ${fmtInt(r.MA)}</div>
      </div>
      <span class="pct ${pctClass(r.Indice)}">${fmtPct(r.Indice)}</span>
    </li>`;
  }
  document.getElementById('topGeneralTop').innerHTML = G.top.map(item).join('');
  document.getElementById('topGeneralBottom').innerHTML = G.bottom.map(item).join('');
}

/* ==================================================================
   MODO: COMPARATIVO
================================================================== */
function renderComparativo(){
  const M = DATA.comparativo.municipio;
  document.getElementById('heroTitle').innerHTML = `Comparativo Estadístico<br>I Corte vs. II Corte 2026`;
  document.getElementById('heroSub').textContent = `Evolución de los indicadores educativos del municipio de El Cuá entre el I Corte (${DATA.meta.meses_i_corte}) y el II Corte (${DATA.meta.meses_ii_corte}) de 2026.`;
  document.getElementById('resumenTitle').textContent = 'Panorama Municipal — Comparativo';
  document.getElementById('resumenNote').textContent = 'Variación de indicadores consolidados entre el I y el II Corte 2026.';

  document.getElementById('heroStats').innerHTML = `
    <div class="hero-stat"><div class="num">${fmtInt(M.MA_II)}</div><div class="lbl">Matrícula Actual</div></div>
    <div class="hero-stat"><div class="num">${fmtDelta(M.Aprobacion_delta)}</div><div class="lbl">Δ Aprobación</div></div>
    <div class="hero-stat"><div class="num">${fmtDelta(M.Reprobacion_delta)}</div><div class="lbl">Δ Reprobación</div></div>
    <div class="hero-stat"><div class="num">${fmtDelta(M.AsisEstudiante_delta)}</div><div class="lbl">Δ Asist. Estudiantil</div></div>
    <div class="hero-stat"><div class="num">${fmtDelta(M.AsisDocente_delta)}</div><div class="lbl">Δ Asist. Docente</div></div>
  `;
  document.getElementById('tagCentros').textContent = `160 centros · 26 NER`;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi"><div class="kpi-label">Permanencia I Corte</div><div class="kpi-value">${fmtPct(M.Permanencia_I)}</div><div class="kpi-sub">línea base</div></div>
    <div class="kpi"><div class="kpi-label">Permanencia II Corte</div><div class="kpi-value">${fmtPct(M.Permanencia_II)}</div><div class="kpi-sub ${deltaClass(M.Permanencia_delta)}">${fmtDelta(M.Permanencia_delta)}</div></div>
    <div class="kpi gold"><div class="kpi-label">Aprobación I Corte</div><div class="kpi-value">${fmtPct(M.Aprobacion_I)}</div><div class="kpi-sub">línea base</div></div>
    <div class="kpi gold"><div class="kpi-label">Aprobación II Corte</div><div class="kpi-value">${fmtPct(M.Aprobacion_II)}</div><div class="kpi-sub ${deltaClass(M.Aprobacion_delta)}">${fmtDelta(M.Aprobacion_delta)}</div></div>
    <div class="kpi bad"><div class="kpi-label">Reprobados I → II</div><div class="kpi-value">${fmtInt(M.TotalRep_I)} → ${fmtInt(M.TotalRep_II)}</div><div class="kpi-sub">acumulado por corte</div></div>
    <div class="kpi"><div class="kpi-label">Asist. Est. / Doc. (II Corte)</div><div class="kpi-value">${fmtPct(M.AsisEstudiante_II)} <small>/ ${fmtPct(M.AsisDocente_II)}</small></div><div class="kpi-sub">promedio del corte</div></div>
  `;

  renderCompMuniChart(M);
  renderCompAsisChart(M);
  renderNerComparativoTable();
  renderCambiosComparativo();
}

function renderCompMuniChart(M){
  destroyChart('compMuni');
  const holder = document.getElementById('chartCompMuni').parentElement;
  if(!window.__chartsOk){ showChartWarning(holder, '⚠ No se pudo cargar Chart.js.'); return; }
  holder.innerHTML = '<canvas id="chartCompMuni"></canvas>';
  charts.compMuni = new Chart(document.getElementById('chartCompMuni'), {
    type:'bar',
    data:{
      labels:['Permanencia', 'Aprobación'],
      datasets:[
        {label:'I Corte', data:[M.Permanencia_I, M.Aprobacion_I], backgroundColor:'#9FB0B6', borderRadius:4},
        {label:'II Corte', data:[M.Permanencia_II, M.Aprobacion_II], backgroundColor:'#2F7C74', borderRadius:4}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{ y:{min:0,max:100, grid:{color:'#EEEAE0'}, ticks:{callback:v=>v+'%'}}, x:{grid:{display:false}} },
      plugins:{ legend:{position:'bottom', labels:{boxWidth:10, usePointStyle:true}} }
    }
  });
}

function renderCompAsisChart(M){
  destroyChart('compAsis');
  const holder = document.getElementById('chartCompAsis').parentElement;
  if(!window.__chartsOk){ showChartWarning(holder, '⚠ No se pudo cargar Chart.js.'); return; }
  holder.innerHTML = '<canvas id="chartCompAsis"></canvas>';
  charts.compAsis = new Chart(document.getElementById('chartCompAsis'), {
    type:'bar',
    data:{
      labels:['Asist. Estudiante', 'Asist. Docente'],
      datasets:[
        {label:'I Corte', data:[M.AsisEstudiante_I, M.AsisDocente_I], backgroundColor:'#9FB0B6', borderRadius:4},
        {label:'II Corte', data:[M.AsisEstudiante_II, M.AsisDocente_II], backgroundColor:'#D9A441', borderRadius:4}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{ y:{min:0,max:100, grid:{color:'#EEEAE0'}, ticks:{callback:v=>v+'%'}}, x:{grid:{display:false}} },
      plugins:{ legend:{position:'bottom', labels:{boxWidth:10, usePointStyle:true}} }
    }
  });
}

let nerCompSort = {key:'Aprobacion_delta', asc:false};
function renderNerComparativoTable(){
  // reconstruir encabezado de la tabla NER para modo comparativo
  const head = document.getElementById('nerTableHead');
  head.innerHTML = `
    <th data-key="NER">NER</th>
    <th data-key="MA_II">Matríc. Actual</th>
    <th data-key="Permanencia_I">Perman. I</th>
    <th data-key="Permanencia_II">Perman. II</th>
    <th data-key="Permanencia_delta">Δ Perman.</th>
    <th data-key="Aprobacion_I">Aprob. I</th>
    <th data-key="Aprobacion_II">Aprob. II</th>
    <th data-key="Aprobacion_delta">Δ Aprob.</th>
  `;
  function draw(){
    const rows = [...DATA.comparativo.ner_comparativo].sort((a,b)=>{
      let va=a[nerCompSort.key], vb=b[nerCompSort.key];
      if(typeof va === 'string') return nerCompSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      va = va==null?-Infinity:va; vb=vb==null?-Infinity:vb;
      return nerCompSort.asc ? va-vb : vb-va;
    });
    document.getElementById('nerTableBody').innerHTML = rows.map(r=>`
      <tr>
        <td style="font-weight:600;color:var(--navy)">${r.NER}</td>
        <td>${fmtInt(r.MA_II)}</td>
        <td>${fmtPct(r.Permanencia_I)}</td>
        <td>${fmtPct(r.Permanencia_II)}</td>
        <td><span class="pct ${deltaClass(r.Permanencia_delta)}">${fmtDelta(r.Permanencia_delta)}</span></td>
        <td>${fmtPct(r.Aprobacion_I)}</td>
        <td>${fmtPct(r.Aprobacion_II)}</td>
        <td><span class="pct ${deltaClass(r.Aprobacion_delta)}">${fmtDelta(r.Aprobacion_delta)}</span></td>
      </tr>`).join('');
    head.querySelectorAll('th').forEach(th=>{
      th.classList.remove('sorted','sorted-asc');
      if(th.dataset.key===nerCompSort.key) th.classList.add(nerCompSort.asc?'sorted-asc':'sorted');
    });
  }
  head.querySelectorAll('th').forEach(th=>{
    th.onclick = ()=>{
      const key = th.dataset.key;
      if(nerCompSort.key===key) nerCompSort.asc = !nerCompSort.asc; else {nerCompSort.key=key; nerCompSort.asc=false;}
      draw();
    };
  });
  draw();
}

function renderCambiosComparativo(){
  function item(r){
    return `<li>
      <div>
        <div class="rank-name">${r.Centro}</div>
        <div class="rank-meta">${r.NER} · ${fmtPct(r.Aprobacion_I)} → ${fmtPct(r.Aprobacion_II)}</div>
      </div>
      <span class="pct ${deltaClass(r.Aprobacion_delta)}">${fmtDelta(r.Aprobacion_delta)}</span>
    </li>`;
  }
  document.getElementById('mayorMejora').innerHTML = DATA.comparativo.mayor_mejora_aprobacion.map(item).join('');
  document.getElementById('mayorCaida').innerHTML = DATA.comparativo.mayor_caida_aprobacion.map(item).join('');
}

/* ==================================================================
   ASIGNATURAS MAS REPROBADAS (independiente del selector de corte,
   pero se filtra según currentCorte para dar contexto)
================================================================== */
function renderAsignaturas(){
  const CR = DATA.clases_reprobadas;
  let dataset, titleSuffix, note;
  if(currentCorte === 'i_corte'){
    dataset = CR.i_corte_por_asignatura;
    titleSuffix = '— I Corte';
    note = `Total de estudiantes con al menos una asignatura reprobada en el I Corte: ${fmtInt(CR.estudiantes_con_reprobadas_i)}. Un mismo estudiante puede aparecer en más de una asignatura si reprobó varias.`;
  } else if(currentCorte === 'ii_corte'){
    dataset = CR.ii_corte_por_asignatura;
    titleSuffix = '— II Corte';
    note = `Total de estudiantes con al menos una asignatura reprobada en el II Corte: ${fmtInt(CR.estudiantes_con_reprobadas_ii)}. Un mismo estudiante puede aparecer en más de una asignatura si reprobó varias.`;
  } else {
    dataset = CR.total_por_asignatura;
    titleSuffix = '— Acumulado I + II Corte';
    note = `Comparativo acumulado: ${fmtInt(CR.estudiantes_con_reprobadas_i)} estudiantes con reprobadas en el I Corte y ${fmtInt(CR.estudiantes_con_reprobadas_ii)} en el II Corte. Un mismo estudiante puede aparecer en más de una asignatura.`;
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
