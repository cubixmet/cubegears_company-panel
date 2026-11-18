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

export const WORKSHOP_ROLE_PRESETS = [
  {
    name: 'Service Advisor',
    description: 'Register customers and vehicles, and manage job cards.',
    permissions: {
      dashboard: ['view'],
      customers: ['view', 'create', 'edit'],
      vehicles: ['view', 'create', 'edit'],
      services: ['view'],
      jobs: ['view', 'create', 'edit'],
      attendance: ['self'],
    },
  },
  {
    name: 'Mechanic',
    description: 'View vehicles and update job cards.',
    permissions: {
      dashboard: ['view'],
      vehicles: ['view'],
      jobs: ['view', 'edit'],
      attendance: ['self'],
    },
  },
  {
    name: 'Parts Manager',
    description: 'Manage parts and stock, and view job cards.',
    permissions: {
      dashboard: ['view'],
      jobs: ['view'],
      stock: ['view', 'create', 'edit'],
      attendance: ['self'],
    },
  },
  {
    name: 'Accountant',
    description: 'Manage invoices, record payments and expenses, and view reports.',
    permissions: {
      dashboard: ['view'],
      invoices: ['view', 'create', 'edit'],
      payments: ['view', 'create'],
      expenses: ['view', 'create'],
      reports: ['view'],
      attendance: ['self'],
    },
  },
  {
    name: 'Workshop Supervisor',
    description: 'Oversee job cards, check stock and view team attendance.',
    permissions: {
      dashboard: ['view'],
      customers: ['view'],
      vehicles: ['view'],
      services: ['view'],
      jobs: ['view', 'create', 'edit'],
      stock: ['view'],
      attendance: ['self', 'team.view'],
    },
  },
];

// Filter every proposed permission through the available company actions.
export const buildRolePresetPermissions = (modules, preset) =>
  Object.fromEntries(modules.map((module) => [
    module.key,
    Object.fromEntries(module.actions.map((action) => [
      action,
      Boolean(preset?.permissions[module.key]?.includes(action)),
    ])),
  ]));

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
