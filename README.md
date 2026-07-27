# Dashboard — Análisis Estadístico El Cuá, Jinotega (I Corte 2026)

## Archivos

| Archivo        | Contenido                                                      |
|----------------|-----------------------------------------------------------------|
| `index.html`   | Estructura de la página (HTML puro, sin estilos ni lógica inline) |
| `styles.css`   | Todos los estilos visuales (colores, tipografía, layout, tablas)  |
| `script.js`    | Lógica: carga de datos, gráficos (Chart.js), tablas interactivas, filtros por NER |
| `data.json`    | Datos ya agregados (municipio, por NER, por centro escolar, rankings) |

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

`data.json` fue generado a partir de `I_CORTE_-_copia.xlsx` (hojas `BD PER y APROB`,
`ASIS. ESTUDIANTE` y `ASIS.DOCENTE`). Si actualizas el Excel, hay que volver a correr el
script de agregación (pandas) para regenerar este archivo con los mismos nombres de clave
que usa `script.js` — de lo contrario el dashboard no encontrará los campos esperados.

## Estructura de `data.json`

```
{
  "municipio": { ... },            // KPIs consolidados de todo el municipio
  "programa_muni": [ ... ],        // desglose por Programa (Primaria, Secundaria, etc.)
  "turno_muni": [ ... ],           // desglose por Turno
  "area_muni": [ ... ],            // desglose Rural/Urbano
  "tendencia_mensual": [ ... ],    // asistencia promedio por mes (ene–jul)
  "ner_list": [ ... ],             // un objeto por cada uno de los 26 NER
  "centros_por_ner": { "NER": [ ... escuelas ... ] },
  "top_aprobacion": [ ... ],       // top 10 escuelas con mayor aprobación
  "bottom_aprobacion": [ ... ],    // 10 escuelas con menor aprobación
  "top_permanencia": [ ... ],
  "bottom_permanencia": [ ... ]
}
```

## Publicarlo en GitHub Pages (recomendado)

Esta es la forma más simple de que el dashboard funcione sin depender de Live Server ni de
que abras el archivo con doble clic — GitHub lo sirve por HTTP real, que es justo lo que
`fetch('data.json')` necesita.

1. Crea un repositorio en GitHub y sube estos 5 archivos (`index.html`, `styles.css`,
   `script.js`, `data.json`, `README.md`) a la raíz del repo (o a una carpeta, ej. `/docs`).
2. En el repositorio: **Settings → Pages**.
3. En "Source" elige la rama (`main`) y la carpeta donde quedaron los archivos (`/ (root)`
   o `/docs`).
4. Guarda. GitHub te da una URL tipo `https://tu-usuario.github.io/tu-repo/`.
5. Esa misma URL funciona igual en PC, tablet o teléfono — no necesitas nada especial.

## Diseño responsivo (se adapta solo a PC y a teléfono)

El dashboard usa **CSS responsivo** (media queries): el navegador le informa al CSS el ancho
real de la pantalla, y el CSS decide cómo acomodar las tarjetas, gráficos y tablas. No hay
que configurar nada ni detectar el dispositivo — es automático:

- **PC / pantallas anchas:** KPIs en fila de 6, gráficos lado a lado, tablas completas.
- **Tablet (≤900px):** los gráficos y rankings pasan a una sola columna.
- **Teléfono (≤600px):** tipografía y espaciados más compactos, las estadísticas del encabezado
  pasan a una cuadrícula 2×2, y las tablas anchas (con muchas columnas) se navegan con scroll
  horizontal — aparece un aviso "↔ Desliza para ver todas las columnas" para que quede claro.

Si quieres probarlo sin subir nada: en Chrome/Brave abre el DevTools (`F12`) → ícono de
celular/tablet (`Toggle device toolbar`) → elige un modelo de teléfono. Verás el mismo
`index.html` acomodarse solo.

## Metodología

- **Permanencia** = Matrícula Actual ÷ Matrícula Inicial
- **Aprobación** = Aprobados ÷ Matrícula Actual
- **Reprobación** = Total de Reprobados ÷ Matrícula Actual
- **Asistencia estudiantil/docente** = promedio de los registros diarios reportados
  entre enero y julio 2026.
