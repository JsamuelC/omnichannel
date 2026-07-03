import toast from 'react-hot-toast';

export function confirmAction(message, onConfirm) {
  toast((t) => (
    <div className="flex flex-col gap-2 max-w-[300px]">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 m-0">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => { toast.dismiss(t.id); onConfirm(); }}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border-none bg-red-500 text-white cursor-pointer hover:bg-red-600 transition-colors"
        >
          Confirmar
        </button>
      </div>
    </div>
  ), { duration: 6000, className: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl', style: { borderRadius: '12px', padding: '16px' } });
}
