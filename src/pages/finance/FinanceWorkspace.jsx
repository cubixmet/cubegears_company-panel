import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ArrowDownLeft, Receipt, Wallet, ArrowLeftRight,
  List, BookOpen, UserRound, Truck, Wrench, FileText, Info, ChevronRight
} from 'lucide-react';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/finance-workspace.css';
import '../../styles/finance-unified-ui.css';
import '../../styles/finance-white-refined.css';

// One workspace; each existing financial workflow remains the sole source of truth.
const sections = [
  { label: 'Overview', to: '/finance', icon: LayoutDashboard, access: 'payments.view', end: true,
    description: 'Understand how much has come in, how much has been paid and what is still due.' },
  { label: 'Payments', to: '/finance/payments', icon: ArrowDownLeft, access: 'payments.view',
    description: 'Record and review money received from customers and their invoices.' },
  { label: 'Expenses', to: '/finance/expenses', icon: Receipt, access: 'expenses.view',
    description: 'Record workshop costs, then pay outstanding expenses from a selected account.' },
  { label: 'Cash & Bank', to: '/finance/accounts', icon: Wallet, access: 'payments.view',
    description: 'Manage cash, bank and UPI accounts. Account balances follow your role permissions.' },
  { label: 'Transfers', to: '/finance/transfers', icon: ArrowLeftRight, access: 'payments.view',
    description: 'Move money between workshop accounts without recording it as income or expense.' },
  { label: 'Transactions', to: '/finance/transactions', icon: List, access: 'payments.view',
    description: 'Review the posted money movements and download the account transaction ledger.' },
  { label: 'Accounting', to: '/finance/accounting', icon: BookOpen, access: 'payments.view',
    description: 'Review journals, trial balance, profit and loss, and bank reconciliation.' },
];

const workflows = [
  { label: 'Customer Invoice', to: '/invoices', icon: FileText, access: 'invoices.view' },
  { label: 'Supplier Purchases & Dues · GST', to: '/suppliers/purchases', icon: Truck, access: 'stock.view' },
  { label: 'Purchase GST / GSTR-2B', to: '/gstr?tab=gstr2b', icon: FileText, access: 'gstr.view' },
  { label: 'Employee Wages', to: '/payroll/daily-wages', icon: UserRound, access: 'payroll.view' },
  { label: 'Outside Purchases', to: '/jobs/outside-labour', icon: Wrench, access: 'jobs.view' },
];

export default function FinanceWorkspace() {
  const access = useFeatureAccess();
  const location = useLocation();
  const canView = access.can('payments.view') || access.can('expenses.view');
  if (location.pathname === '/finance' && !access.can('payments.view') && access.can('expenses.view')) {
    return <Navigate to="/finance/expenses" replace />;
  }
  if (!canView) {
    return <div className="finance-workspace-denied" role="alert">
      You do not have permission to view the company finance workspace.
    </div>;
  }
  const current = [...sections].sort((a, b) => b.to.length - a.to.length).find((item) =>
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );
  return <main className="finance-workspace cg-finance-refined">
    <div className="finance-workspace-top">
      <div className="cg-finance-heading">
        <span className="finance-workspace-eyebrow">CUBIXGEAR · WORKSHOP FINANCE</span>
        <h1>Finance</h1>
        <p>Track the money your workshop receives, pays and keeps in its accounts.</p>
      </div>
      <span className="finance-workspace-context"><ChevronRight size={15} aria-hidden="true"/>{current?.label || 'Overview'}</span>
    </div>
    <nav className="finance-workspace-tabs" aria-label="Finance sections">
      {sections.filter(item => access.can(item.access)).map(({ label, to, icon: Icon, end }) =>
        <NavLink key={to} to={to} end={end} className={({ isActive }) =>
          'finance-workspace-tab' + (isActive ? ' is-active' : '')
        }>
          <Icon size={16} aria-hidden="true" />{label}
        </NavLink>
      )}
    </nav>
    <div className="finance-workspace-intro" role="note">
      <Info size={17} aria-hidden="true"/>
      <span>{current?.description || 'Select a finance section to view its records.'}</span>
    </div>
    <Outlet />
    <section className="finance-workspace-related" aria-label="Linked finance workflows">
      <div>
        <h2>Other workshop payments</h2>
        <p>Supplier purchases and staff wages start from their own records. Record each payment once; posted movements appear in the Finance transaction ledger.</p>
      </div>
      <div className="finance-workspace-links">
        {workflows.filter(item => access.can(item.access)).map(({ label, to, icon: Icon }) =>
          <NavLink to={to} key={to}><Icon size={15} aria-hidden="true" />{label}</NavLink>
        )}
      </div>
    </section>
  </main>;
}
