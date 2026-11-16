import { forwardRef, useId } from "react";
import { Label } from './Label';

export const Textarea = forwardRef(function Textarea({
  label, error, helper, success, required = false, disabled = false,
  rows = 3, containerStyle, className = '', id, placeholder,
  labelPosition = 'floating', ...props
}, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const message = error || success || helper;
  const stacked = labelPosition === 'above';
  return (
    <div data-cg-input-wrapper="true" className={'flex w-full min-w-0 flex-col gap-1.5 ' +
      (label ? (stacked ? 'cg-stacked-field ' : 'cg-floating-field cg-floating-textarea-field ') : '') + className}
      style={containerStyle}>
      {label && stacked && <Label htmlFor={inputId} required={required} className="cg-stacked-label">{label}</Label>}
      <div className="cg-floating-textarea-shell">
        {label && !stacked && <Label htmlFor={inputId} required={required} className="cg-floating-label">{label}</Label>}
        <textarea ref={ref} id={inputId} rows={rows} required={required}
          disabled={disabled} aria-invalid={Boolean(error)}
          aria-describedby={message ? inputId + '-message' : undefined}
          className={'cg-floating-control min-h-24 w-full resize-y rounded-xl border bg-[var(--field-bg)] px-3 py-2.5 font-normal leading-5 text-content outline-none transition placeholder:font-normal placeholder:text-muted focus:bg-[var(--field-focus-bg)] focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 ' +
            (error ? 'border-danger' : 'border-line focus:border-primary')}
          placeholder={label && !stacked ? (placeholder || ' ') : placeholder} {...props} />
      </div>
      {message && <span id={inputId + '-message'}
        className={'text-xs ' + (error ? 'font-medium text-danger' : success ? 'font-medium text-success' : 'text-muted')}>
        {message}
      </span>}
    </div>
  );
});
