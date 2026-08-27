# Dashboard — Análisis Estadístico El Cuá, Jinotega (I y II Corte 2026)

## Archivos

| Archivo        | Contenido                                                      |
|----------------|-----------------------------------------------------------------|
| `index.html`   | Estructura de la página (HTML puro, sin estilos ni lógica inline) |
| `styles.css`   | Todos los estilos visuales (colores, tipografía, layout, tablas)  |
| `script.js`    | Lógica: carga de datos, selector de corte, gráficos (Chart.js), tablas interactivas, filtros por NER |
| `data.json`    | Datos ya agregados: I Corte, II Corte, comparativo, asignaturas reprobadas, causas de retiro |
| `process.py`   | Script de Python (pandas) que genera `data.json` a partir de `ANALISIS_POR_CORTES.xlsx` |

## Novedades de esta versión

- **Selector de corte** (arriba a la derecha del encabezado): permite ver **I Corte**, **II Corte** o el **Comparativo** entre ambos. Todo el dashboard —KPIs, gráficos, tabla de NER, rankings— cambia según la selección.
- **Modo Comparativo**: muestra la variación (Δ) de Permanencia, Aprobación, Reprobación y Asistencia entre ambos cortes, a nivel municipio, por NER y por centro escolar (mayor mejora / mayor caída en aprobación).
- **Asignaturas con más reprobados**: cuenta cuántos estudiantes reprobaron cada asignatura (Matemática, Lengua y Literatura, Ciencias Naturales, etc.), separando por I Corte, II Corte o el acumulado, según el corte seleccionado.
- **Top General (Índice Combinado)**: ranking de mejores y peores escuelas usando el promedio de Aprobación + Permanencia (no solo un indicador aislado).
- **Causas de retiro escolar**: gráfico con los motivos de abandono más frecuentes (Cambio de domicilio, Nunca asistió a clases, Falta de apoyo de los padres, Trabajo, etc.), acumulado del periodo.

## Cómo abrirlo en VS Code

`script.js` carga `data.json` con `fetch()`, y los navegadores bloquean `fetch` sobre archivos
abiertos directamente con doble clic (protocolo `file://`). Para que funcione necesitas un
servidor local muy simple. Dos formas fáciles:

**Opción A — Extensión Live Server (recomendada)**
1. Instala la extensión **"Live Server"** de Ritwick Dey en VS Code.
2. Clic derecho sobre `index.html` → **"Open with Live Server"**.
3. Se abre en el navegador en `http://127.0.0.1:5500/...` y todo carga correctamente.

**Opción B — Servidor de Python (sin instalar nada en VS Code)**
```bash
cd carpeta-del-proyecto
python3 -m http.server 8000
```
Luego abre `http://localhost:8000` en tu navegador.

## Cómo regenerar `data.json` si cambian los datos fuente

`data.json` se genera con `process.py` a partir de `ANALISIS_POR_CORTES.xlsx`, que debe tener
estas hojas (mismos nombres exactos):

- `ICORTE` y `IICORTE` — matrícula, aprobados y reprobados por NER/centro/programa/nivel.
- `ASISTENCIA EST ENERO-AGOSTO` y `ASISTENCIA DOC ENERO-AGOSTO` — asistencia diaria.
- `CLASES REPROBADAS` — columnas `CLASE. REPR` (lista de asignaturas separadas por coma),
  `NUCLEO` (NER) y `CORTE` (`I CORTE` / `II CORTE`).
- `CAUSAS DE RETIROS` — columnas `CAUSA DE RETIROS` y `Total`.
- `CODIGOS` — catálogo de centros y directores (referencia).

Para regenerar:
```bash
pip install pandas openpyxl --break-system-packages   # si hace falta
python3 process.py
```
Esto sobrescribe `data.json` con los mismos nombres de clave que usa `script.js` — si cambias
los encabezados del Excel, hay que actualizar `process.py` para que siga generando esas mismas
claves, o el dashboard no encontrará los campos esperados.

### Nota sobre los meses de cada corte

El script asigna los meses de asistencia así:
- **I Corte:** febrero, marzo, abril.
- **II Corte:** mayo, junio, julio.

Si tu calendario académico usa otros meses de corte, ajusta las listas `MESES_I` y `MESES_II`
al inicio de `process.py`.

## Estructura de `data.json`

```
{
  "meta": { cortes_disponibles, meses_i_corte, meses_ii_corte },
  "i_corte":  { municipio, programa_muni, turno_muni, area_muni, tendencia_mensual,
                ner_list, centros_por_ner, top_aprobacion, bottom_aprobacion,
                top_permanencia, bottom_permanencia },
  "ii_corte": { ...misma estructura que i_corte... },
  "comparativo": {
    municipio,               // deltas municipales I -> II
    ner_comparativo,         // I vs II por cada NER
    mayor_mejora_aprobacion, // top 10 centros que más subieron aprobación
    mayor_caida_aprobacion   // top 10 centros que más bajaron aprobación
  },
  "clases_reprobadas": {
    total_por_asignatura, i_corte_por_asignatura, ii_corte_por_asignatura,
    por_ner_total, por_ner_i_corte, por_ner_ii_corte,
    estudiantes_con_reprobadas_i, estudiantes_con_reprobadas_ii
  },
  "causas_retiro": { lista, total },
  "top_general": {
    i_corte:  { top, bottom },   // índice combinado Aprobación + Permanencia
    ii_corte: { top, bottom }
  }
}
```

## Publicarlo en GitHub Pages (recomendado)

1. Crea un repositorio en GitHub y sube estos archivos (`index.html`, `styles.css`,
   `script.js`, `data.json`, `README.md`) a la raíz del repo (o a una carpeta, ej. `/docs`).
2. En el repositorio: **Settings → Pages**.
3. En "Source" elige la rama (`main`) y la carpeta donde quedaron los archivos (`/ (root)`
   o `/docs`).
4. Guarda. GitHub te da una URL tipo `https://tu-usuario.github.io/tu-repo/`.
5. Esa misma URL funciona igual en PC, tablet o teléfono — no necesitas nada especial.

## Diseño responsivo

El dashboard usa **CSS responsivo** (media queries): el navegador le informa al CSS el ancho
real de la pantalla, y el CSS decide cómo acomodar las tarjetas, gráficos, selector de corte
y tablas. No hay que configurar nada ni detectar el dispositivo — es automático.

- **PC / pantallas anchas:** KPIs en fila de 6, gráficos lado a lado, tablas completas, selector de corte al lado del encabezado.
- **Tablet (≤900px):** los gráficos y rankings pasan a una sola columna.
- **Teléfono (≤700px):** el selector de corte pasa a ancho completo debajo del encabezado; en ≤600px la tipografía y espaciados son más compactos, las estadísticas del encabezado pasan a una cuadrícula 2×2, y las tablas anchas se navegan con scroll horizontal.

## Metodología

- **Permanencia** = Matrícula Actual ÷ Matrícula Inicial
- **Aprobación** = Aprobados ÷ Matrícula Actual
- **Reprobación** = Total de Reprobados ÷ Matrícula Actual
- **Índice combinado (Top General)** = promedio simple de Aprobación y Permanencia
- **Asistencia estudiantil/docente** = promedio de los registros diarios reportados
  en el periodo del corte correspondiente.
- **Asignaturas reprobadas** = cada fila de la hoja `CLASES REPROBADAS` lista, separadas por
  coma, las asignaturas que un estudiante reprobó en ese corte. El script separa esa lista y
  cuenta cuántas veces aparece cada asignatura — así, si "Matemática" aparece 774 veces en
  total, significa que 774 estudiantes reprobaron Matemática (en el I o el II Corte, sumados).
