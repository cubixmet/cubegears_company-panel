import { recordLabel } from '../../utils/recordReferences';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Wallet, ArrowDownLeft, ArrowUpRight,
  Users, Package, AlertCircle, ArrowLeftRight,
  Receipt, RefreshCw, TrendingUp
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
    { title: 'Cash & bank', cards: [
      ['Cash Balance', data.cashBalance, Wallet],
      ['Bank Balance', data.bankBalance, Building2],
    ] },
    { title: 'Money movement · all time', cards: [
      ['Money Received', data.totalReceived, ArrowDownLeft],
      ['Money Paid Out', data.totalPaid, ArrowUpRight],
    ] },
    { title: 'Outstanding dues', cards: [
      ['Customer Dues', data.outstandingCustomer, Users],
      ['Supplier Dues', data.supplierOutstanding, Package],
      ['Unpaid Expenses', data.pendingExpenses, AlertCircle],
    ] },
  ] : [];
  const quickActions = [
    { label: 'Record Payment', icon: ArrowDownLeft, path: '/finance/payments/new', permission: 'payments.create', primary: true },
    { label: 'Add Expense', icon: Receipt, path: '/finance/expenses/new', permission: 'expenses.create' },
    { label: 'Transfer Money', icon: ArrowLeftRight, path: '/finance/transfers/new', permission: 'payments.edit' },
  ].filter(({ permission }) => can(permission));

  return (
    <div className="finance-dashboard">
      <header className="finance-dash-header">
        <h1>Finance Overview</h1>
        <button className="finance-refresh-btn" onClick={() => {
          setRefreshVersion(value => value + 1);
          void load();
        }} disabled={loading} aria-label="Refresh">
          <RefreshCw size={16} className={loading ? 'finance-spin' : ''} />
          Refresh
        </button>
      </header>

      {error && <div className="finance-error" role="alert">{error}</div>}

      {quickActions.length > 0 && <nav className="finance-quick-actions" aria-label="Finance actions">
        {quickActions.map(({ label, icon: Icon, path, primary }) => (
          <Link key={path} className={`finance-action-btn${primary ? ' is-primary' : ''}`} to={path}>
            <Icon size={18} aria-hidden="true" /> {label}
          </Link>
        ))}
      </nav>}

      {loading && !data && <p className="finance-loading" role="status">Loading finance overview…</p>}
      {data && <div className="finance-overview-groups">
        {stats.map(({title, cards}) => (
          <section className="finance-overview-group" key={title} aria-label={title}>
            <h2>{title}</h2>
            <dl>{cards.map(([label, value, Icon]) => (
              <div key={label}><dt><Icon size={16} aria-hidden="true" />{label}</dt><dd>{fmt(value)}</dd></div>
            ))}</dl>
          </section>
        ))}
        {data.estimatedProfit != null && <section className="finance-overview-group finance-estimate">
          <h2>Estimated operating result</h2>
          <strong>{fmt(data.estimatedProfit)}</strong>
          {data.profitNote && <details className="finance-disclosure">
            <summary>How this is calculated</summary>
            <p>{data.profitNote}</p>
          </details>}
        </section>}
      </div>}
      {data?.accountBalanceNote && <p className="finance-dash-note">{data.accountBalanceNote}</p>}

      <div className="finance-overview-activity">
        {/* Accounts */}
        {data?.accounts?.length > 0 && (
          <section className="finance-accounts-section">
            <div className="finance-section-header">
              <h2>Cash &amp; Bank Accounts</h2>
              <Link className="finance-link-btn" to="/finance/accounts">
                View Accounts
              </Link>
            </div>
            <div className="finance-accounts-grid">
              {data.accounts.map(acc => (
                <Link
                  key={acc.id}
                  className="finance-account-card"
                  to={`/finance/accounts/${acc.id}`}
                  aria-label={`View account ${acc.name}`}
                >
                  <div className="finance-account-top">
                    <span className={`finance-account-badge finance-account-${String(acc.kind || 'Other').toLowerCase()}`}>{acc.kind || 'Other'}</span>
                    <strong>{acc.name}</strong>
                  </div>
                  {acc.bankName && <span className="finance-account-bank">{acc.bankName}</span>}
                  <div className="finance-account-balance">{fmt(acc.currentBalance)}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Transactions */}
        {data?.recentTransactions?.length > 0 && (
          <section className="finance-recent-section">
            <div className="finance-section-header">
              <h2>Latest Money Movements</h2>
              <Link className="finance-link-btn" to="/finance/transactions">
                View Transactions
              </Link>
            </div>
            <div className="finance-txn-list">
              {data.recentTransactions.map(txn => (
                <div key={txn.id} className="finance-txn-row">
                  <div className="finance-txn-info">
                    <span className="finance-txn-type">{String(txn.type || 'Transaction').replace(/_/g, ' ')}</span>
                    <span className="finance-txn-account">{txn.account}</span>
                    {(txn.reference || txn.id) && <span className="finance-txn-ref">{recordLabel(txn.reference || txn.id)}</span>}
                  </div>
                  <div className={`finance-txn-amount ${parseFloat(txn.amount) >= 0 ? 'is-credit' : 'is-debit'}`}>
                    {parseFloat(txn.amount) >= 0 ? '+' : ''}{fmt(txn.amount)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {canViewSupplierBills && <FinanceSupplierPurchases
        refreshVersion={refreshVersion}
        canPurchase={canPostSupplierPurchase}
        canPaySupplier={canPaySupplierCredit}
        canReviewGST={can('gstr.view')}
      />}

      {!loading && !error && can('payments.edit') && data?.accounts?.length === 0 && (
        <div className="finance-empty">
          <TrendingUp size={40} />
          <h3>No cash or bank accounts yet</h3>
          <p>Add your workshop's cash or bank account to track future money movements.</p>
          <Link className="finance-primary-btn" to="/finance/accounts/new">
            Add First Account
          </Link>
        </div>
      )}
    </div>
  );
}

export default FinanceDashboard;

