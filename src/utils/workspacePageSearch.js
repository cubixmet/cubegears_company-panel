import { getPermissionForPath } from './permissions.js';

// Keep the primary page catalog synchronized with the real sidebar routes.
// Extra destinations must exist in AppRoutes and pass their own route permission.
const DESCRIPTIONS = {
  credits: ['wallet credits billing subscription storage account', 'SaaS billing, credits and features'],
  dashboard: ['home overview summary workshop', 'Workshop dashboard and overview'],
  jobs: ['job cards job management work inspection estimate qc complaints', 'Job cards, inspections and work'],
  stock: ['inventory spare parts stock sku part number product store', 'Parts, inventory and stock'],
  suppliers: ['supplier vendors vendor procurement purchase bill supplier credits ledger supplier payments outstanding', 'Supplier profiles, purchases, credits and payments'],
  'my-attendance': ['punch in punch out leave calendar shift self attendance', 'My daily attendance and leave'],
  'attendance-manager': ['attendance manager team approvals shifts rules report', 'Team attendance and approvals'],
  'staff-management': ['employees staff team roles permission mechanic account manager', 'Staff directory and management'],
  payroll: ['salary wages pay employees overtime daily wages', 'Payroll, wages and payments'],
  customers: ['customer client clients contact mobile customer ledger', 'Customer records and profiles'],
  vehicles: ['cars vehicle registration vin plate make model', 'Vehicle directory and details'],
  services: ['service catalog labour labor work service list', 'Service catalog and work prices'],
  invoices: ['bill billing invoices estimates quotation invoice eway gst', 'Invoices, estimates and billing'],
  gstr: ['gst tax gstr returns tax reports', 'GST reports and returns'],
  payments: ['payment cash bank upi receipts collection', 'Customer payments and receipts'],
  expenses: ['expense cost outflow vendor bills', 'Workshop expenses and spending'],
  finance: ['accounts accounting transfer transactions ledger bank cash profit', 'Accounts, transfers and transactions'],
  reports: ['analytics report business insights summary statistics', 'Workshop reports and analytics'],
  notifications: ['alerts messages announcements inbox', 'Alerts and notifications'],
  settings: ['setting configuration preferences profile whatsapp', 'Workshop settings'],
  'customer-website': ['public website portal branding domain hosting customer', 'Customer website and branding'],
};

const OTHER_PAGES = [
  { id: 'add-job', label: 'Create Job Card', path: '/jobs/new', permission: 'jobs.create', keywords: 'new job create service jobcard', description: 'Start a new workshop job' },
  { id: 'add-customer', label: 'Add Customer', path: '/customers/new', permission: 'customers.create', keywords: 'register client new customer', description: 'Create a customer profile' },
  { id: 'add-vehicle', label: 'Add Vehicle', path: '/vehicles/new', permission: 'vehicles.create', keywords: 'register car registration new vehicle', description: 'Create a vehicle record' },
  { id: 'add-staff', label: 'Add Staff', path: '/staff-management/add', permission: 'staff.create', keywords: 'new employee team staff onboard whatsapp', description: 'Onboard a staff member' },
  { id: 'staff-roles', label: 'Staff Roles', path: '/staff-management/roles', permission: 'company.manage', keywords: 'permissions access user roles', description: 'Set staff roles and permissions' },
  { id: 'staff-teams', label: 'Staff Teams', path: '/staff-management/teams', permission: 'staff.edit', keywords: 'team organization department', description: 'Manage staff teams' },
  { id: 'staff-shifts', label: 'Staff Shifts', path: '/staff-management/shifts', permission: 'staff.edit', keywords: 'employee schedules rota', description: 'Configure employee shifts' },
  { id: 'daily-wages', label: 'Daily Wages', path: '/payroll/daily-wages', permission: 'payroll.view', keywords: 'salary payroll daily wage', description: 'Daily wages and payroll' },
  { id: 'overtime-approvals', label: 'Overtime Approvals', path: '/payroll/daily-wages/overtime-approvals', permission: 'attendance.team.view', keywords: 'ot time attendance approvals', description: 'Approve staff overtime' },
  { id: 'payroll-payments', label: 'Payroll Payments', path: '/payroll/payments', permission: 'payroll.payments.view', keywords: 'salary payouts wages', description: 'Review salary payments' },
  { id: 'supplier-purchases', label: 'Supplier Purchases', path: '/suppliers', permission: 'stock.view', extraPermissions: ['payments.view'], keywords: 'purchase order bills procurement vendor', description: 'Open Suppliers to review purchase records' },
  { id: 'supplier-credits', label: 'Supplier Credits', path: '/suppliers', permission: 'stock.view', extraPermissions: ['payments.view'], keywords: 'supplier outstanding payable vendor balance ledger', description: 'Open Suppliers to review credit balances' },
  { id: 'finance-accounts', label: 'Cash & Bank Accounts', path: '/finance/accounts', permission: 'payments.view', keywords: 'upi wallet financial account bank', description: 'Workshop finance accounts' },
  { id: 'finance-transactions', label: 'Transactions', path: '/finance/transactions', permission: 'payments.view', keywords: 'account ledger entry history', description: 'Finance transaction history' },
  { id: 'finance-transfers', label: 'Account Transfers', path: '/finance/transfers', permission: 'payments.view', keywords: 'bank cash transfer funds', description: 'Move funds between accounts' },
  { id: 'accounting', label: 'Accounting', path: '/finance/accounting', permission: 'payments.view', keywords: 'ledger journal profit reconciliation', description: 'Accounting workspace' },
  { id: 'eway-bills', label: 'E-Way Bills', path: '/invoices/e-way-bills', permission: 'invoices.view', keywords: 'eway e way gst invoice logistics', description: 'E-way bill management' },
  { id: 'whatsapp-settings', label: 'WhatsApp Settings', path: '/settings/whatsapp', permission: 'settings.view', keywords: 'whatsapp business api message notification', description: 'WhatsApp delivery settings' },
  { id: 'customer-domains', label: 'Customer Website Domains', path: '/settings/customer-website/domains', permission: 'company.manage', keywords: 'domain dns custom website', description: 'Customer site domain settings' },
];

const scoreMatch = (item, query) => {
  const label = item.label.toLowerCase();
  const keywords = item.keywords.toLowerCase();
  const details = item.description.toLowerCase();
  const path = item.path.toLowerCase();
  if (label === query) return 400;
  if (label.startsWith(query)) return 300;
  if (label.includes(query)) return 200;
  if (keywords.split(/\s+/).some(word => word === query)) return 160;
  if (keywords.includes(query)) return 110;
  if (details.includes(query)) return 70;
  if (path.includes(query)) return 30;
  return 0;
};

/** Return only currently accessible routes. Never read or cache tenant records. */
export function searchWorkspacePages(query, routes, can, max = 12) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2 || typeof can !== 'function') return [];
  const primary = routes.map(route => {
    const [keywords, description] = DESCRIPTIONS[route.id] || ['', route.section || 'Workspace page'];
    return { ...route, keywords, description };
  });
  return [...primary, ...OTHER_PAGES]
    .filter(item => {
      const routePermission = getPermissionForPath(item.path);
      return Boolean(routePermission && item.permission && can(item.permission) &&
        can(routePermission) && (!item.extraPermissions || item.extraPermissions.every(can)));
    })
    .map(item => ({ ...item, score: scoreMatch(item, q) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, max)
    .map(item => ({
      id: 'page-' + item.id,
      group: 'Pages & Features',
      title: item.label,
      subtitle: item.description,
      status: 'Page',
      route: item.path,
    }));
}
