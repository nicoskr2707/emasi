/**
 * Helpers de mapa (Leaflet + tiles de OpenStreetMap).
 * Se usan tanto para el mapa general (todas las propiedades) como
 * para el mapa individual de cada ficha de propiedad.
 */

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIB =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const CENTRO_DEFAULT = [-34.6037, -58.4116]; // Buenos Aires

/** Registro de instancias ya creadas por elementId, para no reinicializar
 * el mapa de Leaflet (y perder su estado) cada vez que cambian los filtros. */
const instanciasMapa = new Map();

function crearMapaBase(elementId, opciones = {}) {
  const mapa = L.map(elementId, {
    center: CENTRO_DEFAULT,
    zoom: 12,
    scrollWheelZoom: false,
    ...opciones,
  });
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIB, maxZoom: 19 }).addTo(mapa);

  mapa.on("focus", () => mapa.scrollWheelZoom.enable());
  mapa.on("blur", () => mapa.scrollWheelZoom.disable());

  return mapa;
}

/** Devuelve (creando si hace falta) el mapa y su capa de marcadores para un elementId dado. */
function obtenerMapa(elementId, opciones) {
  if (instanciasMapa.has(elementId)) return instanciasMapa.get(elementId);
  const mapa = crearMapaBase(elementId, opciones);
  const capaMarcadores = L.layerGroup().addTo(mapa);
  const instancia = { mapa, capaMarcadores };
  instanciasMapa.set(elementId, instancia);
  return instancia;
}

function iconoMarcador() {
  return L.divIcon({
    className: "map-pin",
    html: '<span class="map-pin__dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
  });
}

/** Mapa general: un marcador por cada propiedad con lat/lng válidos. */
function renderMapaGeneral(elementId, propiedades) {
  const conUbicacion = propiedades.filter((p) => p.lat && p.lng);
  const { mapa, capaMarcadores } = obtenerMapa(elementId);
  capaMarcadores.clearLayers();

  if (conUbicacion.length === 0) {
    mapa.setView(CENTRO_DEFAULT, 12);
    return mapa;
  }

  const marcadores = [];
  conUbicacion.forEach((prop) => {
    const op = operacionPrincipal(prop);
    const marcador = L.marker([prop.lat, prop.lng], { icon: iconoMarcador() });
    marcador.bindPopup(`
      <div class="map-popup">
        <strong>${escapeHTML(prop.titulo)}</strong>
        <span>${escapeHTML(prop.barrio)}</span>
        <span class="map-popup__precio">${formatPrecio(op)}</span>
        <a href="${escapeHTML(urlFicha(prop))}">Ver detalle →</a>
      </div>
    `);
    marcador.addTo(capaMarcadores);
    marcadores.push(marcador);
  });

  const grupo = L.featureGroup(marcadores);
  mapa.fitBounds(grupo.getBounds(), { padding: [30, 30], maxZoom: 15 });

  return mapa;
}

/** Mapa individual de una ficha de propiedad. */
function renderMapaPropiedad(elementId, prop) {
  const { mapa, capaMarcadores } = obtenerMapa(elementId, { zoom: 15 });
  capaMarcadores.clearLayers();
  mapa.setView([prop.lat, prop.lng], 15);
  const marcador = L.marker([prop.lat, prop.lng], { icon: iconoMarcador() }).addTo(capaMarcadores);
  marcador.bindPopup(`<strong>${escapeHTML(prop.titulo)}</strong>`).openPopup();
  return mapa;
}
