import { useState } from 'react';
import { AlertTriangle, Search, RefreshCw, Plus, Megaphone, Clock, Check, X, ShieldAlert, Radio, Calendar, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { addManualAlertDB } from '../../utils/db';
import { isNotamActiveOnDate, formatNotamDateRange, categorizeNotam, getUtcDateString } from '../../utils/notamUtils';

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

  // Fecha de consulta actual en UTC
  const todayStr = getUtcDateString(new Date());
  const [queryDateStr, setQueryDateStr] = useState(todayStr);

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
      start_date: '2026-08-01T03:00:00Z',
      end_date: '2026-08-31T08:00:00Z',
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
      start_date: '2026-08-04T12:00:00Z',
      end_date: '2026-08-10T23:59:00Z',
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
      start_date: '2026-08-01T00:00:00Z',
      end_date: '2026-12-31T23:59:00Z',
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
      start_date: '2026-08-05T05:00:00Z',
      end_date: '2026-08-05T10:00:00Z',
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
      start_date: '2026-08-01T00:00:00Z',
      end_date: 'PERM',
      dates_raw: '2026-08-01 00:00 - PERM',
      schedule: '1400 - 2000 UTC'
    }
  ];

  // Helpers para navegación de fechas
  const getTomorrowStr = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return getUtcDateString(d);
  };

  const changeDateByDays = (days) => {
    const parts = queryDateStr.split('-');
    const current = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    current.setUTCDate(current.getUTCDate() + days);
    setQueryDateStr(getUtcDateString(current));
  };

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

  // Calcular conteos de NOTAMs VIGENTES para la fecha de consulta en cada ámbito
  const getScopeList = (tab) => {
    if (tab === 'ad_clsd') return notamsData?.adClosedNotams?.length ? notamsData.adClosedNotams : defaultNotams.filter(n => n.scope === 'ad_clsd');
    if (tab === 'flow') return notamsData?.flowNotams?.length ? notamsData.flowNotams : defaultNotams.filter(n => n.scope === 'flow');
    if (tab === 'ashtam') return notamsData?.ashtamNotams?.length ? notamsData.ashtamNotams : defaultNotams.filter(n => n.scope === 'ashtam');
    return notamsData?.notams?.length ? notamsData.notams : defaultNotams.filter(n => n.scope === 'skbo' || !n.scope);
  };

  const activeSkboCount = getScopeList('skbo').filter(n => isNotamActiveOnDate(n, queryDateStr)).length;
  const activeAdCount = getScopeList('ad_clsd').filter(n => isNotamActiveOnDate(n, queryDateStr)).length;
  const activeFlowCount = getScopeList('flow').filter(n => isNotamActiveOnDate(n, queryDateStr)).length;
  const activeAshtamCount = getScopeList('ashtam').filter(n => isNotamActiveOnDate(n, queryDateStr)).length;

  // Filtrar dataset: 1) SOLO VIGENTES EN FECHA DE CONSULTA, 2) Categoría SKBO, 3) Búsqueda
  const filteredNotams = rawDataset.filter(n => {
    // 1. Filtrar estrictamente por fecha de vigencia
    if (!isNotamActiveOnDate(n, queryDateStr)) {
      return false;
    }

    // 2. Filtrar por término de búsqueda
    const text = (n.description || n.text || n.raw_text || n.summary || '').toLowerCase();
    const idStr = (n.id || n.number || '').toLowerCase();
    const airportStr = (n.airport || n.location || '').toLowerCase();
    const query = searchTerm.toLowerCase().trim();

    const matchesSearch = !query || idStr.includes(query) || airportStr.includes(query) || text.includes(query);
    if (!matchesSearch) return false;

    // 3. Filtrar por subcategoría SKBO
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

  const isQueryingToday = queryDateStr === todayStr;
  const isQueryingTomorrow = queryDateStr === getTomorrowStr();

  // Formato de fecha legible para el encabezado
  const formatQueryDateDisplay = (dateStr) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    } catch (e) {
      return dateStr;
    }
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

      {/* SELECTOR DE FECHA DE CONSULTA DE VIGENCIA */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '0.65rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        boxShadow: 'var(--glass-shadow)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={14} />
            Fecha de Consulta (Vigencia UTC):
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {formatQueryDateDisplay(queryDateStr)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => changeDateByDays(-1)}
            style={{
              padding: '0.4rem 0.5rem',
              borderRadius: '7px',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Día anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={() => setQueryDateStr(todayStr)}
            style={{
              flex: 1,
              padding: '0.4rem 0.5rem',
              borderRadius: '7px',
              border: isQueryingToday ? '1px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
              background: isQueryingToday ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-secondary)',
              color: isQueryingToday ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            Hoy
          </button>

          <button
            onClick={() => setQueryDateStr(getTomorrowStr())}
            style={{
              flex: 1,
              padding: '0.4rem 0.5rem',
              borderRadius: '7px',
              border: isQueryingTomorrow ? '1px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
              background: isQueryingTomorrow ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-secondary)',
              color: isQueryingTomorrow ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            Mañana
          </button>

          <input
            type="date"
            value={queryDateStr}
            onChange={(e) => {
              if (e.target.value) setQueryDateStr(e.target.value);
            }}
            style={{
              flex: 1.4,
              padding: '0.35rem 0.45rem',
              borderRadius: '7px',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              fontWeight: '700',
              fontFamily: 'var(--font-mono)',
              outline: 'none'
            }}
          />

          <button
            onClick={() => changeDateByDays(1)}
            style={{
              padding: '0.4rem 0.5rem',
              borderRadius: '7px',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Día siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
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

      {/* PESTAÑAS PRINCIPALES DE ÁMBITO CON CONTEOS VIGENTES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem', background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
        {[
          { id: 'skbo', label: `SKBO (${activeSkboCount})` },
          { id: 'ad_clsd', label: `Otros AD (${activeAdCount})` },
          { id: 'flow', label: `Flujo (${activeFlowCount})` },
          { id: 'ashtam', label: `ASHTAM (${activeAshtamCount})` }
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

      {/* LISTA DE NOTAMS VIGENTES CON CONTENIDO COMPLETO */}
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

            const formattedDates = formatNotamDateRange(notam);

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
                {/* Cabecera con Código, Ubicación y Estado Vigente */}
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--status-success)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '6px',
                      fontSize: '0.65rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}>
                      <CheckCircle2 size={10} />
                      Vigente
                    </span>

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>
                      Vigencia: {formattedDates}
                    </span>
                    <span>Fuente: {notam.source && notam.source.includes('AEROCIVIL') ? 'Aerocivil' : 'FAA'}</span>
                  </div>
                  {notam.schedule && (
                    <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} color="var(--status-warning)" />
                      <span>Horario activo: {notam.schedule}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--glass-bg)', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <AlertTriangle size={28} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700' }}>
              No hay NOTAMs vigentes para la fecha consultada ({formatQueryDateDisplay(queryDateStr)})
            </p>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Intenta cambiar la fecha de consulta o la subcategoría seleccionada.
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
