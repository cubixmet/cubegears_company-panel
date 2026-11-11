import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Wallet, ArrowDownLeft, ArrowUpRight,
  Users, Package, AlertCircle, Plus, ArrowLeftRight,
  Receipt, List, RefreshCw, TrendingUp
} from 'lucide-react';
import { financeService } from '../../services/finance.service';
import { USE_MOCK_API } from '../../api/apiConfig';
import FinanceSupplierPurchases from '../../components/finance/FinanceSupplierPurchases';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/finance-dashboard.css';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
});

export function FinanceDashboard() {
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const canViewSupplierBills = can('stock.view') && can('payments.view');
  const canPostSupplierPurchase = canViewSupplierBills &&
    can('stock.create') && can('stock.edit') && can('payments.create') && !USE_MOCK_API;
  const canPaySupplierCredit = canViewSupplierBills && can('payments.create') && !USE_MOCK_API;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await financeService.getDashboard();
      setData(result);
    } catch {
      setError('Unable to load finance data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Balance fields are redacted by Django for staff without balance access.
  // Never present hidden balances as a real zero.
  const fmt = (v) => v === undefined || v === null ? 'Restricted' : money.format(parseFloat(v || 0));

  const stats = data ? [
    { label: 'Bank Balance', value: fmt(data.bankBalance), icon: Building2, color: 'blue' },
    { label: 'Cash Balance', value: fmt(data.cashBalance), icon: Wallet, color: 'green' },
    { label: 'Money Received', value: fmt(data.totalReceived), icon: ArrowDownLeft, color: 'emerald' },
    { label: 'Money Paid Out', value: fmt(data.totalPaid), icon: ArrowUpRight, color: 'orange' },
    { label: 'Customer Dues', value: fmt(data.outstandingCustomer), icon: Users, color: 'yellow' },
    { label: 'Supplier Dues', value: fmt(data.supplierOutstanding), icon: Package, color: 'red' },
    { label: 'Unpaid Expenses', value: fmt(data.pendingExpenses), icon: AlertCircle, color: 'purple' },
    ...(data.estimatedProfit === undefined ? [] : [{ label: 'Estimated Operating Result (not profit)',
      value: fmt(data.estimatedProfit), icon: TrendingUp, color: 'blue' }]),
  ] : [];

  const quickActions = [
    { label: 'Record Payment', icon: ArrowDownLeft, path: '/finance/payments/new', permission: 'payments.create' },
    { label: 'Add Expense', icon: Receipt, path: '/finance/expenses/new', permission: 'expenses.create' },
    { label: 'Add Cash or Bank', icon: Plus, path: '/finance/accounts/new', permission: 'payments.edit' },
    { label: 'Transfer Money', icon: ArrowLeftRight, path: '/finance/transfers/new', permission: 'payments.edit' },
    { label: 'View Transactions', icon: List, path: '/finance/transactions', permission: 'payments.view' },
    { label: 'Accounting & Reports', icon: List, path: '/finance/accounting', permission: 'payments.view' },
    ...(canPostSupplierPurchase ? [
      { label: 'Receive Stock / Purchase GST', icon: Package,
        path: '/suppliers/purchases', permission: 'stock.create' },
    ] : []),
    ...(canPaySupplierCredit ? [
      { label: 'Pay Supplier Credit', icon: Wallet,
        path: '/suppliers', permission: 'payments.create' },
    ] : []),
  ];

  return (
    <div className="finance-dashboard">
      <header className="finance-dash-header">
        <div>
          <span className="finance-dash-kicker">FINANCE</span>
          <h1>Money Overview</h1>
          <p>See money received, money paid, cash and bank balances, and pending dues.</p>
        </div>
        <button className="finance-refresh-btn" onClick={() => {
          setRefreshVersion(value => value + 1);
          void load();
        }} disabled={loading} aria-label="Refresh">
          <RefreshCw size={16} className={loading ? 'finance-spin' : ''} />
          Refresh
        </button>
      </header>

      {error && <div className="finance-error" role="alert">{error}</div>}

      {/* Quick Actions */}
      <section className="finance-quick-actions">
        {quickActions.filter(({ permission }) => can(permission)).map(({ label, icon: Icon, path }) => (
          <button key={label} className="finance-action-btn" onClick={() => navigate(path)}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </section>

      {/* Stats Grid */}
      <section className="finance-stats-grid">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="finance-stat-card finance-stat-skeleton" />
          ))
        ) : (
          stats.map(({ label, value, icon: Icon, color }) => (
            <article key={label} className={`finance-stat-card finance-stat-${color}`}>
              <div className="finance-stat-top">
                <span className="finance-stat-label">{label}</span>
                <Icon size={18} aria-hidden="true" />
              </div>
              <strong className="finance-stat-value">{value}</strong>
            </article>
          ))
        )}
      </section>

      {data?.profitNote && <p className="finance-dash-note">{data.profitNote}</p>}
      {data?.accountBalanceNote && <p className="finance-dash-note">{data.accountBalanceNote}</p>}

      {canViewSupplierBills && <FinanceSupplierPurchases
        refreshVersion={refreshVersion}
        canPurchase={canPostSupplierPurchase}
        canPaySupplier={canPaySupplierCredit}
        canReviewGST={can('gstr.view')}
      />}

      {/* Accounts */}
      {data?.accounts?.length > 0 && (
        <section className="finance-accounts-section">
          <div className="finance-section-header">
            <h2>Cash &amp; Bank Accounts</h2>
            <button className="finance-link-btn" onClick={() => navigate('/finance/accounts')}>
              View Accounts
            </button>
          </div>
          <div className="finance-accounts-grid">
            {data.accounts.map(acc => (
              <article
                key={acc.id}
                className="finance-account-card"
                onClick={() => navigate(`/finance/accounts/${acc.id}`)}
                role="button"
                tabIndex={0}
                aria-label={`View account ${acc.name}`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/finance/accounts/${acc.id}`);
                  }
                }}
              >
                <div className="finance-account-top">
                  <span className={`finance-account-badge finance-account-${String(acc.kind || 'Other').toLowerCase()}`}>{acc.kind || 'Other'}</span>
                  <strong>{acc.name}</strong>
                </div>
                {acc.bankName && <span className="finance-account-bank">{acc.bankName}</span>}
                <div className="finance-account-balance">{fmt(acc.currentBalance)}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Recent Transactions */}
      {data?.recentTransactions?.length > 0 && (
        <section className="finance-recent-section">
          <div className="finance-section-header">
            <h2>Latest Money Movements</h2>
            <button className="finance-link-btn" onClick={() => navigate('/finance/transactions')}>
              See All Transactions
            </button>
          </div>
          <div className="finance-txn-list">
            {data.recentTransactions.map(txn => (
              <div key={txn.id} className="finance-txn-row">
                <div className="finance-txn-info">
                  <span className="finance-txn-type">{String(txn.type || 'Transaction').replace(/_/g, ' ')}</span>
                  <span className="finance-txn-account">{txn.account}</span>
                  {txn.reference && <span className="finance-txn-ref">{txn.reference}</span>}
                </div>
                <div className={`finance-txn-amount ${parseFloat(txn.amount) >= 0 ? 'is-credit' : 'is-debit'}`}>
                  {parseFloat(txn.amount) >= 0 ? '+' : ''}{fmt(txn.amount)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && (!data?.accounts || data.accounts.length === 0) && (
        <div className="finance-empty">
          <TrendingUp size={40} />
          <h3>No cash or bank accounts yet</h3>
          <p>Add your workshop's cash or bank account to track future money movements.</p>
          <button className="finance-primary-btn" onClick={() => navigate('/finance/accounts/new')}>
            Add First Account
          </button>
        </div>
      )}
    </div>
  );
}

export default FinanceDashboard;

