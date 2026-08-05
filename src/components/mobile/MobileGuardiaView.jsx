import { useState } from 'react';
import { Radio, Shield, Users, Clock, UserCheck } from 'lucide-react';
import { getSlotAcronym } from '../../utils/schedulerEngine';

export default function MobileGuardiaView({ scheduleMonth, controllers, currentUser }) {
  const [selectedShift, setSelectedShift] = useState('M'); // 'A' | 'M' | 'T' | 'N'
  const [targetDayOffset, setTargetDayOffset] = useState(0); // 0 = Hoy, 1 = Mañana

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + targetDayOffset);
  const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

  const shiftConfig = {
    'A': { title: 'Madrugada (A)', hours: '00:00 - 06:00 UTC', color: 'var(--shift-madrugada)', bg: 'rgba(99, 102, 241, 0.12)' },
    'M': { title: 'Mañana (M)', hours: '06:00 - 12:00 UTC', color: 'var(--shift-manana)', bg: 'rgba(6, 182, 212, 0.12)' },
    'T': { title: 'Tarde (T)', hours: '12:00 - 18:00 UTC', color: 'var(--shift-tarde)', bg: 'rgba(245, 158, 11, 0.12)' },
    'N': { title: 'Noche (N)', hours: '18:00 - 24:00 UTC', color: 'var(--shift-noche)', bg: 'rgba(16, 185, 129, 0.12)' },
  };

  const currentDayData = scheduleMonth ? scheduleMonth[dateKey] : null;
  const shiftSlots = currentDayData?.[selectedShift] || {};

  // Nombres completos y precisos de cada posición operacional
  const getFullPositionName = (slotKey, shift) => {
    const acronym = getSlotAcronym(slotKey, shift);
    switch (acronym) {
      case 'LNT': return 'Torre Norte (LNT)';
      case 'LST': return 'Torre Sur (LST)';
      case 'LPT': return 'Torre Reserva (LPT)';
      case 'GNT': return 'Superficie Norte (GNT)';
      case 'GST': return 'Superficie Sur (GST)';
      case 'GPT': return 'Superficie Reserva (GPT)';
      case 'DPT': return 'Autorizaciones Titular (DPT)';
      case 'DPR': return 'Autorizaciones Reserva (DPR)';
      case 'FPT': return 'FIC Titular (FPT)';
      case 'FPR': return 'FIC Reserva (FPR)';
      case 'FPA': return 'FIC Apoyo (FPA)';
      case 'CTE': return 'Encargado de Turno (CTE)';
      case 'ACC': return 'Centro de Control (ACC)';
      case 'SIM': return 'Simulador / Pseudopiloto (SIM)';
      case 'OFI': return 'Turno Administrativo (OFI)';
      case 'CAE': return 'Capacitación Especial (CAE)';
      case 'CHC': return 'Chequeo / Evaluación (CHC)';
      case 'ENT': return 'Entrenamiento Alumno (ENT)';
      case 'INS': return 'Instrucción Operativa (INS)';
      default: return `${slotKey} (${acronym})`;
    }
  };

  // Agrupar por áreas operativas
  const getGroupedPositions = () => {
    const groups = {
      'CTE (Supervisión de Turno)': [],
      'TWR (Torre de Control)': [],
      'GND (Control de Superficie)': [],
      'DEL (Autorizaciones de Plan)': [],
      'FIC / ACC (Ruta & Control)': []
    };

    Object.entries(shiftSlots).forEach(([slotKey, assignedId]) => {
      if (!assignedId) return;
      const ctrlObj = controllers.find(c => c.id === assignedId || c.signature === assignedId);
      const name = ctrlObj ? ctrlObj.name : assignedId;
      const sig = ctrlObj ? ctrlObj.signature : assignedId;
      const fullPosName = getFullPositionName(slotKey, selectedShift);

      const item = { 
        slotId: `${selectedShift}-${slotKey}`, 
        posKey: slotKey, 
        fullPosName,
        ctrlSig: sig, 
        ctrlId: assignedId,
        name 
      };

      if (slotKey.includes('CTE')) groups['CTE (Supervisión de Turno)'].push(item);
      else if (slotKey.includes('TWR') || slotKey.includes('LNT') || slotKey.includes('LST') || slotKey.includes('LPT')) groups['TWR (Torre de Control)'].push(item);
      else if (slotKey.includes('GND') || slotKey.includes('GNT') || slotKey.includes('GST') || slotKey.includes('GPT')) groups['GND (Control de Superficie)'].push(item);
      else if (slotKey.includes('DEL') || slotKey.includes('DPT') || slotKey.includes('DPR')) groups['DEL (Autorizaciones de Plan)'].push(item);
      else groups['FIC / ACC (Ruta & Control)'].push(item);
    });

    return groups;
  };

  const grouped = getGroupedPositions();

  // Verificar si la fila corresponde al controlador autenticado
  const isMe = (item) => {
    if (!currentUser) return false;
    return (item.ctrlSig && item.ctrlSig === currentUser.signature) ||
           (item.ctrlId && item.ctrlId === currentUser.id) ||
           (item.name && item.name === currentUser.name);
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Selector de Fecha (Turno de Hoy / Turno de Mañana) */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '0.25rem', border: '1px solid var(--glass-border)' }}>
        <button
          onClick={() => setTargetDayOffset(0)}
          style={{
            flex: 1,
            padding: '0.55rem',
            border: 'none',
            borderRadius: '9px',
            background: targetDayOffset === 0 ? 'var(--accent-cyan)' : 'transparent',
            color: targetDayOffset === 0 ? '#000' : 'var(--text-secondary)',
            fontWeight: '800',
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Turno de Hoy
        </button>
        <button
          onClick={() => setTargetDayOffset(1)}
          style={{
            flex: 1,
            padding: '0.55rem',
            border: 'none',
            borderRadius: '9px',
            background: targetDayOffset === 1 ? 'var(--accent-cyan)' : 'transparent',
            color: targetDayOffset === 1 ? '#000' : 'var(--text-secondary)',
            fontWeight: '800',
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Turno de Mañana
        </button>
      </div>

      {/* Tabs de Jornadas (A, M, T, N) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
        {Object.entries(shiftConfig).map(([code, config]) => {
          const isSelected = selectedShift === code;
          return (
            <button
              key={code}
              onClick={() => setSelectedShift(code)}
              style={{
                padding: '0.6rem 0.3rem',
                borderRadius: '10px',
                border: isSelected ? `2px solid ${config.color}` : '1px solid var(--glass-border)',
                background: isSelected ? config.bg : 'var(--bg-secondary)',
                color: isSelected ? config.color : 'var(--text-muted)',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textAlign: 'center',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {code}
            </button>
          );
        })}
      </div>

      {/* Cabecera del Turno Seleccionado */}
      <div style={{
        background: shiftConfig[selectedShift].bg,
        border: `1px solid ${shiftConfig[selectedShift].color}`,
        borderRadius: '12px',
        padding: '0.75rem 1rem',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: shiftConfig[selectedShift].color }}>
            Personal En Turno · {shiftConfig[selectedShift].title}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {shiftConfig[selectedShift].hours}
          </span>
        </div>
        <Radio size={20} color={shiftConfig[selectedShift].color} />
      </div>

      {/* Desglose por Posiciones Operativas Completas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Object.entries(grouped).map(([groupTitle, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={groupTitle} style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '14px',
              padding: '0.85rem',
              boxShadow: 'var(--glass-shadow)'
            }}>
              <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {groupTitle}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {items.map((item, idx) => {
                  const isCurrentLoggedUser = isMe(item);
                  return (
                    <div 
                      key={idx} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        background: isCurrentLoggedUser ? 'rgba(6, 182, 212, 0.14)' : 'var(--bg-tertiary)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '10px',
                        border: isCurrentLoggedUser ? '1.5px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                        boxShadow: isCurrentLoggedUser ? '0 0 14px rgba(6, 182, 212, 0.25)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: isCurrentLoggedUser ? '800' : '600', color: isCurrentLoggedUser ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          {item.fullPosName}
                        </span>
                      </div>

                      {/* Siglas con Resaltado (tú) si corresponde */}
                      {isCurrentLoggedUser ? (
                        <span style={{
                          background: 'var(--accent-cyan)',
                          color: '#000',
                          fontWeight: '800',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '7px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          boxShadow: '0 0 10px rgba(6, 182, 212, 0.4)'
                        }}>
                          {item.ctrlSig} (tú)
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--glass-border)',
                          fontWeight: '700',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '6px'
                        }}>
                          {item.ctrlSig}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
