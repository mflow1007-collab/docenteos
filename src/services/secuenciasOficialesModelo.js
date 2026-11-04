/**
 * secuenciasOficialesModelo.js — Lógica PURA del banco de secuencias oficiales
 * del MINERD (sin Firestore): alcance, identificadores y división de una guía.
 *
 * El banco se organiza como Nivel → Grado → Área → Guía → Secuencias. El alcance
 * lo declara el administrador y se valida con coincidencia EXACTA: nada se deduce
 * ni se normaliza, porque 4to de Primaria y 4to de Secundaria son grados distintos.
 *
 * Es material didáctico oficial, no currículo: los indicadores y contenidos
 * siguen viviendo solo en `curricularContent`.
 */

export const SO_NIVELES = ['Primaria', 'Secundaria'];
export const SO_GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to'];
export const SO_AREAS = [
  'Lengua Española', 'Matemática', 'Ciencias Sociales',
  'Ciencias de la Naturaleza', 'Lenguas Extranjeras',
  'Educación Artística', 'Educación Física',
  'Formación Integral Humana y Religiosa',
];
export const SO_ASIGNATURAS_POR_AREA = {
  'Lenguas Extranjeras':       ['Inglés', 'Francés'],
  'Ciencias Sociales':         ['Ciencias Sociales', 'Geografía', 'Historia', 'Moral y Cívica'],
  'Ciencias de la Naturaleza': ['Ciencias de la Naturaleza', 'Biología', 'Química', 'Física'],
};

// Firestore admite 1 MiB por documento; se deja margen para los metadatos.
export const SO_MAX_BYTES_DOC = 900 * 1024;

export const validarAlcance = ({ nivel, grado, area, asignatura } = {}) => {
  const errores = [];
  if (!SO_NIVELES.includes(nivel)) errores.push(`Nivel inválido: "${nivel ?? ''}"`);
  if (!SO_GRADOS.includes(grado)) errores.push(`Grado inválido: "${grado ?? ''}"`);
  if (!SO_AREAS.includes(area)) {
    errores.push(`Área inválida: "${area ?? ''}"`);
    return errores;
  }
  const permitidas = SO_ASIGNATURAS_POR_AREA[area] || [area];
  if (!permitidas.includes(asignatura)) {
    errores.push(`Asignatura "${asignatura ?? ''}" no pertenece a ${area}. Permitidas: ${permitidas.join(', ')}`);
  }
  return errores;
};

const slug = (texto) => String(texto || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const construirIdGuia = ({ nivel, grado, area, asignatura, guia = {} }) =>
  [nivel, grado, area, asignatura, guia.anio].map(slug).join('-');

export const construirIdSecuencia = (idGuia, numero) =>
  `${idGuia}__s${String(numero).padStart(2, '0')}`;

// Pie de página de las guías: "Secuencia Didáctica #1 • La conversación 13" o
// "66 Lengua Española • Cuarto Grado del Nivel Primario". Justo después suele venir
// la pestaña con el nombre de la sección; el contenido real que siga se conserva.
const PIE_DE_PAGINA = /^(Secuencia Didáctica #\d+ • .+ \d+|\d+ .+ • .+ del Nivel .+)$/;
const PESTANA = /^(Comprensión (oral|escrita)|Producción (oral|escrita)|Gramática textual|Anexos?)$/i;

/** Limpia artefactos de extracción del PDF sin alterar la redacción. */
export const limpiarTextoPagina = (texto) => {
  const lineas = String(texto || '')
    .replace(/ﬁ\s*/g, 'fi')
    .replace(/ﬂ\s*/g, 'fl')
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+/g, ' ').trim());
  const limpias = [];
  for (let i = 0; i < lineas.length; i += 1) {
    if (PIE_DE_PAGINA.test(lineas[i])) {
      if (PESTANA.test(lineas[i + 1] || '')) i += 1;
    } else {
      limpias.push(lineas[i]);
    }
  }
  return limpias.join('\n');
};

const coincideEncabezado = (linea, nombre) => {
  const a = linea.trim().toLowerCase();
  const b = nombre.trim().toLowerCase();
  if (a === b) return true;
  return /^anexos?$/.test(b) && /^anexos?$/.test(a);
};

/** Posición del encabezado como línea completa a partir de `desde`, o -1. */
const buscarEncabezado = (textoPagina, nombre, desde = 0) => {
  let pos = 0;
  for (const linea of textoPagina.split('\n')) {
    if (pos >= desde && coincideEncabezado(linea, nombre)) return pos;
    pos += linea.length + 1;
  }
  return -1;
};

const textoEntre = (paginas, inicio, fin) => {
  if (inicio.pagina === fin.pagina) {
    return paginas[inicio.pagina - 1].slice(inicio.pos, fin.pos).trim();
  }
  const trozos = [paginas[inicio.pagina - 1].slice(inicio.pos)];
  for (let p = inicio.pagina + 1; p < fin.pagina; p += 1) trozos.push(paginas[p - 1]);
  trozos.push(paginas[fin.pagina - 1].slice(0, fin.pos));
  return trozos.join('\n').trim();
};

/**
 * Divide las páginas de una guía según su manifiesto. Falla de forma explícita:
 * cualquier encabezado o portada que no aparezca donde dice el índice es un error
 * y la guía no se puede cargar.
 *
 * @param paginas   textos por página; paginas[0] es la página 1
 * @param manifiesto { nivel, grado, area, asignatura, guia, secuencias }
 * @returns { idGuia, documentos: [{ id, datos }], errores: [] }
 */
export const dividirGuia = (paginas, manifiesto) => {
  const errores = validarAlcance(manifiesto);
  const { nivel, grado, area, asignatura, guia = {}, secuencias = [] } = manifiesto || {};
  if (!guia.titulo) errores.push('La guía no tiene título');
  if (!guia.anio) errores.push('La guía no tiene año');
  if (!guia.urlFuente) errores.push('La guía no tiene enlace de origen');
  if (!secuencias.length) errores.push('El manifiesto no tiene secuencias');
  if (errores.length) return { idGuia: '', documentos: [], errores };

  const limpias = paginas.map(limpiarTextoPagina);
  const idGuia = construirIdGuia(manifiesto);
  const documentos = [];

  secuencias.forEach((sec, indice) => {
    const etiqueta = `Secuencia ${sec.numero}`;
    const siguiente = secuencias[indice + 1];
    const paginaFin = siguiente ? siguiente.paginaInicio - 1 : limpias.length;
    const portada = limpias[sec.paginaInicio - 1];
    const patronPortada = new RegExp(`Secuencia\\s+Didáctica\\s*${sec.numero}\\b`, 'i');
    if (portada === undefined || !patronPortada.test(portada)) {
      errores.push(`${etiqueta}: no aparece su portada en la página ${sec.paginaInicio}`);
      return;
    }

    let cursor = { pagina: sec.paginaInicio, pos: 0 };
    const marcas = [];
    let fallo = false;
    for (const parte of sec.partes || []) {
      if (parte.pagina < cursor.pagina || parte.pagina > paginaFin) {
        errores.push(`${etiqueta}: "${parte.nombre}" (p. ${parte.pagina}) está fuera de orden o de rango`);
        fallo = true;
        break;
      }
      const desde = parte.pagina === cursor.pagina ? cursor.pos : 0;
      const pos = buscarEncabezado(limpias[parte.pagina - 1], parte.nombre, desde);
      if (pos < 0) {
        errores.push(`${etiqueta}: no aparece "${parte.nombre}" en la página ${parte.pagina}`);
        fallo = true;
        break;
      }
      cursor = { pagina: parte.pagina, pos: pos + parte.nombre.length };
      marcas.push({ nombre: parte.nombre, pagina: parte.pagina, pos });
    }
    if (fallo) return;
    if (!marcas.length) {
      errores.push(`${etiqueta}: no tiene partes`);
      return;
    }

    const finSecuencia = { pagina: paginaFin, pos: limpias[paginaFin - 1].length };
    const partes = marcas.map((marca, i) => {
      const fin = marcas[i + 1] || finSecuencia;
      const quitarEncabezado = limpias[marca.pagina - 1].indexOf('\n', marca.pos);
      const inicio = {
        pagina: marca.pagina,
        pos: quitarEncabezado < 0 ? marca.pos : quitarEncabezado + 1,
      };
      return {
        nombre: marca.nombre,
        paginaInicio: marca.pagina,
        paginaFin: fin.pagina,
        texto: textoEntre(limpias, inicio, fin),
      };
    });
    const vacia = partes.find((p) => !p.texto);
    if (vacia) errores.push(`${etiqueta}: "${vacia.nombre}" quedó sin texto`);

    const id = construirIdSecuencia(idGuia, sec.numero);
    const datos = {
      nivel, grado, area, asignatura,
      guia: { ...guia, id: idGuia, totalPaginas: limpias.length },
      numero: sec.numero,
      titulo: sec.titulo,
      paginaInicio: sec.paginaInicio,
      paginaFin,
      introduccion: textoEntre(limpias, { pagina: sec.paginaInicio, pos: 0 }, marcas[0]),
      partes,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(datos)).length;
    if (bytes > SO_MAX_BYTES_DOC) errores.push(`${etiqueta}: pesa ${bytes} bytes, supera el límite`);
    documentos.push({ id, datos });
  });

  return { idGuia, documentos, errores };
};

/** Agrupa las secuencias de un grado por área y guía, en el orden oficial. */
export const agruparPorArea = (secuencias = []) => {
  const areas = Object.fromEntries(SO_AREAS.map((area) => [area, []]));
  for (const sec of secuencias) {
    if (!areas[sec.area]) continue;
    let guia = areas[sec.area].find((g) => g.id === sec.guia?.id);
    if (!guia) {
      guia = { id: sec.guia?.id, asignatura: sec.asignatura, datos: sec.guia, secuencias: [] };
      areas[sec.area].push(guia);
    }
    guia.secuencias.push(sec);
  }
  Object.values(areas).forEach((guias) => guias.forEach((g) => {
    g.secuencias.sort((a, b) => a.numero - b.numero);
  }));
  return areas;
};
