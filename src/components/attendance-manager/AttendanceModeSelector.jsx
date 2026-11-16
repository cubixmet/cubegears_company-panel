
import { Clock3, LogIn, Repeat2, TimerReset } from 'lucide-react';

const modes = [
  {
    value: 'single',
    title: 'Single Punch',
    icon: LogIn,
  },
  {
    value: 'multi',
    title: 'Multi Punch',
    icon: Repeat2,
  },
  {
    value: 'auto_checkout',
    title: 'Auto Checkout',
    icon: Clock3,
  },
  {
    value: 'hybrid',
    title: 'Hybrid',
    icon: TimerReset,
  },
];

export const AttendanceModeSelector = ({ value, onChange }) => (
  <div className="attendance-mode-grid">
    {modes.map(({ value: modeValue, title, icon: Icon }) => {
      const selected = value === modeValue;
      return (
        <button
          key={modeValue}
          type="button"
          className={`attendance-mode-card ${selected ? 'is-selected' : ''}`}
          onClick={() => onChange(modeValue)}
          aria-pressed={selected}
        >
          <span className="attendance-mode-icon"><Icon size={17} /></span>
          <span className="attendance-mode-copy">
            <strong>{title}</strong>
          </span>
          <span className="attendance-mode-radio" aria-hidden="true" />
        </button>
      );
    })}
  </div>
);
