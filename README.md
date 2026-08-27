# Dashboard — Análisis Estadístico El Cuá, Jinotega (I y II Corte 2026)

## Archivos

| Archivo        | Contenido                                                      |
|----------------|-----------------------------------------------------------------|
| `index.html`   | Estructura de la página (HTML puro, sin estilos ni lógica inline) |
| `styles.css`   | Todos los estilos visuales (colores, tipografía, layout, tablas)  |
| `script.js`    | Lógica: carga de datos, selector de corte, gráficos (Chart.js), tablas interactivas, filtros por NER |
| `data.json`    | Datos ya agregados: I Corte, II Corte, análisis por grado, modalidad, asignaturas reprobadas, retiros y causas de retiro |
| `process.py`   | Script de Python (pandas) que genera `data.json` a partir de `ANALISIS_POR_CORTES.xlsx`, con verificaciones automáticas de integridad |

## Qué se corrigió en esta versión

La versión anterior se quedaba "a medias" al cargar (grado, modalidad y asistencia docente no
aparecían) por dos motivos, ambos ya corregidos:

1. **Un gráfico roto detenía todo lo demás.** El dashboard dibujaba las secciones en cadena
   (tendencia → programa → grado → modalidad → NER → rankings...). Si un solo gráfico fallaba
   —por ejemplo porque Chart.js no terminó de cargar a tiempo por una conexión lenta o
   intermitente— el error detenía el resto del código y las secciones siguientes (grado,
   modalidad, asistencia docente, etc.) se quedaban vacías. Ahora cada sección se ejecuta de
   forma aislada: si una falla, se muestra un aviso discreto arriba del panel indicando cuál
   fue, pero **todas las demás secciones siguen funcionando con normalidad**.
2. **El navegador podía quedarse con una versión vieja de `data.json` en caché.** Si la
   conexión se cortaba justo cuando se estaba descargando el archivo de datos, el navegador
   podía mostrar una copia anterior guardada en caché (por eso la matrícula del I Corte parecía
   "no actualizada"). Ahora cada carga pide `data.json` con un parámetro que cambia siempre
   (`?v=timestamp`) y con `cache: 'no-store'`, así que el navegador nunca sirve una copia vieja.

Estos dos cambios se probaron automáticamente simulando: carga normal, Chart.js sin cargar
(internet caído), y un gráfico que falla a propósito — en los tres casos las tablas de grado,
modalidad, NER y la matrícula del encabezado se mostraron correctamente.

**Recomendación:** si alguna vez ves un aviso amarillo arriba del panel diciendo que alguna
sección no cargó, simplemente recarga la página (Ctrl+R o Cmd+R) con mejor conexión.

## Novedades de la versión anterior (siguen vigentes)

- **Selector de corte**: I Corte o II Corte. Todo el dashboard cambia según la selección.
- **Análisis por Grado**: reprobación (%) y retiros por grado (Programa + Nivel, p. ej.
  "Primaria - Tercero"), en gráfico y tabla ordenable.
- **Análisis por Modalidad**: tabla con Permanencia, Retiros, Reprobados y Aprobación por cada
  modalidad educativa (Regular, Multigrado, Extraedad, Comunitaria JYA, en el Campo, etc.).
- **Retiros por NER**: gráfico dedicado y columna de Retiros en la tabla de NER y en el detalle
  por centro escolar.
- **Asignaturas con más reprobados**: cuenta cuántos estudiantes reprobaron cada asignatura,
  según el corte seleccionado.
- **Top General (Índice Combinado)**: mejores y peores escuelas por el promedio de Aprobación +
  Permanencia.
- **Causas de retiro escolar**: motivos de abandono más frecuentes, acumulado del periodo.

### Cómo se calculan los "Retiros"

El Excel no trae una columna de retiros por NER/centro/grado/modalidad, así que se calcula como
**Matrícula Inicial − Matrícula Actual** dentro de cada corte — la misma lógica que ya usa el
indicador de Permanencia, expresada en cantidad de estudiantes. Esto es distinto de la tabla de
"Causas de Retiro", que es un conteo total y aparte, sin desglose geográfico.

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

`process.py` ahora incluye **verificaciones automáticas** al final: si algo sale mal (por
ejemplo, que la tabla de grado quede vacía, o que la matrícula del I Corte no cuadre con la
suma real del Excel), el script se detiene con un `AssertionError` explicando exactamente qué
falló, en vez de generar silenciosamente un `data.json` incompleto. Si ves ese error, revisa el
mensaje — normalmente apunta a una hoja o columna del Excel con un nombre distinto al esperado.

**Nota:** `ICORTE` e `IICORTE` pueden traer encabezados con nombres distintos entre sí (por
ejemplo `MI AS` vs `Cantidad Mat Inicial`, o `aCodCen` ausente en una de las dos). `process.py`
ya contempla ambas variantes; si agregas una tercera hoja de corte con otros nombres de columna,
agrégalos al diccionario `rename_map` dentro de la función `load_corte()`.

## Estructura de `data.json`

```
{
  "meta": { version, cortes_disponibles, meses_i_corte, meses_ii_corte, nota_retiros },
  "i_corte": {
    municipio,          // KPIs consolidados, incluye Retiros y TasaRetiro
    programa_muni,      // por Programa (Primaria, Secundaria, etc.)
    turno_muni,         // por Turno
    area_muni,          // Rural / Urbano
    grado_muni,         // por Grado = Programa + Nivel
    modalidad_muni,     // por Modalidad educativa
    tendencia_mensual,  // asistencia promedio por mes del corte
    ner_list,           // un objeto por cada uno de los 26 NER, incluye Retiros
    ner_retiros,        // ner_list ordenado de mayor a menor Retiros
    centros_por_ner,    // { "NER": [ ...escuelas, cada una con Retiros... ] }
    top_aprobacion, bottom_aprobacion, top_permanencia, bottom_permanencia,
    top_general, bottom_general   // índice combinado Aprobación + Permanencia
  },
  "ii_corte": { ...misma estructura que i_corte... },
  "clases_reprobadas": {
    i_corte_por_asignatura, ii_corte_por_asignatura,
    por_ner_i_corte, por_ner_ii_corte,
    estudiantes_con_reprobadas_i, estudiantes_con_reprobadas_ii
  },
  "causas_retiro": { lista, total }   // acumulado, sin desglose por NER
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
- **Retiros** = Matrícula Inicial − Matrícula Actual, calculado dentro de cada corte, a
  cualquier nivel de desglose (municipio, NER, centro, grado, modalidad). No debe confundirse
  con la tabla de "Causas de Retiro", que es un conteo aparte y acumulado de todo el periodo.
- **Grado** = combinación de Programa + Nivel (ej. "Primaria - Tercero", "Educación Inicial -
  Segundo"). Se combinan porque el campo `Nivel` del Excel reutiliza los mismos nombres
  ("Primero", "Segundo"...) tanto en Preescolar como en Primaria, así que agruparlos solo por
  `Nivel` mezclaría grados distintos.
- **Índice combinado (Top General)** = promedio simple de Aprobación y Permanencia.
- **Asistencia estudiantil/docente** = promedio de los registros diarios reportados en el
  periodo del corte correspondiente.
- **Asignaturas reprobadas** = cada fila de la hoja `CLASES REPROBADAS` lista, separadas por
  coma, las asignaturas que un estudiante reprobó en ese corte. El script separa esa lista y
  cuenta cuántas veces aparece cada asignatura.
