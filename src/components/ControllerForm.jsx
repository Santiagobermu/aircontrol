import { useState } from 'react';
import { UserPlus, UserCheck, AlertTriangle, Shield, Hash, FileText, Mail, Phone, Lock, Award, User, PenTool, ShieldCheck, Trash2 } from 'lucide-react';
import { validateController } from '../utils/storage';
import SignatureModal from './SignatureModal';

export default function ControllerForm({ onAddController, editingController, onUpdateController, onCancelEdit, controllers, userRole }) {
  const [fullName, setFullName] = useState(editingController ? (editingController.fullName || '') : '');
  const [name, setName] = useState(editingController ? (editingController.name || '') : '');
  const [id, setId] = useState(editingController ? (editingController.id || '') : '');
  const [referenceNumber, setReferenceNumber] = useState(editingController ? (editingController.referenceNumber || '') : '');
  const [documentId, setDocumentId] = useState(editingController ? (editingController.documentId || '') : '');
  const [institutionalEmail, setInstitutionalEmail] = useState(editingController ? (editingController.institutionalEmail || '') : '');
  const [phone, setPhone] = useState(editingController ? (editingController.phone || '') : '');
  const [signatureUrl, setSignatureUrl] = useState(editingController ? (editingController.signatureUrl || '') : '');
  const [signatureDataUrl, setSignatureDataUrl] = useState(editingController ? (editingController.signatureDataUrl || '') : '');
  const [signaturePin, setSignaturePin] = useState(editingController ? (editingController.signaturePin || '') : '');
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [skills, setSkills] = useState(editingController ? (editingController.skills || []) : []);
  const [trainingPreferred, setTrainingPreferred] = useState(editingController ? !!editingController.trainingPreferred : false);
  const [isAdmin, setIsAdmin] = useState(editingController ? !!editingController.isAdmin : false);
  const [isSupervisor, setIsSupervisor] = useState(editingController ? !!editingController.isSupervisor : false);
  const [email, setEmail] = useState(editingController ? (editingController.email || '') : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const resetForm = () => {
    setFullName('');
    setName('');
    setId('');
    setReferenceNumber('');
    setDocumentId('');
    setInstitutionalEmail('');
    setPhone('');
    setSignatureUrl('');
    setSignatureDataUrl('');
    setSignaturePin('');
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

    // Validar SIGLAS
    if (!name || name.trim() === '') {
      setError('Las SIGLAS (firma operativa) son obligatorias.');
      return;
    }
    // Validar Licencia / ID
    if (!id || id.trim() === '') {
      setError('La Licencia / ID único es obligatorio.');
      return;
    }
    // Validar email y password locales para acceso
    if (!email || email.trim() === '') {
      setError('El correo electrónico de acceso a la plataforma es obligatorio.');
      return;
    }
    if (!editingController && (!password || password.length < 6)) {
      setError('La contraseña de acceso es obligatoria y debe tener al menos 6 caracteres.');
      return;
    }

    const siglaClean = name.trim().toUpperCase();

    const controllerData = {
      ...(editingController || {}),
      id: id.trim(),
      originalId: editingController ? editingController.id : undefined,
      fullName: fullName.trim(),
      name: siglaClean,
      signature: siglaClean,
      referenceNumber: referenceNumber.trim(),
      documentId: documentId.trim(),
      institutionalEmail: institutionalEmail.trim().toLowerCase(),
      phone: phone.trim(),
      signatureUrl: signatureUrl || '',
      signatureDataUrl: signatureDataUrl || '',
      signaturePin: signaturePin || '',
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
    { code: 'FIC', name: 'Información de Vuelo (FIC)', description: 'Servicio de Información de Vuelo' },
    { code: 'SIM', name: 'Pseudopiloto (SIM)', description: 'Operador de Simulador' }
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

        {/* SECCIÓN 1: DATOS OPERATIVOS Y PERSONALES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
            paddingBottom: '0.35rem'
          }}>
            <User size={14} />
            Identificación Operativa y Personal
          </div>

          {/* 1. Nombre Completo */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="ctrl-fullname" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <User size={13} style={{ color: 'var(--accent-cyan)' }} />
              Nombre Completo
            </label>
            <input
              id="ctrl-fullname"
              type="text"
              className="form-input"
              placeholder="Ej: Carlos Arturo Mendoza Rodríguez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
            />
          </div>

          {/* 2 y 3. SIGLAS y Licencia / ID único (editable) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ctrl-name" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Award size={13} style={{ color: 'var(--accent-cyan)' }} />
                SIGLAS (Firma Operativa) *
              </label>
              <input
                id="ctrl-name"
                type="text"
                className="form-input"
                placeholder="Ej: JZA, GMB, CSO"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                maxLength={10}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Sigla de 2 a 4 letras visible en la malla y asignaciones.
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ctrl-id" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Shield size={13} style={{ color: 'var(--accent-cyan)' }} />
                Licencia / ID Único *
              </label>
              <input
                id="ctrl-id"
                type="text"
                className="form-input"
                placeholder="Ej: ATC-123"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
              />
              {editingController && (
                <span style={{ fontSize: '0.7rem', color: 'var(--status-warning)' }}>
                  ⚠️ Editable: actualizará sus turnos en el cuadrante.
                </span>
              )}
            </div>
          </div>

          {/* 4 y 5. No. Referencia Interno y Documento de Identidad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ctrl-ref" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Hash size={13} style={{ color: 'var(--accent-cyan)' }} />
                No. Referencia Interno
              </label>
              <input
                id="ctrl-ref"
                type="text"
                className="form-input"
                placeholder="Ej: REF-042 o Cód. Empleado"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ctrl-doc" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FileText size={13} style={{ color: 'var(--accent-cyan)' }} />
                Documento de Identidad (C.C. / ID)
              </label>
              <input
                id="ctrl-doc"
                type="text"
                className="form-input"
                placeholder="Ej: 1018456789"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: CONTACTO Y CORREO INSTITUCIONAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
            paddingBottom: '0.35rem'
          }}>
            <Mail size={14} />
            Contacto Oficial para Notificaciones de Turno
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ctrl-inst-email" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={13} style={{ color: 'var(--accent-cyan)' }} />
                Correo Institucional
              </label>
              <input
                id="ctrl-inst-email"
                type="email"
                className="form-input"
                placeholder="Ej: c.mendoza@aerocivil.gov.co"
                value={institutionalEmail}
                onChange={(e) => setInstitutionalEmail(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ctrl-phone" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={13} style={{ color: 'var(--accent-cyan)' }} />
                Número de Contacto / Celular
              </label>
              <input
                id="ctrl-phone"
                type="tel"
                className="form-input"
                placeholder="Ej: +57 310 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            ℹ️ El correo institucional será el destinatario oficial para el envío de correos automáticos de oficialización de covers y swaps.
          </span>
        </div>

        {/* SECCIÓN 3: FIRMA HÍBRIDA Y PIN OPERATIVO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
            paddingBottom: '0.35rem'
          }}>
            <PenTool size={14} />
            Firma Híbrida y PIN de Autorización
          </div>

          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  color: (signatureUrl || signatureDataUrl) ? 'var(--status-success)' : 'var(--text-muted)',
                  background: (signatureUrl || signatureDataUrl) ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  border: (signatureUrl || signatureDataUrl) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--color-border)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px'
                }}>
                  {(signatureUrl || signatureDataUrl) ? '✓ Firma Gráfica Registrada' : 'Sin Firma Gráfica'}
                </span>

                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  color: signaturePin ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  background: signaturePin ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  border: signaturePin ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid var(--color-border)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px'
                }}>
                  {signaturePin ? '✓ PIN Operativo: Configurado' : 'Sin PIN Operativo'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="filter-btn active"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <PenTool size={13} />
                  {(signatureUrl || signatureDataUrl) ? 'Modificar Firma / PIN' : 'Configurar Firma y PIN'}
                </button>

                {(signatureUrl || signatureDataUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('¿Deseas eliminar la firma y PIN registrados para este controlador?')) {
                        setSignatureUrl('');
                        setSignatureDataUrl('');
                        setSignaturePin('');
                      }
                    }}
                    className="btn btn-danger-outline btn-icon-only"
                    style={{ padding: '0.3rem' }}
                    title="Eliminar Firma y PIN"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Vista previa de la firma si existe */}
            {(signatureUrl || signatureDataUrl) && (
              <div style={{
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vista previa trazo:</span>
                <img 
                  src={signatureDataUrl || signatureUrl} 
                  alt="Firma" 
                  style={{ maxHeight: '42px', maxWidth: '160px', objectFit: 'contain' }} 
                />
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 4: ACCESO A LA PLATAFORMA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
            paddingBottom: '0.35rem'
          }}>
            <Lock size={14} />
            Credenciales de Acceso al Sistema
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ctrl-email">Correo Electrónico (Acceso) *</label>
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

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ctrl-password">
                {editingController ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
              </label>
              <input
                id="ctrl-password"
                type="password"
                className="form-input"
                placeholder={editingController ? 'Dejar en blanco para no cambiar' : 'Mínimo 6 caracteres'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingController}
                minLength={6}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: HABILITACIONES Y ROLES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            color: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
            paddingBottom: '0.35rem'
          }}>
            <Award size={14} />
            Habilitaciones y Roles Operativos
          </div>

          <div className="form-group" style={{ margin: 0 }}>
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
          </div>

          {/* Campo Entrenamiento Preferente */}
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.65rem' }}>
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
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', padding: '0.85rem' }}>
          {editingController ? 'Guardar Cambios del Perfil' : 'Registrar en Base de Datos'}
        </button>
      </form>

      {/* MODAL DE CONFIGURACIÓN DE FIRMA Y PIN */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        controller={{
          id: id || 'ATC-TEMP',
          name: name || 'ATC',
          fullName: fullName || name || 'Controlador',
          referenceNumber,
          documentId,
          institutionalEmail,
          signatureUrl,
          signatureDataUrl,
          signaturePin
        }}
        onSaveSignature={({ signatureUrl: newUrl, signatureDataUrl: newDataUrl, signaturePin: newPin }) => {
          setSignatureUrl(newUrl);
          setSignatureDataUrl(newDataUrl);
          if (newPin) setSignaturePin(newPin);
        }}
        isAdmin={true}
      />
    </div>
  );
}
