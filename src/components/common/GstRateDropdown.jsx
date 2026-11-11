import { useEffect, useRef, useState } from 'react';
import {
  GST_TAX_DROPDOWN_CHOICES, gstChoiceForSavedRate, gstTotalFromSelection,
} from '../../utils/gstRateDropdown';
import './GstRateDropdown.css';

// This shared editor changes only the stored TOTAL GST percentage. It never
// infers tax jurisdiction, approves ITC, or creates accounting entries.
const choices = GST_TAX_DROPDOWN_CHOICES;

/**
 * A drop-in GST rate control for fields that store a numeric TOTAL percentage.
 * CGST/SGST labels indicate one component of a paired same-state rate. A
 * selection such as CGST 9% stores 18%, NOT an additional 9% ledger entry.
 */
export default function GstRateDropdown({
  value, onChange, name, id, required = false, disabled = false,
  className = '', selectLabel = 'GST Rate (%)', showTotal = true,
  blankLabel = 'Select GST Component / Rate',
}) {
  const [selection, setSelection] = useState(() => gstChoiceForSavedRate(value));
  const justEmitted = useRef(null);

  // Forms also load pre-existing rates asynchronously (edit, reset, wizard).
  // Preserve the user's explicit CGST vs SGST vs IGST choice when all three
  // may represent the same total GST percentage.
  useEffect(() => {
    const next = String(value ?? '');
    if (justEmitted.current === next) {
      justEmitted.current = null;
      return;
    }
    setSelection(gstChoiceForSavedRate(next));
  }, [value]);

  const emit = next => {
    justEmitted.current = String(next);
    onChange(next);
  };

  const choose = next => {
    setSelection(next);
    emit(gstTotalFromSelection(next));
  };

  const total = String(value ?? '').trim();
  const parsedTotal = Number(total);
  const validTotal = total !== '' && Number.isFinite(parsedTotal) &&
    parsedTotal >= 0 && parsedTotal <= 100;

  return <div className="cg-shared-gst-rate">
    <select className={className} id={id} name={name}
      aria-label={selectLabel} required={required} disabled={disabled}
      value={selection} onChange={event => choose(event.target.value)}>
      <option value="">{blankLabel}</option>
      <option value="none">0% — Select Tax Classification</option>
      {choices.map(option =>
        <option key={option.value} value={option.value}>{option.label}</option>)}
      <option value="custom">Saved/Other HSN-Specific Rate (custom %)</option>
    </select>
    {selection === 'custom' && <input type="number" className={className}
      aria-label="Custom total GST rate (%)" required={required} disabled={disabled}
      inputMode="decimal" min="0" max="100" step="0.01"
      value={value ?? ''} onChange={event => emit(event.target.value)}/>}
    {showTotal && selection && selection !== 'custom' && validTotal &&
      <small className="cg-shared-gst-rate-hint">Total GST saved: {total}%.
        CGST / SGST choices are paired components; IGST is a single total rate.
      </small>}
  </div>;
}
