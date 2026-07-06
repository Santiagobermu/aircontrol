import { useState, useMemo } from 'react';
import { 
  ClipboardList, 
  User, 
  Calendar as CalendarIcon, 
  Clock, 
  Shield, 
  Plus, 
  Trash2, 
  AlertTriangle,
  Search
} from 'lucide-react';
import { isColombianHoliday } from '../utils/schedulerEngine';

export default function RequestPanel({ 
  controllers, 
  requests, 
  onAddRequest, 
  onDeleteRequest 
}) {
  const [ctrlId, setCtrlId] = useState('');
  const [date, setDate] = useState('');
  const [shift, setShift] = useState('Cualquiera');
  const [position, setPosition] = useState('Cualquiera');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [comment, setComment] = useState('');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Filtrar controladores activos
  const activeControllers = useMemo(() => {
    return controllers.filter(c => c.active);
  }, [controllers]);

  // Formatear nombres de meses únicos presentes en las peticiones para filtros
  const uniqueMonths = useMemo(() => {
    const months = new Set();
    requests.forEach(r => {
      if (r.date) {
        const parts = r.date.split('-');
        months.add(`${parts[0]}-${parts[1]}`); // e.g. "2026-06"
      }
    });
    return Array.from(months).sort();
  }, [requests]);

  // Filtrar peticiones por búsqueda y mes
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const ctrl = controllers.find(c => c.id === r.controllerId);
      const ctrlName = ctrl ? ctrl.name.toLowerCase() : '';
      const ctrlIdLower = r.controllerId.toLowerCase();
      const query = searchQuery.toLowerCase();
      
      const matchesSearch = ctrlName.includes(query) || ctrlIdLower.includes(query);
      
      let matchesMonth = true;
      if (filterMonth !== 'all') {
        matchesMonth = r.date.startsWith(filterMonth);
      }
 
      return matchesSearch && matchesMonth;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [requests, controllers, searchQuery, filterMonth]);

  const isExceptionRequest = position === 'DESCANSO' || position === 'LICN' || position === 'LICR';

  const handleRegister = (e) => {
    e.preventDefault();
    if (!ctrlId || !date) return;

    const newRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      controllerId: ctrlId,
      date,
      shift: isExceptionRequest ? 'Cualquiera' : shift,
      position,
      comment: comment.trim()
    };

    onAddRequest(newRequest);
    
    // Resetear campos para permitir registros rápidos
    setDate('');
    setShift('Cualquiera');
    setPosition('Cualquiera');
    setComment('');
  };

  const getShiftBadge = (s) => {
    if (s === 'Cualquiera') return <span style={{ color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>CUALQUIERA</span>;
    
    const colors = {
      A: { c: 'var(--accent-indigo)', bg: 'rgba(99, 102, 241, 0.1)' },
      M: { c: 'var(--accent-cyan)', bg: 'rgba(6, 182, 212, 0.1)' },
      T: { c: 'var(--accent-fic)', bg: 'rgba(245, 158, 11, 0.1)' },
      N: { c: 'var(--accent-purple)', bg: 'rgba(168, 85, 247, 0.1)' }
    };
    const style = colors[s] || { c: 'white', bg: 'gray' };
    return <span style={{ color: style.c, backgroundColor: style.bg, padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800' }}>TURNO {s}</span>;
  };

  const getPositionBadge = (pos) => {
    if (pos === 'Cualquiera') return <span style={{ color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>CUALQUIERA</span>;
    if (pos === 'DESCANSO') return <span style={{ color: 'var(--status-success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.2)' }}>DESCANSO</span>;
    if (pos === 'LICN') return <span style={{ color: 'var(--accent-indigo)', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', border: '1px solid rgba(99, 102, 241, 0.2)' }}>LIC. NO REMUN. (LICN)</span>;
    if (pos === 'LICR') return <span style={{ color: 'var(--accent-purple)', backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', border: '1px solid rgba(168, 85, 247, 0.2)' }}>LIC. REMUNERADA (LICR)</span>;
    return <span className={`skill-chip ${pos.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>{pos}</span>;
  };

  const formatCalendarDayName = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dayNames[date.getDay()]} (${date.getDate()} ${monthNamesShort[date.getMonth()]})`;
  };

  return (
    <div className="dashboard-grid">
      
      {/* Columna Izquierda: Formulario de Adición */}
      <div className="glass-panel" style={{ height: 'fit-content' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
          <ClipboardList size={22} style={{ color: 'var(--accent-cyan)' }} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.2rem' }}>
            Registrar Petición Especial
          </h3>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controlador */}
          <div className="form-group">
            <label htmlFor="req-ctrl" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <User size={14} /> Controlador
            </label>
            <select
              id="req-ctrl"
              className="form-input"
              value={ctrlId}
              onChange={(e) => setCtrlId(e.target.value)}
              required
            >
              <option value="">-- Selecciona el Controlador --</option>
              {activeControllers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="form-group">
            <label htmlFor="req-date" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CalendarIcon size={14} /> Fecha Requerida
            </label>
            <input
              id="req-date"
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Turno */}
          <div className="form-group">
            <label htmlFor="req-shift" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={14} /> Turno Preferente
            </label>
            <select
              id="req-shift"
              className="form-input"
              value={isExceptionRequest ? 'Cualquiera' : shift}
              onChange={(e) => setShift(e.target.value)}
              disabled={isExceptionRequest}
              style={isExceptionRequest ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            >
              <option value="Cualquiera">Cualquier Turno (Flexible)</option>
              <option value="M">Mañana (M: 06:00 - 12:00)</option>
              <option value="T">Tarde (T: 12:00 - 18:00)</option>
              <option value="N">Noche (N: 18:00 - 24:00)</option>
              <option value="A">Madrugada (A: 00:00 - 06:00)</option>
            </select>
          </div>

          {/* Posición */}
          <div className="form-group">
            <label htmlFor="req-pos" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Shield size={14} /> Posición / Requerimiento
            </label>
            <select
              id="req-pos"
              className="form-input"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="Cualquiera">Cualquier Posición (Flexible)</option>
              <option value="TWR">Torre (TWR / LNT, LST, LPT)</option>
              <option value="GND">Superficie (GND / GNT, GST, GPT)</option>
              <option value="DEL">Autorizaciones (DEL / DPT, DPR)</option>
              <option value="FIC">Información de Vuelo (FIC / FPT, FPA, FPR)</option>
              <option value="CTE">Encargado de Turno (CTE)</option>
              <option value="DESCANSO">Día de Descanso (DESCANSO)</option>
              <option value="LICN">Licencia No Remunerada (LICN)</option>
              <option value="LICR">Licencia Remunerada (LICR)</option>
            </select>
          </div>

          {/* Comentarios */}
          <div className="form-group">
            <label htmlFor="req-comment" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ClipboardList size={14} /> Comentarios / Justificación
            </label>
            <textarea
              id="req-comment"
              className="form-input"
              rows={2}
              placeholder="Escribe una breve razón o comentario (opcional)..."
              style={{ resize: 'vertical', minHeight: '60px', padding: '0.5rem 0.75rem', fontFamily: 'inherit' }}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontWeight: '700', gap: '0.25rem' }}
          >
            <Plus size={16} /> Registrar Solicitud
          </button>
        </form>
      </div>

      {/* Columna Derecha: Listado y Filtros */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.75rem'
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={22} style={{ color: 'var(--accent-indigo)' }} />
            Peticiones Registradas
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-cyan)', padding: '0.15rem 0.5rem', borderRadius: '10px', marginLeft: '0.25rem', border: '1px solid rgba(6,182,212,0.15)' }}>
              {filteredRequests.length} activas
            </span>
          </h3>

          {/* Filtros Rápidos */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar controlador..."
                className="form-input"
                style={{ padding: '0.35rem 0.75rem 0.35rem 1.75rem', fontSize: '0.75rem', width: '160px', borderRadius: '8px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="form-input"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', width: '130px', borderRadius: '8px' }}
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="all">Todos los Meses</option>
              {uniqueMonths.map(m => {
                const [y, mm] = m.split('-');
                const monthName = monthNames[parseInt(mm) - 1];
                return (
                  <option key={m} value={m}>
                    {monthName} {y}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Lista de Tarjetas de Petición */}
        {filteredRequests.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem',
            overflowY: 'auto',
            maxHeight: '450px',
            paddingRight: '0.25rem'
          }}>
            {filteredRequests.map((r) => {
              const ctrl = controllers.find(c => c.id === r.controllerId);
              const holidayInfo = isColombianHoliday(r.date);
              const isSun = new Date(r.date + 'T00:00:00').getDay() === 0;

              return (
                <div 
                  key={r.id} 
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    position: 'relative',
                    transition: 'var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-indigo)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {ctrl ? ctrl.name : 'Desconocido'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Firma/Licencia: {r.controllerId}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteRequest(r.id)}
                      className="btn btn-danger-outline btn-icon-only"
                      style={{ padding: '0.25rem', width: '28px', height: '28px', borderRadius: '6px' }}
                      title="Cancelar Petición"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    <CalendarIcon size={14} style={{ color: 'var(--accent-cyan)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600' }}>{formatCalendarDayName(r.date)}</span>
                      {(holidayInfo.isHoliday || isSun) && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-fic)', fontWeight: '700' }}>
                          {holidayInfo.isHoliday ? `[FESTIVO: ${holidayInfo.name}]` : '[DOMINGO]'}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.comment && (
                    <div style={{
                      marginTop: '0.4rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      borderLeft: '2px solid var(--accent-indigo)',
                      wordBreak: 'break-word'
                    }}>
                      "{r.comment}"
                    </div>
                  )}

                  <div style={{ 
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
                    paddingTop: '0.5rem',
                    marginTop: '0.2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Turno:</span>
                      {getShiftBadge(r.shift)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Posición:</span>
                      {getPositionBadge(r.position)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '3rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <AlertTriangle size={32} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              No se encontraron peticiones especiales para los filtros seleccionados.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
