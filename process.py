import pandas as pd
import numpy as np
import json
import re
from collections import Counter

XLSX = 'ANALISIS_POR_CORTES.xlsx'

def pct(a, b):
    if b is None or b == 0 or pd.isna(b):
        return None
    return round(100 * a / b, 1)

def safe_round(x, nd=1):
    if x is None or pd.isna(x):
        return None
    return round(float(x), nd)

# ---------------------------------------------------------------
# 1. Cargar hojas de matricula/aprobacion por corte
# ---------------------------------------------------------------
def load_corte(sheet):
    df = pd.read_excel(XLSX, sheet_name=sheet)
    df.columns = [c.strip() for c in df.columns]
    area_col = 'AREA' if 'AREA' in df.columns else 'Tipo Area'
    df = df.rename(columns={
        'aCodEst Esc': 'CodEst', 'aCodCen': 'CodCentro', 'NER': 'NER', 'Centro': 'Centro',
        'Programa': 'Programa', 'Modalidad': 'Modalidad', 'Turno': 'Turno', area_col: 'TipoArea',
        'Nivel': 'Nivel', 'Cantidad Mat Inicial': 'MI', 'Cantidad Mat Actual': 'MA',
        'Aprobados': 'APR', 'Reprobado 1': 'Rep1', 'Reprobado 2': 'Rep2',
        'Reprobado 3 o más': 'Rep3mas', 'Total de Reprobados': 'TotalRep',
    })
    for c in ['MI','MA','APR','Rep1','Rep2','Rep3mas','TotalRep']:
        df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)
    df['NER'] = df['NER'].astype(str).str.strip()
    df['Centro'] = df['Centro'].astype(str).str.strip()
    return df

df_i = load_corte('ICORTE')
df_ii = load_corte('IICORTE')

# ---------------------------------------------------------------
# 2. Asistencia estudiantil y docente (todo el periodo ene-jul/ago)
#    Se reparte por corte usando el mes: I Corte = feb-abr, II Corte = may-jul
#    (ajustable; el municipio reporta por mes calendario)
# ---------------------------------------------------------------
def load_asistencia_est():
    df = pd.read_excel(XLSX, sheet_name='ASISTENCIA EST ENERO-AGOSTO')
    df = df.rename(columns={'Columna1':'NER'})
    df['NER'] = df['NER'].astype(str).str.strip()
    df['Centro'] = df['Centro'].astype(str).str.strip()
    df['FechaAsistencia'] = pd.to_datetime(df['FechaAsistencia'], dayfirst=True)
    df['mes'] = df['FechaAsistencia'].dt.month
    df['Total_Matricula'] = pd.to_numeric(df['Total_Matricula'], errors='coerce').fillna(0)
    df['Total_Asistencia'] = pd.to_numeric(df['Total_Asistencia'], errors='coerce').fillna(0)
    return df

def load_asistencia_doc():
    df = pd.read_excel(XLSX, sheet_name='ASISTENCIA DOC ENERO-AGOSTO')
    df['NER'] = df['NER'].astype(str).str.strip()
    df['Centro'] = df['Centro'].astype(str).str.strip()
    df['FechaAsistencia'] = pd.to_datetime(df['FechaAsistencia'], dayfirst=True)
    df['mes'] = df['FechaAsistencia'].dt.month
    df['Total_Docente'] = pd.to_numeric(df['Total_Docente'], errors='coerce').fillna(0)
    df['Total_Asistencia'] = pd.to_numeric(df['Total_Asistencia'], errors='coerce').fillna(0)
    return df

asis_est = load_asistencia_est()
asis_doc = load_asistencia_doc()

# meses por corte: I Corte febrero-abril, II Corte mayo-julio (ajustar si es necesario)
MESES_I = [2,3,4]
MESES_II = [5,6,7]

def asis_rate(df, meses, group_col=None, group_val=None, sumcol='Total_Matricula'):
    sub = df[df['mes'].isin(meses)]
    if group_col is not None:
        sub = sub[sub[group_col] == group_val]
    tot_m = sub[sumcol].sum()
    tot_a = sub['Total_Asistencia'].sum()
    return pct(tot_a, tot_m)

def asis_by_ner(df, meses, sumcol):
    sub = df[df['mes'].isin(meses)]
    g = sub.groupby('NER').agg(tot_m=(sumcol,'sum'), tot_a=('Total_Asistencia','sum')).reset_index()
    g['rate'] = g.apply(lambda r: pct(r['tot_a'], r['tot_m']), axis=1)
    return dict(zip(g['NER'], g['rate']))

def asis_by_centro(df, meses, sumcol):
    sub = df[df['mes'].isin(meses)]
    g = sub.groupby('Centro').agg(tot_m=(sumcol,'sum'), tot_a=('Total_Asistencia','sum')).reset_index()
    g['rate'] = g.apply(lambda r: pct(r['tot_a'], r['tot_m']), axis=1)
    return dict(zip(g['Centro'], g['rate']))

def tendencia_mensual(meses):
    out = []
    nombres = {1:'Ene',2:'Feb',3:'Mar',4:'Abr',5:'May',6:'Jun',7:'Jul',8:'Ago'}
    for m in meses:
        est = asis_rate(asis_est, [m], sumcol='Total_Matricula')
        doc = asis_rate(asis_doc, [m], sumcol='Total_Docente')
        out.append({'mes': nombres[m], 'estudiante': est, 'docente': doc})
    return out

# ---------------------------------------------------------------
# 3. Construir bloque de indicadores por corte
# ---------------------------------------------------------------
def build_corte_block(df, meses):
    m = {
        'MI': int(df['MI'].sum()), 'MA': int(df['MA'].sum()), 'APR': int(df['APR'].sum()),
        'Rep1': int(df['Rep1'].sum()), 'Rep2': int(df['Rep2'].sum()), 'Rep3mas': int(df['Rep3mas'].sum()),
        'TotalRep': int(df['TotalRep'].sum()),
    }
    m['Permanencia'] = pct(m['MA'], m['MI'])
    m['Aprobacion'] = pct(m['APR'], m['MA'])
    m['Reprobacion'] = pct(m['TotalRep'], m['MA'])
    m['NumCentros'] = df['Centro'].nunique()
    m['NumNER'] = df['NER'].nunique()
    m['AsisEstudiante'] = asis_rate(asis_est, meses, sumcol='Total_Matricula')
    m['AsisDocente'] = asis_rate(asis_doc, meses, sumcol='Total_Docente')
    return m

def build_programa_muni(df):
    out = []
    for prog, g in df.groupby('Programa'):
        mi, ma, apr = g['MI'].sum(), g['MA'].sum(), g['APR'].sum()
        r1, r2, r3 = g['Rep1'].sum(), g['Rep2'].sum(), g['Rep3mas'].sum()
        tot = r1+r2+r3
        out.append({
            'MI': int(mi), 'MA': int(ma), 'APR': int(apr),
            'Rep1': int(r1), 'Rep2': int(r2), 'Rep3mas': int(r3), 'TotalRep': int(tot),
            'Permanencia': pct(ma, mi), 'Aprobacion': pct(apr, ma), 'Reprobacion': pct(tot, ma),
            'Programa': prog
        })
    order = ['ALFABETIZACION','EDUCACION INICIAL','EDUCACION ESPECIAL','PRIMARIA','SECUNDARIA']
    out.sort(key=lambda x: order.index(x['Programa']) if x['Programa'] in order else 99)
    return out

def build_turno_muni(df):
    out = []
    for t, g in df.groupby('Turno'):
        mi, ma, apr = g['MI'].sum(), g['MA'].sum(), g['APR'].sum()
        r1, r2, r3 = g['Rep1'].sum(), g['Rep2'].sum(), g['Rep3mas'].sum()
        tot = r1+r2+r3
        out.append({
            'MI': int(mi), 'MA': int(ma), 'APR': int(apr),
            'Rep1': int(r1), 'Rep2': int(r2), 'Rep3mas': int(r3), 'TotalRep': int(tot),
            'Permanencia': pct(ma, mi), 'Aprobacion': pct(apr, ma), 'Reprobacion': pct(tot, ma),
            'Turno': t
        })
    return out

def build_area_muni(df):
    out = []
    for a, g in df.groupby('TipoArea'):
        mi, ma, apr = g['MI'].sum(), g['MA'].sum(), g['APR'].sum()
        r1, r2, r3 = g['Rep1'].sum(), g['Rep2'].sum(), g['Rep3mas'].sum()
        tot = r1+r2+r3
        label = 'Rural' if str(a).upper()=='RURAL' else 'Urbano'
        out.append({
            'MI': int(mi), 'MA': int(ma), 'APR': int(apr),
            'Rep1': int(r1), 'Rep2': int(r2), 'Rep3mas': int(r3), 'TotalRep': int(tot),
            'Permanencia': pct(ma, mi), 'Aprobacion': pct(apr, ma), 'Reprobacion': pct(tot, ma),
            'Area': label
        })
    return out

def build_ner_list(df, meses):
    est_ner = asis_by_ner(asis_est, meses, 'Total_Matricula')
    doc_ner = asis_by_ner(asis_doc, meses, 'Total_Docente')
    out = []
    for ner, g in df.groupby('NER'):
        mi, ma, apr = g['MI'].sum(), g['MA'].sum(), g['APR'].sum()
        r1, r2, r3 = g['Rep1'].sum(), g['Rep2'].sum(), g['Rep3mas'].sum()
        tot = r1+r2+r3
        out.append({
            'MI': int(mi), 'MA': int(ma), 'APR': int(apr),
            'Rep1': int(r1), 'Rep2': int(r2), 'Rep3mas': int(r3), 'TotalRep': int(tot),
            'Permanencia': pct(ma, mi), 'Aprobacion': pct(apr, ma), 'Reprobacion': pct(tot, ma),
            'NER': ner, 'NumCentros': g['Centro'].nunique(),
            'AsisEstudiante': est_ner.get(ner), 'AsisDocente': doc_ner.get(ner),
        })
    return out

def build_centros_por_ner(df, meses):
    est_c = asis_by_centro(asis_est, meses, 'Total_Matricula')
    doc_c = asis_by_centro(asis_doc, meses, 'Total_Docente')
    out = {}
    for ner, gner in df.groupby('NER'):
        lst = []
        for centro, g in gner.groupby('Centro'):
            mi, ma, apr = g['MI'].sum(), g['MA'].sum(), g['APR'].sum()
            r1, r2, r3 = g['Rep1'].sum(), g['Rep2'].sum(), g['Rep3mas'].sum()
            tot = r1+r2+r3
            lst.append({
                'MI': int(mi), 'MA': int(ma), 'APR': int(apr),
                'Rep1': int(r1), 'Rep2': int(r2), 'Rep3mas': int(r3), 'TotalRep': int(tot),
                'Permanencia': pct(ma, mi), 'Aprobacion': pct(apr, ma), 'Reprobacion': pct(tot, ma),
                'Centro': centro, 'CodCentro': int(g['CodCentro'].iloc[0]),
                'AsisEstudiante': est_c.get(centro), 'AsisDocente': doc_c.get(centro),
                'Programas': sorted(g['Programa'].unique().tolist()),
                'TipoArea': 'Rural' if str(g['TipoArea'].iloc[0]).upper()=='RURAL' else 'Urbano',
                'NER': ner,
            })
        out[ner] = lst
    return out

def rankings(centros_por_ner, min_ma=15):
    flat = []
    for ner, lst in centros_por_ner.items():
        for c in lst:
            if c['MA'] is not None and c['MA'] >= min_ma:
                flat.append(c)
    top_aprob = sorted([c for c in flat if c['Aprobacion'] is not None], key=lambda x: -x['Aprobacion'])[:10]
    bottom_aprob = sorted([c for c in flat if c['Aprobacion'] is not None], key=lambda x: x['Aprobacion'])[:10]
    top_perm = sorted([c for c in flat if c['Permanencia'] is not None], key=lambda x: -x['Permanencia'])[:10]
    bottom_perm = sorted([c for c in flat if c['Permanencia'] is not None], key=lambda x: x['Permanencia'])[:10]
    return top_aprob, bottom_aprob, top_perm, bottom_perm

def build_full_corte(df, meses):
    block = build_corte_block(df, meses)
    programa_muni = build_programa_muni(df)
    turno_muni = build_turno_muni(df)
    area_muni = build_area_muni(df)
    tendencia = tendencia_mensual(meses)
    ner_list = build_ner_list(df, meses)
    centros_por_ner = build_centros_por_ner(df, meses)
    top_aprob, bottom_aprob, top_perm, bottom_perm = rankings(centros_por_ner)
    return {
        'municipio': block,
        'programa_muni': programa_muni,
        'turno_muni': turno_muni,
        'area_muni': area_muni,
        'tendencia_mensual': tendencia,
        'ner_list': ner_list,
        'centros_por_ner': centros_por_ner,
        'top_aprobacion': top_aprob,
        'bottom_aprobacion': bottom_aprob,
        'top_permanencia': top_perm,
        'bottom_permanencia': bottom_perm,
    }

corte_i = build_full_corte(df_i, MESES_I)
corte_ii = build_full_corte(df_ii, MESES_II)

# ---------------------------------------------------------------
# 4. COMPARATIVO I vs II corte (municipio y por NER)
# ---------------------------------------------------------------
def build_comparativo(ci, cii):
    m1, m2 = ci['municipio'], cii['municipio']
    def delta(k):
        a, b = m1.get(k), m2.get(k)
        if a is None or b is None:
            return None
        return round(b - a, 1)
    municipio_delta = {
        'MI_I': m1['MI'], 'MI_II': m2['MI'],
        'MA_I': m1['MA'], 'MA_II': m2['MA'],
        'Permanencia_I': m1['Permanencia'], 'Permanencia_II': m2['Permanencia'], 'Permanencia_delta': delta('Permanencia'),
        'Aprobacion_I': m1['Aprobacion'], 'Aprobacion_II': m2['Aprobacion'], 'Aprobacion_delta': delta('Aprobacion'),
        'Reprobacion_I': m1['Reprobacion'], 'Reprobacion_II': m2['Reprobacion'], 'Reprobacion_delta': delta('Reprobacion'),
        'TotalRep_I': m1['TotalRep'], 'TotalRep_II': m2['TotalRep'],
        'AsisEstudiante_I': m1['AsisEstudiante'], 'AsisEstudiante_II': m2['AsisEstudiante'],
        'AsisEstudiante_delta': None if m1['AsisEstudiante'] is None or m2['AsisEstudiante'] is None else round(m2['AsisEstudiante']-m1['AsisEstudiante'],1),
        'AsisDocente_I': m1['AsisDocente'], 'AsisDocente_II': m2['AsisDocente'],
        'AsisDocente_delta': None if m1['AsisDocente'] is None or m2['AsisDocente'] is None else round(m2['AsisDocente']-m1['AsisDocente'],1),
    }

    ner1 = {n['NER']: n for n in ci['ner_list']}
    ner2 = {n['NER']: n for n in cii['ner_list']}
    ner_comp = []
    for ner in sorted(set(ner1) | set(ner2)):
        a = ner1.get(ner); b = ner2.get(ner)
        row = {'NER': ner}
        row['Permanencia_I'] = a['Permanencia'] if a else None
        row['Permanencia_II'] = b['Permanencia'] if b else None
        row['Aprobacion_I'] = a['Aprobacion'] if a else None
        row['Aprobacion_II'] = b['Aprobacion'] if b else None
        row['MA_I'] = a['MA'] if a else None
        row['MA_II'] = b['MA'] if b else None
        row['Permanencia_delta'] = None if row['Permanencia_I'] is None or row['Permanencia_II'] is None else round(row['Permanencia_II']-row['Permanencia_I'],1)
        row['Aprobacion_delta'] = None if row['Aprobacion_I'] is None or row['Aprobacion_II'] is None else round(row['Aprobacion_II']-row['Aprobacion_I'],1)
        ner_comp.append(row)

    # comparativo por centro (para destacar mayores subas/bajas)
    c1 = {}
    for lst in ci['centros_por_ner'].values():
        for c in lst: c1[c['Centro']] = c
    c2 = {}
    for lst in cii['centros_por_ner'].values():
        for c in lst: c2[c['Centro']] = c
    centro_comp = []
    for centro in sorted(set(c1) & set(c2)):
        a, b = c1[centro], c2[centro]
        if a['Aprobacion'] is None or b['Aprobacion'] is None: continue
        if a['MA'] < 15 or b['MA'] < 15: continue
        centro_comp.append({
            'Centro': centro, 'NER': b['NER'],
            'Aprobacion_I': a['Aprobacion'], 'Aprobacion_II': b['Aprobacion'],
            'Aprobacion_delta': round(b['Aprobacion']-a['Aprobacion'],1),
            'Permanencia_I': a['Permanencia'], 'Permanencia_II': b['Permanencia'],
            'Permanencia_delta': None if a['Permanencia'] is None or b['Permanencia'] is None else round(b['Permanencia']-a['Permanencia'],1),
            'MA_II': b['MA'],
        })
    mayor_mejora = sorted(centro_comp, key=lambda x: -x['Aprobacion_delta'])[:10]
    mayor_caida = sorted(centro_comp, key=lambda x: x['Aprobacion_delta'])[:10]

    return {
        'municipio': municipio_delta,
        'ner_comparativo': ner_comp,
        'mayor_mejora_aprobacion': mayor_mejora,
        'mayor_caida_aprobacion': mayor_caida,
    }

comparativo = build_comparativo(corte_i, corte_ii)

# ---------------------------------------------------------------
# 5. CLASES REPROBADAS -> contar por asignatura, corte y NER
# ---------------------------------------------------------------
def norm_asig(s):
    s = s.strip()
    # normalizar tildes/variantes conocidas
    fixes = {
        'Matematica': 'Matemática', 'Matemáticas': 'Matemática', 'MATEMATICA': 'Matemática',
        'Ingles': 'Inglés', 'INGLES': 'Inglés',
        'Ciencias Sociales': 'Ciencias Sociales', 'CC.SS': 'Ciencias Sociales',
        'Ciencias Naturales': 'Ciencias Naturales',
        'Lengua y Literatura': 'Lengua y Literatura', 'Lengua Y Literatura': 'Lengua y Literatura',
        'Geografia': 'Geografía', 'GEOGRAFIA': 'Geografía',
        'Historia': 'Historia',
        'Fisica': 'Física', 'Quimica': 'Química', 'Biologia': 'Biología',
        'Convivencia y Civica': 'Convivencia y Civismo',
        'Educacion Fisica': 'Educación Física',
    }
    return fixes.get(s, s)

df_clases = pd.read_excel(XLSX, sheet_name='CLASES REPROBADAS')
df_clases.columns = [c.strip() for c in df_clases.columns]
df_clases = df_clases.rename(columns={'CLASE. REPR':'Clases','NUCLEO':'NER','CORTE':'Corte'})
df_clases['NER'] = df_clases['NER'].astype(str).str.strip().str.upper()
df_clases['Corte'] = df_clases['Corte'].astype(str).str.strip()

def explode_clases(df):
    rows = []
    for _, r in df.iterrows():
        if pd.isna(r['Clases']):
            continue
        items = [norm_asig(x) for x in str(r['Clases']).split(',')]
        for it in items:
            it = it.strip()
            if it:
                rows.append({'Asignatura': it, 'NER': r['NER'], 'Corte': r['Corte']})
    return pd.DataFrame(rows)

df_asig = explode_clases(df_clases)

def conteo_asignaturas(df, corte=None):
    sub = df if corte is None else df[df['Corte'] == corte]
    c = Counter(sub['Asignatura'])
    return [{'Asignatura': k, 'Total': v} for k, v in sorted(c.items(), key=lambda x: -x[1])]

asig_total = conteo_asignaturas(df_asig)
asig_i = conteo_asignaturas(df_asig, 'I CORTE')
asig_ii = conteo_asignaturas(df_asig, 'II CORTE')

def conteo_asig_por_ner(df, corte=None):
    sub = df if corte is None else df[df['Corte'] == corte]
    out = {}
    for ner, g in sub.groupby('NER'):
        c = Counter(g['Asignatura'])
        out[ner] = [{'Asignatura': k, 'Total': v} for k, v in sorted(c.items(), key=lambda x: -x[1])]
    return out

asig_por_ner_total = conteo_asig_por_ner(df_asig)
asig_por_ner_i = conteo_asig_por_ner(df_asig, 'I CORTE')
asig_por_ner_ii = conteo_asig_por_ner(df_asig, 'II CORTE')

# cuantos estudiantes con al menos 1 reprobada por corte (filas de la hoja)
n_estudiantes_i = int((df_clases['Corte']=='I CORTE').sum())
n_estudiantes_ii = int((df_clases['Corte']=='II CORTE').sum())

clases_reprobadas = {
    'total_por_asignatura': asig_total,
    'i_corte_por_asignatura': asig_i,
    'ii_corte_por_asignatura': asig_ii,
    'por_ner_total': asig_por_ner_total,
    'por_ner_i_corte': asig_por_ner_i,
    'por_ner_ii_corte': asig_por_ner_ii,
    'estudiantes_con_reprobadas_i': n_estudiantes_i,
    'estudiantes_con_reprobadas_ii': n_estudiantes_ii,
}

# ---------------------------------------------------------------
# 6. CAUSAS DE RETIRO
# ---------------------------------------------------------------
df_retiro = pd.read_excel(XLSX, sheet_name='CAUSAS DE RETIROS')
df_retiro.columns = [c.strip() for c in df_retiro.columns]
df_retiro = df_retiro[df_retiro['CAUSA DE RETIROS'] != 'Total general']
causas_retiro = [{'Causa': r['CAUSA DE RETIROS'].title(), 'Total': int(r['Total'])}
                  for _, r in df_retiro.sort_values('Total', ascending=False).iterrows()]
total_retiros = int(sum(c['Total'] for c in causas_retiro))

# ---------------------------------------------------------------
# 7. TOP GENERAL (combinando ambos indicadores: Aprobacion + Permanencia)
#    usando datos del II Corte (mas reciente) con MA >= 15
# ---------------------------------------------------------------
def build_top_general(centros_por_ner, min_ma=15):
    flat = []
    for ner, lst in centros_por_ner.items():
        for c in lst:
            if c['MA'] is not None and c['MA'] >= min_ma and c['Aprobacion'] is not None and c['Permanencia'] is not None:
                score = (c['Aprobacion'] + min(c['Permanencia'], 100)) / 2
                flat.append({**c, 'Indice': round(score,1)})
    top = sorted(flat, key=lambda x: -x['Indice'])[:10]
    bottom = sorted(flat, key=lambda x: x['Indice'])[:10]
    return top, bottom

top_general_ii, bottom_general_ii = build_top_general(corte_ii['centros_por_ner'])
top_general_i, bottom_general_i = build_top_general(corte_i['centros_por_ner'])

# ---------------------------------------------------------------
# 8. Ensamblar JSON final
# ---------------------------------------------------------------
final = {
    'meta': {
        'cortes_disponibles': ['I Corte', 'II Corte', 'Comparativo'],
        'meses_i_corte': 'Febrero - Abril 2026',
        'meses_ii_corte': 'Mayo - Julio 2026',
    },
    'i_corte': corte_i,
    'ii_corte': corte_ii,
    'comparativo': comparativo,
    'clases_reprobadas': clases_reprobadas,
    'causas_retiro': {'lista': causas_retiro, 'total': total_retiros},
    'top_general': {
        'i_corte': {'top': top_general_i, 'bottom': bottom_general_i},
        'ii_corte': {'top': top_general_ii, 'bottom': bottom_general_ii},
    },
}

def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj

final = clean_nan(final)

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(final, f, ensure_ascii=False, indent=None)

print('OK. Tamano archivo:', len(json.dumps(final)))
print('Municipio I:', final['i_corte']['municipio'])
print('Municipio II:', final['ii_corte']['municipio'])
print('Comparativo municipio:', final['comparativo']['municipio'])
print('Asignaturas top total:', final['clases_reprobadas']['total_por_asignatura'][:8])
print('Causas retiro top:', final['causas_retiro']['lista'][:5])
