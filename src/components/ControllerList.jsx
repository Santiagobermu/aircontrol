import { useState } from 'react';
import { Search, Edit3, Trash2, Users, AlertCircle, GraduationCap, Shield, Hash, FileText, Mail, Phone, Lock } from 'lucide-react';

export default function ControllerList({ controllers, onEditController, onDeleteController, userRole }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleFilterClick = (filter) => {
    setSelectedFilter(filter);
  };

  // Filtrado lógico de los controladores
  const filteredControllers = controllers.filter(controller => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      (controller.fullName && controller.fullName.toLowerCase().includes(q)) ||
      (controller.name && controller.name.toLowerCase().includes(q)) ||
      (controller.id && controller.id.toLowerCase().includes(q)) ||
      (controller.referenceNumber && controller.referenceNumber.toLowerCase().includes(q)) ||
      (controller.documentId && controller.documentId.toLowerCase().includes(q)) ||
      (controller.phone && controller.phone.toLowerCase().includes(q)) ||
      (controller.institutionalEmail && controller.institutionalEmail.toLowerCase().includes(q)) ||
      (controller.email && controller.email.toLowerCase().includes(q));
    
    const matchesFilter = selectedFilter === 'ALL' || (controller.skills && controller.skills.includes(selectedFilter));

    return matchesSearch && matchesFilter;
  });

  const getSkillLabel = (skill) => {
    switch (skill) {
      case 'CTE': return 'Centro / Encargado';
      case 'TWR': return 'Torre';
      case 'GND': return 'Superficie';
      case 'DEL': return 'Autorizaciones';
      case 'FIC': return 'Información de Vuelo';
      case 'SIM': return 'Pseudopiloto';
      default: return skill;
    }
  };

  return (
    <div className="glass-panel" style={{ flex: 1 }}>
      <div className="panel-header">
        <h3>
          <Users size={20} />
          Controladores Registrados
          <span style={{ 
            fontSize: '0.75rem', 
            backgroundColor: 'var(--bg-tertiary)', 
            color: 'var(--accent-cyan)', 
            padding: '0.2rem 0.6rem', 
            borderRadius: '20px', 
            marginLeft: '0.5rem',
            border: '1px solid rgba(6, 182, 212, 0.15)'
          }}>
            {filteredControllers.length} / {controllers.length}
          </span>
        </h3>
      </div>

      {/* Controles de Búsqueda y Filtro */}
      <div className="list-controls">
        <div className="search-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Buscar por nombre, siglas, licencia, ref, documento o correo..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <div className="filter-group">
          {['ALL', 'CTE', 'TWR', 'GND', 'DEL', 'FIC', 'SIM'].map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterClick(filter)}
              className={`filter-btn ${selectedFilter === filter ? 'active' : ''}`}
            >
              {filter === 'ALL' ? 'Todos' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Contenedor con Scroll para la Lista de Controladores */}
      <div className="controllers-scroll-container">
        <div className="controllers-grid">
          {filteredControllers.length > 0 ? (
            filteredControllers.map((controller) => (
              <div key={controller.id} className="controller-card">
                <div className="controller-header">
                  <div className="controller-info" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="controller-name">
                        {controller.fullName || controller.name}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        color: 'var(--accent-cyan)',
                        backgroundColor: 'rgba(6, 182, 212, 0.12)',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)'
                      }} title="SIGLAS / Firma Operativa">
                        {controller.name}
                      </span>
                      {controller.trainingPreferred && (
                        <GraduationCap size={15} style={{ color: 'var(--accent-indigo)', flexShrink: 0 }} title="Entrenamiento Preferente" />
                      )}
                      {controller.isAdmin && (
                        <Shield size={14} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} title="Administrador (Acceso Total)" />
                      )}
                      {controller.isSupervisor && (
                        <Shield size={14} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} title="Encargado de Turno (CTE)" />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                      <span className="controller-id">{controller.id}</span>
                      {controller.referenceNumber && (
                        <span style={{
                          fontSize: '0.65rem',
                          background: 'rgba(6, 182, 212, 0.1)',
                          border: '1px solid rgba(6, 182, 212, 0.25)',
                          color: 'var(--accent-cyan)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: '600',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          Ref: {controller.referenceNumber}
                        </span>
                      )}
                      {controller.documentId && (
                        <span style={{
                          fontSize: '0.65rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--text-secondary)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: '500'
                        }}>
                          Doc: {controller.documentId}
                        </span>
                      )}
                    </div>

                    {/* Datos de contacto y correos */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.4rem' }}>
                      {controller.institutionalEmail && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--accent-cyan)' }} title="Correo institucional oficial">
                          <Mail size={12} style={{ flexShrink: 0 }} />
                          <span style={{ wordBreak: 'break-all', fontWeight: '500' }}>{controller.institutionalEmail}</span>
                        </div>
                      )}
                      {controller.phone && (
                        <a 
                          href={`tel:${controller.phone}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
                          title="Llamar o contactar"
                        >
                          <Phone size={12} style={{ flexShrink: 0, color: 'var(--status-success)' }} />
                          <span>{controller.phone}</span>
                        </a>
                      )}
                      {controller.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)' }} title="Correo de acceso al sistema">
                          <Lock size={11} style={{ flexShrink: 0 }} />
                          <span style={{ wordBreak: 'break-all' }}>Acceso: {controller.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div 
                    className="controller-status-dot" 
                    title={controller.active ? "Activo para programación" : "Inactivo"}
                    style={{
                      backgroundColor: controller.active ? 'var(--status-success)' : 'var(--status-danger)',
                      boxShadow: controller.active ? '0 0 8px var(--status-success)' : '0 0 8px var(--status-danger)',
                      flexShrink: 0
                    }}
                  />
                </div>

                <div className="controller-body">
                  <span className="skills-label">Habilitaciones Certificadas:</span>
                  <div className="controller-skills">
                    {(controller.skills || []).map((skill) => (
                      <span 
                        key={skill} 
                        className={`skill-chip ${skill.toLowerCase()}`}
                        title={getSkillLabel(skill)}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {userRole === 'admin' && (
                  <div className="controller-footer">
                    <button
                      onClick={() => onEditController(controller)}
                      className="btn btn-secondary btn-icon-only"
                      title="Editar controlador"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => onDeleteController(controller.id)}
                      className="btn btn-danger-outline btn-icon-only"
                      title="Eliminar controlador"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <AlertCircle size={40} />
              <p style={{ fontWeight: '500', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                No se encontraron controladores
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Prueba cambiando la búsqueda o el filtro de habilidad, o registra un controlador nuevo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
