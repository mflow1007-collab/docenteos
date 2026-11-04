import { useEffect, useMemo, useState } from 'react';
import { listarSecuenciasDeGrado } from '../../services/secuenciasOficialesService.js';
import {
  SO_AREAS, SO_GRADOS, SO_NIVELES, agruparPorArea,
} from '../../services/secuenciasOficialesModelo.js';

// Banco de secuencias oficiales del MINERD, por Nivel → Grado → Área → Guía.
// Solo lectura: las guías se cargan con scripts/cargar_guia_oficial.mjs. La
// generación de unidades todavía no consume este banco.

const chip = (activo) => ({
  background: activo ? '#1d4ed8' : '#fff',
  color: activo ? '#fff' : '#334155',
  border: `1px solid ${activo ? '#1d4ed8' : '#cbd5e1'}`,
  borderRadius: 8,
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
});

function Secuencia({ secuencia }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div style={{ borderTop: '1px solid #e2e8f0', padding: '10px 0' }}>
      <button
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
          display: 'flex', justifyContent: 'space-between', gap: 12, textAlign: 'left',
          fontSize: 14, fontWeight: 600, color: '#1e293b',
        }}
      >
        <span>{secuencia.numero}. {secuencia.titulo}</span>
        <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', flexShrink: 0 }}>
          pp. {secuencia.paginaInicio}-{secuencia.paginaFin} {abierta ? '▲' : '▼'}
        </span>
      </button>
      {abierta && (
        <div style={{ marginTop: 8 }}>
          {secuencia.introduccion && (
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>
              {secuencia.introduccion}
            </p>
          )}
          {(secuencia.partes || []).map((parte, i) => (
            <details key={`${parte.nombre}-${i}`} style={{ marginBottom: 6 }}>
              <summary style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                {parte.nombre} (pp. {parte.paginaInicio}-{parte.paginaFin})
              </summary>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>
                {parte.texto}
              </p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function Guia({ guia }) {
  const { datos = {} } = guia;
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginTop: 10, background: '#fff' }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{datos.titulo}</p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
        {guia.asignatura} · {datos.edicion} ({datos.anio}) · {datos.institucion} · {guia.secuencias.length} secuencias
      </p>
      {datos.urlFuente && (
        <a href={datos.urlFuente} target="_blank" rel="noreferrer" style={{ display: 'inline-block', margin: '4px 0 8px', fontSize: 12 }}>
          Ver documento original
        </a>
      )}
      {datos.restriccionUso && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#a16207' }}>
          Condición de uso del documento: “{datos.restriccionUso}”.
        </p>
      )}
      {guia.secuencias.map((s) => <Secuencia key={s.id} secuencia={s} />)}
    </div>
  );
}

export default function AdminSecuenciasOficiales() {
  const [nivel, setNivel] = useState(SO_NIVELES[0]);
  const [grado, setGrado] = useState(SO_GRADOS[0]);
  const [secuencias, setSecuencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    setSecuencias([]);
    listarSecuenciasDeGrado(nivel, grado)
      .then((lista) => { if (vigente) setSecuencias(lista); })
      .catch((e) => { if (vigente) setError(`Error cargando: ${e.message || e}`); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [nivel, grado]);

  const areas = useMemo(() => agruparPorArea(secuencias), [secuencias]);

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1e293b' }}>Secuencias Oficiales MINERD</h1>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748b' }}>
        Guías oficiales por nivel, grado y área. Es material didáctico: el currículo sigue saliendo de las mallas.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {SO_NIVELES.map((n) => (
          <button key={n} onClick={() => setNivel(n)} aria-pressed={n === nivel} style={chip(n === nivel)}>{n}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {SO_GRADOS.map((g) => (
          <button key={g} onClick={() => setGrado(g)} aria-pressed={g === grado} style={chip(g === grado)}>{g}</button>
        ))}
      </div>

      {error && <p role="alert" style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
      {cargando && <p style={{ color: '#64748b', fontSize: 13 }}>Cargando...</p>}

      {!cargando && !error && SO_AREAS.map((area) => (
        <section key={area} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, color: '#334155' }}>{area}</h2>
          {areas[area].length
            ? areas[area].map((guia) => <Guia key={guia.id} guia={guia} />)
            : <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>Sin guía todavía</p>}
        </section>
      ))}
    </div>
  );
}
