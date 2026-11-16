import { useRef } from "react";
import { useDialogAccessibility } from "./useDialogAccessibility";
import { X } from 'lucide-react';
import '../../styles/responsive-modal-sheet.css';

export const ResponsiveModalSheet = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '720px',
  className = '',
  footer = null,
}) => {
  const modalRef = useRef(null);

  useDialogAccessibility(isOpen, onClose, modalRef);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Modal dialog'}
      className="responsive-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className={`responsive-modal-sheet ${className}`.trim()}
        tabIndex={-1}
        style={{ '--responsive-modal-max-width': maxWidth }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="responsive-modal-drag-handle" aria-hidden="true">
          <span />
        </div>

        <header className="responsive-modal-header">
          <h3>{title}</h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="responsive-modal-close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="responsive-modal-body scroll-hidden">
          {children}
        </div>
        {footer && <div className="responsive-modal-footer">{footer}</div>}
      </section>
    </div>
  );
};
