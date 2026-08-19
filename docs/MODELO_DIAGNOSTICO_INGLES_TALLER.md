# Examen modelo de diagnóstico — Inglés 4to (taller de idiomas)

> **Referencia, no implementada.** Material real de un taller de idiomas: examen
> de recuperación pedagógica de Inglés 4to. Se guarda como MODELO a tener en
> cuenta al diseñar los ítems de la evaluación diagnóstica del generador
> (`diagnosticoBlueprintService.js`). NO es una orden de implementación; es el
> patrón de calidad/enfoque comunicativo que el dueño quiere replicar.

## Datos del examen

- **Título:** Práctica de recuperación pedagógica inglés de 4to
- **Tema unificado:** *Communication, News & Daily Information* (comunicación,
  noticias e información diaria) — todo el examen gira sobre un mismo hilo
  comunicativo, no temas sueltos.
- **Encabezado:** Name / Number / Date / Section.

## Estructura por secciones (patrón de tipos de ítem)

| # | Tipo de ítem | Detalle |
|---|---|---|
| I | Completar con expresiones | Frecuencia (always, usually, sometimes, never) + opinión (I think, in my opinion). 5 oraciones. |
| II | Escribir el verbo en pasado | Conjugar en past tense: read, share, learn, watch, talk (5 verbos, oraciones dadas). |
| III | Emparejar función ↔ propósito | Ask for information / Give opinions / Share news → con su función. Opciones: I think… / What do you think? / I agree / I don't think so / Guess what? |
| IV | Selección múltiple | Elegir forma correcta (read / reads / reading). |
| V | Completar oraciones | Con opción entre dos: phone/book, message/table, questions/food, news/plate. |
| VI | Verdadero o Falso | Sobre uso de expresiones ("I think" para opiniones) y noticias. |
| VII | Escritura de párrafo corto | 4–5 oraciones sobre cómo obtienes información. |
| VIII | Responder preguntas abiertas | Where do you get information? What did you do yesterday? What do you think about social media? |
| IX | Escritura final | Párrafo corto que incluya past tense, opiniones e información de noticias. |

## Detalle literal de las secciones (para calcar ítems)

**I. Complete with expressions (always, usually, sometimes, never, I think, in my opinion)**
1. I ____ read news on my phone.
2. She ____ shares information with her classmates.
3. ____, social media is very useful.
4. We ____ talk about current events in class.
5. ____, learning English is important.

**II. Write the verb in past tense**
6. Yesterday, I ____ (read) a news article.
7. She ____ (share) a message online.
8. We ____ (learn) new vocabulary.
9. He ____ (watch) the news.
10. They ____ (talk) about technology.

**III. Match the function with its purpose**
Ask for information → ____ / Give opinions → ____ / Share news → ____ / Agree → ____ / Disagree → ____
Opciones: a) I think… b) What do you think? c) I agree d) I don't think so e) Guess what?

**IV. Choose the correct answer**
1. I ____ news every day. a) read b) reads c) reading
2. Yesterday, she ____ a message. a) read b) reads c) reading (past)

**V. Complete the sentences**
1. I read news on my ____ (phone/book).
2. Yesterday, she shared a ____ (message/table) in class.
3. We ask ____ (questions/food).
4. He watches the ____ (news/plate).

**VI. True or False**
1. "I think" is used to give opinions. ( )
2. News gives information. ( )

**VII. Short paragraph writing** — Write 4–5 sentences about how you get information.

**VIII. Answer the questions**
1. Where do you get information?
2. What did you do yesterday?
3. What do you think about social media?

**IX. Final writing** — Write a short paragraph including past tense, opinions, and news information.

## Qué aporta frente al banco actual (`diagnosticoBlueprintService.js`)

El banco genérico de Inglés (12 temas, 4 dimensiones, 4 formatos: selección
múltiple / V-F / completar / pareado) NO cubre hoy:

- **Expresiones de frecuencia** (always/usually/sometimes/never) como tipo de ítem.
- **Expresiones de opinión** (I think / in my opinion) como función comunicativa.
- **Conjugación de verbo en pasado** como ejercicio (hay tema "past tense", no el ejercicio).
- **Match función↔propósito** comunicativo (el pareado actual es solo palabra↔traducción).
- **Preguntas abiertas** estructuradas (Where/What did you…).
- **Escritura de párrafo GUIADA** con requisitos (past tense + opiniones + noticias).
- **Hilo comunicativo único** que unifique todos los ítems.

Enfoque a replicar: **funciones del lenguaje** (pedir información, dar opinión,
compartir noticias) — coherente con el molde comunicativo del currículo MINERD
de idiomas que el sistema ya reconoce.
