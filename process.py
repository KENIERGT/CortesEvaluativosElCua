import pandas as pd
import numpy as np
import json
from collections import Counter

XLSX = 'ANALISIS_POR_CORTES.xlsx'

def pct(a, b):
    if b is None or b == 0 or pd.isna(b):
        return None
    return round(100 * a / b, 1)

# ---------------------------------------------------------------
# 0. Mapa de codigos de centro (para I Corte, que no trae aCodCen)
# ---------------------------------------------------------------
cod_df = pd.read_excel(XLSX, sheet_name='CODIGOS')
cod_df.columns = [c.strip() for c in cod_df.columns]
codest_to_codcen = dict(zip(cod_df['CODIGO DE ESTABL'].astype(int), cod_df['CODIGO DE CENTRO2'].astype(int)))

# ---------------------------------------------------------------
# 1. Cargar hojas de matricula/aprobacion por corte (headers distintos entre hojas)
# ---------------------------------------------------------------
def load_corte(sheet):
    df = pd.read_excel(XLSX, sheet_name=sheet)
    df.columns = [c.strip() for c in df.columns]
    rename_map = {
        'aCodEst Esc': 'CodEst', 'aCodCen': 'CodCentro', 'NER': 'NER', 'Centro': 'Centro',
        'Programa': 'Programa', 'Modalidad': 'Modalidad', 'Turno': 'Turno',
        'AREA': 'TipoArea', 'Tipo Area': 'TipoArea', 'Nivel': 'Nivel',
        'MI AS': 'MI', 'Cantidad Mat Inicial': 'MI',
        'MA AS': 'MA', 'Cantidad Mat Actual': 'MA',
        'APR AS': 'APR', 'Aprobados': 'APR',
        'Reprobado en 1': 'Rep1', 'Reprobado 1': 'Rep1',
        'Reprobado en 2': 'Rep2', 'Reprobado 2': 'Rep2',
        'Reprobado en 3 o más': 'Rep3mas', 'Reprobado 3 o más': 'Rep3mas',
        'Total de Reprobados': 'TotalRep',
        'PERMANENCIA': 'Permanencia_x', 'Permanencia': 'Permanencia_x',
        'APROBACION': 'Aprobacion_x', 'Aprobacion': 'Aprobacion_x',
    }
    df = df.rename(columns=rename_map)
    for c in ['MI','MA','APR','Rep1','Rep2','Rep3mas','TotalRep']:
        df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)
    df['NER'] = df['NER'].astype(str).str.strip().str.upper()
    df['Centro'] = df['Centro'].astype(str).str.strip()
    df['Programa'] = df['Programa'].astype(str).str.strip()
    df['Modalidad'] = df['Modalidad'].astype(str).str.strip()
    df['Nivel'] = df['Nivel'].astype(str).str.strip()
    df['Turno'] = df['Turno'].astype(str).str.strip()
    df['TipoArea'] = df['TipoArea'].astype(str).str.strip().str.upper()
    if 'CodCentro' not in df.columns:
        df['CodCentro'] = df['CodEst'].astype(int).map(codest_to_codcen)
    df['CodCentro'] = df['CodCentro'].fillna(0).astype(int)
    df['Grado'] = df['Programa'].str.title() + ' - ' + df['Nivel']
    return df

df_i = load_corte('ICORTE')
df_ii = load_corte('IICORTE')

# ---------------------------------------------------------------
# 2. Asistencia estudiantil y docente
# ---------------------------------------------------------------
def load_asistencia_est():
    df = pd.read_excel(XLSX, sheet_name='ASISTENCIA EST ENERO-AGOSTO')
    df = df.rename(columns={'Columna1':'NER'})
    df['NER'] = df['NER'].astype(str).str.strip().str.upper()
    df['Centro'] = df['Centro'].astype(str).str.strip()
    df['FechaAsistencia'] = pd.to_datetime(df['FechaAsistencia'], dayfirst=True)
    df['mes'] = df['FechaAsistencia'].dt.month
    df['Total_Matricula'] = pd.to_numeric(df['Total_Matricula'], errors='coerce').fillna(0)
    df['Total_Asistencia'] = pd.to_numeric(df['Total_Asistencia'], errors='coerce').fillna(0)
    return df

def load_asistencia_doc():
    df = pd.read_excel(XLSX, sheet_name='ASISTENCIA DOC ENERO-AGOSTO')
    df['NER'] = df['NER'].astype(str).str.strip().str.upper()
    df['Centro'] = df['Centro'].astype(str).str.strip()
    df['FechaAsistencia'] = pd.to_datetime(df['FechaAsistencia'], dayfirst=True)
    df['mes'] = df['FechaAsistencia'].dt.month
    df['Total_Docente'] = pd.to_numeric(df['Total_Docente'], errors='coerce').fillna(0)
    df['Total_Asistencia'] = pd.to_numeric(df['Total_Asistencia'], errors='coerce').fillna(0)
    return df

asis_est = load_asistencia_est()
asis_doc = load_asistencia_doc()

# meses por corte: I Corte febrero-abril, II Corte mayo-julio
MESES_I = [2,3,4]
MESES_II = [5,6,7]

def asis_rate(df, meses, sumcol, group_col=None, group_val=None):
    sub = df[df['mes'].isin(meses)]
    if group_col is not None:
        sub = sub[sub[group_col] == group_val]
    tot_m = sub[sumcol].sum()
    tot_a = sub['Total_Asistencia'].sum()
    return pct(tot_a, tot_m)

def asis_by_key(df, meses, sumcol, key):
    sub = df[df['mes'].isin(meses)]
    g = sub.groupby(key).agg(tot_m=(sumcol,'sum'), tot_a=('Total_Asistencia','sum')).reset_index()
    g['rate'] = g.apply(lambda r: pct(r['tot_a'], r['tot_m']), axis=1)
    return dict(zip(g[key], g['rate']))

def tendencia_mensual(meses):
    out = []
    nombres = {1:'Ene',2:'Feb',3:'Mar',4:'Abr',5:'May',6:'Jun',7:'Jul',8:'Ago'}
    for m in meses:
        est = asis_rate(asis_est, [m], 'Total_Matricula')
        doc = asis_rate(asis_doc, [m], 'Total_Docente')
        out.append({'mes': nombres[m], 'estudiante': est, 'docente': doc})
    return out

# ---------------------------------------------------------------
# 3. Agregaciones genéricas
# ---------------------------------------------------------------
def agg_block(g):
    mi, ma, apr = g['MI'].sum(), g['MA'].sum(), g['APR'].sum()
    r1, r2, r3 = g['Rep1'].sum(), g['Rep2'].sum(), g['Rep3mas'].sum()
    tot = r1 + r2 + r3
    retiros = max(int(mi - ma), 0)
    return {
        'MI': int(mi), 'MA': int(ma), 'APR': int(apr),
        'Rep1': int(r1), 'Rep2': int(r2), 'Rep3mas': int(r3), 'TotalRep': int(tot),
        'Permanencia': pct(ma, mi), 'Aprobacion': pct(apr, ma), 'Reprobacion': pct(tot, ma),
        'Retiros': retiros, 'TasaRetiro': pct(retiros, mi),
    }

def build_corte_block(df, meses):
    b = agg_block(df)
    b['NumCentros'] = df['Centro'].nunique()
    b['NumNER'] = df['NER'].nunique()
    b['AsisEstudiante'] = asis_rate(asis_est, meses, 'Total_Matricula')
    b['AsisDocente'] = asis_rate(asis_doc, meses, 'Total_Docente')
    return b

def build_group(df, groupcol, label_key, order=None):
    out = []
    for val, g in df.groupby(groupcol):
        row = agg_block(g)
        row[label_key] = val
        out.append(row)
    if order:
        out.sort(key=lambda x: order.index(x[label_key]) if x[label_key] in order else 99)
    else:
        out.sort(key=lambda x: -x['MA'])
    return out

def build_ner_list(df, meses):
    est_ner = asis_by_key(asis_est, meses, 'Total_Matricula', 'NER')
    doc_ner = asis_by_key(asis_doc, meses, 'Total_Docente', 'NER')
    out = []
    for ner, g in df.groupby('NER'):
        row = agg_block(g)
        row['NER'] = ner
        row['NumCentros'] = g['Centro'].nunique()
        row['AsisEstudiante'] = est_ner.get(ner)
        row['AsisDocente'] = doc_ner.get(ner)
        out.append(row)
    return out

def build_centros_por_ner(df, meses):
    est_c = asis_by_key(asis_est, meses, 'Total_Matricula', 'Centro')
    doc_c = asis_by_key(asis_doc, meses, 'Total_Docente', 'Centro')
    out = {}
    for ner, gner in df.groupby('NER'):
        lst = []
        for centro, g in gner.groupby('Centro'):
            row = agg_block(g)
            row['Centro'] = centro
            row['CodCentro'] = int(g['CodCentro'].iloc[0])
            row['AsisEstudiante'] = est_c.get(centro)
            row['AsisDocente'] = doc_c.get(centro)
            row['Programas'] = sorted(g['Programa'].unique().tolist())
            row['TipoArea'] = 'Rural' if str(g['TipoArea'].iloc[0]).upper() == 'RURAL' else 'Urbano'
            row['NER'] = ner
            lst.append(row)
        out[ner] = lst
    return out

def rankings(centros_por_ner, min_ma=15):
    flat = []
    for lst in centros_por_ner.values():
        for c in lst:
            if c['MA'] is not None and c['MA'] >= min_ma:
                flat.append(c)
    top_aprob = sorted([c for c in flat if c['Aprobacion'] is not None], key=lambda x: -x['Aprobacion'])[:10]
    bottom_aprob = sorted([c for c in flat if c['Aprobacion'] is not None], key=lambda x: x['Aprobacion'])[:10]
    top_perm = sorted([c for c in flat if c['Permanencia'] is not None], key=lambda x: -x['Permanencia'])[:10]
    bottom_perm = sorted([c for c in flat if c['Permanencia'] is not None], key=lambda x: x['Permanencia'])[:10]
    return top_aprob, bottom_aprob, top_perm, bottom_perm

def build_top_general(centros_por_ner, min_ma=15):
    flat = []
    for lst in centros_por_ner.values():
        for c in lst:
            if c['MA'] is not None and c['MA'] >= min_ma and c['Aprobacion'] is not None and c['Permanencia'] is not None:
                score = (c['Aprobacion'] + min(c['Permanencia'], 100)) / 2
                flat.append({**c, 'Indice': round(score, 1)})
    top = sorted(flat, key=lambda x: -x['Indice'])[:10]
    bottom = sorted(flat, key=lambda x: x['Indice'])[:10]
    return top, bottom

GRADO_ORDER = [
    'Educacion Inicial - Primero', 'Educacion Inicial - Segundo', 'Educacion Inicial - Tercero',
    'Educacion Especial - Primero', 'Educacion Especial - Segundo', 'Educacion Especial - Tercero',
    'Educacion Especial - Cuarto', 'Educacion Especial - Quinto', 'Educacion Especial - Sexto',
    'Educacion Especial - Sin Nivel',
    'Alfabetizacion - Sin Nivel',
    'Primaria - Primero', 'Primaria - Segundo', 'Primaria - Tercero', 'Primaria - Cuarto',
    'Primaria - Quinto', 'Primaria - Sexto', 'Primaria - I Ciclo', 'Primaria - Ii Ciclo', 'Primaria - Iii Ciclo',
    'Secundaria - Septimo', 'Secundaria - Octavo', 'Secundaria - Noveno', 'Secundaria - Décimo',
    'Secundaria - Undécimo', 'Secundaria - Grupo A', 'Secundaria - Grupo B', 'Secundaria - 3Ro',
]
def grado_sort_key(g):
    key = g['Grado'].title()
    return GRADO_ORDER.index(key) if key in GRADO_ORDER else 99

def build_grado(df):
    out = build_group(df, 'Grado', 'Grado')
    out.sort(key=grado_sort_key)
    return out

MODALIDAD_ORDER = [
    'EDUCACION TEMPRANA','PREESCOLAR COMUNITARIO MULTINIVEL','PREESCOLAR FORMAL','PREESCOLAR FORMAL MULTINIVEL',
    'PRIM. MULTIGRADO EN EDUC. ESPECIAL','ALFABETIZACION',
    'PRIMARIA REGULAR','PRIMARIA MULTIGRADO','PRIMARIA EXTRAEDAD','Primaria Comunitaria JYA',
    'SECUNDARIA REGULAR','SECUNDARIA EN EL CAMPO','SECUNDARIA POR ENCUENTRO',
    'III CICLO','IV CICLO','BACHILLERATO COMUNITARIO DE JYA',
]
def build_modalidad(df):
    return build_group(df, 'Modalidad', 'Modalidad', order=MODALIDAD_ORDER)

def build_full_corte(df, meses):
    municipio = build_corte_block(df, meses)
    programa_muni = build_group(df, 'Programa', 'Programa', order=['ALFABETIZACION','EDUCACION INICIAL','EDUCACION ESPECIAL','PRIMARIA','SECUNDARIA'])
    turno_muni = build_group(df, 'Turno', 'Turno')
    grado_muni = build_grado(df)
    modalidad_muni = build_modalidad(df)
    area_out = []
    for a, g in df.groupby('TipoArea'):
        row = agg_block(g)
        row['Area'] = 'Rural' if a == 'RURAL' else 'Urbano'
        area_out.append(row)
    tendencia = tendencia_mensual(meses)
    ner_list = build_ner_list(df, meses)
    centros_por_ner = build_centros_por_ner(df, meses)
    top_aprob, bottom_aprob, top_perm, bottom_perm = rankings(centros_por_ner)
    top_general, bottom_general = build_top_general(centros_por_ner)
    ner_retiros = sorted(ner_list, key=lambda x: -x['Retiros'])
    return {
        'municipio': municipio,
        'programa_muni': programa_muni,
        'turno_muni': turno_muni,
        'area_muni': area_out,
        'grado_muni': grado_muni,
        'modalidad_muni': modalidad_muni,
        'tendencia_mensual': tendencia,
        'ner_list': ner_list,
        'ner_retiros': ner_retiros,
        'centros_por_ner': centros_por_ner,
        'top_aprobacion': top_aprob,
        'bottom_aprobacion': bottom_aprob,
        'top_permanencia': top_perm,
        'bottom_permanencia': bottom_perm,
        'top_general': top_general,
        'bottom_general': bottom_general,
    }

corte_i = build_full_corte(df_i, MESES_I)
corte_ii = build_full_corte(df_ii, MESES_II)

# ---------------------------------------------------------------
# 4. CLASES REPROBADAS -> contar por asignatura, corte, NER
# ---------------------------------------------------------------
def norm_asig(s):
    s = s.strip()
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

def conteo_asig_por_ner(df, corte=None):
    sub = df if corte is None else df[df['Corte'] == corte]
    out = {}
    for ner, g in sub.groupby('NER'):
        c = Counter(g['Asignatura'])
        out[ner] = [{'Asignatura': k, 'Total': v} for k, v in sorted(c.items(), key=lambda x: -x[1])]
    return out

clases_reprobadas = {
    'i_corte_por_asignatura': conteo_asignaturas(df_asig, 'I CORTE'),
    'ii_corte_por_asignatura': conteo_asignaturas(df_asig, 'II CORTE'),
    'por_ner_i_corte': conteo_asig_por_ner(df_asig, 'I CORTE'),
    'por_ner_ii_corte': conteo_asig_por_ner(df_asig, 'II CORTE'),
    'estudiantes_con_reprobadas_i': int((df_clases['Corte'] == 'I CORTE').sum()),
    'estudiantes_con_reprobadas_ii': int((df_clases['Corte'] == 'II CORTE').sum()),
}

# ---------------------------------------------------------------
# 5. CAUSAS DE RETIRO (total municipal, sin desglose por NER en la fuente)
# ---------------------------------------------------------------
df_retiro = pd.read_excel(XLSX, sheet_name='CAUSAS DE RETIROS')
df_retiro.columns = [c.strip() for c in df_retiro.columns]
df_retiro = df_retiro[df_retiro['CAUSA DE RETIROS'] != 'Total general']
causas_retiro = [{'Causa': r['CAUSA DE RETIROS'].title(), 'Total': int(r['Total'])}
                  for _, r in df_retiro.sort_values('Total', ascending=False).iterrows()]
total_retiros_causas = int(sum(c['Total'] for c in causas_retiro))

# ---------------------------------------------------------------
# 6. Ensamblar JSON final (sin comparativo)
# ---------------------------------------------------------------
final = {
    'meta': {
        'cortes_disponibles': ['I Corte', 'II Corte'],
        'meses_i_corte': 'Febrero - Abril 2026',
        'meses_ii_corte': 'Mayo - Julio 2026',
        'nota_retiros': 'El indicador "Retiros" por NER, centro, grado y modalidad se calcula como Matrícula Inicial - Matrícula Actual dentro del corte (estimado). Las "Causas de Retiro" provienen de un registro aparte, acumulado para todo el periodo y sin desglose por NER.',
    },
    'i_corte': corte_i,
    'ii_corte': corte_ii,
    'clases_reprobadas': clases_reprobadas,
    'causas_retiro': {'lista': causas_retiro, 'total': total_retiros_causas},
}

def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    return obj

final = clean_nan(final)

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(final, f, ensure_ascii=False, indent=None)

print('OK. Tamano archivo:', len(json.dumps(final)))
print('Municipio I:', final['i_corte']['municipio'])
print('Municipio II:', final['ii_corte']['municipio'])
print('Grado muni I (primeros 5):', final['i_corte']['grado_muni'][:5])
print('Modalidad muni I (primeros 5):', final['i_corte']['modalidad_muni'][:5])
print('NER retiros I (top 5):', [(n['NER'], n['Retiros']) for n in final['i_corte']['ner_retiros'][:5]])
