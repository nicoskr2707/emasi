#!/usr/bin/env python3
"""
Genera una página HTML estática por propiedad a partir de propiedades.csv.

Por qué: Google indexa mucho mejor una URL propia con su título, descripción,
H1 y datos estructurados en el HTML que una única propiedad.html?id=… armada
con JavaScript. Las fichas generadas quedan en propiedades/<slug>/index.html
y el JavaScript del sitio solo las "mejora" (carrusel de fotos y mapa).

Qué hace:
  1. Lee propiedades.csv (solo filas con estado_listado = activa).
  2. Escribe propiedades/<slug>/index.html usando propiedad.html como plantilla.
  3. Si una propiedad que ya tenía ficha deja de estar activa, su página pasa a
     "ya no está disponible" (noindex) con propiedades similares, en vez de
     dar error 404: los enlaces compartidos o de avisos siguen funcionando.
  4. Actualiza assets/data/fichas.json (id → URL), el sitemap.xml y la lista
     de enlaces del catálogo en propiedades.html.

Solo usa campos públicos del CSV (los mismos que ya muestra la ficha).
Nunca escribe direccion_real, productor, productor_email ni coordenadas
en el HTML generado.

Uso (desde la raíz del repo, Python 3.8+, sin dependencias):
    python3 scripts/generar_fichas.py
"""

import csv
import datetime as dt
import html
import json
import re
import shutil
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SITIO = "https://emasi.com.ar/"
CSV = RAIZ / "propiedades.csv"
PLANTILLA = RAIZ / "propiedad.html"
CARPETA = RAIZ / "propiedades"
INDICE = RAIZ / "assets" / "data" / "fichas.json"
SITEMAP = RAIZ / "sitemap.xml"
CATALOGO = RAIZ / "propiedades.html"
PREFIJO = "../../"  # de propiedades/<slug>/ a la raíz

PAGINAS_FIJAS = [
    ("", "weekly", "1.0"),
    ("propiedades.html", "daily", "0.9"),
    ("tasaciones.html", "monthly", "0.7"),
    ("nosotros.html", "monthly", "0.6"),
    ("contacto.html", "monthly", "0.5"),
]

ETIQUETA_OPERACION = {"venta": "Venta", "alquiler": "Alquiler", "alquiler_temp": "Alquiler temporario"}
TIPO_SCHEMA = {
    "departamento": "Apartment",
    "casa": "House",
    "ph": "House",
    "monoambiente": "Apartment",
}


# ---------- Datos ----------

def texto(v):
    return "" if v is None else str(v).strip()


def numero(v):
    s = texto(v)
    if not s:
        return None
    try:
        n = float(s)
    except ValueError:
        return None
    return int(n) if n.is_integer() else n


def fmt_num(n):
    if n is None:
        return ""
    if isinstance(n, float):
        entero, dec = f"{n:,.2f}".split(".")
        dec = dec.rstrip("0")
        s = entero.replace(",", ".") + ("," + dec if dec else "")
        return s
    return f"{n:,}".replace(",", ".")


def operaciones(fila):
    ops = []
    if numero(fila.get("venta_precio")):
        ops.append({"tipo": "venta", "moneda": texto(fila.get("venta_moneda")) or "USD",
                    "precio": numero(fila["venta_precio"])})
    if numero(fila.get("alquiler_precio")):
        ops.append({"tipo": "alquiler", "moneda": texto(fila.get("alquiler_moneda")) or "ARS",
                    "precio": numero(fila["alquiler_precio"])})
    if numero(fila.get("alquiler_temp_precio")):
        ops.append({"tipo": "alquiler_temp", "moneda": texto(fila.get("alquiler_temp_moneda")) or "USD",
                    "precio": numero(fila["alquiler_temp_precio"]),
                    "periodo": texto(fila.get("alquiler_temp_periodo"))})
    return ops


def fmt_precio(op):
    if not op:
        return "Consultar precio"
    periodo = ""
    if op["tipo"] == "alquiler":
        periodo = " / mes"
    elif op["tipo"] == "alquiler_temp" and op.get("periodo"):
        periodo = f" / {op['periodo']}"
    return f"{op['moneda']} {fmt_num(op['precio'])}{periodo}"


def fotos(fila):
    lista = [f.strip() for f in texto(fila.get("fotos")).split("|") if f.strip()]
    descs = [d.strip() for d in texto(fila.get("fotos_descripciones")).split("|")]
    portada = texto(fila.get("foto_portada")) or (lista[0] if lista else "")
    pares = list(zip(lista, descs + [""] * (len(lista) - len(descs))))
    if portada:
        pares = [p for p in pares if p[0] != portada]
        pares.insert(0, (portada, ""))
    return pares


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def propiedad(fila):
    ops = operaciones(fila)
    principal = ops[0] if ops else None
    ambientes = numero(fila.get("ambientes"))
    sup = numero(fila.get("sup_cubierta")) or numero(fila.get("sup_total"))
    tipo = texto(fila.get("tipo")) or "Propiedad"
    barrio = texto(fila.get("barrio_localidad")) or "Buenos Aires"
    pid = texto(fila.get("id"))
    op_nombre = ETIQUETA_OPERACION[principal["tipo"]] if principal else "Propiedad"

    partes = [op_nombre, tipo.lower()]
    if ambientes:
        partes.append(f"{fmt_num(ambientes)} ambiente" + ("s" if ambientes != 1 else ""))
    nombre = " ".join(partes) + f" en {barrio}"

    slug = slugify("-".join(
        [op_nombre, tipo, barrio] + ([f"{ambientes}-ambientes"] if ambientes else []) + [pid]
    ))
    return {
        "id": pid,
        "codigo": texto(fila.get("codigo_referencia")),
        "estado": texto(fila.get("estado_listado")).lower(),
        "titulo_tokko": texto(fila.get("titulo")),
        "nombre": nombre,
        "tipo": tipo,
        "barrio": barrio,
        "direccion": texto(fila.get("direccion")),
        "ops": ops,
        "principal": principal,
        "ambientes": ambientes,
        "dormitorios": numero(fila.get("dormitorios")),
        "banos": numero(fila.get("banos")),
        "toilettes": numero(fila.get("toilettes")),
        "cocheras": numero(fila.get("cocheras")),
        "sup_cubierta": numero(fila.get("sup_cubierta")),
        "sup_total": numero(fila.get("sup_total")),
        "sup": sup,
        "unidad": texto(fila.get("unidad_superficie")) or "m²",
        "antiguedad": numero(fila.get("antiguedad")),
        "condicion": texto(fila.get("condicion")),
        "situacion": texto(fila.get("situacion")),
        "orientacion": texto(fila.get("orientacion")),
        "apto_credito": texto(fila.get("apto_credito")),
        "expensas": numero(fila.get("expensas")),
        "tags": [t.strip() for t in texto(fila.get("tags")).split(",") if t.strip()],
        "fotos": fotos(fila),
        "descripcion": texto(fila.get("descripcion")),
        "creada": texto(fila.get("creada"))[:10],
        "slug": slug,
        "ruta": f"propiedades/{slug}/",
    }


def unidad_legible(u):
    return "m²" if u.upper() in ("M2", "M²") else u


# ---------- HTML ----------

def e(s):
    return html.escape(str(s), quote=True)


def prefijar_rutas(doc):
    """Ajusta href/src relativos para que funcionen desde propiedades/<slug>/."""
    return re.sub(
        r'\b(href|src)="(?!https?:|//|#|mailto:|tel:|data:|/)([^"]+)"',
        lambda m: f'{m.group(1)}="{PREFIJO}{m.group(2)}"',
        doc,
    )


def titulo_seo(p, repetidos):
    t = p["nombre"]
    if p["sup"]:
        t = t.replace(" en ", f", {fmt_num(p['sup'])} m², en ", 1)
    if t in repetidos and p["codigo"]:
        t += f" · {p['codigo']}"
    return t


def descripcion_seo(p):
    datos = [fmt_precio(p["principal"])]
    if p["sup"]:
        datos.append(f"{fmt_num(p['sup'])} m²")
    if p["dormitorios"]:
        datos.append(f"{fmt_num(p['dormitorios'])} dorm.")
    if p["condicion"]:
        datos.append(p["condicion"].lower())
    base = f"{p['nombre']}. " + ", ".join(datos) + "."
    resto = re.sub(r"\s+", " ", p["descripcion"])
    if resto:
        base += " " + resto
    if len(base) > 158:
        base = base[:155].rsplit(" ", 1)[0] + "…"
    return base


def spec(etiqueta, valor):
    if valor in (None, ""):
        return ""
    return f'<div class="spec-row"><dt>{e(etiqueta)}</dt><dd>{e(valor)}</dd></div>'


def specs_html(p):
    u = unidad_legible(p["unidad"])
    filas = [
        spec("Tipo", p["tipo"]),
        spec("Ambientes", fmt_num(p["ambientes"])),
        spec("Dormitorios", fmt_num(p["dormitorios"])),
        spec("Baños", fmt_num(p["banos"])),
        spec("Toilettes", fmt_num(p["toilettes"])),
        spec("Cocheras", fmt_num(p["cocheras"])),
        spec("Superficie cubierta", f"{fmt_num(p['sup_cubierta'])} {u}" if p["sup_cubierta"] else ""),
        spec("Superficie total", f"{fmt_num(p['sup_total'])} {u}" if p["sup_total"] else ""),
        spec("Antigüedad", f"{fmt_num(p['antiguedad'])} años" if p["antiguedad"] is not None else ""),
        spec("Condición", p["condicion"]),
        spec("Situación", p["situacion"]),
        spec("Orientación", p["orientacion"]),
        spec("Apto crédito", p["apto_credito"]),
        spec("Expensas", f"${fmt_num(p['expensas'])}" if p["expensas"] else ""),
    ]
    return "".join(f for f in filas if f)


def badges_html(p):
    if not p["ops"]:
        return '<span class="badge badge--consultar">Consultar precio</span>'
    return "".join(
        f'<span class="badge badge--{op["tipo"].replace("_temp", "-temp")}">{e(fmt_precio(op))}</span>'
        for op in p["ops"]
    )


def galeria_html(p):
    if not p["fotos"]:
        return ""
    url, desc = p["fotos"][0]
    alt = desc or f"Foto de {p['nombre']}"
    return (f'<div class="galeria__principal"><img class="media-foto" src="{e(url)}" '
            f'alt="{e(alt)}" fetchpriority="high" decoding="async" '
            f'onerror="manejarErrorFoto(this)" /></div>')


def json_ld(p, titulo, desc):
    url = SITIO + p["ruta"]
    principal = p["principal"]
    entidad = {
        "@type": TIPO_SCHEMA.get(p["tipo"].lower(), "Accommodation"),
        "name": p["nombre"],
        "address": {
            "@type": "PostalAddress",
            "streetAddress": p["direccion"] or None,
            "addressLocality": p["barrio"],
            "addressRegion": "Ciudad Autónoma de Buenos Aires",
            "addressCountry": "AR",
        },
        "numberOfRooms": p["ambientes"],
        "numberOfBedrooms": p["dormitorios"],
        "numberOfBathroomsTotal": p["banos"],
        "floorSize": {"@type": "QuantitativeValue", "value": p["sup"], "unitCode": "MTK"} if p["sup"] else None,
    }
    listado = {
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        "name": titulo,
        "description": desc,
        "url": url,
        "datePosted": p["creada"] or None,
        "image": [f for f, _ in p["fotos"][:6]] or None,
        "mainEntity": entidad,
        "offers": {
            "@type": "Offer",
            "price": principal["precio"],
            "priceCurrency": principal["moneda"],
            "businessFunction": "http://purl.org/goodrelations/v1#" + (
                "Sell" if principal["tipo"] == "venta" else "LeaseOut"),
            "availability": "https://schema.org/InStock",
            "seller": {"@type": "RealEstateAgent", "name": "Emasi Propiedades", "url": SITIO},
        } if principal else None,
    }
    migas = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITIO},
            {"@type": "ListItem", "position": 2, "name": "Propiedades", "item": SITIO + "propiedades.html"},
            {"@type": "ListItem", "position": 3, "name": p["nombre"], "item": url},
        ],
    }

    def limpiar(o):
        if isinstance(o, dict):
            return {k: limpiar(v) for k, v in o.items() if v not in (None, "", [])}
        if isinstance(o, list):
            return [limpiar(v) for v in o]
        return o

    bloques = [limpiar(listado), migas]
    return "\n".join(
        '<script type="application/ld+json">\n'
        + json.dumps(b, ensure_ascii=False, indent=2).replace("</", "<\\/")
        + "\n</script>"
        for b in bloques
    )


def cabecera(doc, titulo, desc, url, imagen, robots, extra=""):
    doc = re.sub(r"<title>.*?</title>", f"<title>{e(titulo)} | Emasi Propiedades</title>", doc, flags=re.S)
    doc = re.sub(r'<meta name="description" content="[^"]*" />',
                 f'<meta name="description" content="{e(desc)}" />', doc)
    doc = re.sub(r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{url}" />', doc)
    doc = re.sub(r'<meta name="robots" content="[^"]*" />', f'<meta name="robots" content="{robots}" />', doc)
    og = (
        '<meta property="og:type" content="website" />\n'
        '<meta property="og:site_name" content="Emasi Propiedades" />\n'
        f'<meta property="og:title" content="{e(titulo)}" />\n'
        f'<meta property="og:description" content="{e(desc)}" />\n'
        f'<meta property="og:url" content="{url}" />\n'
        + (f'<meta property="og:image" content="{e(imagen)}" />\n' if imagen else "")
        + '<meta property="og:locale" content="es_AR" />\n'
        '<meta name="twitter:card" content="summary_large_image" />\n'
    )
    return doc.replace("</head>", og + extra + ("\n" if extra else "") + "</head>", 1)


def cuerpo(doc, contenido_main, ficha_id=""):
    doc = re.sub(r'<main id="contenido">.*?</main>',
                 lambda _: f'<main id="contenido">\n{contenido_main}\n</main>', doc, flags=re.S)
    if ficha_id:
        doc = doc.replace("<body>", f'<body data-ficha-id="{e(ficha_id)}">', 1)
    return doc


def migas_html(p, prefijo=PREFIJO):
    return (f'  <div class="contenedor">\n    <p class="breadcrumb">\n'
            f'      <a href="{prefijo}index.html">Inicio</a> ›\n'
            f'      <a href="{prefijo}propiedades.html">Propiedades</a> ›\n'
            f'      <span>{e(p["barrio"])}</span> ›\n'
            f'      <span>{e(p["nombre"])}</span>\n    </p>\n  </div>')


def pagina_activa(plantilla, p, titulo):
    desc = descripcion_seo(p)
    url = SITIO + p["ruta"]
    imagen = p["fotos"][0][0] if p["fotos"] else SITIO + "assets/img/sitio/hero-edificio.jpg"
    tags = ""
    if p["tags"]:
        chips = "".join(f'<li class="chip">{e(t)}</li>' for t in p["tags"])
        tags = (f'        <section class="seccion-detalle" id="seccion-tags" style="margin-top:2rem;">\n'
                f'          <h2>Comodidades</h2>\n          <ul class="chips-lista" id="detalle-tags">{chips}</ul>\n'
                f'        </section>\n')
    descripcion = e(p["descripcion"] or "Consultá con nuestro equipo para más información sobre esta propiedad.")
    codigo = f"Código {e(p['codigo'])}" if p["codigo"] else ""
    main = f"""{migas_html(p)}

  <div class="contenedor">
    <article id="detalle-propiedad">
      <div class="detalle__encabezado">
        <div>
          <h1 id="detalle-titulo">{e(titulo)}</h1>
          <p class="detalle__codigo"><span id="detalle-direccion">{e(p["direccion"] or p["barrio"])}</span> · <span id="detalle-codigo">{codigo}</span></p>
        </div>
        <div class="detalle__badges" id="detalle-badges">{badges_html(p)}</div>
      </div>

      <div class="galeria" id="galeria-fotos" aria-label="Galería de fotos">{galeria_html(p)}</div>

      <div class="detalle__layout detalle__layout--full">
        <section class="seccion-detalle">
          <h2>Características</h2>
          <dl class="specs-grid" id="detalle-specs">{specs_html(p)}</dl>
        </section>

        <section class="seccion-detalle" style="margin-top:2rem;">
          <h2>Descripción</h2>
          <p class="detalle__descripcion" id="detalle-descripcion">{descripcion}</p>
        </section>

{tags}        <section class="seccion-detalle" id="seccion-mapa" style="margin-top:2rem;">
          <h2>Ubicación</h2>
          <p>{e(p["barrio"])}, Ciudad de Buenos Aires.</p>
          <div id="mapa-propiedad" class="mapa mapa--chica" role="application" aria-label="Mapa con la ubicación de la propiedad"></div>
        </section>
      </div>
    </article>
  </div>"""
    doc = cabecera(plantilla, titulo, desc, url, imagen, "index, follow", json_ld(p, titulo, desc))
    return cuerpo(doc, main, p["id"])


def pagina_retirada(plantilla, previa, similares):
    """Ficha de una propiedad que ya no está activa: sigue respondiendo, sin indexar."""
    nombre = previa["nombre"]
    lista = "".join(
        f'<li><a href="{PREFIJO}{s["ruta"]}">{e(s["nombre"])}</a> · {e(fmt_precio(s["principal"]))}</li>'
        for s in similares
    )
    bloque_similares = (f'      <h2 style="margin-top:2rem;">Propiedades similares disponibles</h2>\n'
                        f'      <ul>{lista}</ul>\n') if similares else ""
    main = f"""{migas_html({"barrio": previa.get("barrio", ""), "nombre": nombre})}

  <div class="contenedor">
    <section class="no-encontrada">
      <h1>Esta propiedad ya no está disponible</h1>
      <p>{e(nombre)} ya se vendió, se alquiló o fue retirada.</p>
{bloque_similares}      <p><a class="btn btn--primario" href="{PREFIJO}propiedades.html">Ver propiedades disponibles</a></p>
    </section>
  </div>"""
    url = SITIO + previa["ruta"]
    doc = cabecera(plantilla, f"{nombre} (no disponible)",
                   f"{nombre}: esta propiedad ya no está disponible. Mirá propiedades similares en Emasi.",
                   url, "", "noindex, follow")
    return cuerpo(doc, main)


def lista_catalogo(activas):
    """Enlaces a cada ficha dentro de la grilla del catálogo (el JS los reemplaza por tarjetas)."""
    items = "\n".join(
        f'        <li><a href="{p["ruta"]}">{e(p["nombre"])}</a> · {e(fmt_precio(p["principal"]))}</li>'
        for p in activas
    )
    return f"<!-- fichas:inicio -->\n      <ul class=\"fichas-estaticas\">\n{items}\n      </ul>\n      <!-- fichas:fin -->"


def sitemap(activas):
    hoy = dt.date.today().isoformat()
    urls = [(SITIO + ruta, freq, prio, hoy) for ruta, freq, prio in PAGINAS_FIJAS]
    urls += [(SITIO + p["ruta"], "weekly", "0.8", hoy) for p in activas]
    cuerpo_xml = "\n".join(
        f"  <url>\n    <loc>{e(u)}</loc>\n    <lastmod>{m}</lastmod>\n"
        f"    <changefreq>{f}</changefreq>\n    <priority>{pr}</priority>\n  </url>"
        for u, f, pr, m in urls
    )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{cuerpo_xml}\n</urlset>\n")


def escribir_si_cambia(ruta, contenido):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    if ruta.exists() and ruta.read_text(encoding="utf-8") == contenido:
        return False
    ruta.write_text(contenido, encoding="utf-8")
    return True


# ---------- Principal ----------

def main():
    with CSV.open(encoding="utf-8-sig", newline="") as f:
        filas = list(csv.DictReader(f))
    todas = [propiedad(fila) for fila in filas if texto(fila.get("id"))]
    activas = [p for p in todas if p["estado"] == "activa"]

    plantilla = prefijar_rutas(PLANTILLA.read_text(encoding="utf-8"))
    indice_previo = json.loads(INDICE.read_text(encoding="utf-8")) if INDICE.exists() else {}

    # Títulos repetidos (p. ej. varias unidades iguales en un mismo edificio) llevan el código
    vistos, repetidos = {}, set()
    for p in activas:
        t = titulo_seo(p, set())
        repetidos.add(t) if t in vistos else vistos.setdefault(t, p["id"])

    indice, cambios = {}, 0
    for p in activas:
        titulo = titulo_seo(p, repetidos)
        cambios += escribir_si_cambia(RAIZ / p["ruta"] / "index.html", pagina_activa(plantilla, p, titulo))
        indice[p["id"]] = {"url": p["ruta"], "nombre": p["nombre"], "barrio": p["barrio"], "activa": True}

    # Fichas que existían y ya no están activas
    for pid, previa in indice_previo.items():
        if pid in indice:
            continue
        actual = next((p for p in activas if p["id"] == pid), None)
        if actual:
            continue
        previa = dict(previa, ruta=previa["url"])
        similares = [p for p in activas if p["barrio"] == previa.get("barrio")][:3] or activas[:3]
        cambios += escribir_si_cambia(RAIZ / previa["url"] / "index.html",
                                      pagina_retirada(plantilla, previa, similares))
        indice[pid] = dict(indice_previo[pid], activa=False)

    # Carpetas huérfanas (por ejemplo, si cambió el slug de una propiedad activa)
    rutas_validas = {v["url"].rstrip("/").split("/")[-1] for v in indice.values()}
    if CARPETA.exists():
        for carpeta in CARPETA.iterdir():
            if carpeta.is_dir() and carpeta.name not in rutas_validas:
                shutil.rmtree(carpeta)
                cambios += 1

    cambios += escribir_si_cambia(INDICE, json.dumps(indice, ensure_ascii=False, indent=2) + "\n")
    cambios += escribir_si_cambia(SITEMAP, sitemap(activas))

    catalogo = CATALOGO.read_text(encoding="utf-8")
    if "<!-- fichas:inicio -->" in catalogo:
        catalogo = re.sub(r"<!-- fichas:inicio -->.*?<!-- fichas:fin -->",
                          lambda _: lista_catalogo(activas), catalogo, flags=re.S)
    else:
        catalogo = catalogo.replace(
            '<div class="grid-propiedades" id="grid-propiedades" hidden></div>',
            '<div class="grid-propiedades" id="grid-propiedades" hidden>\n      '
            + lista_catalogo(activas) + "\n      </div>", 1)
    cambios += escribir_si_cambia(CATALOGO, catalogo)

    retiradas = sum(1 for v in indice.values() if not v["activa"])
    print(f"Fichas activas: {len(activas)} · retiradas: {retiradas} · archivos modificados: {cambios}")


if __name__ == "__main__":
    main()
