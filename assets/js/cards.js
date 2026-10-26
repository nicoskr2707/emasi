/**
 * Render de tarjetas de propiedad (grilla de listados) y helpers
 * de marcado compartidos entre index y la página de detalle.
 */

const PLACEHOLDER_SVG = `
  <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Foto próximamente">
    <rect width="400" height="300" fill="var(--placeholder-bg)" />
    <g fill="var(--placeholder-icon)" opacity="0.9">
      <path d="M200 95 L265 150 L255 150 L255 205 L215 205 L215 165 L185 165 L185 205 L145 205 L145 150 L135 150 Z" />
    </g>
    <text x="200" y="240" text-anchor="middle" font-family="TT Neoris, Golos Text, Arial, sans-serif" font-size="14" fill="var(--placeholder-text)">
      Foto próximamente
    </text>
  </svg>`;

/**
 * Markup de la foto de portada. Si la propiedad trae "foto_portada" (CSV)
 * se muestra esa imagen real; si falla al cargar o no existe, se cae al
 * placeholder genérico — nunca queda un ícono roto.
 */
function manejarErrorFoto(img) {
  img.outerHTML = PLACEHOLDER_SVG;
}

function fotoHTML(prop) {
  if (!prop.fotoPortada) return PLACEHOLDER_SVG;
  return `
    <img
      class="media-foto"
      src="${escapeHTML(prop.fotoPortada)}"
      alt="Foto de portada de ${escapeHTML(prop.titulo)}"
      loading="lazy"
      decoding="async"
      onerror="manejarErrorFoto(this)"
    />`;
}

function badgeOperacion(op) {
  const clase = op ? op.tipo.replace("_temp", "-temp") : "consultar";
  const texto = op ? ETIQUETA_OPERACION[op.tipo] : "Consultar";
  return `<span class="badge badge--${clase}">${texto}</span>`;
}

/** Íconos de línea fina (estilo Lucide, trazo 1.5) — la marca no usa emoji. */
const ICONO = {
  ambientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
  dormitorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 17h20"/></svg>',
  banos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.68 3 4 3.68 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M2 12h20"/><path d="M7 19v2M17 19v2"/></svg>',
  superficie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h4M3 15h4M9 3v4M15 3v4"/></svg>',
};

function specIcon(valor, icono, etiqueta) {
  if (!valor) return "";
  return `<span class="spec" title="${etiqueta}"><span class="spec__icon" aria-hidden="true">${icono}</span>${valor} <span class="spec__label">${etiqueta}</span></span>`;
}

function propertyCardHTML(prop) {
  const op = operacionPrincipal(prop);
  const specs = [
    specIcon(prop.ambientes, ICONO.ambientes, prop.ambientes === 1 ? "amb." : "ambs."),
    specIcon(prop.dormitorios, ICONO.dormitorios, prop.dormitorios === 1 ? "dorm." : "dorms."),
    specIcon(prop.banos, ICONO.banos, "baños"),
    specIcon(formatSuperficie(prop), ICONO.superficie, ""),
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="card" data-id="${prop.id}">
      <a class="card__media" href="${escapeHTML(urlFicha(prop))}" aria-label="Ver detalle de ${escapeHTML(prop.titulo)}">
        ${fotoHTML(prop)}
        ${badgeOperacion(op)}
      </a>
      <div class="card__body">
        <p class="card__precio">${formatPrecio(op)}</p>
        <h3 class="card__titulo">
          <a href="${escapeHTML(urlFicha(prop))}">${escapeHTML(prop.titulo)}</a>
        </h3>
        <p class="card__ubicacion">${escapeHTML(prop.barrio || "Buenos Aires")}</p>
        <div class="card__specs">${specs}</div>
      </div>
    </article>`;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderCards(container, props) {
  if (props.length === 0) {
    container.innerHTML = `
      <div class="estado-vacio">
        <p>No encontramos propiedades que coincidan con tu búsqueda.</p>
        <p>Probá ajustar o quitar algunos filtros.</p>
      </div>`;
    return;
  }
  container.innerHTML = props.map(propertyCardHTML).join("");
}
