/**
 * Lógica de la página de inicio: carga el CSV, puebla filtros,
 * renderiza la grilla de propiedades y el mapa general.
 */

(async function () {
  const grid = document.getElementById("grid-propiedades");
  const estadoCarga = document.getElementById("estado-carga");
  const contador = document.getElementById("contador-resultados");
  const selBarrio = document.getElementById("filtro-barrio");
  const selOperacion = document.getElementById("filtro-operacion");
  const selAmbientes = document.getElementById("filtro-ambientes");
  const selOrden = document.getElementById("filtro-orden");
  const inputBusqueda = document.getElementById("filtro-busqueda");
  const inputPrecioDesde = document.getElementById("filtro-precio-desde");
  const inputPrecioHasta = document.getElementById("filtro-precio-hasta");
  const btnLimpiar = document.getElementById("filtro-limpiar");
  const chipTotal = document.getElementById("chip-total");
  const chipBarrios = document.getElementById("chip-barrios");

  let propiedades = [];

  function poblarSelect(select, opciones) {
    opciones.forEach((op) => {
      const o = document.createElement("option");
      o.value = op;
      o.textContent = op;
      select.appendChild(o);
    });
  }

  function aplicarFiltros() {
    const barrio = selBarrio.value;
    const operacion = selOperacion.value;
    const ambientesMin = selAmbientes.value ? Number(selAmbientes.value) : null;
    const texto = inputBusqueda.value.trim().toLowerCase();
    const precioDesde = inputPrecioDesde.value !== "" ? Number(inputPrecioDesde.value) : null;
    const precioHasta = inputPrecioHasta.value !== "" ? Number(inputPrecioHasta.value) : null;

    let resultado = propiedades.filter((p) => {
      if (barrio && p.barrio !== barrio) return false;
      if (operacion && !p.operaciones.some((o) => o.tipo === operacion)) return false;
      if (ambientesMin && !(p.ambientes >= ambientesMin)) return false;
      if (precioDesde !== null || precioHasta !== null) {
        // Si hay un filtro de operación activo, comparamos contra esa operación puntual;
        // si no, contra la operación principal de la propiedad (venta > alquiler > alq. temp).
        const op = operacion ? p.operaciones.find((o) => o.tipo === operacion) : operacionPrincipal(p);
        if (!op) return false;
        if (precioDesde !== null && op.precio < precioDesde) return false;
        if (precioHasta !== null && op.precio > precioHasta) return false;
      }
      if (texto) {
        const haystack = `${p.titulo} ${p.barrio} ${p.descripcion}`.toLowerCase();
        if (!haystack.includes(texto)) return false;
      }
      return true;
    });

    resultado = ordenarPropiedades(resultado, selOrden.value);

    renderCards(grid, resultado);
    contador.textContent = `${resultado.length} ${resultado.length === 1 ? "propiedad encontrada" : "propiedades encontradas"}`;
  }

  function ordenarPropiedades(lista, criterio) {
    const copia = [...lista];
    switch (criterio) {
      case "precio_asc":
        return copia.sort((a, b) => precioComparable(a) - precioComparable(b));
      case "precio_desc":
        return copia.sort((a, b) => precioComparable(b) - precioComparable(a));
      case "recientes":
        return copia.sort((a, b) => new Date(b.creada) - new Date(a.creada));
      default:
        return copia;
    }
  }

  function precioComparable(prop) {
    const op = operacionPrincipal(prop);
    if (!op) return Infinity;
    // Normaliza aproximadamente a USD solo para poder ordenar (no es cotización real).
    return op.moneda === "ARS" ? op.precio / 1000 : op.precio;
  }

  [selBarrio, selOperacion, selAmbientes, selOrden].forEach((el) =>
    el.addEventListener("change", aplicarFiltros)
  );
  inputBusqueda.addEventListener("input", debounce(aplicarFiltros, 200));
  inputPrecioDesde.addEventListener("input", debounce(aplicarFiltros, 300));
  inputPrecioHasta.addEventListener("input", debounce(aplicarFiltros, 300));
  btnLimpiar.addEventListener("click", () => {
    selBarrio.value = "";
    selOperacion.value = "";
    selAmbientes.value = "";
    selOrden.value = "";
    inputBusqueda.value = "";
    inputPrecioDesde.value = "";
    inputPrecioHasta.value = "";
    aplicarFiltros();
  });

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /** Toma ?q=&operacion=&barrio= de la URL (por ejemplo, desde la búsqueda rápida del home) y precarga los filtros. */
  function aplicarParametrosDeURL() {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    const operacion = params.get("operacion");
    const barrio = params.get("barrio");
    if (q) inputBusqueda.value = q;
    if (operacion && Array.from(selOperacion.options).some((o) => o.value === operacion)) {
      selOperacion.value = operacion;
    }
    if (barrio && Array.from(selBarrio.options).some((o) => o.value === barrio)) {
      selBarrio.value = barrio;
    }
  }

  try {
    propiedades = await cargarPropiedades();

    poblarSelect(selBarrio, barriosDisponibles(propiedades));
    aplicarParametrosDeURL();

    estadoCarga.hidden = true;
    grid.hidden = false;

    chipTotal.textContent = `${propiedades.length} propiedades disponibles`;
    chipBarrios.textContent = `${barriosDisponibles(propiedades).length} barrios`;

    aplicarFiltros();

    const mapaEl = document.getElementById("mapa-general");
    if (mapaEl && typeof L !== "undefined") {
      renderMapaGeneral("mapa-general", propiedades);
    }

    inyectarJSONLD(propiedades);
  } catch (err) {
    console.error(err);
    estadoCarga.innerHTML = `
      <p><strong>No pudimos cargar las propiedades.</strong></p>
      <p>Si estás viendo este sitio abriendo el archivo directamente (file://), los navegadores
      bloquean la lectura del CSV por seguridad. Serví la carpeta con un servidor local o publicala
      en GitHub Pages / cualquier hosting estático y volverá a funcionar.</p>`;
  }

  function inyectarJSONLD(props) {
    const itemListElement = props
      .filter((p) => p.lat && p.lng)
      .map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${location.origin}${location.pathname.replace(/propiedades\.html$/, "")}propiedad.html?id=${p.id}`,
      }));

    const data = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement,
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }
})();
