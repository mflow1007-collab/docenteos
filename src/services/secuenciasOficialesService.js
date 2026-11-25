/**
 * secuenciasOficialesService.js — Lectura del banco de secuencias oficiales del
 * MINERD. Solo administradores (ver firestore.rules). La generación de unidades
 * todavía NO consume este banco.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { validarAlcance } from './secuenciasOficialesModelo.js';

export const COL_SECUENCIAS_OFICIALES = 'secuenciasOficiales';

export const listarSecuenciasDeGrado = async (nivel, grado) => {
  if (!db) throw new Error('Firestore no disponible');
  // Solo interesan nivel y grado: la validación del área se usa con una válida.
  const errores = validarAlcance({ nivel, grado, area: 'Matemática', asignatura: 'Matemática' });
  if (errores.length) throw new Error(errores.join('. '));
  const snap = await getDocs(query(
    collection(db, COL_SECUENCIAS_OFICIALES),
    where('nivel', '==', nivel),
    where('grado', '==', grado),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
