/**
 * generarPDF.js
 * Genera documentos PDF profesionales en formato MINERD
 * Produce salida HTML lista para convertir a PDF con herramientas como html2pdf o Puppeteer
 */

/**
 * Paleta de colores MINERD
 */
const COLORES_MINERD = {
  primario: "#003A70", // Azul oscuro
  secundario: "#1f4788", // Azul medio
  acento: "#E74C3C", // Rojo
  exito: "#27AE60", // Verde
  advertencia: "#F39C12", // Naranja
  neutral: "#34495E", // Gris oscuro
  claro: "#ECF0F1", // Gris claro
  blanco: "#FFFFFF",
};

/**
 * Generar documento HTML para PDF profesional
 */
export const generarPDFHTML = (planificacion) => {
  const {
    metadata = {},
    datosUnidad = {},
    situacionAprendizaje = {},
    desarrolloSemanal = [],
    evaluacion = {},
    productoFinal = {},
    adecuacionesNEAE = {},
    recursosGenerales = {},
    bibliografia = {},
  } = planificacion;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planificación - ${datosUnidad.titulo || "Unidad de Aprendizaje"}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
    }

    .contenedor {
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      background-color: white;
    }

    /* PORTADA */
    .portada {
      page-break-after: always;
      text-align: center;
      padding: 60px 40px;
      background: linear-gradient(135deg, ${COLORES_MINERD.primario} 0%, ${COLORES_MINERD.secundario} 100%);
      color: white;
      border-radius: 5px;
      margin-bottom: 40px;
    }

    .portada h1 {
      font-size: 48px;
      font-weight: bold;
      margin: 30px 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }

    .portada .subtitulo {
      font-size: 24px;
      margin: 20px 0;
      font-weight: 300;
    }

    .portada .metadata-portada {
      margin-top: 60px;
      text-align: center;
      font-size: 14px;
    }

    .portada .metadata-portada p {
      margin: 8px 0;
    }

    .decoracion {
      height: 3px;
      background-color: ${COLORES_MINERD.acento};
      margin: 30px 0;
    }

    /* ENCABEZADOS SECCIONALES */
    .seccion {
      page-break-inside: avoid;
      margin-top: 40px;
      margin-bottom: 30px;
      border-left: 5px solid ${COLORES_MINERD.primario};
      padding-left: 20px;
    }

    .seccion h2 {
      color: ${COLORES_MINERD.primario};
      font-size: 28px;
      margin-bottom: 20px;
      font-weight: bold;
    }

    .seccion h3 {
      color: ${COLORES_MINERD.secundario};
      font-size: 18px;
      margin-top: 20px;
      margin-bottom: 10px;
      font-weight: 600;
    }

    /* TABLAS */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    thead {
      background-color: ${COLORES_MINERD.primario};
      color: white;
    }

    th {
      padding: 15px;
      text-align: left;
      font-weight: bold;
      font-size: 14px;
    }

    td {
      padding: 12px 15px;
      border-bottom: 1px solid ${COLORES_MINERD.claro};
      font-size: 14px;
    }

    tbody tr:nth-child(even) {
      background-color: #f9f9f9;
    }

    tbody tr:hover {
      background-color: #f0f0f0;
    }

    /* CAJAS DE INFORMACIÓN */
    .caja-info {
      page-break-inside: avoid;
      background-color: #f0f8ff;
      border-left: 4px solid ${COLORES_MINERD.primario};
      padding: 15px;
      margin: 15px 0;
      border-radius: 3px;
    }

    .caja-advertencia {
      background-color: #fff3cd;
      border-left-color: ${COLORES_MINERD.advertencia};
    }

    .caja-exito {
      background-color: #d4edda;
      border-left-color: ${COLORES_MINERD.exito};
    }

    .caja-info p {
      margin: 5px 0;
      font-size: 14px;
    }

    /* LISTAS */
    ul, ol {
      margin: 10px 0;
      padding-left: 30px;
    }

    li {
      margin: 8px 0;
      font-size: 14px;
    }

    /* COMPETENCIA Y INDICADORES */
    .competencia-card {
      page-break-inside: avoid;
      background-color: white;
      border: 1px solid ${COLORES_MINERD.claro};
      border-radius: 5px;
      padding: 20px;
      margin: 15px 0;
    }

    .competencia-card .titulo {
      color: ${COLORES_MINERD.primario};
      font-weight: bold;
      margin-bottom: 10px;
      font-size: 16px;
    }

    .indicador {
      background-color: #f9f9f9;
      padding: 10px;
      margin: 8px 0;
      border-left: 3px solid ${COLORES_MINERD.acento};
      font-size: 13px;
    }

    /* SEMANAS */
    .semana-card {
      page-break-inside: avoid;
      border: 2px solid ${COLORES_MINERD.primario};
      border-radius: 5px;
      margin: 30px 0;
      overflow: hidden;
    }

    .semana-header {
      background-color: ${COLORES_MINERD.primario};
      color: white;
      padding: 15px 20px;
      font-weight: bold;
      font-size: 16px;
    }

    .semana-content {
      padding: 20px;
    }

    .dia-item {
      page-break-inside: avoid;
      background-color: #f5f5f5;
      border-left: 4px solid ${COLORES_MINERD.acento};
      padding: 15px;
      margin: 12px 0;
      border-radius: 3px;
    }

    .dia-titulo {
      font-weight: bold;
      color: ${COLORES_MINERD.secundario};
      margin-bottom: 8px;
      font-size: 14px;
    }

    /* MOMENTOS PEDAGÓGICOS */
    .momento-card {
      page-break-inside: avoid;
      background-color: #fffacd;
      border: 1px solid #dfd700;
      border-radius: 3px;
      padding: 12px;
      margin: 10px 0;
      font-size: 13px;
    }

    .momento-titulo {
      font-weight: bold;
      color: ${COLORES_MINERD.primario};
      margin-bottom: 5px;
    }

    .momento-tiempo {
      color: ${COLORES_MINERD.neutral};
      font-size: 12px;
      margin-bottom: 8px;
    }

    /* EVALUACIÓN */
    .evaluacion-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 20px 0;
    }

    .evaluacion-item {
      page-break-inside: avoid;
      background-color: #f0f0f0;
      padding: 15px;
      border-radius: 5px;
      border-top: 3px solid ${COLORES_MINERD.primario};
    }

    /* RUBRICA */
    .rubrica {
      width: 100%;
      font-size: 12px;
      margin-top: 15px;
    }

    .rubrica td {
      padding: 8px;
      font-size: 12px;
    }

    .rubrica thead {
      background-color: ${COLORES_MINERD.secundario};
    }

    .nivel-1 { background-color: #ffcccc; }
    .nivel-2 { background-color: #ffffcc; }
    .nivel-3 { background-color: #ccffcc; }
    .nivel-4 { background-color: #ccccff; }

    /* FOOTER */
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 2px solid ${COLORES_MINERD.claro};
      font-size: 12px;
      color: #666;
      text-align: center;
    }

    /* IMPRESIÓN */
    @media print {
      body {
        background-color: white;
      }

      .contenedor {
        max-width: 100%;
        padding: 0;
      }

      .seccion {
        page-break-inside: avoid;
      }

      .semana-card {
        page-break-inside: avoid;
      }

      .dia-item {
        page-break-inside: avoid;
      }

      .competencia-card {
        page-break-inside: avoid;
      }

      @page {
        margin: 1cm;
      }
    }

    /* META-INFORMACIÓN */
    .info-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }

    .meta-item {
      background-color: ${COLORES_MINERD.claro};
      padding: 10px;
      border-radius: 3px;
      font-size: 13px;
    }

    .meta-label {
      font-weight: bold;
      color: ${COLORES_MINERD.primario};
    }

    .meta-valor {
      color: #333;
    }
  </style>
</head>
<body>
  <div class="contenedor">
    ${generarPortada(metadata, datosUnidad)}
    ${generarDatosInstitucionales(metadata)}
    ${generarSituacionAprendizaje(situacionAprendizaje, datosUnidad)}
    ${generarDesarrolloSemanal(desarrolloSemanal)}
    ${generarEvaluacion(evaluacion)}
    ${generarProductoFinal(productoFinal)}
    ${adecuacionesNEAE ? generarAdecuacionesNEAE(adecuacionesNEAE) : ""}
    ${generarRecursos(recursosGenerales)}
    ${generarBibliografia(bibliografia)}
    ${generarFooter(metadata)}
  </div>
</body>
</html>
  `.trim();

  return html;
};

/**
 * Generar sección de portada
 */
const generarPortada = (metadata, datosUnidad) => {
  return `
    <div class="portada">
      <h1>${datosUnidad.titulo || "Unidad de Aprendizaje"}</h1>
      <div class="decoracion"></div>
      <p class="subtitulo">${datosUnidad.competenciaEspecifica || ""}</p>

      <div class="metadata-portada">
        <p><strong>Centro Educativo:</strong> ${metadata.centro || "-----"}</p>
        <p><strong>Docente:</strong> ${metadata.docente || "-----"}</p>
        <p><strong>Área:</strong> ${metadata.area || "-----"} | <strong>Grado:</strong> ${metadata.grado}° ${metadata.seccion || ""}</p>
        <p><strong>Año Escolar:</strong> ${metadata.anoEscolar} | <strong>Período:</strong> ${metadata.periodo}</p>
        <p><strong>Duración:</strong> ${metadata.duracion} semanas | <strong>Inicio:</strong> ${metadata.fechaInicio}</p>
      </div>
    </div>
  `;
};

/**
 * Generar datos institucionales
 */
const generarDatosInstitucionales = (metadata) => {
  return `
    <div class="seccion">
      <h2>Datos de Identificación</h2>
      <div class="info-meta">
        <div class="meta-item">
          <span class="meta-label">Centro Educativo:</span>
          <span class="meta-valor">${metadata.centro || "-----"}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Docente Responsable:</span>
          <span class="meta-valor">${metadata.docente || "-----"}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Área/Asignatura:</span>
          <span class="meta-valor">${metadata.area || "-----"}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Grado/Nivel:</span>
          <span class="meta-valor">${metadata.grado}° ${metadata.seccion || ""}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Año Escolar:</span>
          <span class="meta-valor">${metadata.anoEscolar}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Período:</span>
          <span class="meta-valor">${metadata.periodo}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Fecha de Inicio:</span>
          <span class="meta-valor">${metadata.fechaInicio}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Duración:</span>
          <span class="meta-valor">${metadata.duracion} semanas</span>
        </div>
      </div>
    </div>
  `;
};

/**
 * Generar situación de aprendizaje
 */
const generarSituacionAprendizaje = (situacion, datosUnidad) => {
  return `
    <div class="seccion">
      <h2>Situación de Aprendizaje</h2>

      <h3>Justificación</h3>
      <div class="caja-info">
        ${situacion.narrativa
          ? `<p>${situacion.narrativa}</p>`
          : "<p>Situación contextualizada basada en problemas reales del entorno."
        }</p>
      </div>

      <h3>Ambiente de Aprendizaje</h3>
      <div class="caja-info">
        ${situacion.ambiente
          ? `<p>${situacion.ambiente}</p>`
          : "<p>Ambiente flexible y colaborativo.</p>"
        }</p>
      </div>

      ${
        situacion.preguntasDetonantes
          ? `
      <h3>Preguntas Detonantes</h3>
      <ul>
        ${situacion.preguntasDetonantes.map((p) => `<li>${p}</li>`).join("")}
      </ul>
      `
          : ""
      }

      <h3>Indicadores de Logro</h3>
      <div>
        ${datosUnidad.indicadoresOficiales
          ? datosUnidad.indicadoresOficiales
              .map(
                (ind) => `
          <div class="indicador">
            <strong>•</strong> ${ind}
          </div>
        `,
              )
              .join("")
          : "<p>Indicadores específicos del currículo nacional.</p>"
        }
      </div>
    </div>
  `;
};

/**
 * Generar desarrollo semanal
 */
const generarDesarrolloSemanal = (semanas) => {
  if (!semanas || semanas.length === 0) {
    return '<div class="seccion"><h2>Desarrollo Semanal</h2><p>Sin semanas definidas.</p></div>';
  }

  return `
    <div class="seccion">
      <h2>Desarrollo Semanal</h2>
      ${semanas
        .map(
          (semana) => `
        <div class="semana-card">
          <div class="semana-header">
            Semana ${semana.n}: ${semana.titulo || "Desarrollo"}
          </div>
          <div class="semana-content">
            <p><strong>Tipo de Evaluación:</strong> ${semana.tipoEval || "Formativa"}</p>
            <p><strong>Propósito:</strong> ${semana.proposito || "Construcción de aprendizajes"}</p>

            <h4 style="margin-top: 15px; color: ${COLORES_MINERD.primario};">Días de la Semana</h4>
            ${(semana.dias || [])
              .map(
                (dia) => `
              <div class="dia-item">
                <div class="dia-titulo">Día ${dia.n}: ${dia.titulo || dia.tema}</div>
                <p><strong>Estrategia:</strong> ${dia.estrategia || "Colaborativa"}</p>
                <p><strong>Tipo de Evaluación:</strong> ${dia.tipoEval || "Formativa"}</p>

                ${
                  dia.momentos && dia.momentos.length > 0
                    ? `
                  <div style="margin-top: 10px;">
                    <strong>Momentos Pedagógicos:</strong>
                    ${dia.momentos
                      .map(
                        (m) => `
                      <div class="momento-card">
                        <div class="momento-titulo">${m.tipo} (${m.tiempo} min)</div>
                        <p>${m.proposito}</p>
                        ${
                          m.actividades && m.actividades.length > 0
                            ? `
                          <ul style="margin: 8px 0; padding-left: 20px; font-size: 12px;">
                            ${m.actividades.map((a) => `<li>${a.descripcion}</li>`).join("")}
                          </ul>
                        `
                            : ""
                        }
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                `
                    : ""
                }
              </div>
            `
              )
              .join("")}

            ${
              semana.productoSemanal
                ? `<div class="caja-exito" style="margin-top: 15px;">
              <strong>Producto Semanal:</strong> ${semana.productoSemanal}
            </div>`
                : ""
            }
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
};

/**
 * Generar sección de evaluación
 */
const generarEvaluacion = (evaluacion) => {
  return `
    <div class="seccion">
      <h2>Evaluación</h2>

      <h3>Tipos de Evaluación</h3>
      <ul>
        ${
          evaluacion.tiposEvaluacion
            ? evaluacion.tiposEvaluacion.map((t) => `<li>${t}</li>`).join("")
            : "<li>Diagnóstica</li><li>Formativa</li><li>Sumativa</li>"
        }
      </ul>

      <h3>Técnicas Formativas</h3>
      <ul>
        ${
          evaluacion.tecnicasFormativos
            ? evaluacion.tecnicasFormativos.map((t) => `<li>${t}</li>`).join("")
            : "<li>Observación sistemática</li>"
        }
      </ul>

      <div class="caja-advertencia">
        <p><strong>Nota:</strong> La evaluación es continua y multidimensional, considerando diferentes tipos de instrumentos y agentes evaluadores.</p>
      </div>
    </div>
  `;
};

/**
 * Generar sección de producto final
 */
const generarProductoFinal = (productoFinal) => {
  if (!productoFinal || !productoFinal.descripcion) return "";

  return `
    <div class="seccion">
      <h2>Producto Final</h2>
      <p><strong>Descripción:</strong> ${productoFinal.descripcion}</p>

      ${
        productoFinal.criteriosEvaluacion
          ? `
      <h3>Criterios de Evaluación</h3>
      <ul>
        ${productoFinal.criteriosEvaluacion.map((c) => `<li>${c}</li>`).join("")}
      </ul>
      `
          : ""
      }

      <p><strong>Formato:</strong> ${productoFinal.formato || "Proyecto/Presentación"}</p>
    </div>
  `;
};

/**
 * Generar adecuaciones NEAE
 */
const generarAdecuacionesNEAE = (adecuaciones) => {
  return `
    <div class="seccion">
      <h2>${adecuaciones.titulo || "Adecuaciones NEAE"}</h2>
      <p>${adecuaciones.descripcion || ""}</p>

      <h3>Nivel de Acceso</h3>
      <ul>
        ${
          Object.values(adecuaciones.nivelAcceso || {})
            .filter((v) => v)
            .map((estrategia) => `<li>${estrategia}</li>`)
            .join("")
        }
      </ul>

      <h3>Nivel Curricular</h3>
      <ul>
        ${
          Object.values(adecuaciones.nivelCurricular || {})
            .filter((v) => v)
            .map((estrategia) => `<li>${estrategia}</li>`)
            .join("")
        }
      </ul>

      <h3>Estrategias de Apoyo</h3>
      <ul>
        ${
          (adecuaciones.estrategias || [])
            .map((e) => `<li>${e}</li>`)
            .join("")
        }
      </ul>
    </div>
  `;
};

/**
 * Generar sección de recursos
 */
const generarRecursos = (recursos) => {
  return `
    <div class="seccion">
      <h2>Recursos</h2>

      <h3>Recursos Humanos</h3>
      <ul>
        ${(recursos.humanos || []).map((r) => `<li>${r}</li>`).join("")}
      </ul>

      <h3>Recursos Didácticos</h3>
      <ul>
        ${(recursos.didacticos || []).map((r) => `<li>${r}</li>`).join("")}
      </ul>

      <h3>Recursos Tecnológicos</h3>
      <ul>
        ${(recursos.tecnologicos || []).map((r) => `<li>${r}</li>`).join("")}
      </ul>
    </div>
  `;
};

/**
 * Generar bibliografía
 */
const generarBibliografia = (bibliografia) => {
  return `
    <div class="seccion">
      <h2>Bibliografía</h2>

      <h3>Bibliografía Básica</h3>
      <ul>
        ${(bibliografia.basica || []).map((b) => `<li>${b}</li>`).join("")}
      </ul>

      <h3>Bibliografía Complementaria</h3>
      <ul>
        ${(bibliografia.complementaria || []).map((b) => `<li>${b}</li>`).join("")}
      </ul>
    </div>
  `;
};

/**
 * Generar footer
 */
const generarFooter = (metadata) => {
  return `
    <div class="footer">
      <p>Documento generado por DocenteOS - Planificación MINERD</p>
      <p>${metadata.centro || "Centro Educativo"} | ${metadata.anoEscolar}</p>
      <p>Generado: ${new Date().toLocaleDateString("es-ES")}</p>
    </div>
  `;
};

/**
 * Exportar planificación a texto plano
 */
export const generarTextoPlano = (planificacion) => {
  const lines = [];

  lines.push("=".repeat(80));
  lines.push((planificacion.datosUnidad?.titulo || "PLANIFICACIÓN").toUpperCase());
  lines.push("=".repeat(80));
  lines.push("");

  // Metadatos
  lines.push("DATOS INSTITUCIONALES");
  lines.push("-".repeat(80));
  lines.push(
    `Centro: ${planificacion.metadata?.centro || "-----"}`,
  );
  lines.push(`Docente: ${planificacion.metadata?.docente || "-----"}`);
  lines.push(
    `Área: ${planificacion.metadata?.area} | Grado: ${planificacion.metadata?.grado}`,
  );
  lines.push(`Período: ${planificacion.metadata?.periodo} | Año: ${planificacion.metadata?.anoEscolar}`);
  lines.push(`Duración: ${planificacion.metadata?.duracion} semanas`);
  lines.push("");

  // Competencia e indicadores
  if (planificacion.datosUnidad) {
    lines.push("COMPETENCIA E INDICADORES");
    lines.push("-".repeat(80));
    lines.push(`Competencia: ${planificacion.datosUnidad.competenciaEspecifica}`);
    lines.push("\nIndicadores:");
    (planificacion.datosUnidad.indicadoresOficiales || []).forEach((ind) => {
      lines.push(`  • ${ind}`);
    });
    lines.push("");
  }

  // Situación de aprendizaje
  if (planificacion.situacionAprendizaje) {
    lines.push("SITUACIÓN DE APRENDIZAJE");
    lines.push("-".repeat(80));
    lines.push(planificacion.situacionAprendizaje.narrativa || "");
    lines.push("");
  }

  // Desarrollo semanal (resumen)
  if (planificacion.desarrolloSemanal) {
    lines.push("DESARROLLO SEMANAL (RESUMEN)");
    lines.push("-".repeat(80));
    planificacion.desarrolloSemanal.forEach((semana) => {
      lines.push(`\nSemana ${semana.n}: ${semana.titulo}`);
      lines.push(`  Propósito: ${semana.proposito}`);
      lines.push(`  Tipo de Evaluación: ${semana.tipoEval}`);
      lines.push(`  Producto: ${semana.productoSemanal}`);
    });
    lines.push("");
  }

  lines.push("=".repeat(80));
  lines.push(`Documento generado: ${new Date().toLocaleString("es-ES")}`);
  lines.push("=".repeat(80));

  return lines.join("\n");
};

export default {
  generarPDFHTML,
  generarTextoPlano,
  COLORES_MINERD,
};
