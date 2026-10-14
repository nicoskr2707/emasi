# Emasi Propiedades — sitio web unificado

Sitio estático (HTML, CSS y JavaScript puro, sin frameworks ni build step) que recrea el contenido real de **emasi.com.ar** (Hostinger Website Builder) y le suma un catálogo de propiedades propio, integrado en la sección "Propiedades".

> **Importante:** por ahora este sitio vive solo en esta carpeta, en tu computadora. Todavía no decidimos dónde publicarlo (GitHub Pages, Netlify, u otro hosting) — eso lo vemos en otro momento. Mientras tanto podés revisarlo localmente con los pasos de más abajo.

## Qué contiene

Recreación completa de las páginas que ya existen en emasi.com.ar, con la identidad del **EMASI Design System** (TT Neoris, verde `#004742` y navy `#102D3E`, celeste `#91B3CF` como único acento, logo apilado oficial e isotipo como marca de agua; fuentes y logos incluidos en `assets/fonts` y `assets/img`) y las fotos reales del sitio **más** el catálogo de propiedades que antes solo vivía en una carpeta aparte:

| Página | Archivo | Contenido |
|---|---|---|
| Inicio | `index.html` | Hero institucional + **barra de búsqueda rápida** (nueva) + servicios + proyectos inmobiliarios |
| Nosotros | `nosotros.html` | Historia de Jaime Skranda + proceso de 3 pasos |
| Tasaciones | `tasaciones.html` | CTA para coordinar una tasación |
| Formulario | `formulario.html` | Formulario de tasación (vendé/alquilá con nosotros) |
| **Propiedades** | `propiedades.html` | **El catálogo**: listado con filtros, mapa general y fichas de detalle — antes esta página solo tenía dos botones que llevaban a Argenprop |
| Contacto | `contacto.html` | Formulario de consulta general |
| Detalle de propiedad | `propiedad.html?id=…` | Ficha completa de cada propiedad |

### La barra de búsqueda rápida del Home

En `index.html`, debajo del hero, hay un buscador compacto (texto libre + operación). Al enviarlo, redirige a `propiedades.html?q=...&operacion=...`, y esa página lee esos parámetros de la URL para precargar los filtros automáticamente y mostrar los resultados ya filtrados. No hace falta ningún backend — es todo client-side.

## Cómo funciona la actualización automática del catálogo

El catálogo **no tiene datos hardcodeados**. Cada vez que se abre `propiedades.html` o `propiedad.html`, el JavaScript lee `propiedades.csv` y dibuja las propiedades en pantalla. El flujo de trabajo:

1. Corrés el script que ya tenías para traer las propiedades actualizadas desde Tokko:
   ```bash
   export TOKKO_API_KEY="tu_api_key"
   python3 tokko_propiedades_csv.py
   ```
2. Subís/publicás el `propiedades.csv` actualizado junto con el resto del sitio.
3. El catálogo muestra las propiedades nuevas automáticamente, sin tocar ningún HTML.

Solo se muestran las propiedades con `estado_listado = activa`.

## Fotos

Cada propiedad del catálogo muestra su foto de portada real (campo `foto_portada` del CSV). Si falta o no carga, cae a un ilustración placeholder, nunca se rompe. Las fotos institucionales (hero, galería "Proyectos inmobiliarios", foto de Jaime en Nosotros) son las mismas que ya están publicadas en emasi.com.ar — se referencian directamente desde ahí.

## Mapas

Leaflet + OpenStreetMap (gratis, sin API key) en `propiedades.html` (mapa general) y en cada ficha de `propiedad.html` (mapa individual), usando lat/long del CSV.

## Formularios sin backend

Como el sitio es 100% estático, los 3 formularios (`formulario.html`, `contacto.html` y la búsqueda rápida) no envían datos a ningún servidor — arman el mensaje y abren WhatsApp o el cliente de correo del visitante, ya precargado, para que solo falte confirmar el envío. Esto respeta la preferencia de contacto que la persona elija en el formulario de tasación.

## Estructura de archivos

```
index.html, nosotros.html, tasaciones.html, formulario.html,
contacto.html, propiedades.html, propiedad.html, 404.html
assets/css/styles.css      → todos los estilos (EMASI Design System)
assets/fonts/              → TT Neoris + Golos Text (woff2)
assets/img/                → logo verde, logo blanco, isotipo, favicon
assets/js/
  csv-parse.js, data.js, cards.js, map.js  → motor del catálogo (sin cambios de marca)
  main.js                   → filtros de propiedades.html + lee ?q=&operacion= de la URL
  property.js                → ficha de detalle
assets/img/favicon.svg
propiedades.csv            → datos (se sobrescribe con el script de Tokko)
tokko_propiedades_csv.py   → script de sincronización (sin cambios)
robots.txt / sitemap.xml   → SEO (apuntan a emasi.com.ar)
```

## Ver el sitio en tu computadora

Los navegadores bloquean la lectura de archivos locales (el CSV) cuando abrís un HTML con doble clic (`file://`). Para probarlo necesitás un servidor local. Esta Mac no tiene Python por línea de comandos, pero sí trae Ruby:

```bash
cd "/Users/valentinaagrelobelloni/Desktop/Prueba con jor" && ruby -run -e httpd . -p 8000
```

Y abrís **http://localhost:8000/** en el navegador (no el ícono del archivo). `Ctrl+C` en la terminal para cortarlo.

## Pendiente (cuando quieras retomarlo)

- **Hosting y dominio real**: decidir dónde se publica (hoy `emasi.com.ar` corre en Hostinger Website Builder, un editor visual al que no tengo acceso — no puedo editarlo directamente). Las opciones y sus implicancias quedaron charladas, listas para retomar cuando quieras.
- Galería de fotos completa por propiedad (hoy se muestra la portada).
- Automatizar la sincronización del CSV con Tokko (hoy es manual).
