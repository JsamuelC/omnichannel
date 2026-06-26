import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Users, Check, Eye, Shield } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store';

export default function WASharingConfig() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [agents, setAgents]   = useState([]);
  const [config, setConfig]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, sharingRes, companyRes] = await Promise.all([
          api.get('/users'),
          api.get('/wa-sharing'),
          api.get('/company'),
        ]);
        const allUsers = usersRes.data?.users || usersRes.data?.data?.users || [];
        const myCompanyId = companyRes.data?.id;
        setAgents(allUsers.filter(u => u.role !== 'superadmin' && (!myCompanyId || u.company_id === myCompanyId)));
        setConfig(sharingRes.data || {});
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const toggleShare = (ownerId, agentId) => {
    setConfig(prev => {
      const next = { ...prev };
      if (!next[ownerId]) next[ownerId] = [];
      if (next[ownerId].includes(agentId)) {
        next[ownerId] = next[ownerId].filter(id => id !== agentId);
      } else {
        next[ownerId] = [...next[ownerId], agentId];
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/wa-sharing', { config });
      toast.success('Configuración de compartir guardada');
    } catch { toast.error('Error guardando'); }
    finally { setSaving(false); }
  };

  const admins = agents.filter(a => a.role === 'admin');
  const operators = agents.filter(a => a.role === 'agent');

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#fff', fontFamily: 'system-ui', color: '#0f172a' }}>
      <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/config')} className="text-sm" style={{ color: '#94a3b8' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            Configuración
          </button>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span className="text-sm font-medium">Compartir WhatsApp</span>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#16a34a', opacity: saving ? 0.7 : 1 }}>
          {saving ? '...' : 'Guardar'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7' }}>
              <Share2 size={20} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Compartir bandeja de WhatsApp</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Permite que los operadores vean y respondan desde la bandeja de WA Business de otros usuarios.</p>
            </div>
          </div>

          {/* Info monitoreo admin */}
          <div className="flex items-start gap-2 mb-6 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <Shield size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
            <p className="text-xs" style={{ color: '#166534' }}>
              Los <strong>administradores</strong> pueden ver todas las bandejas de WhatsApp de su empresa para monitoreo, sin necesidad de permiso.
            </p>
          </div>

          {loading ? (
            <p className="text-sm" style={{ color: '#94a3b8' }}>Cargando...</p>
          ) : (
            <div className="space-y-6">
              {/* Por cada usuario que tiene WA, mostrar a quién puede compartir */}
              {agents.filter(a => a.is_active).map(owner => {
                const othersCanSee = agents.filter(a => a.id !== owner.id && a.is_active && a.role === 'agent');
                if (othersCanSee.length === 0) return null;

                const shared = config[owner.id] || [];

                return (
                  <div key={owner.id} className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #e2e8f0' }}>
                    <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#f8fafc', borderBottom: '0.5px solid #e2e8f0' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#25d366' }}>
                        {owner.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>{owner.name}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{owner.role === 'admin' ? 'Admin' : 'Operador'} · {owner.email}</p>
                      </div>
                      <Eye size={14} style={{ color: '#94a3b8' }} />
                    </div>

                    <div className="px-4 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
                        ¿Quién puede ver la bandeja de {owner.name.split(' ')[0]}?
                      </p>
                      {othersCanSee.map(agent => {
                        const isShared = shared.includes(agent.id);
                        return (
                          <div key={agent.id} className="flex items-center gap-3 py-2 cursor-pointer" onClick={() => toggleShare(owner.id, agent.id)}>
                            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                              style={{ background: isShared ? '#16a34a' : '#fff', border: `1.5px solid ${isShared ? '#16a34a' : '#d1d5db'}` }}>
                              {isShared && <Check size={12} color="#fff" />}
                            </div>
                            <p className="text-sm" style={{ color: '#0f172a' }}>{agent.name}</p>
                            <p className="text-xs" style={{ color: '#94a3b8' }}>{agent.email}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
