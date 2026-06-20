import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Code, Palette, Eye, MessageSquare } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const COLORS = [
  { value: '#6366f1', label: 'Índigo' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#0ea5e9', label: 'Celeste' },
  { value: '#10b981', label: 'Esmeralda' },
  { value: '#f59e0b', label: 'Ámbar' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#1e293b', label: 'Oscuro' },
];

export default function WidgetsConfig() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('Te respondemos al instante');
  const [position, setPosition] = useState('right');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/company');
        if (res.success && res.data) {
          setCompanyId(res.data.id);
          setCompanyName(res.data.nombre);
          setTitle(res.data.nombre || 'Chat con nosotros');
        }
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const API_BASE = 'https://app.tecnossync.com.do';

  const scriptCode = `<script>
  window.TecnoSyncWidget = {
    companyId: '${companyId}',
    server: '${API_BASE}/api',
    title: '${title || companyName}',
    subtitle: '${subtitle}',
    color: '${color}',
    position: '${position}'
  };
</script>
<script src="${API_BASE}/widget.js"></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    toast.success('Código copiado al portapapeles');
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: '#94a3b8' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#fff', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/config')} className="flex items-center gap-1.5 text-sm" style={{ color: '#94a3b8' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            Configuración
          </button>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span className="text-sm font-medium">Widget de Chat Web</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Widget de Chat</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Agrega un chat en vivo a tu sitio web. Los mensajes llegan al inbox de la plataforma.</p>
            </div>
          </div>

          {/* Personalización */}
          <div className="mb-8 pb-8" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>
              <Palette size={12} className="inline mr-1.5" />
              Personalización
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748b' }}>Título del widget</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Chat con nosotros"
                  className="rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748b' }}>Subtítulo</label>
                <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Te respondemos al instante"
                  className="rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748b' }}>Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setColor(c.value)} title={c.label}
                      className="w-8 h-8 rounded-lg transition-all"
                      style={{
                        background: c.value,
                        border: color === c.value ? '2.5px solid #0f172a' : '2px solid transparent',
                        transform: color === c.value ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748b' }}>Posición</label>
                <div className="flex gap-2">
                  {['right', 'left'].map(p => (
                    <button key={p} onClick={() => setPosition(p)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: position === p ? '#6366f1' : '#f8fafc',
                        color: position === p ? '#fff' : '#64748b',
                        border: `0.5px solid ${position === p ? '#6366f1' : '#e2e8f0'}`,
                      }}
                    >
                      {p === 'right' ? 'Derecha' : 'Izquierda'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Código */}
          <div className="mb-8 pb-8" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                <Code size={12} className="inline mr-1.5" />
                Código de integración
              </h3>
              <button onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: copied ? '#ecfdf5' : '#eef2ff', color: copied ? '#059669' : '#6366f1', border: `0.5px solid ${copied ? '#a7f3d0' : '#c7d2fe'}` }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar código'}
              </button>
            </div>
            <p className="text-sm mb-3" style={{ color: '#64748b' }}>
              Pega este código antes de <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>&lt;/body&gt;</code> en tu sitio web:
            </p>
            <div className="rounded-xl overflow-hidden" style={{ background: '#0f172a', border: '1px solid #334155' }}>
              <pre className="p-4 text-sm overflow-x-auto" style={{ color: '#a5b4fc', fontFamily: 'monospace', margin: 0, lineHeight: 1.6 }}>
                {scriptCode}
              </pre>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>
              <Eye size={12} className="inline mr-1.5" />
              Vista previa
            </h3>
            <div className="rounded-xl overflow-hidden relative" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0', height: 400 }}>
              {/* Fake website */}
              <div className="p-6">
                <div className="h-4 w-32 rounded" style={{ background: '#e2e8f0' }} />
                <div className="mt-4 h-3 w-full rounded" style={{ background: '#e2e8f0' }} />
                <div className="mt-2 h-3 w-3/4 rounded" style={{ background: '#e2e8f0' }} />
                <div className="mt-2 h-3 w-5/6 rounded" style={{ background: '#e2e8f0' }} />
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[1,2,3].map(i => <div key={i} className="h-20 rounded-lg" style={{ background: '#e2e8f0' }} />)}
                </div>
              </div>
              {/* Widget button preview */}
              <div className="absolute bottom-4" style={{ [position]: 20 }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: color }}>
                  <MessageSquare size={24} className="text-white" />
                </div>
              </div>
              {/* Chat preview */}
              <div className="absolute bottom-20 w-72" style={{ [position]: 20 }}>
                <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: '#0f172a' }}>
                  <div className="p-4 flex items-center gap-3" style={{ background: color }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,.2)' }}>
                      <span className="text-white text-sm">💬</span>
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold">{title || companyName}</p>
                      <p className="text-white/70 text-[10px]">{subtitle}</p>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-xs px-3 py-2 rounded-xl" style={{ background: '#1e293b', color: '#e2e8f0', maxWidth: '80%' }}>
                      ¡Hola! 👋 ¿En qué te podemos ayudar?
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
