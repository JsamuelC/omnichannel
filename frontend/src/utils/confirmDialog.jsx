import toast from 'react-hot-toast';

export function confirmAction(message, onConfirm) {
  toast((t) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
      <p style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', margin: 0 }}>{message}</p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => toast.dismiss(t.id)}
          style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button
          onClick={() => { toast.dismiss(t.id); onConfirm(); }}
          style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer' }}
        >
          Confirmar
        </button>
      </div>
    </div>
  ), { duration: 10000, style: { background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.1)', borderRadius: '12px', padding: '16px' } });
}
