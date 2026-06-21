import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Link2Off, MessageCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const META_APP_ID = '897060716742578';

export default function MessengerConfig() {
  const navigate = useNavigate();
  const [status, setStatus]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    api.get('/channels/messenger/status')
      .then(r => setStatus(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = () => {
    setConnecting(true);
    const redirectUri = `${window.location.origin}/config/messenger`;
    const scope = 'pages_show_list,pages_read_engagement,pages_messaging';
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=token&display=popup`;
    const w = 600, h = 700;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;
    const popup = window.open(url, 'fb_messenger', `width=${w},height=${h},left=${left},top=${top}`);

    const interval = setInterval(() => {
      try {
        if (!popup || popup.closed) { clearInterval(interval); setConnecting(false); return; }
        const popupUrl = popup.location.href;
        if (popupUrl.includes('access_token=')) {
          clearInterval(interval);
          const token = popupUrl.split('access_token=')[1]?.split('&')[0];
          popup.close();
          if (token) connectWithToken(token);
          else setConnecting(false);
        }
      } catch (_) {}
    }, 500);
  };

  const connectWithToken = async (token) => {
    setLoading(true);
    try {
      const r = await api.get(`/channels/pages?user_token=${token}`);
      const pages = r.data || [];
      if (pages.length === 0) { toast.error('No se encontraron páginas de Facebook'); return; }
      const page = pages[0];
      const res = await api.post('/channels/messenger/connect', {
        page_access_token: page.page_access_token, page_id: page.page_id, page_name: page.page_name,
      });
      if (res?.success) {
        toast.success('Messenger conectado');
        const r2 = await api.get('/channels/messenger/status');
        setStatus(r2.data);
      }
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); setConnecting(false); }
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const token = hash.split('access_token=')[1]?.split('&')[0];
      window.location.hash = '';
      if (token) connectWithToken(token);
    }
  }, []);

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar Messenger?')) return;
    try {
      await api.delete('/channels/messenger/disconnect');
      setStatus({ connected: false });
      toast.success('Messenger desconectado');
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
          <span className="text-sm font-medium">Messenger</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0084ff' }}>
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Facebook Messenger</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Conecta tu página de Facebook para recibir mensajes en el inbox.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm" style={{ color: '#94a3b8' }}>Cargando...</p>
          ) : status?.connected ? (
            <div className="rounded-xl p-5" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm font-semibold text-green-800">Conectado</span>
              </div>
              <p className="text-sm mb-1" style={{ color: '#166534' }}>Página: <strong>{status.page_name || status.page_id}</strong></p>
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
              <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
                Conecta tu página de Facebook para recibir y responder mensajes de Messenger desde la plataforma.
              </p>
              <button onClick={handleConnect} disabled={connecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: '#0084ff' }}>
                <MessageCircle size={15} />
                {connecting ? 'Conectando...' : 'Conectar con Facebook'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
