/**
 * Utilidades de permisos para DocenteOS.
 *
 * La distinción entre usuario regular y administrador se basa
 * únicamente en el dominio del correo electrónico.
 */

const DOMINIO_ADMIN = '@docenteos.com'

/**
 * Devuelve true si el correo pertenece al equipo DocenteOS.
 * Estos usuarios tienen acceso a módulos avanzados (IA, Currículo)
 * y al Panel de Administración.
 *
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
export function esUsuarioDocenteOS(email) {
  if (!email || typeof email !== 'string') return false
  return email.trim().toLowerCase().endsWith(DOMINIO_ADMIN)
}

/**
 * Devuelve true si el usuario tiene acceso a un módulo específico.
 * Centraliza la lógica de visibilidad por módulo.
 *
 * @param {string|null|undefined} email
 * @param {'ia'|'curriculo'|'admin'} modulo
 * @returns {boolean}
 */
export function tieneAcceso(email, modulo) {
  switch (modulo) {
    case 'ia':
    case 'curriculo':
    case 'admin':
      return esUsuarioDocenteOS(email)
    default:
      return true
  }
}

/**
 * Etiqueta legible del cargo almacenado en Firestore (campo `rol`).
 * La clave es el valor técnico; el valor es lo que se muestra al usuario.
 */
export const ETIQUETAS_CARGO = {
  docente:     'Docente',
  coordinador: 'Coordinador Pedagógico',
  director:    'Director',
  orientador:  'Orientador(a) Escolar',
  psicologo:   'Psicólogo(a) Escolar',
  admin:       'Administrador DocenteOS',
}

/**
 * Permisos por cargo.
 * Cada clave es un rol; el valor lista los módulos habilitados.
 * Estructura preparada para expansión futura — agregar módulos aquí
 * sin tocar la base de datos ni el formulario de registro.
 *
 * Módulos disponibles:
 *   'planificacion' | 'cursos' | 'estudiantes' | 'instrumentos'
 *   | 'reportes' | 'ia' | 'curriculo' | 'admin'
 */
export const PERMISOS_CARGO = {
  docente: [
    'planificacion', 'cursos', 'estudiantes', 'instrumentos', 'reportes',
  ],
  coordinador: [
    'planificacion', 'cursos', 'estudiantes', 'instrumentos', 'reportes',
  ],
  director: [
    'planificacion', 'cursos', 'estudiantes', 'instrumentos', 'reportes',
  ],
  orientador: [
    'planificacion', 'estudiantes', 'reportes',
  ],
  psicologo: [
    'planificacion', 'estudiantes', 'reportes',
  ],
  admin: [
    'planificacion', 'cursos', 'estudiantes', 'instrumentos', 'reportes',
    'ia', 'curriculo', 'admin',
  ],
}

/**
 * Devuelve true si un rol tiene acceso a un módulo específico.
 * Usa PERMISOS_CARGO como fuente de verdad para lógica basada en cargo.
 *
 * @param {string} rol   - Clave del cargo (ej: 'orientador')
 * @param {string} modulo - Módulo a verificar (ej: 'instrumentos')
 * @returns {boolean}
 */
export function cargoTieneModulo(rol, modulo) {
  return (PERMISOS_CARGO[rol] ?? PERMISOS_CARGO.docente).includes(modulo)
}

/**
 * Etiqueta legible del estado del usuario.
 */
export const ETIQUETAS_ESTADO = {
  pendiente:  'Pendiente',
  activo:     'Activo',
  inactivo:   'Inactivo',
  suspendido: 'Suspendido',
  rechazado:  'Rechazado',
}
