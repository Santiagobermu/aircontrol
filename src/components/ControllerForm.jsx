import { useState } from 'react';
import { UserPlus, UserCheck, AlertTriangle, Shield } from 'lucide-react';
import { validateController } from '../utils/storage';

export default function ControllerForm({ onAddController, editingController, onUpdateController, onCancelEdit, controllers, userRole }) {
  const [name, setName] = useState(editingController ? editingController.name : '');
  const [id, setId] = useState(editingController ? editingController.id : '');
  const [skills, setSkills] = useState(editingController ? (editingController.skills || []) : []);
  const [trainingPreferred, setTrainingPreferred] = useState(editingController ? !!editingController.trainingPreferred : false);
  const [isAdmin, setIsAdmin] = useState(editingController ? !!editingController.isAdmin : false);
  const [isSupervisor, setIsSupervisor] = useState(editingController ? !!editingController.isSupervisor : false);
  const [email, setEmail] = useState(editingController ? (editingController.email || '') : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const resetForm = () => {
    setName('');
    setId('');
    setSkills([]);
    setTrainingPreferred(false);
    setIsAdmin(false);
    setIsSupervisor(false);
    setEmail('');
    setPassword('');
    setError(null);
  };

  const handleSkillChange = (skill) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter(s => s !== skill));
    } else {
      setSkills([...skills, skill]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    // Validar email y password locales
    if (!email || email.trim() === '') {
      setError('El correo electrónico de acceso es obligatorio.');
      return;
    }
    if (!editingController && (!password || password.length < 6)) {
      setError('La contraseña de acceso es obligatoria y debe tener al menos 6 caracteres.');
      return;
    }

    const controllerData = {
      ...(editingController || {}),
      id: id.trim(),
      name: name.trim(),
      skills,
      trainingPreferred,
      isAdmin,
      isSupervisor,
      active: editingController ? editingController.active : true,
      email: email.trim().toLowerCase()
    };

    if (password) {
      controllerData.password = password;
    }

    const validation = validateController(controllerData, controllers, !!editingController);

    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    if (editingController) {
      onUpdateController(controllerData);
    } else {
      onAddController(controllerData);
    }
    resetForm();
  };

  const skillOptions = [
    { code: 'CTE', name: 'Encargado de Turno (CTE)', description: 'Supervisor de turno' },
    { code: 'ACC', name: 'Ruta / ACC (ACC)', description: 'Control de Área' },
    { code: 'TWR', name: 'Torre (TWR)', description: 'Control de Pistas' },
    { code: 'GND', name: 'Superficie (GND)', description: 'Calles de Rodaje' },
    { code: 'DEL', name: 'Autorizaciones (DEL)', description: 'Planes de Vuelo' },
    { code: 'FIC', name: 'Información de Vuelo (FIC)', description: 'Servicio de Información de Vuelo' }
  ];

  if (userRole === 'supervisor') {
    return (
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', padding: '3rem', textAlign: 'center' }}>
        <Shield size={40} style={{ color: 'var(--accent-purple)' }} />
        <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', margin: 0 }}>Modo Solo Lectura</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Como Supervisor, puedes consultar la lista de controladores y sus certificaciones, pero la creación y edición de fichas está restringida al Administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3>
          {editingController ? (
            <>
              <UserCheck size={20} />
              Editar Controlador
            </>
          ) : (
            <>
              <UserPlus size={20} />
              Registrar Controlador
            </>
          )}
        </h3>
        {editingController && (
          <button 
            type="button" 
            className="filter-btn active" 
            onClick={onCancelEdit}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          >
            Cancelar Edición
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: 'var(--status-danger)',
            fontSize: '0.85rem',
            fontWeight: '500'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="ctrl-id">Licencia / ID Único</label>
          <input
            id="ctrl-id"
            type="text"
            className="form-input"
            placeholder="Ej: ATC-123"
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={!!editingController} // ID no se puede editar una vez creado
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="ctrl-name">Nombre Completo</label>
          <input
            id="ctrl-name"
            type="text"
            className="form-input"
            placeholder="Ej: Carlos Mendoza"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="ctrl-email">Correo Electrónico (Acceso)</label>
          <input
            id="ctrl-email"
            type="email"
            className="form-input"
            placeholder="Ej: jza@aircontrol.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="ctrl-password">
            {editingController ? 'Nueva Contraseña (Dejar en blanco para no cambiar)' : 'Contraseña de Acceso'}
          </label>
          <input
            id="ctrl-password"
            type="password"
            className="form-input"
            placeholder={editingController ? '••••••••' : 'Ej: Mínimo 6 caracteres'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!editingController}
            minLength={6}
          />
        </div>

        <div className="form-group">
          <label>Certificaciones / Skills</label>
          <div className="skills-selector-grid">
            {skillOptions.map((option) => {
              const isChecked = skills.includes(option.code);
              return (
                <label 
                  key={option.code} 
                  className={`skill-checkbox-card ${option.code.toLowerCase()}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleSkillChange(option.code)}
                  />
                  <div className="skill-checkbox-inner">
                    <span className="skill-abbr">{option.code}</span>
                    <span className="skill-name">{option.code}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Selecciona todas las posiciones en las que este controlador está certificado para operar.
          </p>
        </div>

        {/* Campo Entrenamiento Preferente */}
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <input
            id="ctrl-training"
            type="checkbox"
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            checked={trainingPreferred}
            onChange={(e) => setTrainingPreferred(e.target.checked)}
          />
          <label htmlFor="ctrl-training" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
            Personal de Entrenamiento Preferente (Shadowing / Alumno)
          </label>
        </div>

        {/* Roles de Acceso (Admin / Supervisor) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <input
              id="ctrl-admin"
              type="checkbox"
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              checked={isAdmin}
              onChange={(e) => {
                setIsAdmin(e.target.checked);
                if (e.target.checked) setIsSupervisor(false);
              }}
            />
            <label htmlFor="ctrl-admin" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
              Habilitar Perfil de Administrador (Acceso Total)
            </label>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <input
              id="ctrl-supervisor"
              type="checkbox"
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              checked={isSupervisor}
              onChange={(e) => {
                setIsSupervisor(e.target.checked);
                if (e.target.checked) setIsAdmin(false);
              }}
            />
            <label htmlFor="ctrl-supervisor" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
              Habilitar como Encargado de Turno (CTE) (Aprobación de Cambios y alertas de Radar)
            </label>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
          {editingController ? 'Guardar Cambios' : 'Registrar en Base de Datos'}
        </button>
      </form>
    </div>
  );
}
