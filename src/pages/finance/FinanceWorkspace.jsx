import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import {
  LayoutDashboard, ArrowDownLeft, Receipt, Wallet, ArrowLeftRight,
  List, BookOpen, UserRound, Truck, Wrench, FileText
} from 'lucide-react';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/finance-workspace.css';
import '../../styles/finance-unified-ui.css';
import '../../styles/finance-white-refined.css';

// One workspace; each existing financial workflow remains the sole source of truth.
const sections = [
  { label: 'Overview', to: '/finance', icon: LayoutDashboard, access: 'payments.view', end: true },
  { label: 'Payments', to: '/finance/payments', icon: ArrowDownLeft, access: 'payments.view' },
  { label: 'Expenses', to: '/finance/expenses', icon: Receipt, access: 'expenses.view' },
  { label: 'Cash & Bank', to: '/finance/accounts', icon: Wallet, access: 'payments.view' },
  { label: 'Transfers', to: '/finance/transfers', icon: ArrowLeftRight, access: 'payments.view' },
  { label: 'Transactions', to: '/finance/transactions', icon: List, access: 'payments.view' },
  { label: 'Accounting', to: '/finance/accounting', icon: BookOpen, access: 'payments.view' },
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
  const tabsRef = useRef(null);
  useEffect(() => {
    const tabs = tabsRef.current;
    const current = tabs?.querySelector('[aria-current="page"]');
    if (!current || tabs.scrollWidth <= tabs.clientWidth) return;
    const tabBounds = current.getBoundingClientRect();
    const bounds = tabs.getBoundingClientRect();
    if (tabBounds.left < bounds.left) tabs.scrollLeft += tabBounds.left - bounds.left - 6;
    if (tabBounds.right > bounds.right) tabs.scrollLeft += tabBounds.right - bounds.right + 6;
  }, [location.pathname]);
  const canView = access.can('payments.view') || access.can('expenses.view');
  if (location.pathname === '/finance' && !access.can('payments.view') && access.can('expenses.view')) {
    return <Navigate to="/finance/expenses" replace />;
  }
  if (!canView) {
    return <div className="finance-workspace-denied" role="alert">
      You do not have permission to view the company finance workspace.
    </div>;
  }
  const visibleWorkflows = workflows.filter(item => access.can(item.access));
  const isExpenseForm = /^\/finance\/expenses\/(?:new|[^/]+\/edit)\/?$/.test(location.pathname);
  return <div className="finance-workspace cg-finance-refined">
    <nav ref={tabsRef} className="finance-workspace-tabs" aria-label="Finance sections">
      {sections.filter(item => access.can(item.access)).map(({ label, to, icon: Icon, end }) =>
        <NavLink key={to} to={to} end={end} className={({ isActive }) =>
          'finance-workspace-tab' + (isActive ? ' is-active' : '')
        }>
          <Icon size={16} aria-hidden="true" />{label}
        </NavLink>
      )}
    </nav>
    <Outlet />
    {!isExpenseForm && visibleWorkflows.length > 0 && <details className="finance-workspace-related finance-disclosure">
      <summary>Related workshop records</summary>
      <div className="finance-workspace-links">
        {visibleWorkflows.map(({ label, to, icon: Icon }) =>
          <NavLink to={to} key={to}><Icon size={15} aria-hidden="true" />{label}</NavLink>
        )}
      </div>
    </details>}
  </div>;
}
