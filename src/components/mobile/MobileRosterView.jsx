import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Users, ArrowRightLeft, ShieldCheck, X } from 'lucide-react';
import { getSlotAcronym } from '../../utils/schedulerEngine';

export default function MobileRosterView({ 
  currentUser, 
  scheduleMonth, 
  exceptions = {},
  controllers, 
  onOpenTradeModal 
}) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  const rawUrl = currentUser?.calendarSyncUrl || `https://firebasestorage.googleapis.com/v0/b/aircontrol-skbo-sbg.firebasestorage.app/o/calendars%2F${currentUser?.id || currentUser?.signature}.ics?alt=media`;
  const webcalUrl = rawUrl.replace(/^https:\/\//, 'webcal://');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(selectedYear, selectedMonth, 1).getDay() + 6) % 7; // Lunes = 0

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  // Helper para convertir slotKey (ej. 'TWR-1') a Sigla de Posición Concreta (ej. 'LNT')
  const getConcretePositionAcronym = (slotKey, shift) => {
    if (!slotKey) return '';
    return getSlotAcronym(slotKey, shift);
  };

  // Descripción legible de la posición
  const getPositionDescription = (acronym) => {
    switch (acronym) {
      case 'LNT': return 'Torre Norte (TWR-1)';
      case 'LST': return 'Torre Sur (TWR-2)';
      case 'LPT': return 'Torre Reserva (TWR-3)';
      case 'GNT': return 'Superficie Norte (GND-1)';
      case 'GST': return 'Superficie Sur (GND-2)';
      case 'GPT': return 'Superficie Reserva (GND-3)';
      case 'DPT': return 'Autorizaciones Titular (DEL-1)';
      case 'DPR': return 'Autorizaciones Reserva (DEL-2)';
      case 'FPT': return 'FIC Titular (FIC-1)';
      case 'FPR': return 'FIC Reserva (FIC-2)';
      case 'FPA': return 'FIC Apoyo (FIC-3)';
      case 'CTE': return 'Encargado de Turno (CTE-1)';
      case 'ACC': return 'Centro de Control (ACC)';
      case 'SIM': return 'Simulador / Pseudopiloto';
      case 'OFI': return 'Turno Administrativo';
      case 'CAE': return 'Capacitación Especial';
      case 'CHC': return 'Chequeo / Evaluación';
      case 'ENT': return 'Entrenamiento Alumno';
      default: return acronym;
    }
  };

  // Estilos de badge por código de jornada
  const getShiftBadgeStyle = (shiftCode) => {
    switch (shiftCode) {
      case 'M': return { bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.4)', color: 'var(--shift-manana)', label: 'MAÑANA (06:00 - 12:00)' };
      case 'T': return { bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)', color: 'var(--shift-tarde)', label: 'TARDE (12:00 - 18:00)' };
      case 'N': return { bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.4)', color: 'var(--shift-noche)', label: 'NOCHE (18:00 - 24:00)' };
      case 'A': return { bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.4)', color: 'var(--shift-madrugada)', label: 'MADRUGADA (00:00 - 06:00)' };
      default: return { bg: 'rgba(148, 163, 184, 0.18)', border: 'rgba(148, 163, 184, 0.3)', color: 'var(--text-secondary)', label: 'DESCANSO / LIBRE' };
    }
  };

  // Obtener TODOS los turnos (o excepciones) asignados al usuario en un día específico
  const getUserShiftsForDay = (dayNum) => {
    if (!currentUser) return [];
    const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    
    const ctrlId = currentUser.id || currentUser.signature;
    const exc = exceptions?.[ctrlId]?.[dateKey] || exceptions?.[currentUser.signature]?.[dateKey];
    if (exc && exc !== 'OPERATIVO') {
      const code = exc === 'DESCANSO' ? 'DESC' : exc.substring(0, 4);
      return [{ type: 'EXCEPTION', status: exc, code, dateKey }];
    }

    if (!scheduleMonth) return [];
    const daySched = scheduleMonth[dateKey];
    if (!daySched) return [];

    const foundShifts = [];
    const SHIFTS = ['M', 'T', 'N', 'A'];

    for (const shift of SHIFTS) {
      const slots = daySched[shift] || {};
      for (const [slotKey, assignedId] of Object.entries(slots)) {
        if (assignedId && (assignedId === ctrlId || assignedId === currentUser.signature || assignedId === currentUser.id)) {
          const posAcronym = getConcretePositionAcronym(slotKey, shift);
          // Código completo del turno (ej. MLNT, NGNT, TLST, ADPR)
          const fullCode = `${shift}${posAcronym}`;
          
          foundShifts.push({
            type: 'SHIFT',
            slotId: `${shift}-${slotKey}`,
            shiftCode: shift,
            posCode: slotKey,
            posAcronym,
            fullCode,
            dateKey
          });
        }
      }
    }
    return foundShifts;
  };

  // Obtener la información del próximo turno del usuario a partir de hoy
  const getNextShiftInfo = () => {
    for (let d = today.getDate(); d <= daysInMonth; d++) {
      const shifts = getUserShiftsForDay(d);
      const realShifts = shifts.filter(s => s.type === 'SHIFT');
      if (realShifts.length > 0) {
        return { dayNum: d, shifts: realShifts };
      }
    }
    return null;
  };

  const nextShiftData = getNextShiftInfo();

  // Buscar compañeros de turno para una jornada específica
  const getShiftColleagues = (dateKey, shiftCode) => {
    if (!scheduleMonth || !scheduleMonth[dateKey] || !shiftCode) return [];
    const daySched = scheduleMonth[dateKey];
    const slots = daySched[shiftCode] || {};
    const colleagues = [];

    const ctrlId = currentUser?.id || currentUser?.signature;

    for (const [slotKey, assignedId] of Object.entries(slots)) {
      if (assignedId && assignedId !== ctrlId && assignedId !== currentUser?.signature) {
        const ctrlObj = controllers.find(c => c.id === assignedId || c.signature === assignedId);
        const posAcronym = getConcretePositionAcronym(slotKey, shiftCode);
        colleagues.push({
          slotId: `${shiftCode}-${slotKey}`,
          posCode: slotKey,
          posAcronym,
          fullCode: `${shiftCode}${posAcronym}`,
          signature: ctrlObj ? ctrlObj.signature : assignedId,
          name: ctrlObj ? ctrlObj.name : assignedId
        });
      }
    }
    return colleagues;
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      
      {/* SECCIÓN HERO: PRÓXIMO TURNO CON POSICIÓN CONCRETA */}
      <div className="hero-shift-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-cyan)', letterSpacing: '0.05em' }}>
              ⚡ Próximo Turno Programado
            </span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0.2rem 0', color: 'var(--text-primary)' }}>
              {nextShiftData ? `Día ${nextShiftData.dayNum} de ${monthNames[selectedMonth]}` : 'Sin guardia asignada hoy'}
            </h2>
          </div>

          {/* Badges con código completo de turno (ej. MLNT, TLST) */}
          {nextShiftData && (
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {nextShiftData.shifts.map((shiftItem, idx) => (
                <span key={idx} style={{
                  background: getShiftBadgeStyle(shiftItem.shiftCode).bg,
                  border: `1px solid ${getShiftBadgeStyle(shiftItem.shiftCode).border}`,
                  color: getShiftBadgeStyle(shiftItem.shiftCode).color,
                  padding: '0.35rem 0.65rem',
                  borderRadius: '8px',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-mono)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                  {shiftItem.fullCode}
                </span>
              ))}
            </div>
          )}
        </div>

        {nextShiftData ? (
          <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {nextShiftData.shifts.map((shiftItem, idx) => (
              <div key={idx} style={{ 
                background: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid var(--glass-border)', 
                borderRadius: '10px', 
                padding: '0.6rem 0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: '700' }}>
                  <ShieldCheck size={16} color={getShiftBadgeStyle(shiftItem.shiftCode).color} />
                  <span>
                    Código: <strong style={{ color: getShiftBadgeStyle(shiftItem.shiftCode).color, fontFamily: 'var(--font-mono)' }}>{shiftItem.fullCode}</strong> · {getPositionDescription(shiftItem.posAcronym)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <Clock size={14} color="var(--accent-cyan)" />
                  <span>{getShiftBadgeStyle(shiftItem.shiftCode).label}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
            Estás de descanso o no hay turnos registrados para el período seleccionado.
          </p>
        )}
      </div>

      {/* NAVEGACIÓN Y GRILLA HOMOGÉNEA DEL CALENDARIO */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        padding: '0.9rem',
        boxShadow: 'var(--glass-shadow)'
      }}>
        {/* Cabecera del Mes */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.4rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CalendarIcon size={17} color="var(--accent-cyan)" />
            {monthNames[selectedMonth]} {selectedYear}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <a
              href={webcalUrl}
              style={{
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid var(--accent-cyan)',
                color: 'var(--accent-cyan)',
                borderRadius: '8px',
                padding: '0.35rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              📅 Sync iPhone / Mac
            </a>
            <button 
              onClick={handlePrevMonth} 
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '0.35rem', cursor: 'pointer' }}
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={handleNextMonth} 
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '0.35rem', cursor: 'pointer' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Días de la semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', textAlign: 'center', marginBottom: '0.4rem' }}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
            <span key={idx} style={{ fontSize: '0.68rem', fontWeight: '700', color: idx >= 5 ? 'var(--status-warning)' : 'var(--text-muted)' }}>
              {d}
            </span>
          ))}
        </div>

        {/* Grilla homogénea de celdas cuadradas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
          {/* Celdas vacías previas */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: '62px', opacity: 0.2 }} />
          ))}

          {/* Días del mes */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayShifts = getUserShiftsForDay(dayNum);
            const isToday = dayNum === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
            const hasMultipleShifts = dayShifts.length > 1;

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDayDetail({ dayNum, dayShifts })}
                style={{
                  minHeight: '62px',
                  width: '100%',
                  borderRadius: '10px',
                  border: isToday ? '2px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  padding: '0.3rem 0.15rem',
                  cursor: 'pointer',
                  gap: '0.2rem',
                  boxSizing: 'border-box'
                }}
              >
                {/* Número del Día */}
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: isToday ? '800' : '700', 
                  color: isToday ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  lineHeight: 1
                }}>
                  {dayNum}
                </span>

                {/* Lista de Turnos Asignados (Renderiza 1 o 2 turnos complementarios) */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.15rem', 
                  width: '100%', 
                  alignItems: 'center' 
                }}>
                  {dayShifts.length > 0 ? (
                    dayShifts.map((item, sIdx) => {
                      if (item.type === 'EXCEPTION') {
                        return (
                          <span key={sIdx} style={{
                            fontSize: '0.58rem',
                            fontWeight: '800',
                            fontFamily: 'var(--font-mono)',
                            background: 'rgba(244, 63, 94, 0.18)',
                            border: '1px solid rgba(244, 63, 94, 0.35)',
                            color: 'var(--status-danger)',
                            padding: '0.08rem 0.2rem',
                            borderRadius: '5px',
                            lineHeight: 1.1,
                            textAlign: 'center',
                            width: '92%'
                          }}>
                            {item.code}
                          </span>
                        );
                      }
                      const badgeStyle = getShiftBadgeStyle(item.shiftCode);
                      return (
                        <span key={sIdx} style={{
                          fontSize: '0.6rem',
                          fontWeight: '800',
                          fontFamily: 'var(--font-mono)',
                          background: badgeStyle.bg,
                          border: `1px solid ${badgeStyle.border}`,
                          color: badgeStyle.color,
                          padding: '0.08rem 0.15rem',
                          borderRadius: '5px',
                          lineHeight: 1.1,
                          textAlign: 'center',
                          width: '94%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.fullCode}
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM SHEET DETALLE DE DÍA CON POSICIÓN CONCRETA Y TODOS LOS TURNOS */}
      {selectedDayDetail && (
        <div className="bottom-sheet-backdrop" onClick={() => setSelectedDayDetail(null)}>
          <div className="bottom-sheet-modal" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
                Detalle Día {selectedDayDetail.dayNum} - {monthNames[selectedMonth]} {selectedYear}
              </h3>
              <button 
                onClick={() => setSelectedDayDetail(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {selectedDayDetail.dayShifts && selectedDayDetail.dayShifts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {selectedDayDetail.dayShifts.map((shiftItem, idx) => {
                  if (shiftItem.type === 'EXCEPTION') {
                    return (
                      <div key={idx} style={{
                        background: 'rgba(244, 63, 94, 0.12)',
                        border: '1px solid var(--status-danger)',
                        padding: '0.8rem',
                        borderRadius: '12px'
                      }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--status-danger)' }}>
                          NO OPERATIVO / DESCANSO
                        </span>
                        <h4 style={{ margin: '0.2rem 0', fontSize: '1.1rem', fontWeight: '800', color: 'var(--status-danger)' }}>
                          {shiftItem.status}
                        </h4>
                      </div>
                    );
                  }

                  const badgeStyle = getShiftBadgeStyle(shiftItem.shiftCode);
                  const colleagues = getShiftColleagues(shiftItem.dateKey, shiftItem.shiftCode);

                  return (
                    <div key={idx} style={{
                      background: 'var(--bg-secondary)',
                      border: `1px solid ${badgeStyle.border}`,
                      borderRadius: '14px',
                      padding: '0.9rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: badgeStyle.color, textTransform: 'uppercase' }}>
                            Guardia {shiftItem.shiftCode}
                          </span>
                          <h4 style={{ margin: '0.1rem 0', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            Código: <span style={{ color: badgeStyle.color }}>{shiftItem.fullCode}</span>
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                            {getPositionDescription(shiftItem.posAcronym)}
                          </span>
                        </div>

                        <span style={{
                          background: badgeStyle.bg,
                          border: `1px solid ${badgeStyle.border}`,
                          color: badgeStyle.color,
                          padding: '0.3rem 0.6rem',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '0.85rem',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {shiftItem.posAcronym}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <Clock size={14} color="var(--accent-cyan)" />
                        <span>{badgeStyle.label}</span>
                      </div>

                      {/* Compañeros en esta guardia */}
                      {colleagues.length > 0 && (
                        <div>
                          <h5 style={{ fontSize: '0.75rem', fontWeight: '700', margin: '0 0 0.4rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Users size={14} color="var(--accent-cyan)" />
                            Compañeros en esta guardia ({colleagues.length}):
                          </h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {colleagues.map((col, cIdx) => (
                              <div key={cIdx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--bg-tertiary)',
                                padding: '0.4rem 0.65rem',
                                borderRadius: '7px',
                                fontSize: '0.78rem'
                              }}>
                                <span style={{ fontWeight: '600' }}>{col.name} ({col.signature})</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-cyan)', fontSize: '0.72rem' }}>
                                  {col.fullCode}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Botón Solicitar Permuta (Redirecciona a Reemplazo con la fecha preseleccionada) */}
                      <button
                        onClick={() => {
                          const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDayDetail.dayNum).padStart(2, '0')}`;
                          setSelectedDayDetail(null);
                          if (onOpenTradeModal) onOpenTradeModal(dateStr, 'COVER');
                        }}
                        className="btn btn-primary"
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          fontWeight: '700',
                          fontSize: '0.8rem',
                          marginTop: '0.2rem'
                        }}
                      >
                        <ArrowRightLeft size={16} />
                        Solicitar Cambio para Turno {shiftItem.fullCode}
                      </button>
                    </div>
                  );
                })}

              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No tienes turno asignado para esta fecha (Descanso / Libre).</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
