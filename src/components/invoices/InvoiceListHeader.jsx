
import { Plus, Wallet, FileCheck2, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

export const InvoiceListHeader = ({ activeTab, onCreate, onFinance, onGSTR, onSupplierPurchases }) => {
  const { user } = useAuth();

  return (
    <header className="invoice-dashboard-header">
      <div className="cg-invoice-heading">
        <span className="cg-invoice-eyebrow">WORKSHOP BILLING</span>
        <h1>{activeTab === 'estimate' ? 'Estimates' : 'Invoices'}</h1>
        <p>{activeTab === 'estimate'
          ? 'Create quotations, track approvals, and convert approved estimates to invoices.'
          : 'Create customer bills, track payment status, and print saved invoices.'}</p>
      </div>

      <div className="invoice-dashboard-header-actions">

        {hasPermission(user, 'gstr.view') && activeTab === 'invoice' && (
          <button type="button" className="bill-btn secondary" onClick={onGSTR}>
            <FileCheck2 size={15} /> GST Returns
          </button>
        )}
        {hasPermission(user, 'stock.view') && hasPermission(user, 'payments.view') &&
          activeTab === 'invoice' && (
          <button type="button" className="bill-btn secondary" onClick={onSupplierPurchases}>
            <ShoppingBag size={15} /> Supplier Purchases
          </button>
        )}
        {hasPermission(user, 'payments.view') && activeTab === 'invoice' && (
          <button type="button" className="bill-btn secondary" onClick={onFinance}>
            <Wallet size={15} /> Finance
          </button>
        )}
        {hasPermission(user, 'invoices.create') && (
          <button type="button" className="bill-btn" onClick={onCreate}>
            <Plus size={14} />
            {activeTab === 'estimate' ? 'Add Estimate' : 'Create Invoice'}
          </button>
        )}
      </div>
    </header>
  );
};
