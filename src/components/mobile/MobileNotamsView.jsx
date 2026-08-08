import { useState } from 'react';
import { AlertTriangle, Search, RefreshCw, Plus, Megaphone, Clock, Check, X, ShieldAlert, Radio } from 'lucide-react';
import { addManualAlertDB } from '../../utils/db';

export default function MobileNotamsView({ 
  notamsData = { notams: [], adClosedNotams: [], flowNotams: [], ashtamNotams: [] }, 
  currentUser, 
  userRole = 'controller' 
}) {
  const [scopeTab, setScopeTab] = useState('skbo'); // 'skbo' | 'ad_clsd' | 'flow' | 'ashtam'
  const [skboCategory, setSkboCategory] = useState('ALL'); // 'ALL' | 'RWY' | 'TWY' | 'SID/STAR/APP' | 'MISC'
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [newAlertText, setNewAlertText] = useState('');

  const isEncargado = userRole === 'admin' || currentUser?.isSupervisor || currentUser?.isAdmin || (currentUser?.skills && currentUser.skills.includes('CTE'));

  // NOTAMs de demostración si la base de datos Firestore aún no ha sido poblada
  const defaultNotams = [
    {
      id: 'A0452/26',
      airport: 'SKBO',
      scope: 'skbo',
      severity: 'WARNING',
      category: 'RWY',
      description: 'PISTA 13L/31R CERRADA POR TRABAJOS DE MANTENIMIENTO PREVENTIVO TODOS LOS MIERCOLES DE 0300 A 0800 UTC.',
      dates_raw: '2026-08-01 03:00 - 2026-08-31 08:00',
      schedule: '0300 - 0800 UTC'
    },
    {
      id: 'A0488/26',
      airport: 'SKBO',
      scope: 'skbo',
      severity: 'CRITICAL',
      category: 'NAV_AIDS',
      description: 'ILS FREQ 110.3 MHZ CAT II RUNWAY 13R U/S DUE TO UPGRADE OF GROUND TRANSMITTER. USE VOR/DME PROC.',
      dates_raw: '2026-08-04 12:00 - 2026-08-10 23:59',
      schedule: '24 HORAS'
    },
    {
      id: 'A0501/26',
      airport: 'SKBO',
      scope: 'skbo',
      severity: 'INFO',
      category: 'SID_STAR_APP',
      description: 'PROCEDIMIENTO DE SALIDA NOCTURNA SID BOGOTA OBLIGATORIO DESDE 0300 UTC HASTA 1100 UTC PARA AVIONES JET.',
      dates_raw: '2026-08-01 00:00 - 2026-12-31 23:59',
      schedule: '0300 - 1100 UTC'
    },
    {
      id: 'C0112/26',
      airport: 'SKRG',
      scope: 'ad_clsd',
      severity: 'CRITICAL',
      category: 'AD_CLSD',
      description: 'AEROPUERTO RIONEGRO (SKRG) CERRADO POR CONDICIONES DE BAJA VISIBILIDAD DE 0500 A 1000 UTC.',
      dates_raw: '2026-08-05 05:00 - 2026-08-05 10:00',
      schedule: '0500 - 1000 UTC'
    },
    {
      id: 'F0024/26',
      airport: 'SKED',
      scope: 'flow',
      severity: 'WARNING',
      category: 'FLOW',
      description: 'CONTROL DE FLUJO (EDCT) EN VIGOR POR ALTA DENSIDAD EN SECTOR TERMINAL BOGOTA. SEPARACION 15 NM.',
      dates_raw: '2026-08-05 14:00 - 2026-08-05 20:00',
      schedule: '1400 - 2000 UTC'
    }
  ];

  // Seleccionar conjunto de NOTAMs según la pestaña activa
  const getRawDataset = () => {
    if (!notamsData) return defaultNotams;
    
    let list = [];
    if (scopeTab === 'ad_clsd') list = notamsData.adClosedNotams || [];
    else if (scopeTab === 'flow') list = notamsData.flowNotams || [];
    else if (scopeTab === 'ashtam') list = notamsData.ashtamNotams || [];
    else list = notamsData.notams || [];

    if (list.length === 0 && (!notamsData.notams || notamsData.notams.length === 0)) {
      list = defaultNotams.filter(n => {
        if (scopeTab === 'ad_clsd') return n.scope === 'ad_clsd';
        if (scopeTab === 'flow') return n.scope === 'flow';
        if (scopeTab === 'ashtam') return n.scope === 'ashtam';
        return n.scope === 'skbo' || !n.scope;
      });
    }

    return list;
  };

  const rawDataset = getRawDataset();

  // Categorización de NOTAMs para SKBO
  const categorizeNotam = (n) => {
    if (n.category) return n.category;
    const desc = (n.description || n.text || n.raw_text || n.summary || '').toUpperCase();
    if (desc.includes('RWY') || desc.includes('RUNWAY') || desc.includes('PISTA')) return 'RWY';
    if (desc.includes('TWY') || desc.includes('TXY') || desc.includes('TAXIWAY') || desc.includes('RODAJE')) return 'TXY';
    if (desc.includes('SID') || desc.includes('STAR') || desc.includes('APP') || desc.includes('PROC') || desc.includes('APPROACH') || desc.includes('SALIDA') || desc.includes('LLEGADA')) return 'SID_STAR_APP';
    return 'MISC';
  };

  // Filtrar dataset según categoría SKBO y término de búsqueda
  const filteredNotams = rawDataset.filter(n => {
    const text = (n.description || n.text || n.raw_text || n.summary || '').toLowerCase();
    const idStr = (n.id || n.number || '').toLowerCase();
    const airportStr = (n.airport || n.location || '').toLowerCase();
    const query = searchTerm.toLowerCase().trim();

    const matchesSearch = !query || idStr.includes(query) || airportStr.includes(query) || text.includes(query);
    if (!matchesSearch) return false;

    if (scopeTab === 'skbo') {
      if (skboCategory === 'ALL') return true;
      const cat = categorizeNotam(n);
      if (skboCategory === 'RWY') return cat === 'RWY';
      if (skboCategory === 'TWY') return cat === 'TXY' || cat === 'TWY';
      if (skboCategory === 'SID/STAR/APP') return cat === 'SID_STAR_APP' || cat === 'SID/STAR/APP';
      if (skboCategory === 'MISC') return cat !== 'RWY' && cat !== 'TXY' && cat !== 'TWY' && cat !== 'SID_STAR_APP' && cat !== 'SID/STAR/APP';
    }

    return true;
  });

  const handleSyncNotamsApi = async () => {
    setSyncing(true);
    try {
      const res = await fetch('https://us-central1-aircontrol-skbo-sbg.cloudfunctions.net/sync_notams_api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Sincronización NOTAMs completa. Se actualizaron ${data.count} boletines.`);
      } else {
        alert(`Servidor respondió: ${data.error || 'Sincronización procesada.'}`);
      }
    } catch (err) {
      alert('Se envió la orden de sincronización de NOTAMs al servidor.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateAlertSubmit = async (e) => {
    e.preventDefault();
    if (!newAlertText.trim()) return;
    await addManualAlertDB({
      content: newAlertText.trim(),
      createdBy: currentUser?.name || 'Encargado de Turno',
      createdByEmail: currentUser?.email || ''
    });
    setNewAlertText('');
    setIsAlertModalOpen(false);
    alert('¡Mensaje/Alerta del Encargado publicado para la guardia!');
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Cabecera NOTAMs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={20} color="var(--status-warning)" />
            Boletines NOTAMs SKBO
          </h2>
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            {notamsData?.lastUpdated 
              ? `Actualizado: ${new Date(notamsData.lastUpdated).toLocaleDateString()} ${new Date(notamsData.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC`
              : 'Información Operativa Oficial El Dorado'}
          </span>
        </div>

        {/* Acciones para Encargados (CTE / Supervisor / Admin) */}
        {isEncargado && (
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              onClick={handleSyncNotamsApi}
              disabled={syncing}
              className="btn btn-secondary"
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '9px',
                fontSize: '0.75rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
              title="Sincronizar NOTAMs SKBO"
            >
              <RefreshCw size={14} className={syncing ? 'spin-animation' : ''} />
              {syncing ? 'Cargando...' : 'Sincronizar'}
            </button>

            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="btn btn-primary"
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '9px',
                fontSize: '0.75rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <Plus size={14} />
              Alerta
            </button>
          </div>
        )}
      </div>

      {/* Buscador táctil */}
      <div style={{ position: 'relative' }}>
        <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Buscar texto en NOTAMs (ej. Pista 13R, ILS, LVP)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.6rem 0.6rem 0.6rem 2.4rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            outline: 'none'
          }}
        />
      </div>

      {/* PESTAÑAS PRINCIPALES DE ÁMBITO (Idénticas a la versión web) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem', background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
        {[
          { id: 'skbo', label: `SKBO (${notamsData?.notams?.length || 0})` },
          { id: 'ad_clsd', label: `Otros AD (${notamsData?.adClosedNotams?.length || 0})` },
          { id: 'flow', label: `Flujo (${notamsData?.flowNotams?.length || 0})` },
          { id: 'ashtam', label: `ASHTAM (${notamsData?.ashtamNotams?.length || 0})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setScopeTab(tab.id)}
            style={{
              padding: '0.45rem 0.15rem',
              border: 'none',
              borderRadius: '8px',
              background: scopeTab === tab.id ? 'var(--accent-cyan)' : 'transparent',
              color: scopeTab === tab.id ? '#000' : 'var(--text-secondary)',
              fontWeight: '800',
              fontSize: '0.7rem',
              cursor: 'pointer',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-FILTROS DE CLASIFICACIÓN PARA SKBO (RWY, TWY, SID/STAR/APP, MISC) */}
      {scopeTab === 'skbo' && (
        <div style={{ display: 'flex', gap: '0.3rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          {[
            { id: 'ALL', label: 'Todos SKBO' },
            { id: 'RWY', label: 'RWY (Pistas)' },
            { id: 'TWY', label: 'TWY (Rodaje)' },
            { id: 'SID/STAR/APP', label: 'SID / STAR / APP' },
            { id: 'MISC', label: 'Otros (ILS/NAV)' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSkboCategory(cat.id)}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                border: skboCategory === cat.id ? '1px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                background: skboCategory === cat.id ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-secondary)',
                color: skboCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* LISTA DE NOTAMS CON CONTENIDO COMPLETO EN JETBRAINS MONO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filteredNotams.length > 0 ? (
          filteredNotams.map((notam, idx) => {
            const notamContent = notam.description || notam.text || notam.raw_text || notam.summary || notam.content || notam.body || 'Sin detalle de texto registrado';
            const notamId = notam.id || notam.number || `NOTAM-${idx+1}`;
            const airport = notam.airport || notam.location || 'SKBO';

            const isCritical = notam.severity === 'CRITICAL' || notamContent.includes('CLSD') || notamContent.includes('CLOSED') || notamContent.includes('CIERRE');
            const isWarning = notam.severity === 'WARNING' || notamContent.includes('U/S') || notamContent.includes('WIP') || notamContent.includes('LIMIT') || notamContent.includes('FLOW');

            let badgeBg = 'rgba(6, 182, 212, 0.12)';
            let badgeBorder = 'rgba(6, 182, 212, 0.3)';
            let badgeColor = 'var(--accent-cyan)';

            if (isCritical) {
              badgeBg = 'rgba(244, 63, 94, 0.15)';
              badgeBorder = 'rgba(244, 63, 94, 0.4)';
              badgeColor = 'var(--status-danger)';
            } else if (isWarning) {
              badgeBg = 'rgba(245, 158, 11, 0.15)';
              badgeBorder = 'rgba(245, 158, 11, 0.4)';
              badgeColor = 'var(--status-warning)';
            }

            return (
              <div key={idx} style={{
                background: 'var(--glass-bg)',
                border: `1px solid ${badgeBorder}`,
                borderRadius: '14px',
                padding: '0.9rem',
                boxShadow: 'var(--glass-shadow)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}>
                {/* Cabecera con Código y Ubicación */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{
                      background: 'rgba(6, 182, 212, 0.15)',
                      color: 'var(--accent-cyan)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '5px',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {airport}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '800',
                      fontSize: '0.9rem',
                      color: badgeColor
                    }}>
                      {notamId}
                    </span>
                  </div>

                  <span style={{
                    background: badgeBg,
                    color: badgeColor,
                    border: `1px solid ${badgeBorder}`,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: '800'
                  }}>
                    {notam.category || categorizeNotam(notam)}
                  </span>
                </div>

                {/* Resumen / Título si existe */}
                {notam.summary && notam.summary !== notamContent && (
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {notam.summary}
                  </h4>
                )}

                {/* CONTENIDO COMPLETO DEL NOTAM EN FUENTE JETBRAINS MONO */}
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                  lineHeight: '1.45',
                  letterSpacing: '0.01em',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {notamContent}
                </div>

                {/* Fechas de Vigencia & Horario */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                  <span>Fuente: {notam.source && notam.source.includes('AEROCIVIL') ? 'Aerocivil' : 'FAA'} | {notam.schedule ? `Horario: ${notam.schedule}` : '24h'}</span>
                  <span>Vigencia: {notam.dates_raw || `${notam.start_date || ''} - ${notam.end_date || 'PERM'}`}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--glass-bg)', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <AlertTriangle size={28} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No se encontraron NOTAMs en la clasificación seleccionada.
            </p>
          </div>
        )}
      </div>

      {/* MODAL PARA AGREGAR ALERTA DEL ENCARGADO DE TURNO */}
      {isAlertModalOpen && (
        <div className="bottom-sheet-backdrop" onClick={() => setIsAlertModalOpen(false)}>
          <div className="bottom-sheet-modal" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Megaphone size={18} color="var(--accent-cyan)" />
                Publicar Alerta del Encargado (CTE)
              </h3>
              <button onClick={() => setIsAlertModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAlertSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Contenido del Mensaje para la Guardia:
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Ej. Precaución en rodaje K por trabajos de bacheo. Frecuencia de respaldo 118.1 MHz..."
                  value={newAlertText}
                  onChange={e => setNewAlertText(e.target.value)}
                  required
                  style={{ width: '100%', resize: 'none', fontSize: '0.82rem', padding: '0.6rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setIsAlertModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.65rem' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.65rem', fontWeight: '700' }}>
                  Publicar Alerta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
