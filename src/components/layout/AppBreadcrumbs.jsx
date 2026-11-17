import { recordLabel } from '../../utils/recordReferences.js';
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { getStaffLandingPath } from '../../utils/staffLanding';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { createPath, Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { staffService } from '../../services/staff.service';
import { customerService } from '../../services/customer.service';
import { vehicleService } from '../../services/vehicle.service';
import { supplierService } from '../../services/supplier.service';
import { stockInventoryLocation } from '../../utils/stockProductRoutes';
import { isRecordPath, recordBreadcrumbFallback, recordBreadcrumbLabel } from './breadcrumbRecordLabels';
import '../../styles/breadcrumbs.css';

const LABELS = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  vehicles: 'Vehicles',
  services: 'Services',
  jobs: 'Job Cards',
  inventory: 'Inventory',
  stock: 'Stock Management',
  invoices: 'Invoices & Billing',
  'e-way-bills': 'E-Way Bills',
  payments: 'Payments',
  expenses: 'Expenses',
  reports: 'Reports & BI',
  notifications: 'Notifications',
  settings: 'Settings',
  profile: 'Profile',
  account: 'Account',
  billing: 'Billing & Plan',
  storage: 'Media Storage',
  history: 'History',
  'my-attendance': 'My Attendance',
  calendar: 'Holiday Calendar',
  leave: 'Leave Requests',
  summary: 'Summary',
  'attendance-manager': 'Attendance Manager',
  overview: 'Overview',
  daily: 'Daily Attendance',
  approvals: 'Approvals',
  'team-review': 'Team Review',
  'master-records': 'Master Records',
  'leave-types': 'Leave Types',
  'leave-requests': 'Leave Requests',
  holidays: 'Holidays',
  overtime: 'Overtime',
  shifts: 'Shifts',
  rules: 'Rules & Settings',
  'staff-management': 'Staff Management',
  suppliers: 'Suppliers',
  purchases: 'Purchase History',
  staff: 'Staff',
  roles: 'Roles & Permissions',
  teams: 'Teams',
  skills: 'Skills',
  performance: 'Performance',
  documents: 'Documents',
  payroll: 'Payroll',
  employees: 'Employees',
  attendance: 'Attendance',
  'salary-setup': 'Salary Setup',
  'daily-wages': 'Daily Wages',
  wages: 'Wage Account',
  incentives: 'Incentives',
  run: 'Run Payroll',
  'salary-structure': 'Salary Structure',
  monthly: 'Monthly Payroll',
  disbursal: 'Disbursal',
  advances: 'Advances',
  payslips: 'Payslips',
  new: 'New',
  edit: 'Edit',
  delete: 'Delete',
  complaints: 'Complaints',
  inspection: 'Inspection',
  parts: 'Parts',
  estimate: 'Estimate',
  updates: 'Technician Updates',
  qc: 'QC',
  invoice: 'Invoice',
  activity: 'Activity',
  costs: 'Costs',
  work: 'Work & Labour',
  photos: 'Photos'
};

const prettify = (value) => {
  if (!value) return '';
  if (LABELS[value]) return LABELS[value];
  const reference = recordLabel(value);
  if (reference !== value) return reference;
  if (/^[A-Z]{2,}-/i.test(value) || /^\d+$/.test(value)) return decodeURIComponent(value);
  return decodeURIComponent(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const buildHref = (segments, index) => '/' + segments.slice(0, index + 1).join('/');

export function AppBreadcrumbs() {
  const { isCompanyOwner, permissions } = useFeatureAccess();
  const homePath = getStaffLandingPath({ isCompanyOwner, effectivePermissions: permissions });
  const location = useLocation();
  const scrollRef = useRef(null);
  const [staffBreadcrumbLabel, setStaffBreadcrumbLabel] = useState('');
  // Stable route-specific cache prevents briefly displaying the previous
  // customer's/vehicle's name while navigating to a different record.
  const [recordLabel, setRecordLabel] = useState(null);
  const [supplierBreadcrumb, setSupplierBreadcrumb] = useState(null);

  useEffect(() => {
    let alive = true;
    const match = location.pathname.match(/^\/staff-management\/staff\/([^/]+)$/)
      || location.pathname.match(/^\/staff\/([^/]+)\/wages$/);

    if (!match) {
      setStaffBreadcrumbLabel('');
      return () => {
        alive = false;
      };
    }

    setStaffBreadcrumbLabel('Staff Profile');

    staffService
      .getStaffById(decodeURIComponent(match[1]))
      .then((profile) => {
        if (alive && profile) {
          setStaffBreadcrumbLabel(profile.name || 'Staff Profile');
        }
      })
      .catch(() => {
        if (alive) setStaffBreadcrumbLabel('Staff Profile');
      });

    return () => {
      alive = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const match = location.pathname.match(/^\/(customers|vehicles)\/([^/]+)(?:\/|$)/);
    if (!match || !isRecordPath(match[1], match[2])) {
      setRecordLabel(null);
      return undefined;
    }
    let alive = true;
    const kind = match[1];
    const identifier = decodeURIComponent(match[2]);
    const fallback = recordBreadcrumbFallback(kind);
    setRecordLabel({ kind, identifier, label: fallback });
    const fetchRecord = kind === 'customers'
      ? customerService.getCustomerById(identifier)
      : vehicleService.getVehicleById(identifier);
    Promise.resolve(fetchRecord)
      .then((record) => {
        if (!alive) return;
        setRecordLabel({ kind, identifier, label: recordBreadcrumbLabel(kind, record) });
      })
      .catch(() => {
        if (alive) setRecordLabel({ kind, identifier, label: fallback });
      });
    return () => { alive = false; };
  }, [location.pathname]);

  useEffect(() => {
    const match = location.pathname.match(/^\/suppliers\/([0-9a-f-]{36})$/i);
    if (!match) {
      setSupplierBreadcrumb(null);
      return undefined;
    }
    let active = true;
    const identifier = match[1].toLowerCase();
    // Never briefly reveal a humanized supplier UUID while fetching the record.
    setSupplierBreadcrumb({ identifier, label: 'Supplier' });
    supplierService.get(identifier)
      .then((supplier) => {
        if (active) setSupplierBreadcrumb({
          identifier, label: /^SUP-\d{5,}$/i.test(String(supplier?.code || ''))
            ? supplier.code : 'Supplier',
        });
      })
      .catch(() => {
        if (active) setSupplierBreadcrumb({ identifier, label: 'Supplier' });
      });
    return () => { active = false; };
  }, [location.pathname]);

  const items = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (!segments.length || location.pathname === '/dashboard') return [];

    if (segments.length === 3 && segments[0] === 'stock' && segments[1] === 'products') {
      return [
        { label: 'Home', href: homePath, current: false, home: true },
        { label: LABELS.stock, href: '/stock', current: false },
        { label: 'Product Details', href: location.pathname, current: true },
      ];
    }

    const isStaffProfile =
      segments.length === 3 &&
      segments[0] === 'staff-management' &&
      segments[1] === 'staff';

    if (segments.length === 3 && segments[0] === 'staff' && segments[2] === 'wages') {
      return [
        { label: 'Home', href: homePath, current: false, home: true },
        { label: 'Staff Management', href: '/staff-management/staff', current: false },
        { label: staffBreadcrumbLabel || 'Staff Profile', href: `/staff-management/staff/${segments[1]}`, current: false },
        { label: 'Wage Account', href: location.pathname, current: true },
      ];
    }

    return [
      { label: 'Home', href: homePath, current: false, home: true },
      ...segments.map((segment, index) => ({
        label:
          isStaffProfile && index === 2
            ? staffBreadcrumbLabel || 'Staff Profile'
            : index === 1 && segments[0] === 'suppliers' && /^[0-9a-f-]{36}$/i.test(segment)
              ? (supplierBreadcrumb?.identifier === segment.toLowerCase() ? supplierBreadcrumb.label : 'Supplier')
              : index === 1 && isRecordPath(segments[0], segment)
                ? (recordLabel?.kind === segments[0] && recordLabel?.identifier === decodeURIComponent(segment)
                    ? recordLabel.label : recordBreadcrumbFallback(segments[0]))
                : prettify(segment),
        href: buildHref(segments, index),
        current: index === segments.length - 1
      }))
    ];
  }, [location.pathname, location.search, staffBreadcrumbLabel, recordLabel, supplierBreadcrumb, homePath]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [location.pathname]);

  if (!items.length) return null;

  return (
    <nav className="app-breadcrumb-wrap no-print" aria-label="Breadcrumb">
      <div className="app-breadcrumb" ref={scrollRef}>
        {items.map((item, index) => (
          <React.Fragment key={item.href + item.label}>
            {index > 0 && (
              <span className="app-breadcrumb-separator" aria-hidden="true">
                <ChevronRight size={12} />
              </span>
            )}
            {item.current ? (
              <span className="app-breadcrumb-current" aria-current="page">{item.label}</span>
            ) : (
              <Link className="app-breadcrumb-link" to={item.href}>
                {item.home && <Home size={12} />}
                <span>{item.label}</span>
              </Link>
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
}

export default AppBreadcrumbs;
