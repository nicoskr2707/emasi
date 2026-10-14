/**
 * Capa de datos: descarga el CSV, lo normaliza y expone utilidades
 * de formato y filtrado. El sitio es 100% estático: cada vez que
 * "propiedades.csv" se actualiza (por el script de sincronización
 * con Tokko) y se vuelve a publicar, esta función trae los datos nuevos
 * en el próximo acceso de cada visitante — sin recompilar nada.
 */

const CSV_PATH = "propiedades.csv";

function toNumber(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

/** Convierte una fila cruda del CSV en un objeto de propiedad tipado. */
function normalizeProperty(row) {
  const venta_precio = toNumber(row.venta_precio);
  const alquiler_precio = toNumber(row.alquiler_precio);
  const alquiler_temp_precio = toNumber(row.alquiler_temp_precio);

  const operaciones = [];
  if (venta_precio) {
    operaciones.push({ tipo: "venta", moneda: toText(row.venta_moneda) || "USD", precio: venta_precio });
  }
  if (alquiler_precio) {
    operaciones.push({ tipo: "alquiler", moneda: toText(row.alquiler_moneda) || "ARS", precio: alquiler_precio });
  }
  if (alquiler_temp_precio) {
    operaciones.push({
      tipo: "alquiler_temp",
      moneda: toText(row.alquiler_temp_moneda) || "USD",
      precio: alquiler_temp_precio,
      periodo: toText(row.alquiler_temp_periodo),
    });
  }

  const lat = toNumber(row.latitud);
  const lng = toNumber(row.longitud);

  return {
    id: toText(row.id),
    codigoReferencia: toText(row.codigo_referencia),
    estado: toText(row.estado_listado).toLowerCase(),
    titulo: toText(row.titulo) || "Propiedad sin título",
    tipo: toText(row.tipo) || "Propiedad",
    direccion: toText(row.direccion),
    barrio: toText(row.barrio_localidad),
    ubicacionCompleta: toText(row.ubicacion_completa),
    lat: lat !== null && lat !== 0 ? lat : null,
    lng: lng !== null && lng !== 0 ? lng : null,
    operaciones,
    expensas: toNumber(row.expensas),
    ambientes: toNumber(row.ambientes),
    dormitorios: toNumber(row.dormitorios),
    banos: toNumber(row.banos),
    toilettes: toNumber(row.toilettes),
    cocheras: toNumber(row.cocheras),
    supCubierta: toNumber(row.sup_cubierta),
    supSemicubierta: toNumber(row.sup_semicubierta),
    supDescubierta: toNumber(row.sup_descubierta),
    supTotal: toNumber(row.sup_total),
    supTerreno: toNumber(row.sup_terreno),
    unidadSuperficie: toText(row.unidad_superficie) || "m²",
    antiguedad: toNumber(row.antiguedad),
    condicion: toText(row.condicion),
    situacion: toText(row.situacion),
    orientacion: toText(row.orientacion),
    aptoCredito: toText(row.apto_credito),
    sucursal: toText(row.sucursal),
    productor: toText(row.productor),
    productorEmail: toText(row.productor_email),
    emprendimiento: toText(row.emprendimiento),
    tags: toText(row.tags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    cantidadFotos: toNumber(row.cantidad_fotos) || 0,
    fotoPortada: toText(row.foto_portada),
    urlPublica: toText(row.url_publica),
    creada: toText(row.creada),
    descripcion: toText(row.descripcion),
  };
}

/** Trae y parsea el CSV. Devuelve solo propiedades activas (disponibles). */
async function cargarPropiedades() {
  const res = await fetch(`${CSV_PATH}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${CSV_PATH} (HTTP ${res.status})`);
  const text = await res.text();
  const filas = parseCSV(text);
  return filas
    .map(normalizeProperty)
    .filter((p) => p.id && p.estado === "activa");
}

/** Precio principal a mostrar en una tarjeta (prioridad: venta > alquiler > alquiler temp). */
function operacionPrincipal(prop) {
  return (
    prop.operaciones.find((o) => o.tipo === "venta") ||
    prop.operaciones.find((o) => o.tipo === "alquiler") ||
    prop.operaciones.find((o) => o.tipo === "alquiler_temp") ||
    null
  );
}

const ETIQUETA_OPERACION = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temp: "Alquiler temporario",
};

function formatPrecio(op) {
  if (!op) return "Consultar precio";
  const monto = new Intl.NumberFormat("es-AR").format(op.precio);
  const etiqueta = ETIQUETA_OPERACION[op.tipo] || "";
  const periodo = op.tipo === "alquiler_temp" && op.periodo ? ` / ${op.periodo}` : op.tipo === "alquiler" ? " / mes" : "";
  return `${op.moneda} ${monto}${periodo}`;
}

function formatNumero(n) {
  if (n === null || n === undefined) return "";
  return new Intl.NumberFormat("es-AR").format(n);
}

function formatSuperficie(prop) {
  const total = prop.supTotal || prop.supCubierta;
  if (!total) return "";
  return `${formatNumero(total)} ${prop.unidadSuperficie}`;
}

/** Obtiene las opciones únicas de barrios presentes en el dataset, ordenadas. */
function barriosDisponibles(props) {
  return Array.from(new Set(props.map((p) => p.barrio).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

function tiposDisponibles(props) {
  return Array.from(new Set(props.map((p) => p.tipo).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
}
