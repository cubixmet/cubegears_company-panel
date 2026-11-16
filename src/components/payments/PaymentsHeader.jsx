
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

export const PaymentsHeader = ({ onRecordPayment }) => {
  const { user } = useAuth();

  return (
    <header className="payments-dashboard-header">
      <div>
        <h1>Payments</h1>
        <p>Customer receipts, supplier settlements and workshop payouts.</p>
      </div>

      <div className="payments-dashboard-header-actions">
        {hasPermission(user, 'payments.create') && (
          <button type="button" className="payments-primary-btn" onClick={onRecordPayment}>
            <Plus size={14} />
            Record Payment
          </button>
        )}
      </div>
    </header>
  );
};
