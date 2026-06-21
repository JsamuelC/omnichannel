import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Link2Off, Camera, Loader2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const META_APP_ID = '897060716742578';

export default function InstagramConfig() {
  const navigate = useNavigate();
  const [status, setStatus]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [connecting, setConnecting] = useState(false);

  const loadStatus = () => {
    api.get('/channels/instagram/status')
      .then(r => setStatus(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStatus(); }, []);

  // Detectar token de OAuth en localStorage (puesto por App.jsx desde popup)
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('ig_oauth_token');
      if (token) {
        localStorage.removeItem('ig_oauth_token');
        connectWithToken(token);
      }
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = () => {
    setConnecting(true);
    const redirectUri = `${window.location.origin}/config/instagram`;
    const scope = 'pages_show_list,pages_read_engagement,business_management';
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=token&display=popup`;
    const w = 600, h = 700;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;
    window.open(url, 'fb_instagram', `width=${w},height=${h},left=${left},top=${top}`);
  };

  const connectWithToken = async (token) => {
    setLoading(true);
    setConnecting(true);
    try {
      const r = await api.get(`/channels/pages?user_token=${token}`);
      const pages = r.data || [];
      const pageWithIg = pages.find(p => p.instagram);
      if (!pageWithIg) {
        toast.error('No se encontró una cuenta de Instagram Business vinculada a tus páginas. Verifica que tu Instagram sea cuenta Business y esté vinculada a tu página de Facebook.');
        return;
      }
      const res = await api.post('/channels/instagram/connect', {
        access_token: pageWithIg.page_access_token,
        ig_id: pageWithIg.instagram.ig_id,
        ig_username: pageWithIg.instagram.ig_username,
        page_id: pageWithIg.page_id,
      });
      if (res?.success) {
        toast.success('Instagram conectado');
        loadStatus();
      }
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); setConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar Instagram?')) return;
    try {
      await api.delete('/channels/instagram/disconnect');
      setStatus({ connected: false });
      toast.success('Instagram desconectado');
    } catch { toast.error('Error desconectando'); }
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
          <span className="text-sm font-medium">Instagram</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f58529, #dd2a7b, #8134af)' }}>
              <Camera size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Instagram</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Conecta tu cuenta de Instagram Business para recibir DMs en el inbox.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#94a3b8' }}><Loader2 size={16} className="animate-spin" /> Cargando...</div>
          ) : status?.connected ? (
            <div className="rounded-xl p-5" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm font-semibold text-green-800">Conectado</span>
              </div>
              <p className="text-sm mb-1" style={{ color: '#166534' }}>Cuenta: <strong>@{status.ig_username || status.ig_id}</strong></p>
              {status.connected_at && <p className="text-xs" style={{ color: '#4ade80' }}>Desde: {new Date(status.connected_at).toLocaleDateString()}</p>}
              <button onClick={handleDisconnect} className="flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                <Link2Off size={14} /> Desconectar
              </button>
            </div>
          ) : (
            <div className="rounded-xl p-5" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-2 mb-3">
                <XCircle size={16} style={{ color: '#94a3b8' }} />
                <span className="text-sm font-semibold" style={{ color: '#64748b' }}>No conectado</span>
              </div>
              <p className="text-sm mb-2" style={{ color: '#94a3b8' }}>
                Conecta tu cuenta de Instagram Business para recibir y responder mensajes directos desde la plataforma.
              </p>
              <p className="text-xs mb-4" style={{ color: '#cbd5e1' }}>
                Requisito: tu Instagram debe ser cuenta Business vinculada a una página de Facebook.
              </p>
              <button onClick={handleConnect} disabled={connecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #f58529, #dd2a7b, #8134af)' }}>
                {connecting ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                {connecting ? 'Conectando...' : 'Conectar Instagram'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
