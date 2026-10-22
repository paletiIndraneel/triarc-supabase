import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type='success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
  return <ToastCtx.Provider value={{ addToast }}>
    {children}
    <div className="toast-container">{toasts.map(t => {
      const Icon = icons[t.type] || Info;
      return <div className={`toast toast-${t.type}`} key={t.id}><Icon size={17}/><span>{t.message}</span><button onClick={()=>setToasts(x=>x.filter(y=>y.id!==t.id))}><X size={14}/></button></div>;
    })}</div>
  </ToastCtx.Provider>;
}
// The same object on every render: effects list `toast` as a dependency (EVBilling's loader),
// and a new object each render made them re-run on every render, reloading billing endlessly.
export const useToast = () => {
  const addToast = useContext(ToastCtx).addToast;
  return useMemo(() => ({ success: (m)=>addToast(m,'success'), error: (m)=>addToast(m,'error'), warning:(m)=>addToast(m,'warning'), info:(m)=>addToast(m,'info') }), [addToast]);
};
