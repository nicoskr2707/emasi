/**
 * Lógica de la página de detalle de una propiedad (propiedad.html?id=...).
 */

(async function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  const estadoCarga = document.getElementById("estado-carga");
  const contenido = document.getElementById("detalle-propiedad");
  const noEncontrada = document.getElementById("no-encontrada");

  if (!id) {
    mostrarNoEncontrada();
    return;
  }

  try {
    const propiedades = await cargarPropiedades();
    const prop = propiedades.find((p) => p.id === id);

    if (!prop) {
      mostrarNoEncontrada();
      return;
    }

    renderDetalle(prop);
    estadoCarga.hidden = true;
    contenido.hidden = false;

    if (prop.lat && prop.lng && typeof L !== "undefined") {
      renderMapaPropiedad("mapa-propiedad", prop);
    } else {
      const mapaSeccion = document.getElementById("seccion-mapa");
      if (mapaSeccion) mapaSeccion.hidden = true;
    }

    actualizarSEO(prop);
  } catch (err) {
    console.error(err);
    estadoCarga.innerHTML = `
      <p><strong>No pudimos cargar la propiedad.</strong></p>
      <p>Si estás abriendo este archivo directamente desde tu computadora (file://), los
      navegadores bloquean la lectura del CSV. Serví la carpeta con un servidor local o
      publicala en GitHub Pages y volverá a funcionar.</p>`;
  }

  function mostrarNoEncontrada() {
    estadoCarga.hidden = true;
    noEncontrada.hidden = false;
  }

  function filaSpec(etiqueta, valor) {
    if (valor === null || valor === undefined || valor === "") return "";
    return `<div class="spec-row"><dt>${etiqueta}</dt><dd>${escapeHTML(String(valor))}</dd></div>`;
  }

  function renderDetalle(prop) {
    document.getElementById("breadcrumb-barrio").textContent = prop.barrio || "Buenos Aires";
    document.getElementById("breadcrumb-titulo").textContent = prop.titulo;

    document.getElementById("detalle-titulo").textContent = prop.titulo;
    document.getElementById("detalle-direccion").textContent = prop.direccion || prop.barrio;
    document.getElementById("detalle-codigo").textContent = prop.codigoReferencia
      ? `Código ${prop.codigoReferencia}`
      : "";

    const badges = document.getElementById("detalle-badges");
    badges.innerHTML = prop.operaciones
      .map((op) => `<span class="badge badge--${op.tipo.replace("_temp", "-temp")}">${formatPrecio(op)}</span>`)
      .join("");
    if (prop.operaciones.length === 0) {
      badges.innerHTML = `<span class="badge badge--consultar">Consultar precio</span>`;
    }

    const galeria = document.getElementById("galeria-fotos");
    const fotosRestantes = prop.fotoPortada ? prop.cantidadFotos - 1 : 0;
    galeria.innerHTML = `
      <div class="galeria__principal">
        ${fotoHTML(prop)}
        ${fotosRestantes > 0 ? `<span class="galeria__badge">+${fotosRestantes} fotos próximamente</span>` : ""}
      </div>`;

    const specs = document.getElementById("detalle-specs");
    specs.innerHTML = [
      filaSpec("Tipo", prop.tipo),
      filaSpec("Ambientes", prop.ambientes),
      filaSpec("Dormitorios", prop.dormitorios),
      filaSpec("Baños", prop.banos),
      filaSpec("Toilettes", prop.toilettes),
      filaSpec("Cocheras", prop.cocheras),
      filaSpec("Superficie cubierta", prop.supCubierta ? `${formatNumero(prop.supCubierta)} ${prop.unidadSuperficie}` : ""),
      filaSpec("Superficie total", prop.supTotal ? `${formatNumero(prop.supTotal)} ${prop.unidadSuperficie}` : ""),
      filaSpec("Antigüedad", prop.antiguedad !== null ? `${prop.antiguedad} años` : ""),
      filaSpec("Condición", prop.condicion),
      filaSpec("Situación", prop.situacion),
      filaSpec("Orientación", prop.orientacion),
      filaSpec("Apto crédito", prop.aptoCredito),
      filaSpec("Expensas", prop.expensas ? `$${formatNumero(prop.expensas)}` : ""),
    ].join("");

    document.getElementById("detalle-descripcion").textContent =
      prop.descripcion || "Consultá con nuestro equipo para más información sobre esta propiedad.";

    const tagsEl = document.getElementById("detalle-tags");
    if (prop.tags.length > 0) {
      tagsEl.innerHTML = prop.tags.map((t) => `<li class="chip">${escapeHTML(t)}</li>`).join("");
    } else {
      document.getElementById("seccion-tags").hidden = true;
    }

    document.title = `${prop.titulo} | ${prop.barrio || "Propiedades"} — Emasi Propiedades`;
  }

  function actualizarSEO(prop) {
    const op = operacionPrincipal(prop);
    const descripcionCorta = (prop.descripcion || "").slice(0, 155);
    setMeta("description", `${prop.titulo} en ${prop.barrio}. ${formatPrecio(op)}. ${descripcionCorta}`);
    setMeta("og:title", prop.titulo, true);
    setMeta("og:description", descripcionCorta, true);
    setMeta("og:type", "website", true);
    setMeta("og:url", location.href, true);

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Apartment",
      name: prop.titulo,
      description: prop.descripcion,
      address: {
        "@type": "PostalAddress",
        streetAddress: prop.direccion,
        addressLocality: prop.barrio,
        addressRegion: "Ciudad Autónoma de Buenos Aires",
        addressCountry: "AR",
      },
      numberOfRooms: prop.ambientes || undefined,
      floorSize: prop.supTotal
        ? { "@type": "QuantitativeValue", value: prop.supTotal, unitCode: "MTK" }
        : undefined,
      geo:
        prop.lat && prop.lng
          ? { "@type": "GeoCoordinates", latitude: prop.lat, longitude: prop.lng }
          : undefined,
      offers: op
        ? {
            "@type": "Offer",
            price: op.precio,
            priceCurrency: op.moneda,
            availability: "https://schema.org/InStock",
          }
        : undefined,
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }

  function setMeta(name, content, isProperty) {
    const attr = isProperty ? "property" : "name";
    let tag = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, name);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  }
})();
