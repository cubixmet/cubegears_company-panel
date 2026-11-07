import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Wallet, ArrowDownLeft, ArrowUpRight,
  Users, Package, AlertCircle, Plus, ArrowLeftRight,
  Receipt, List, RefreshCw, TrendingUp
} from 'lucide-react';
import { financeService } from '../../services/finance.service';
import '../../styles/finance-dashboard.css';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
});

export function FinanceDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const fmt = (v) => money.format(parseFloat(v || 0));

  const stats = data ? [
    { label: 'Bank Balance', value: fmt(data.bankBalance), icon: Building2, color: 'blue' },
    { label: 'Cash & Wallet', value: fmt(data.cashBalance), icon: Wallet, color: 'green' },
    { label: 'Total Received', value: fmt(data.totalReceived), icon: ArrowDownLeft, color: 'emerald' },
    { label: 'Total Paid', value: fmt(data.totalPaid), icon: ArrowUpRight, color: 'orange' },
    { label: 'Customer Outstanding', value: fmt(data.outstandingCustomer), icon: Users, color: 'yellow' },
    { label: 'Supplier Outstanding', value: fmt(data.supplierOutstanding), icon: Package, color: 'red' },
    { label: 'Pending Expenses', value: fmt(data.pendingExpenses), icon: AlertCircle, color: 'purple' },
  ] : [];

  const quickActions = [
    { label: 'Add Payment', icon: ArrowDownLeft, path: '/payments/new' },
    { label: 'Add Expense', icon: Receipt, path: '/expenses/new' },
    { label: 'Add Account', icon: Plus, path: '/finance/accounts/new' },
    { label: 'Transfer Money', icon: ArrowLeftRight, path: '/finance/transfers/new' },
    { label: 'View Ledger', icon: List, path: '/finance/transactions' },
    { label: 'Accounting & Reports', icon: List, path: '/finance/accounting' },
  ];

  return (
    <div className="finance-dashboard">
      <header className="finance-dash-header">
        <div>
          <span className="finance-dash-kicker">FINANCE</span>
          <h1>Finance Overview</h1>
          <p>Bank balances, cash flow, outstanding payments and recent activity.</p>
        </div>
        <button className="finance-refresh-btn" onClick={load} disabled={loading} aria-label="Refresh">
          <RefreshCw size={16} className={loading ? 'finance-spin' : ''} />
          Refresh
        </button>
      </header>

      {error && <div className="finance-error" role="alert">{error}</div>}

      {/* Quick Actions */}
      <section className="finance-quick-actions">
        {quickActions.map(({ label, icon: Icon, path }) => (
          <button key={label} className="finance-action-btn" onClick={() => navigate(path)}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </section>

      {/* Stats Grid */}
      <section className="finance-stats-grid">
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
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

      {/* Accounts */}
      {data?.accounts?.length > 0 && (
        <section className="finance-accounts-section">
          <div className="finance-section-header">
            <h2>Accounts</h2>
            <button className="finance-link-btn" onClick={() => navigate('/finance/accounts')}>
              Manage Accounts →
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
                onKeyDown={e => e.key === 'Enter' && navigate(`/finance/accounts/${acc.id}`)}
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
            <h2>Recent Transactions</h2>
            <button className="finance-link-btn" onClick={() => navigate('/finance/transactions')}>
              View All →
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
          <h3>No accounts set up yet</h3>
          <p>Add a bank or cash account to start tracking your finances.</p>
          <button className="finance-primary-btn" onClick={() => navigate('/finance/accounts/new')}>
            Add First Account
          </button>
        </div>
      )}
    </div>
  );
}

export default FinanceDashboard;

