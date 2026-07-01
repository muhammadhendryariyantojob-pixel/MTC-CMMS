import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info' | 'warning';
  alertOnly?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'info',
  alertOnly = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-sm hover:shadow-md'
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
          confirmBtn: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-sm hover:shadow-md'
        };
      default:
        return {
          iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-sm hover:shadow-md'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity" id="confirm-modal-overlay">
      <div 
        className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150"
        id="confirm-modal-container"
      >
        {/* Close Button */}
        <button 
          onClick={onCancel || onConfirm}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition"
          id="confirm-modal-close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex gap-4 items-start mt-1">
          <div className={`p-3 rounded-xl shrink-0 ${styles.iconBg}`} id="confirm-modal-icon">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight font-sans" id="confirm-modal-title">
              {title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium" id="confirm-modal-message">
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 justify-end mt-6" id="confirm-modal-actions">
          {!alertOnly && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              id="confirm-modal-btn-cancel"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${styles.confirmBtn}`}
            id="confirm-modal-btn-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
