import { forwardRef, useId } from "react";
import { Label } from './Label';

/** Accessible outlined input. The label remains associated with its native input. */
export const Input = forwardRef(function Input({
  label, error, helper, success, required = false, disabled = false,
  icon: Icon, rightIcon: RightIcon, containerStyle, style, className = '',
  labelPosition = 'floating',
  id, placeholder, ...props
}, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const message = error || success || helper;
  const stacked = labelPosition === 'above';
  return (
    <div data-cg-input-wrapper="true"
      className={'flex w-full min-w-0 flex-col gap-1.5 ' + (label ? (stacked ? 'cg-stacked-field ' : 'cg-floating-field ') : '') + className}
      style={containerStyle}>
      {label && stacked && <Label htmlFor={inputId} required={required} className="cg-stacked-label">{label}</Label>}
      <div data-cg-input-shell="true" data-cg-floating-icon={Icon && !stacked ? 'true' : undefined}
        className={'cg-field-shell flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border bg-[var(--field-bg)] px-3 transition focus-within:bg-[var(--field-focus-bg)] focus-within:ring-2 focus-within:ring-primary/15 ' +
          (error ? 'border-danger' : success ? 'border-success' : 'border-line focus-within:border-primary') +
          (disabled ? ' cursor-not-allowed opacity-60' : '')}>
        {Icon && <Icon size={17} className="shrink-0 text-muted" aria-hidden="true" />}
        {label && !stacked && <Label htmlFor={inputId} required={required} className="cg-floating-label">{label}</Label>}
        <input ref={ref} id={inputId}
          className="cg-floating-control h-10 min-w-0 flex-1 border-0 bg-transparent p-0 font-normal text-content outline-none placeholder:font-normal placeholder:text-muted"
          required={required} disabled={disabled} aria-invalid={Boolean(error)}
          aria-describedby={message ? inputId + '-message' : undefined}
          style={style} placeholder={label && !stacked ? (placeholder || ' ') : placeholder} {...props} />
        {RightIcon && <RightIcon size={17} className="shrink-0 text-muted" aria-hidden="true" />}
      </div>
      {message && <span id={inputId + '-message'}
        className={'text-xs ' + (error ? 'font-medium text-danger' : success ? 'font-medium text-success' : 'text-muted')}>
        {message}
      </span>}
    </div>
  );
});
