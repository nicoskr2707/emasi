/**
 * Lógica de la página de detalle de una propiedad (propiedad.html?id=...).
 */

(async function () {
  // Ficha estática (propiedades/<slug>/): el contenido ya viene en el HTML;
  // acá solo se agregan el carrusel de fotos y el mapa.
  const fichaId = document.body.dataset.fichaId;
  if (fichaId) {
    try {
      const propiedades = await cargarPropiedades();
      const prop = propiedades.find((p) => p.id === fichaId);
      if (!prop) return;
      renderGaleria(document.getElementById("galeria-fotos"), prop);
      if (prop.lat && prop.lng && typeof L !== "undefined") {
        renderMapaPropiedad("mapa-propiedad", prop);
      } else {
        const mapaSeccion = document.getElementById("seccion-mapa");
        if (mapaSeccion) mapaSeccion.hidden = true;
      }
    } catch (err) {
      console.error(err);
    }
    return;
  }

  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  // Enlaces viejos (propiedad.html?id=…): si ya existe la ficha estática, redirigir.
  if (id) {
    const indice = await cargarIndiceFichas();
    if (indice[id]) {
      location.replace(new URL(indice[id].url, RAIZ_SITIO).href);
      return;
    }
  }

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

    renderGaleria(document.getElementById("galeria-fotos"), prop);

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

  /**
   * Carrusel de fotos: pista con scroll-snap (el swipe en mobile sale
   * gratis), flechas, contador, miniaturas y teclado (← →).
   */
  function renderGaleria(galeria, prop) {
    const fotos = prop.fotos.length ? prop.fotos : prop.fotoPortada ? [prop.fotoPortada] : [];

    if (fotos.length <= 1) {
      galeria.innerHTML = `<div class="galeria__principal">${fotoHTML(prop)}</div>`;
      return;
    }

    const total = fotos.length;
    const altFoto = (i) =>
      prop.fotosDescripciones[i] || `Foto ${i + 1} de ${total} de ${prop.titulo}`;

    const slides = fotos
      .map(
        (url, i) => `
        <div class="galeria__slide" role="group" aria-roledescription="foto" aria-label="${i + 1} de ${total}">
          <img
            class="media-foto"
            src="${escapeHTML(url)}"
            alt="${escapeHTML(altFoto(i))}"
            ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
            decoding="async"
            onerror="manejarErrorFoto(this)"
          />
        </div>`
      )
      .join("");

    const miniaturas = fotos
      .map(
        (url, i) => `
        <button type="button" class="galeria__mini" data-indice="${i}" aria-label="Ver foto ${i + 1}">
          <img src="${escapeHTML(url)}" alt="" loading="lazy" decoding="async" onerror="manejarErrorFoto(this)" />
        </button>`
      )
      .join("");

    galeria.setAttribute("aria-roledescription", "carrusel");
    galeria.innerHTML = `
      <div class="galeria__principal galeria__principal--carrusel" tabindex="0">
        <div class="galeria__pista">${slides}</div>
        <button type="button" class="galeria__flecha galeria__flecha--prev" aria-label="Foto anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button type="button" class="galeria__flecha galeria__flecha--next" aria-label="Foto siguiente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <span class="galeria__badge" aria-live="polite"><span class="galeria__actual">1</span> / ${total}</span>
      </div>
      <div class="galeria__miniaturas">${miniaturas}</div>`;

    const principal = galeria.querySelector(".galeria__principal");
    const pista = galeria.querySelector(".galeria__pista");
    const prev = galeria.querySelector(".galeria__flecha--prev");
    const next = galeria.querySelector(".galeria__flecha--next");
    const contador = galeria.querySelector(".galeria__actual");
    const minis = Array.from(galeria.querySelectorAll(".galeria__mini"));
    let actual = -1;
    const movimiento = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

    function irA(i) {
      const destino = Math.max(0, Math.min(total - 1, i));
      pista.scrollTo({ left: destino * pista.clientWidth, behavior: movimiento });
    }

    function marcar(i) {
      if (i === actual) return;
      actual = i;
      contador.textContent = i + 1;
      prev.disabled = i === 0;
      next.disabled = i === total - 1;
      minis.forEach((m, j) => {
        const activa = j === i;
        m.classList.toggle("activa", activa);
        if (activa) m.setAttribute("aria-current", "true");
        else m.removeAttribute("aria-current");
      });
      const mini = minis[i];
      const tira = mini.parentElement;
      tira.scrollTo({
        left: mini.offsetLeft - (tira.clientWidth - mini.offsetWidth) / 2,
        behavior: movimiento,
      });
    }

    let pendiente = false;
    pista.addEventListener(
      "scroll",
      () => {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(() => {
          pendiente = false;
          marcar(Math.round(pista.scrollLeft / pista.clientWidth));
        });
      },
      { passive: true }
    );

    prev.addEventListener("click", () => irA(actual - 1));
    next.addEventListener("click", () => irA(actual + 1));
    minis.forEach((m) => m.addEventListener("click", () => irA(Number(m.dataset.indice))));
    principal.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); irA(actual - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); irA(actual + 1); }
    });
    // Al cambiar el ancho (rotar el celular), mantener la foto actual alineada.
    window.addEventListener("resize", () => {
      pista.scrollTo({ left: actual * pista.clientWidth });
    });

    marcar(0);
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
