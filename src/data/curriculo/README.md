# Currículo MINERD — Área de Lenguas Extranjeras (Nivel Secundario)

Datos extraídos de forma **literal** del PDF oficial. Este archivo describe de dónde
salen los datos y cómo están organizados. No contiene interpretación del currículo.

## Fuente

- **Documento:** *Adecuación Curricular — Nivel Secundario*
- **Emisor:** MINERD — Viceministerio de Servicios Técnicos y Pedagógicos, Dirección General de Currículo
- **Fecha:** Santo Domingo, agosto 2023
- **Archivo original:** `Ht7X-adecuacion-secundaria-2023pdf-2.pdf` (520 páginas)
- **Rango extraído:** páginas impresas **121–208** (Área de Lenguas Extranjeras, Inglés y Francés)

Datos: `curriculo-lenguas-extranjeras-secundaria-2023.json`

## Criterio de extracción

Transcripción literal. **No se corrigió nada** del original:

- Se conservan erratas del documento tal cual aparecen impresas. Por ejemplo:
  `"Ambientaly de la Salud"` (6to inglés), `"Ambiental y del a Salud"` (1ro francés),
  `"Pensamiento Lógico, Crítico y Creativo"` (orden invertido en varios grados frente a
  `"Pensamiento Lógico, Creativo y Crítico"`), `"Lenguas Extrajeras"` en el título de la
  contextualización.
- Se conserva la acentuación, puntuación y uso de mayúsculas del original.
- Las listas de contenidos conservan **el salto de línea de la maquetación impresa**. Un
  mismo ítem puede ocupar varias entradas consecutivas del arreglo. Ejemplo real:

  ```
  "• Condiciones atmosféricas: sunny,"
  "windy, hot…"
  ```

  Si se necesitan ítems completos, hay que unir cada línea que no empieza con `•` a la
  anterior — pero ojo: en la sección de Gramática los ejemplos en inglés/francés van en
  líneas propias sin viñeta y **no** son continuación del ítem anterior. Esa unión es una
  decisión de procesamiento, no viene resuelta aquí a propósito.

## Estructura del JSON

```
documento              metadatos de procedencia
area, nivel
marco_del_area         texto corrido pp.122-126 (contextualización, enfoque, MCER)
alineacion_mcer        tabla de la p.125: nivel MCER por grado e idioma
idiomas
  ingles / frances
    idioma
    ciclos[]
      ciclo                                    "Primer Ciclo" | "Segundo Ciclo"
      grados[]                                 ej. ["1ro","2do","3ro"]
      aportes_a_las_competencias_fundamentales[]
        competencia_fundamental
        competencia_especifica_del_ciclo
        competencias_especificas_por_grado     {Primero|Segundo|Tercero} o {Cuarto|Quinto|Sexto}
        criterios_de_evaluacion[]
      conexion_con_los_ejes_transversales[]
        eje_transversal
        grados                                 texto por grado
      mallas_curriculares[]
        grado                                  "1er. Grado" …
        paginas_documento                      [inicio, fin] páginas impresas
        competencias_especificas_del_grado[]   7 entradas: CF + descripción
        contenidos
          conceptos[]                          líneas literales
          procedimientos[]
          actitudes_y_valores[]
        indicadores_de_logro[]
```

## Patrón estructural del documento

Útil para validar y para generar: el área repite una estructura fija.

- **7 Competencias Fundamentales** por ciclo, siempre en el mismo orden:
  Comunicativa · Pensamiento Lógico, Creativo y Crítico · Resolución de Problemas ·
  Ética y Ciudadana · Científica y Tecnológica · Ambiental y de la Salud ·
  Desarrollo Personal y Espiritual.
- **5 Ejes Transversales:** Salud y Bienestar · Desarrollo Sostenible · Desarrollo
  Personal y Profesional · Alfabetización Imprescindible · Ciudadanía y Convivencia.
- **Criterios de evaluación e indicadores de logro** siguen siempre la tríada
  **comprensión → producción → interacción** (verbos: *responde* → *se expresa* →
  *interactúa*). Por eso hay 21 indicadores por grado (7 CF × 3).
- **Contenidos de Inglés** vienen sub-categorizados de forma consistente:
  - Conceptos: `Temas` / `Vocabulario` / `Expresiones` / `Gramática`
  - Procedimientos: `Funcionales` / `Discursivos` / `Estratégicos` (con
    Comprensión oral, Producción oral, Comprensión escrita, Producción escrita, Otros) /
    `Sociolingüísticos y socioculturales`

Estos sub-encabezados van como líneas sueltas dentro del arreglo, sin viñeta.

## Alineación MCER (p.125)

| Grado | Inglés | Francés |
|---|---|---|
| 1ro Sec. | A2.1 | A1.1 |
| 2do Sec. | A2.2 | A1.2 |
| 3ro Sec. | A2.3 | A1.3 |
| 4to Sec. | B1.1 | A1.4 |
| 5to Sec. | B1.2 | A2.1 |
| 6to Sec. | B1.3 | A2.2 |

El nivel MCER **no** está inyectado dentro de cada grado en el JSON; vive en el bloque
`alineacion_mcer` para no mezclar datos de páginas distintas. El cruce es por grado.

## Verificación hecha

La extracción se auditó comparando, palabra por palabra, el texto de cada página del PDF
contra lo que quedó en el JSON. Los 12 grados quedan cubiertos; lo único que no se
traslada son los encabezados de tabla repetidos en cada página (`Contenidos`,
`Conceptos`, `Procedimientos`, `Actitudes y Valores`) y los rótulos de página.

Nota técnica: las páginas 181 y 182 del PDF arrastran una capa de texto invisible
(coordenadas negativas, fuera del área imprimible) que duplica la tabla de competencias
de la página anterior. `pdftotext` la incluye y produce un texto mezclado; aquí se
descartó porque no forma parte de la página visible.

## Lo que NO está aquí

- Las demás áreas del documento (Lengua Española, Matemática, Ciencias Sociales,
  Ciencias de la Naturaleza, Educación Artística, Educación Física, Formación Integral
  Humana y Religiosa), fuera de pp. 121–208.
- La salida optativa *Humanidades y Lenguas Modernas* (p. 444 y siguientes).
- Cualquier interpretación, resumen o reordenamiento del contenido curricular.
