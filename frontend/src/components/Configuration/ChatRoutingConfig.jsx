import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle, Users, Check, Info } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ROUTING_MODES = [
  { key: 'manual',      label: 'Manual',      desc: 'Los chats llegan sin asignar. Los agentes los toman manualmente.', icon: '✋' },
  { key: 'round_robin', label: 'Round Robin',  desc: 'Se distribuyen automáticamente entre los operadores seleccionados que estén activos.', icon: '🔄' },
];

const AVAILABILITY_LABELS = {
  active:   { label: 'Activo',      color: 'bg-green-500', text: 'text-green-700' },
  inactive: { label: 'Inactivo',    color: 'bg-red-500',   text: 'text-red-700' },
  break:    { label: 'En descanso', color: 'bg-amber-400', text: 'text-amber-700' },
};

export default function ChatRoutingConfig() {
  const navigate = useNavigate();
  const [mode, setMode]                 = useState('manual');
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [agents, setAgents]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/company');
        const routing = res.data?.routing_config || { mode: 'manual', agents: [] };
        setMode(routing.mode || 'manual');
        setSelectedAgents(routing.agents || []);
      } catch {}
      try {
        const res = await api.get('/users');
        const allUsers = res.data?.users || res.data?.data?.users || [];
        // Filtrar: solo usuarios de MI empresa, excluir superadmin
        const companyRes = await api.get('/company');
        const myCompanyId = companyRes.data?.id;
        setAgents(allUsers.filter(u => u.role !== 'superadmin' && (!myCompanyId || u.company_id === myCompanyId)));
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/company', { routing_config: { mode, agents: selectedAgents } });
      toast.success('Enrutamiento configurado');
    } catch { toast.error('Error guardando'); }
    finally { setSaving(false); }
  };

  const toggleAgent = (agentId) => {
    setSelectedAgents(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const selectAll = () => {
    const allIds = agents.filter(a => a.is_active).map(a => a.id);
    setSelectedAgents(allIds);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#fff', fontFamily: 'system-ui', color: '#0f172a' }}>
      <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/config')} className="text-sm" style={{ color: '#94a3b8' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            Configuración
          </button>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span className="text-sm font-medium">Enrutamiento de chat</span>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: '#6366f1', opacity: saving ? 0.7 : 1 }}>
          {saving ? '...' : 'Guardar'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eef2ff' }}>
              <Shuffle size={20} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Enrutamiento de chat</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Define cómo se distribuyen las conversaciones cuando el bot redirige a un humano.</p>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 mb-6 p-3 rounded-xl" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
            <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#6366f1' }} />
            <p className="text-xs" style={{ color: '#4338ca' }}>
              El enrutamiento se activa cuando el bot decide transferir a un humano (<code>[HUMAN_NEEDED]</code>) o cuando el cliente lo solicita. Solo los operadores seleccionados y con estado <strong>Activo</strong> recibirán chats.
            </p>
          </div>

          {/* Modo de enrutamiento */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>Modo de distribución</p>
            <div className="flex flex-col gap-3">
              {ROUTING_MODES.map(m => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: mode === m.key ? '#eef2ff' : '#f8fafc',
                    border: `1.5px solid ${mode === m.key ? '#6366f1' : '#e2e8f0'}`,
                  }}>
                  <span className="text-2xl">{m.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>{m.label}</p>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>{m.desc}</p>
                  </div>
                  {mode === m.key && <Check size={18} style={{ color: '#6366f1' }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Selección de operadores (solo visible en round_robin) */}
          {mode === 'round_robin' && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                  <Users size={12} className="inline mr-1" />
                  Operadores en la rotación
                </p>
                <button onClick={selectAll} className="text-xs font-medium" style={{ color: '#6366f1' }}>
                  Seleccionar todos
                </button>
              </div>

              {loading ? (
                <p className="text-sm" style={{ color: '#94a3b8' }}>Cargando...</p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #e2e8f0' }}>
                  {agents.filter(a => a.is_active).map(agent => {
                    const av = AVAILABILITY_LABELS[agent.availability || 'active'];
                    const isSelected = selectedAgents.includes(agent.id);
                    return (
                      <div key={agent.id}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                        style={{
                          borderBottom: '0.5px solid #f1f5f9',
                          background: isSelected ? '#eef2ff' : 'transparent',
                        }}
                        onClick={() => toggleAgent(agent.id)}>
                        {/* Checkbox */}
                        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            background: isSelected ? '#6366f1' : '#fff',
                            border: `1.5px solid ${isSelected ? '#6366f1' : '#d1d5db'}`,
                          }}>
                          {isSelected && <Check size={12} color="#fff" />}
                        </div>
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: '#6366f1' }}>
                          {agent.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        {/* Info */}
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: '#0f172a' }}>{agent.name}</p>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>{agent.email} · {agent.role === 'admin' ? 'Admin' : 'Operador'}</p>
                        </div>
                        {/* Estado */}
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${av.color}`} />
                          <span className={`text-xs font-medium ${av.text}`}>{av.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedAgents.length === 0 && (
                <p className="text-xs mt-2" style={{ color: '#ef4444' }}>
                  Selecciona al menos un operador para la rotación.
                </p>
              )}

              <p className="text-xs mt-3" style={{ color: '#94a3b8' }}>
                {selectedAgents.length} operador{selectedAgents.length !== 1 ? 'es' : ''} seleccionado{selectedAgents.length !== 1 ? 's' : ''}.
                Solo los que tengan estado <strong>Activo</strong> recibirán chats.
              </p>
            </div>
          )}

          {/* Estado actual de todos los agentes */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>
              Estado actual del equipo
            </p>
            {loading ? (
              <p className="text-sm" style={{ color: '#94a3b8' }}>Cargando...</p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #e2e8f0' }}>
                {agents.map(agent => {
                  const av = AVAILABILITY_LABELS[agent.availability || 'active'];
                  return (
                    <div key={agent.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: agent.is_active ? '#6366f1' : '#94a3b8' }}>
                        {agent.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: '#0f172a' }}>{agent.name}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{agent.role === 'admin' ? 'Admin' : 'Operador'} {!agent.is_active ? '(desactivado)' : ''}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${av.color}`} />
                        <span className={`text-xs font-medium ${av.text}`}>{av.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
