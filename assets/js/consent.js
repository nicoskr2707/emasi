/**
 * Banner de consentimiento de cookies (Consent Mode v2 de Google).
 *
 * El estado por defecto ("todo denegado") se fija en el <head> de cada página,
 * antes de Google Tag Manager. Este archivo muestra el banner cuando la persona
 * todavía no eligió, guarda su elección en localStorage y avisa a GTM.
 *
 * Ojo: Consent Mode solo frena las etiquetas que lo respetan (GA4 y Google Ads
 * lo hacen solas). Las etiquetas de Meta u otras cargadas en GTM tienen que
 * configurarse con "Consentimiento adicional requerido: ad_storage".
 */
(function () {
  var CLAVE = "emasi_consentimiento";

  function leer() {
    try { return localStorage.getItem(CLAVE); } catch (e) { return null; }
  }

  function guardar(valor) {
    try { localStorage.setItem(CLAVE, valor); } catch (e) {}
  }

  function aplicar(valor) {
    var estado = valor === "aceptado" ? "granted" : "denied";
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        ad_storage: estado,
        ad_user_data: estado,
        ad_personalization: estado,
        analytics_storage: estado,
      });
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "consentimiento_actualizado", consentimiento: valor });
  }

  function cerrar(banner) {
    banner.hidden = true;
  }

  function crearBanner() {
    var banner = document.createElement("div");
    banner.className = "consentimiento";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Preferencias de cookies");
    banner.innerHTML =
      '<p class="consentimiento__texto">Usamos cookies de medición y publicidad (Google y Meta) ' +
      "para entender cómo se usa el sitio y mostrarte avisos relevantes. " +
      "Podés aceptarlas o rechazarlas: el sitio funciona igual.</p>" +
      '<div class="consentimiento__acciones">' +
      '<button type="button" class="btn btn--secundario" data-eleccion="rechazado">Rechazar</button>' +
      '<button type="button" class="btn btn--primario" data-eleccion="aceptado">Aceptar</button>' +
      "</div>";

    banner.addEventListener("click", function (e) {
      var boton = e.target.closest("[data-eleccion]");
      if (!boton) return;
      var valor = boton.getAttribute("data-eleccion");
      guardar(valor);
      aplicar(valor);
      cerrar(banner);
    });

    document.body.appendChild(banner);
    return banner;
  }

  function agregarEnlaceFooter(abrir) {
    var pie = document.querySelector(".footer__bottom");
    if (!pie) return;
    var enlace = document.createElement("button");
    enlace.type = "button";
    enlace.className = "consentimiento__reabrir";
    enlace.textContent = "Preferencias de cookies";
    enlace.addEventListener("click", abrir);
    pie.appendChild(enlace);
  }

  var banner = null;
  function abrir() {
    if (!banner) banner = crearBanner();
    banner.hidden = false;
  }

  if (!leer()) abrir();
  agregarEnlaceFooter(abrir);
})();
