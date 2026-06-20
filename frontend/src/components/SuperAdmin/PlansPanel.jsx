import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, MessageSquare, HardDrive, Megaphone, Smartphone,
  TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronDown,
  ChevronUp, Save, DollarSign, Calendar, XCircle, FileText,
  LayoutGrid, Loader2, ArrowLeft, Plus, Pencil, Trash2,
  BarChart2, RefreshCw, X, Upload, Receipt, Eye, CreditCard,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ── Colores dinámicos por color del plan ─────────────────────────────────────
const colorMap = {
  slate:  { bg: 'bg-slate-700/40',   border: 'border-slate-600',      text: 'text-slate-300',  badge: 'bg-slate-700 text-slate-300',         ring: 'ring-slate-500' },
  indigo: { bg: 'bg-indigo-900/20',  border: 'border-indigo-700/40',  text: 'text-indigo-300', badge: 'bg-indigo-900/60 text-indigo-300',     ring: 'ring-indigo-500' },
  violet: { bg: 'bg-violet-900/20',  border: 'border-violet-700/40',  text: 'text-violet-300', badge: 'bg-violet-900/60 text-violet-300',     ring: 'ring-violet-500' },
  amber:  { bg: 'bg-amber-900/20',   border: 'border-amber-700/40',   text: 'text-amber-300',  badge: 'bg-amber-900/60 text-amber-300',       ring: 'ring-amber-500' },
  emerald:{ bg: 'bg-emerald-900/20', border: 'border-emerald-700/40', text: 'text-emerald-300',badge: 'bg-emerald-900/60 text-emerald-300',   ring: 'ring-emerald-500' },
  rose:   { bg: 'bg-rose-900/20',    border: 'border-rose-700/40',    text: 'text-rose-300',   badge: 'bg-rose-900/60 text-rose-300',         ring: 'ring-rose-500' },
  sky:    { bg: 'bg-sky-900/20',     border: 'border-sky-700/40',     text: 'text-sky-300',    badge: 'bg-sky-900/60 text-sky-300',           ring: 'ring-sky-500' },
};
const getColors = (color) => colorMap[color] || colorMap.slate;

const fmt = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ALERT_STYLES = {
  overdue:  { wrap: 'bg-red-900/20 border-red-700/40',     icon: <XCircle size={14} className="text-red-400 flex-shrink-0" />,   label: 'Vencido' },
  due_soon: { wrap: 'bg-amber-900/20 border-amber-700/40', icon: <Clock   size={14} className="text-amber-400 flex-shrink-0" />, label: 'Próximo' },
};

const LIMITS_CONFIG = [
  { key: 'max_operators',           label: 'Operadores máximos',      icon: <Users size={13} /> },
  { key: 'max_conversations_month', label: 'Conversaciones / mes',    icon: <MessageSquare size={13} /> },
  { key: 'max_storage_mb',          label: 'Almacenamiento (MB)',      icon: <HardDrive size={13} /> },
  { key: 'max_campaigns_month',     label: 'Campañas / mes',          icon: <Megaphone size={13} /> },
  { key: 'max_whatsapp_accounts',   label: 'Cuentas WhatsApp',        icon: <Smartphone size={13} /> },
  { key: 'max_merge_templates',     label: 'Plantillas Merge',        icon: <FileText size={13} /> },
  { key: 'max_custom_modules',      label: 'Módulos personalizados',  icon: <LayoutGrid size={13} /> },
];

const COLOR_OPTIONS = ['slate','indigo','violet','amber','emerald','rose','sky'];
const CYCLE_LABELS  = { monthly: 'Mensual', quarterly: 'Trimestral', annual: 'Anual' };

// ── Subcomponentes ────────────────────────────────────────────────────────────

function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="animate-spin text-violet-400" />;
}

function StatCard({ icon, label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-slate-400 text-xs">{icon}{label}</div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function LimitInput({ icon, label, value, onChange }) {
  const isUnlimited = value === -1;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
      ${isUnlimited ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-slate-800/60 border-slate-700/40'}`}>
      <div className={`flex-shrink-0 ${isUnlimited ? 'text-emerald-400' : 'text-slate-400'}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={-1}
            value={isUnlimited ? '' : value}
            onChange={e => onChange(e.target.value === '' ? -1 : Number(e.target.value))}
            placeholder="−1 = ilimitado"
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5
                       focus:outline-none focus:border-violet-500 transition-colors"
          />
          {isUnlimited && <span className="text-xs text-emerald-400 whitespace-nowrap font-semibold">∞</span>}
        </div>
      </div>
    </div>
  );
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer',   label: 'Transferencia bancaria' },
  { value: 'cash',            label: 'Efectivo' },
  { value: 'card',            label: 'Tarjeta' },
  { value: 'mobile_payment',  label: 'Pago móvil' },
  { value: 'check',           label: 'Cheque' },
  { value: 'paypal',          label: 'PayPal' },
  { value: 'other',           label: 'Otro' },
];

const STATUS_PAYMENT = {
  confirmed: { label: 'Confirmado', color: 'bg-emerald-500/20 text-emerald-400' },
  pending:   { label: 'Pendiente',  color: 'bg-amber-500/20 text-amber-400' },
  refunded:  { label: 'Reembolsado', color: 'bg-red-500/20 text-red-400' },
};

// ── Sección pagos de empresa ─────────────────────────────────────────────────

function CompanyPayments({ companyId, companyName }) {
  const [payments,  setPayments]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [form, setForm] = useState({
    amount: '', currency: 'USD', payment_method: 'bank_transfer',
    reference_number: '', payment_date: new Date().toISOString().split('T')[0],
    period_covered: '', notes: '', status: 'confirmed',
  });
  const [receiptFile, setReceiptFile] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/company-payments?company_id=${companyId}&limit=50`);
      setPayments(res.data?.payments || []);
    } catch { toast.error('Error cargando pagos'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const resetForm = () => {
    setForm({ amount: '', currency: 'USD', payment_method: 'bank_transfer', reference_number: '',
              payment_date: new Date().toISOString().split('T')[0], period_covered: '', notes: '', status: 'confirmed' });
    setReceiptFile(null);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (p) => {
    setForm({
      amount: p.amount, currency: p.currency, payment_method: p.payment_method,
      reference_number: p.reference_number || '', payment_date: p.payment_date,
      period_covered: p.period_covered || '', notes: p.notes || '', status: p.status,
    });
    setEditingId(p.id);
    setReceiptFile(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.payment_date) return toast.error('Monto y fecha son obligatorios');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('company_id', companyId);
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (receiptFile) fd.append('receipt', receiptFile);

      if (editingId) {
        await api.put(`/company-payments/${editingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Pago actualizado');
      } else {
        await api.post('/company-payments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Pago registrado');
      }
      resetForm();
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este pago?')) return;
    try {
      await api.delete(`/company-payments/${id}`);
      toast.success('Pago eliminado');
      fetchPayments();
    } catch { toast.error('Error eliminando pago'); }
  };

  const totalPaid = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Receipt size={14} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white">Historial de pagos</span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{payments.length}</span>
          {totalPaid > 0 && <span className="text-xs text-emerald-400 ml-2">${fmt(totalPaid)} total</span>}
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Plus size={12} /> Registrar pago
        </button>
      </div>

      {/* Formulario de pago */}
      {showForm && (
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {editingId ? 'Editar pago' : 'Nuevo pago'}
            </p>
            <button onClick={resetForm} className="text-slate-400 hover:text-white"><X size={14} /></button>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {/* Monto */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Monto *</label>
              <div className="flex gap-2">
                <input type="number" min="0" step="0.01" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
                <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                  className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2 py-2 focus:outline-none">
                  <option>USD</option><option>DOP</option><option>EUR</option>
                </select>
              </div>
            </div>

            {/* Método de pago */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Método de pago *</label>
              <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {/* ID de transferencia */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">ID transferencia / referencia</label>
              <input value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))}
                placeholder="Ej: TRF-20260620-001"
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
            </div>

            {/* Fecha de pago */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={11} /> Fecha de pago *</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))}
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
            </div>

            {/* Período cubierto */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Período cubierto</label>
              <input value={form.period_covered} onChange={e => setForm(p => ({ ...p, period_covered: e.target.value }))}
                placeholder="Ej: Junio 2026"
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
            </div>

            {/* Estado */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Estado</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
                <option value="confirmed">Confirmado</option>
                <option value="pending">Pendiente</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </div>
          </div>

          {/* Comprobante + Notas */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 flex items-center gap-1"><Upload size={11} /> Comprobante de pago</label>
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-dashed border-slate-600 hover:border-emerald-500 text-sm rounded-lg cursor-pointer transition-colors">
                <Upload size={14} className="text-slate-400" />
                <span className={receiptFile ? 'text-emerald-400' : 'text-slate-400'}>
                  {receiptFile ? receiptFile.name : 'Subir imagen o PDF...'}
                </span>
                <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden"
                  onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Notas</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Ej: Pago parcial de factura #123"
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? <Spinner size={13} /> : <Save size={13} />}
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar pago'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de pagos */}
      <div className="max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm gap-2"><Spinner size={14} /> Cargando...</div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Sin pagos registrados</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {payments.map(p => {
              const method = PAYMENT_METHODS.find(m => m.value === p.payment_method);
              const st = STATUS_PAYMENT[p.status] || STATUS_PAYMENT.pending;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <CreditCard size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">${fmt(p.amount)}</span>
                      <span className="text-xs text-slate-500">{p.currency}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{method?.label || p.payment_method}</span>
                      {p.reference_number && <span className="text-slate-500">· Ref: {p.reference_number}</span>}
                      {p.period_covered && <span className="text-slate-500">· {p.period_covered}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{p.payment_date}</p>
                    {p.notes && <p className="text-xs text-slate-500 truncate max-w-[150px]">{p.notes}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {p.receipt_path && (
                      <button onClick={() => setPreview(p.id)} title="Ver comprobante"
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20 rounded-lg transition-colors">
                        <Eye size={13} />
                      </button>
                    )}
                    <button onClick={() => handleEdit(p)} title="Editar"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} title="Eliminar"
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview de comprobante */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Comprobante de pago</h3>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4">
              <img src={`${import.meta.env.VITE_API_URL || '/api'}/company-payments/${preview}/receipt`}
                alt="Comprobante" className="max-w-full max-h-[60vh] rounded-lg mx-auto"
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No se puede mostrar el comprobante (puede ser un PDF). <a href="' + (import.meta.env.VITE_API_URL || '/api') + '/company-payments/' + preview + '/receipt" target="_blank" class="text-violet-400 underline">Descargar</a></p>'; }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal crear/editar plan ───────────────────────────────────────────────────

function PlanModal({ plan, planKey, onClose, onSaved }) {
  const isNew = !planKey;
  const [form, setForm] = useState({
    key:             planKey || '',
    label:           plan?.label           || '',
    color:           plan?.color           || 'indigo',
    icon:            plan?.icon            || '◉',
    price:           plan?.price           ?? 0,
    price_quarterly: plan?.price_quarterly ?? 0,
    price_annual:    plan?.price_annual    ?? 0,
    limits: {
      max_operators:           plan?.limits?.max_operators           ?? 5,
      max_conversations_month: plan?.limits?.max_conversations_month ?? 1000,
      max_storage_mb:          plan?.limits?.max_storage_mb          ?? 500,
      max_campaigns_month:     plan?.limits?.max_campaigns_month     ?? 5,
      max_whatsapp_accounts:   plan?.limits?.max_whatsapp_accounts   ?? 2,
      max_merge_templates:     plan?.limits?.max_merge_templates     ?? 20,
      max_custom_modules:      plan?.limits?.max_custom_modules      ?? 3,
    },
  });
  const [saving, setSaving] = useState(false);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setL = (k, v) => setForm(p => ({ ...p, limits: { ...p.limits, [k]: v } }));

  const handleSave = async () => {
    if (!form.label) return toast.error('El nombre del plan es obligatorio');
    if (isNew && !form.key) return toast.error('El identificador es obligatorio');
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/plans/presets', form);
        toast.success(`Plan "${form.label}" creado`);
      } else {
        await api.put(`/plans/presets/${planKey}`, form);
        toast.success(`Plan "${form.label}" actualizado`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const pc = getColors(form.color);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-base font-black text-white">{isNew ? 'Nuevo plan' : `Editar "${plan?.label}"`}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Identificador (solo nuevo) */}
          {isNew && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Identificador único (sin espacios)</label>
              <input
                value={form.key}
                onChange={e => setF('key', e.target.value.toLowerCase().replace(/\s/g, '_'))}
                placeholder="ej: startup"
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}

          {/* Nombre e icono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Nombre del plan</label>
              <input
                value={form.label}
                onChange={e => setF('label', e.target.value)}
                placeholder="ej: Startup"
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Icono (emoji o símbolo)</label>
              <input
                value={form.icon}
                onChange={e => setF('icon', e.target.value)}
                placeholder="◉"
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Color */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(c => {
                const cc = getColors(c);
                return (
                  <button
                    key={c}
                    onClick={() => setF('color', c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                      ${cc.badge} ${form.color === c ? `ring-2 ${cc.ring}` : 'opacity-60 hover:opacity-100'}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Precios por ciclo */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Precios por ciclo (USD)</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'price',           label: 'Mensual',     placeholder: '49' },
                { key: 'price_quarterly', label: 'Trimestral',  placeholder: '42' },
                { key: 'price_annual',    label: 'Anual',       placeholder: '39' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">{label} / mes</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                    <input
                      type="number" min={0}
                      value={form[key]}
                      onChange={e => setF(key, Number(e.target.value))}
                      placeholder={placeholder}
                      className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">El precio trimestral y anual es el precio mensual equivalente al pagar ese período.</p>
          </div>

          {/* Límites */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Límites de uso (−1 = ilimitado)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LIMITS_CONFIG.map(({ key, label, icon }) => (
                <LimitInput key={key} icon={icon} label={label} value={form.limits[key]} onChange={v => setL(key, v)} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? <Spinner size={13} /> : <Save size={13} />}
            {saving ? 'Guardando...' : 'Guardar plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

export default function PlansPanel({ companies }) {
  const [presets,   setPresets]   = useState({});
  const [overview,  setOverview]  = useState(null);
  const [alerts,    setAlerts]    = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [planData,  setPlanData]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [loadingCo, setLoadingCo] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [expanded,  setExpanded]  = useState('limits');
  const [activeTab, setActiveTab] = useState('companies'); // companies | presets | metrics
  const [modal,     setModal]     = useState(null); // null | { planKey, plan } | { new: true }
  const [deleting,  setDeleting]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o, a] = await Promise.all([
        api.get('/plans/presets'),
        api.get('/plans/overview'),
        api.get('/plans/billing-alerts'),
      ]);
      setPresets(p.data || {});
      setOverview(o.data || null);
      setAlerts(a.data  || []);
    } catch {
      toast.error('Error cargando planes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectCompany = async (company) => {
    setSelected(company);
    setActiveTab('companies');
    setLoadingCo(true);
    try {
      const res = await api.get(`/plans/company/${company.id}`);
      const d   = res.data;
      setPlanData({
        plan:              d.plan || 'basic',
        plan_limits:       d.plan_limits || {},
        billing:           d.billing || { price: '', currency: 'USD', cycle: 'monthly', next_payment: '', status: 'active', notes: '' },
        current_operators: d.current_operators || 0,
      });
    } catch {
      toast.error('Error cargando datos de la empresa');
    } finally {
      setLoadingCo(false);
    }
  };

  const applyPreset = (planKey) => {
    const preset = presets[planKey];
    if (!preset) return;
    const priceBycycle = {
      monthly:   preset.price,
      quarterly: preset.price_quarterly ?? preset.price,
      annual:    preset.price_annual    ?? preset.price,
    };
    const cycle = planData?.billing?.cycle || 'monthly';
    setPlanData(p => ({
      ...p,
      plan:        planKey,
      plan_limits: { ...preset.limits },
      billing:     { ...p.billing, price: priceBycycle[cycle] ?? preset.price },
    }));
  };

  const setLimit   = (key, val) => setPlanData(p => ({ ...p, plan_limits: { ...p.plan_limits, [key]: val } }));
  const setBilling = (key, val) => {
    setPlanData(p => {
      const updated = { ...p.billing, [key]: val };
      // Si cambia el ciclo, actualiza el precio automáticamente desde el preset
      if (key === 'cycle' && p.plan && presets[p.plan]) {
        const pr = presets[p.plan];
        const prices = { monthly: pr.price, quarterly: pr.price_quarterly ?? pr.price, annual: pr.price_annual ?? pr.price };
        updated.price = prices[val] ?? pr.price;
      }
      return { ...p, billing: updated };
    });
  };

  const handleSave = async () => {
    if (!selected || !planData) return;
    setSaving(true);
    try {
      await api.put(`/plans/company/${selected.id}`, {
        plan:        planData.plan,
        plan_limits: planData.plan_limits,
        billing:     planData.billing,
      });
      toast.success(`Plan de "${selected.nombre}" actualizado`);
      load();
    } catch (err) {
      toast.error(err.message || 'Error guardando plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePreset = async (key) => {
    if (!window.confirm(`¿Eliminar el plan "${presets[key]?.label}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(key);
    try {
      await api.delete(`/plans/presets/${key}`);
      toast.success('Plan eliminado');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error eliminando plan');
    } finally {
      setDeleting(null);
    }
  };

  const pc = getColors(planData ? (presets[planData.plan]?.color || 'violet') : 'violet');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Sidebar ── */}
      <div className="w-64 flex-shrink-0 border-r border-slate-800 flex flex-col">
        {/* Tabs sidebar */}
        <div className="p-3 border-b border-slate-800 space-y-1">
          {[
            { key: 'companies', label: 'Empresas',  icon: <Users size={13} /> },
            { key: 'presets',   label: 'Gestionar planes', icon: <LayoutGrid size={13} /> },
            { key: 'metrics',   label: 'Métricas',  icon: <BarChart2 size={13} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setSelected(null); setPlanData(null); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === t.key && !selected ? 'bg-violet-600/20 text-violet-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Lista empresas */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">Empresas</p>
          {companies.map(c => {
            const preset   = presets[c.plan];
            const pc2      = getColors(preset?.color || 'slate');
            const hasAlert = alerts.some(a => a.id === c.id);
            const isActive = selected?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => selectCompany(c)}
                className={`w-full text-left flex items-center gap-2.5 p-3 rounded-xl border transition-all
                  ${isActive ? 'bg-violet-600/20 border-violet-500/40' : 'hover:bg-slate-800/70 border-transparent'}`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
                  {c.nombre?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pc2.badge}`}>
                    {preset?.icon || '·'} {preset?.label || c.plan}
                  </span>
                </div>
                {hasAlert && <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading && (
          <div className="flex-1 flex items-center justify-center gap-3 text-slate-400 text-sm">
            <Spinner size={18} /> Cargando...
          </div>
        )}

        {/* ── TAB: GESTIONAR PLANES (presets) ── */}
        {!loading && !selected && activeTab === 'presets' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Planes disponibles</h2>
              <button
                onClick={() => setModal({ isNew: true })}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Plus size={14} /> Nuevo plan
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {Object.entries(presets).map(([key, preset]) => {
                const pc3 = getColors(preset.color);
                return (
                  <div key={key} className={`${pc3.bg} border ${pc3.border} rounded-xl p-4`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg ${pc3.text}`}>{preset.icon}</span>
                          <h3 className="text-base font-black text-white">{preset.label}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pc3.badge}`}>{key}</span>
                        </div>
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs text-slate-400">Mensual: <strong className="text-white">${fmt(preset.price)}</strong></span>
                          <span className="text-xs text-slate-400">Trimestral: <strong className="text-white">${fmt(preset.price_quarterly ?? preset.price)}</strong></span>
                          <span className="text-xs text-slate-400">Anual: <strong className="text-white">${fmt(preset.price_annual ?? preset.price)}</strong></span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => setModal({ planKey: key, plan: preset })}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        {!['free','basic','pro','enterprise'].includes(key) && (
                          <button
                            onClick={() => handleDeletePreset(key)}
                            disabled={deleting === key}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            {deleting === key ? <Spinner size={13} /> : <Trash2 size={13} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LIMITS_CONFIG.slice(0, 4).map(({ key: lk, label, icon }) => (
                        <div key={lk} className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className="text-slate-500">{icon}</span>
                          <span>{label}:</span>
                          <strong className={preset.limits[lk] === -1 ? 'text-emerald-400' : 'text-white'}>
                            {preset.limits[lk] === -1 ? '∞' : preset.limits[lk]}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: MÉTRICAS ── */}
        {!loading && !selected && activeTab === 'metrics' && overview && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Métricas de planes</h2>
              <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                <RefreshCw size={12} /> Actualizar
              </button>
            </div>

            {/* KPIs financieros */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard icon={<Users size={13} />}      label="Total empresas"  value={overview.total}           color="text-white" />
              <StatCard icon={<DollarSign size={13} />} label="MRR"             value={`$${fmt(overview.mrr)}`}       sub="ingresos / mes"        color="text-emerald-400" />
              <StatCard icon={<DollarSign size={13} />} label="QRR"             value={`$${fmt(overview.qrr)}`}       sub="ingresos / trimestre"  color="text-sky-400" />
              <StatCard icon={<DollarSign size={13} />} label="ARR"             value={`$${fmt(overview.arr)}`}       sub="ingresos / año"        color="text-violet-400" />
            </div>

            {/* Distribución por plan */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribución por plan</h3>
              <div className="space-y-3">
                {Object.entries(overview.plan_metrics || {}).map(([key, m]) => {
                  const pc4 = getColors(presets[key]?.color || 'slate');
                  return (
                    <div key={key} className={`${pc4.bg} border ${pc4.border} rounded-xl p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${pc4.text}`}>{presets[key]?.icon || '·'}</span>
                          <span className="text-sm font-bold text-white">{m.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pc4.badge}`}>{m.count} empresa{m.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">{m.pct}%</p>
                          {m.price > 0 && <p className="text-xs text-slate-400">${fmt(m.price)}/mes base</p>}
                        </div>
                      </div>
                      <div className="w-full bg-slate-700/40 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500`} style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Por estado y ciclo */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Por estado de pago</h3>
                <div className="space-y-2">
                  {Object.entries(overview.by_status || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        status === 'active'    ? 'bg-emerald-500/20 text-emerald-400' :
                        status === 'overdue'   ? 'bg-red-500/20 text-red-400' :
                        status === 'trial'     ? 'bg-sky-500/20 text-sky-400' :
                                                 'bg-slate-700 text-slate-400'
                      }`}>{status}</span>
                      <span className="text-sm font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Por ciclo de cobro</h3>
                <div className="space-y-2">
                  {Object.entries(overview.by_cycle || {}).map(([cycle, count]) => (
                    <div key={cycle} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{CYCLE_LABELS[cycle] || cycle}</span>
                      <span className="text-sm font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alertas */}
            {alerts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-400" /> Alertas de cobro
                  <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-semibold">{alerts.length}</span>
                </h3>
                <div className="space-y-2">
                  {alerts.map(a => {
                    const as = ALERT_STYLES[a.alert_type];
                    return (
                      <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${as.wrap}`}>
                        {as.icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{a.nombre}</p>
                          <p className="text-xs text-slate-400">
                            {a.days_until < 0 ? `${Math.abs(a.days_until)} días vencido` : `Vence en ${a.days_until} días`}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-white flex-shrink-0">${fmt(a.price)} {a.currency}</p>
                        <button
                          onClick={() => selectCompany({ id: a.id, nombre: a.nombre })}
                          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex-shrink-0"
                        >
                          Gestionar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: COMPANIES (overview cuando no hay empresa seleccionada) ── */}
        {!loading && !selected && activeTab === 'companies' && overview && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard icon={<Users size={13} />}      label="Total empresas" value={overview.total}     color="text-white" />
              <StatCard icon={<DollarSign size={13} />} label="MRR estimado"   value={`$${fmt(overview.mrr)}`} sub="USD/mes activos" color="text-emerald-400" />
              {Object.entries(overview.by_plan || {}).map(([plan, count]) => {
                const preset = presets[plan];
                return (
                  <StatCard key={plan}
                    icon={<TrendingUp size={13} />}
                    label={preset?.label || plan}
                    value={count}
                    sub="empresa(s)"
                    color={getColors(preset?.color || 'slate').text}
                  />
                );
              })}
            </div>
            {alerts.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-400" /> Alertas de facturación
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">{alerts.length}</span>
                </h3>
                <div className="space-y-2">
                  {alerts.map(a => {
                    const as = ALERT_STYLES[a.alert_type];
                    const preset = presets[a.plan];
                    return (
                      <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${as.wrap}`}>
                        {as.icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{a.nombre}</p>
                          <p className="text-xs text-slate-400">
                            Vence: {a.next_payment} · {a.days_until < 0 ? `${Math.abs(a.days_until)} días vencido` : `en ${a.days_until} días`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-white">${fmt(a.price)} {a.currency}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getColors(preset?.color || 'slate').badge}`}>
                            {preset?.label || a.plan}
                          </span>
                        </div>
                        <button
                          onClick={() => selectCompany({ id: a.id, nombre: a.nombre })}
                          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                          Gestionar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EDITOR de plan por empresa ── */}
        {!loading && selected && (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelected(null); setPlanData(null); }} className="text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h2 className="text-base font-black text-white leading-tight">{selected.nombre}</h2>
                  {planData && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {planData.current_operators} operador{planData.current_operators !== 1 ? 'es' : ''} activo{planData.current_operators !== 1 ? 's' : ''}
                      {planData.plan_limits.max_operators !== -1 && <span className="text-slate-500"> / {planData.plan_limits.max_operators} máx.</span>}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || loadingCo}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {saving ? <Spinner size={13} /> : <Save size={13} />}
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>

            {loadingCo && <div className="flex items-center justify-center gap-3 py-16 text-slate-400 text-sm"><Spinner size={18} /> Cargando datos...</div>}

            {!loadingCo && planData && (
              <div className="p-6 space-y-5">

                {/* Selector de plan */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Plan contratado</p>
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    {Object.entries(presets).map(([key, preset]) => {
                      const pc5  = getColors(preset.color);
                      const active = planData.plan === key;
                      return (
                        <button
                          key={key}
                          onClick={() => applyPreset(key)}
                          className={`p-4 rounded-xl border text-left transition-all
                            ${active ? `${pc5.bg} ${pc5.border} ring-2 ${pc5.ring}` : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600 hover:bg-slate-800/60'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm font-bold ${active ? pc5.text : 'text-white'}`}>{preset.icon} {preset.label}</p>
                            {active && <CheckCircle size={13} className={pc5.text} />}
                          </div>
                          <p className="text-xs text-slate-400">{preset.price === 0 ? 'Gratis' : `$${fmt(preset.price)}/mes`}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {preset.limits.max_operators === -1 ? '∞' : preset.limits.max_operators} op ·{' '}
                            {preset.limits.max_storage_mb === -1 ? '∞' : `${preset.limits.max_storage_mb}MB`}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Límites */}
                <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === 'limits' ? null : 'limits')}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-violet-400" />
                      <span className="text-sm font-semibold text-white">Límites de uso</span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">−1 = ilimitado</span>
                    </div>
                    {expanded === 'limits' ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>
                  {expanded === 'limits' && (
                    <div className="px-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {LIMITS_CONFIG.map(({ key, label, icon }) => (
                        <LimitInput key={key} icon={icon} label={label} value={planData.plan_limits[key] ?? -1} onChange={v => setLimit(key, v)} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Facturación */}
                <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === 'billing' ? null : 'billing')}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} className="text-emerald-400" />
                      <span className="text-sm font-semibold text-white">Facturación</span>
                      {planData.billing?.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          planData.billing.status === 'active'    ? 'bg-emerald-500/20 text-emerald-400' :
                          planData.billing.status === 'overdue'   ? 'bg-red-500/20 text-red-400' :
                          planData.billing.status === 'trial'     ? 'bg-blue-500/20 text-blue-400' :
                                                                     'bg-slate-700 text-slate-400'
                        }`}>{planData.billing.status}</span>
                      )}
                    </div>
                    {expanded === 'billing' ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>

                  {expanded === 'billing' && (
                    <div className="px-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-3">

                      {/* Ciclo — primero para que actualice precio automáticamente */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Ciclo de cobro</label>
                        <select
                          value={planData.billing.cycle || 'monthly'}
                          onChange={e => setBilling('cycle', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
                        >
                          <option value="monthly">Mensual</option>
                          <option value="quarterly">Trimestral</option>
                          <option value="annual">Anual</option>
                        </select>
                      </div>

                      {/* Precio */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Precio contratado</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={planData.billing.price || ''}
                            onChange={e => setBilling('price', e.target.value)}
                            placeholder="0"
                            className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                          <select
                            value={planData.billing.currency || 'USD'}
                            onChange={e => setBilling('currency', e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2 py-2 focus:outline-none"
                          >
                            <option>USD</option><option>DOP</option><option>EUR</option><option>COP</option>
                          </select>
                        </div>
                      </div>

                      {/* Próximo pago */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={11} /> Próximo pago</label>
                        <input
                          type="date"
                          value={planData.billing.next_payment || ''}
                          onChange={e => setBilling('next_payment', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>

                      {/* Estado */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Estado de pago</label>
                        <select
                          value={planData.billing.status || 'active'}
                          onChange={e => setBilling('status', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
                        >
                          <option value="active">Activo</option>
                          <option value="overdue">Vencido</option>
                          <option value="cancelled">Cancelado</option>
                          <option value="trial">Prueba</option>
                        </select>
                      </div>

                      {/* Notas */}
                      <div className="xl:col-span-2 flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Notas internas</label>
                        <textarea
                          value={planData.billing.notes || ''}
                          onChange={e => setBilling('notes', e.target.value)}
                          placeholder="Ej: Cliente paga por transferencia los primeros 5 días del mes"
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Historial de pagos */}
                <CompanyPayments companyId={selected.id} companyName={selected.nombre} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal crear/editar plan ── */}
      {modal && (
        <PlanModal
          planKey={modal.planKey}
          plan={modal.plan}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
