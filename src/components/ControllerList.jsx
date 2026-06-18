import { useState } from 'react';
import { Search, Edit3, Trash2, Users, AlertCircle, GraduationCap, Shield } from 'lucide-react';

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
    const matchesSearch = controller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          controller.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = selectedFilter === 'ALL' || (controller.skills && controller.skills.includes(selectedFilter));

    return matchesSearch && matchesFilter;
  });

  const getSkillLabel = (skill) => {
    switch (skill) {
      case 'CTE': return 'Centro';
      case 'TWR': return 'Torre';
      case 'GND': return 'Superficie';
      case 'DEL': return 'Autorizaciones';
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
            placeholder="Buscar por nombre o ID de licencia..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <div className="filter-group">
          {['ALL', 'CTE', 'TWR', 'GND', 'DEL'].map((filter) => (
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

      {/* Lista Grid */}
      <div className="controllers-grid">
        {filteredControllers.length > 0 ? (
          filteredControllers.map((controller) => (
            <div key={controller.id} className="controller-card">
              <div className="controller-header">
                <div className="controller-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="controller-name">{controller.name}</span>
                    {controller.trainingPreferred && (
                      <GraduationCap size={15} style={{ color: 'var(--accent-indigo)', flexShrink: 0 }} title="Entrenamiento Preferente" />
                    )}
                    {controller.isAdmin && (
                      <Shield size={14} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} title="Administrador (Acceso Total)" />
                    )}
                    {controller.isSupervisor && (
                      <Shield size={14} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} title="Supervisor (Aprobación de Cambios)" />
                    )}
                  </div>
                  <span className="controller-id">{controller.id}</span>
                  {controller.email && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem', display: 'block', wordBreak: 'break-all' }}>
                      {controller.email}
                    </span>
                  )}
                </div>
                <div 
                  className="controller-status-dot" 
                  title={controller.active ? "Activo para programación" : "Inactivo"}
                  style={{
                    backgroundColor: controller.active ? 'var(--status-success)' : 'var(--status-danger)',
                    boxShadow: controller.active ? '0 0 8px var(--status-success)' : '0 0 8px var(--status-danger)'
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
  );
}
