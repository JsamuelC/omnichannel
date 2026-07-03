import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Check, Shield, Info } from 'lucide-react';
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
        const [usersRes, sharingRes] = await Promise.all([
          api.get('/users'),
          api.get('/wa-sharing'),
        ]);
        const allUsers = usersRes.data?.users || usersRes.data?.data?.users || [];
        // Solo operadores/supervisores activos de la misma empresa
        setAgents(allUsers.filter(u =>
          (u.role === 'agent' || u.role === 'supervisor') &&
          u.company_id === user?.company_id &&
          u.is_active
        ));
        setConfig(sharingRes.data || {});
      } catch {}
      setLoading(false);
    };
    load();
  }, [user?.company_id]);

  const toggleShare = (agentId) => {
    const myId = user?.id;
    if (!myId) return;
    setConfig(prev => {
      const shared = prev[myId] || [];
      return {
        ...prev,
        [myId]: shared.includes(agentId)
          ? shared.filter(id => id !== agentId)
          : [...shared, agentId],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/wa-sharing', { config });
      toast.success('Configuración guardada');
    } catch { toast.error('Error guardando'); }
    finally { setSaving(false); }
  };

  const myShared = config[user?.id] || [];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/config')} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg viewBox="0 0 24 24" className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Configuración
          </button>
          <span className="text-slate-300 dark:text-slate-600">›</span>
          <span className="text-sm font-medium">Compartir WhatsApp</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-xl">
          {/* Título */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100 dark:bg-green-900/30">
              <Share2 size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Compartir mi WhatsApp Business</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Los operadores seleccionados podrán ver y responder desde tu bandeja de WhatsApp.
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 mb-6 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <Shield size={14} className="flex-shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
            <p className="text-xs text-green-800 dark:text-green-300">
              Los <strong>administradores</strong> ven todas las bandejas de su empresa por defecto.
              Aquí configuras el acceso para <strong>operadores y supervisores</strong>.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Cargando operadores...</p>
          ) : agents.length === 0 ? (
            <div className="flex items-start gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <Info size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No hay operadores ni supervisores activos. Crea usuarios con rol
                <strong> Operador</strong> o <strong>Supervisor</strong> para poder compartir tu WhatsApp.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Operadores con acceso a mi bandeja
                </p>
              </div>

              {agents.map(agent => {
                const isShared = myShared.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                    onClick={() => toggleShare(agent.id)}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        background: isShared ? '#16a34a' : 'transparent',
                        border: `1.5px solid ${isShared ? '#16a34a' : '#d1d5db'}`,
                      }}
                    >
                      {isShared && <Check size={12} color="#fff" />}
                    </div>

                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-violet-500 flex-shrink-0">
                      {agent.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-slate-400 truncate">{agent.email}</p>
                    </div>

                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      agent.role === 'supervisor'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {agent.role === 'supervisor' ? 'Supervisor' : 'Operador'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {agents.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {myShared.length === 0
                ? 'Ningún operador tiene acceso actualmente.'
                : `${myShared.length} operador${myShared.length !== 1 ? 'es tienen' : ' tiene'} acceso a tu WhatsApp.`
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
