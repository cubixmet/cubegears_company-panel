export const hasPermission = (user, permission) => {
  if (!permission) return true;

  if (permission.startsWith('billing.')) return user?.isCompanyOwner === true;
  if (Array.isArray(user?.effectivePermissions)) return user.effectivePermissions.includes(permission);
  const role = user?.role;

  const permissions =
    role && typeof role === 'object' && Array.isArray(role.permissions)
      ? role.permissions
      : [];

  return permissions.includes('*') || permissions.includes(permission);
};

export const getUserPermissions = (user) => {
  if (Array.isArray(user?.effectivePermissions)) return user.effectivePermissions;
  const role = user?.role;

  return role && typeof role === 'object' && Array.isArray(role.permissions)
    ? role.permissions
    : [];
};

const CRUD_PREFIXES = {
  '/customers': 'customers',
  '/vehicles': 'vehicles',
  '/services': 'services',
  '/jobs': 'jobs',
  '/stock': 'stock',
  '/suppliers': 'stock',
  '/invoices': 'invoices',
  '/quotations': 'invoices',
  '/payments': 'payments',
  '/expenses': 'expenses',
  '/finance/payments': 'payments',
  '/finance/expenses': 'expenses',
};

const SPECIAL_PATH_PERMISSIONS = [
  ['/onboarding', 'company.manage'],
  ['/stock/suppliers', 'payments.view'],
  ['/suppliers/credits', 'payments.view'],
  ['/suppliers/payments', 'payments.view'],
  ['/staff-management/roles', 'company.manage'],
  ['/staff-management/add', 'staff.create'],
  ['/staff-management/teams', 'staff.edit'],
  ['/staff-management/shifts', 'staff.edit'],
  ['/staff-management/skills', 'staff.edit'],
  ['/dashboard', 'dashboard.view'],
  ['/my-attendance', 'attendance.self'],
  ['/attendance-manager', 'attendance.team.view'],
  ['/payroll/daily-wages/overtime-approvals', 'attendance.team.view'],
  ['/payroll/payments', 'payroll.payments.view'],
  ['/staff-management', 'staff.view'],
  ['/payroll', 'payroll.view'],
  ['/gstr', 'gstr.view'],
  ['/finance/accounting', 'payments.view'],
  ['/finance/accounts', 'payments.view'],
  ['/finance/transfers', 'payments.view'],
  ['/finance/transactions', 'payments.view'],
  ['/reports', 'reports.view'],
  ['/notifications', 'notifications.view'],
  ['/settings/customer-website', 'company.manage'],
  ['/settings/customer-website', 'company.manage'],
  ['/settings', 'settings.view'],
  ['/account/credits', 'billing.view'],
  ['/account/billing', 'billing.view'],
  ['/account/credits', 'billing.view'],
  ['/account/storage', 'billing.view'],
  ['/account/templates', 'settings.view'],
  ['/account/security', 'settings.view'],
  ['/account', 'billing.view'],
  ['/staff', 'payroll.view'],
];

const actionForCrudPath = (pathname, prefix) => {
  const suffix = pathname.slice(prefix.length);

  if (/\/(new|add)$/.test(suffix)) return 'create';
  // Both /customers/:id/edit and the legacy /customers/edit/:id
  // require write access, including direct links and refreshed tabs.
  if (/\/(?:[^/]+\/edit|edit\/[^/]+)$/.test(suffix)) return 'edit';
  if (/\/(?:[^/]+\/delete|delete\/[^/]+)$/.test(suffix)) return 'delete';

  return 'view';
};

export const getPermissionForPath = (pathname = '') => {
  if (!pathname || pathname === '/profile' || pathname === '/access-denied') {
    return null;
  }
  // Explicit tenant permission for finance root; expense-only roles are
  // separately allowed at the root and redirected to their section.
  if (pathname === '/finance') return 'payments.view';
  // A Job Card has cross-module sections; its invoice screen is NOT covered
  // by the Jobs label alone. Direct deep-links also require invoice access.
  if (/^\/jobs\/[^/]+\/invoice(?:\/|$)/.test(pathname)) return 'invoices.view';
  if (/^\/jobs\/[^/]+\/parts(?:\/|$)/.test(pathname)) return 'stock.view';

  const special = SPECIAL_PATH_PERMISSIONS
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];

  if (special) return special[1];

  const crudEntry = Object.entries(CRUD_PREFIXES)
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];

  if (crudEntry) {
    const [prefix, module] = crudEntry;
    return `${module}.${actionForCrudPath(pathname, prefix)}`;
  }

  return null;
};
