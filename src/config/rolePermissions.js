export const ROLE_PERMISSION_MODULES = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { key: 'customers', label: 'Customers', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'vehicles', label: 'Vehicles', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'services', label: 'Services', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'jobs', label: 'Job Cards', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'stock', label: 'Stock Management', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'invoices', label: 'Invoices', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'payments', label: 'Payments', actions: ['view', 'create', 'edit', 'delete', 'reverse'] },
  { key: 'expenses', label: 'Expenses', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'attendance', label: 'Attendance', actions: ['self', 'manage', 'team.view', 'records.manage', 'corrections.approve', 'leave.approve', 'overtime.approve', 'shifts.manage', 'rules.manage', 'holidays.manage'] },
  { key: 'staff', label: 'Staff', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'payroll', label: 'Payroll & Daily Wages', actions: ['view', 'create', 'edit', 'delete', 'rates.manage', 'wages.finalize', 'extras.manage', 'extras.approve', 'adjustments.manage', 'process', 'approve', 'payments.view', 'payments.record', 'payments.reverse'] },
  { key: 'reports', label: 'Reports', actions: ['view'] },
  { key: 'notifications', label: 'Notifications', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'settings', label: 'Settings', actions: ['view', 'manage'] },
  { key: 'storage', label: 'Storage', actions: ['view', 'manage'] },
];

// Conservative role-editor presets: never grant payment, payroll, delete,
// approval, settings management, or attendance manager permissions by default.
const VIEWER_PRESET = Object.freeze({
  dashboard: ['view'],
  customers: ['view'],
  vehicles: ['view'],
  services: ['view'],
  jobs: ['view'],
  stock: ['view'],
});

const STANDARD_PRESET = Object.freeze({
  ...VIEWER_PRESET,
  customers: ['view', 'create', 'edit'],
  vehicles: ['view', 'create', 'edit'],
  jobs: ['view', 'create', 'edit'],
  attendance: ['self'],
});

// Apply only actions present in the authorized, visible modules supplied by
// companyPermissionModules(). Keep any hidden role permissions untouched.
export const buildRoleAccessPreset = (modules, mode) => {
  const allow = mode === 'standard' ? STANDARD_PRESET : VIEWER_PRESET;
  return Object.fromEntries(modules.map((module) => [
    module.key,
    Object.fromEntries(module.actions.map((action) => [
      action,
      Boolean(allow[module.key]?.includes(action)),
    ])),
  ]));
};

export const createPermissionMatrix = (enabled = false) =>
  Object.fromEntries(
    ROLE_PERMISSION_MODULES.map((module) => [
      module.key,
      Object.fromEntries(module.actions.map((action) => [action, enabled])),
    ])
  );

export const permissionCodesToMatrix = (codes = []) => {
  const list = Array.isArray(codes) ? codes : [];
  if (list.includes('*')) return createPermissionMatrix(true);

  const matrix = createPermissionMatrix(false);
  for (const code of list) {
    const [module, ...parts] = String(code).split('.');
    const action = parts.join('.');
    if (matrix[module] && Object.prototype.hasOwnProperty.call(matrix[module], action)) {
      matrix[module][action] = true;
    }
  }
  return matrix;
};

export const permissionMatrixToCodes = (matrix = {}) =>
  ROLE_PERMISSION_MODULES.flatMap((module) =>
    module.actions
      .filter((action) => Boolean(matrix?.[module.key]?.[action]))
      .map((action) => `${module.key}.${action}`)
  );

export const permissionActionLabel = (action, moduleKey = '') => {
  if (action === 'self') return 'Self Access';
  if (action === 'manage') return 'Manage';
  if (action === 'reverse' && moduleKey === 'payments') return 'Reverse Customer Payment';
  if (action === 'payments.reverse') return moduleKey === 'payroll' ? 'Reverse Wage Payment' : moduleKey === 'payments' ? 'Reverse Customer Payment' : 'Reverse Payment';
  const names = {
    'team.view': 'View Team Attendance',
    'records.manage': 'Create / Correct Attendance',
    'corrections.approve': 'Approve Punch Corrections',
    'leave.approve': 'Approve Leave',
    'overtime.approve': 'Approve Overtime',
    'shifts.manage': 'Manage Shifts',
    'rules.manage': 'Manage Attendance Rules',
    'holidays.manage': 'Manage Holidays',
    'rates.manage': 'Manage Wage Rates',
    'wages.finalize': 'Finalize Daily Wages',
    'extras.manage': 'Add Extra Earnings',
    'extras.approve': 'Approve Extra Earnings',
    'adjustments.manage': 'Manage Wage Adjustments',
    'payments.view': 'View Salary / Wage Payments',
    'payments.record': 'Record Wage / Salary Payment',
    process: 'Process Payroll',
    approve: 'Approve Payroll',
  };
  if (names[action]) return names[action];
  return action.charAt(0).toUpperCase() + action.slice(1);
};

// Render only actions authorized by the current company access response.
export const companyPermissionModules = (can) => ROLE_PERMISSION_MODULES.map(module => ({
  ...module, actions: module.actions.filter(action => can(`${module.key}.${action}`)),
})).filter(module => module.actions.length > 0);
