/**
 * Parser de CSV (RFC 4180) sin dependencias.
 * Soporta campos entre comillas con comas, comillas dobles escapadas ("")
 * y saltos de línea dentro de un campo.
 */
function parseCSV(text) {
  // Quita BOM si existe (utf-8-sig)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // ignorado, \n maneja el fin de línea
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Última celda/fila si el archivo no termina con salto de línea
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0];
  const objects = [];
  for (let r = 1; r < rows.length; r++) {
    const values = rows[r];
    if (values.length === 1 && values[0] === "") continue; // línea vacía final
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[c] !== undefined ? values[c] : "";
    }
    objects.push(obj);
  }
  return objects;
}
