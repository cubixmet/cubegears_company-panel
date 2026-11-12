import { useEffect } from 'react';
import { lazyPage } from './lazyPage';
const OwnerCompanyProfile = lazyPage(() => import('../pages/saas/OwnerCompanyProfile'), 'OwnerCompanyProfile');
const OwnerOnboarding = lazyPage(() => import('../pages/saas/OwnerOnboarding'), 'OwnerOnboarding');
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getStaffLandingPath } from '../utils/staffLanding';
import { ProtectedRoute } from './ProtectedRoute';

const CreditWorkspace = lazyPage(() => import('../pages/saas/CreditWorkspace'), 'CreditWorkspace');

// Old supplier finance URLs remain safe bookmarks, but no duplicate UI/page is
// mounted. All purchase, payment and credit actions now live on /suppliers/:id.
function LegacySupplierRouteRedirect() {
  const { search } = useLocation();
  const selected = new URLSearchParams(search).get('supplier');
  return <Navigate to={selected ? '/suppliers/' + encodeURIComponent(selected) : '/suppliers'} replace />;
}


const Login = lazyPage(() => import('../pages/auth/Login'), 'Login');
const StaffSetPasswordPage = lazyPage(() => import('../pages/auth/StaffSetPasswordPage'), 'default');
const ForgotPassword = lazyPage(() => import('../pages/auth/ForgotPassword'), 'ForgotPassword');
const ResetPassword = lazyPage(() => import('../pages/auth/ResetPassword'), 'ResetPassword');
const SetupPassword = lazyPage(() => import('../pages/auth/SetupPassword'), 'SetupPassword');
const MagicLinkVerify = lazyPage(() => import('../pages/auth/MagicLinkVerify'), 'MagicLinkVerify');
const AccessDenied = lazyPage(() => import('../pages/auth/AccessDenied'), 'AccessDenied');
const Dashboard = lazyPage(() => import('../pages/dashboard/Dashboard'), 'Dashboard');
const MyAttendance = lazyPage(() => import('../pages/attendance/MyAttendance'), 'MyAttendance');
const AttendanceManager = lazyPage(() => import('../pages/attendance/AttendanceManager'), 'AttendanceManager');
const StaffAttendanceDetails = lazyPage(() => import('../pages/attendance-manager/StaffAttendanceDetails'), 'StaffAttendanceDetails');
const StaffManagement = lazyPage(() => import('../pages/employees/StaffManagement'), 'StaffManagement');
const DailyWagePage = lazyPage(() => import('../pages/payroll/DailyWagePage'), 'DailyWagePage');
const OvertimeApprovalPage = lazyPage(() => import('../pages/payroll/OvertimeApprovalPage'), 'OvertimeApprovalPage');
const DailyWageAccountPage = lazyPage(() => import('../pages/payroll/DailyWageAccountPage'), 'DailyWageAccountPage');
const CustomerList = lazyPage(() => import('../pages/customers/CustomerList'), 'CustomerList');
const CustomerManagement = lazyPage(() => import('../pages/customers/CustomerManagement'), 'CustomerManagement');
const AddCustomer = lazyPage(() => import('../pages/customers/AddCustomer'), 'AddCustomer');
const EditCustomer = lazyPage(() => import('../pages/customers/EditCustomer'), 'EditCustomer');
const CustomerDetails = lazyPage(() => import('../pages/customers/CustomerDetails'), 'CustomerDetails');
const VehicleList = lazyPage(() => import('../pages/vehicles/VehicleList'), 'VehicleList');
const AddVehicle = lazyPage(() => import('../pages/vehicles/AddVehicle'), 'AddVehicle');
const VehicleDetails = lazyPage(() => import('../pages/vehicles/VehicleDetails'), 'VehicleDetails');
const EditVehicle = lazyPage(() => import('../pages/vehicles/EditVehicle'), 'EditVehicle');
const ServiceList = lazyPage(() => import('../pages/services/ServiceList'), 'ServiceList');
const JobList = lazyPage(() => import('../pages/jobs/JobList'), 'JobList');
const JobCreatePage = lazyPage(() => import('../pages/jobs/JobCreatePage'), 'JobCreatePage');
const JobComplaintDetails = lazyPage(() => import('../pages/jobs/JobComplaintDetails'), 'JobComplaintDetails');
const OutsideLabourPage = lazyPage(() => import('../pages/jobs/OutsideLabourPage'), 'OutsideLabourPage');
const JobDetails = lazyPage(() => import('../pages/jobs/JobDetails'), 'JobDetails');
const JobStatus = lazyPage(() => import('../pages/jobs/JobStatus'), 'JobStatus');
const JobReports = lazyPage(() => import('../pages/jobs/JobReports'), 'JobReports');
const StockEasyPage = lazyPage(() => import('../pages/stock/StockEasyPage'), 'default');
const SuppliersPage = lazyPage(() => import('../pages/suppliers/SuppliersPage'), 'default');
const InvoiceList = lazyPage(() => import('../pages/invoices/InvoiceList'), 'InvoiceList');
const EWayBillPage = lazyPage(() => import('../pages/invoices/EWayBillPage'), 'EWayBillPage');
const PaymentList = lazyPage(() => import('../pages/payments/PaymentList'), 'PaymentList');
const ExpenseList = lazyPage(() => import('../pages/expenses/ExpenseList'), 'ExpenseList');
const FinanceWorkspace = lazyPage(() => import('../pages/finance/FinanceWorkspace'), 'default');
const FinanceDashboard = lazyPage(() => import('../pages/finance/FinanceDashboard'), 'FinanceDashboard');
const AccountingWorkspace = lazyPage(() => import('../pages/finance/AccountingWorkspace'), 'default');
const AccountsPage = lazyPage(() => import('../pages/finance/AccountsPage'), 'AccountsPage');
const TransfersPage = lazyPage(() => import('../pages/finance/TransfersPage'), 'TransfersPage');
const TransactionsPage = lazyPage(() => import('../pages/finance/TransactionsPage'), 'TransactionsPage');
const Reports = lazyPage(() => import('../pages/reports/Reports'), 'Reports');
const GSTRDashboard = lazyPage(() => import('../pages/gstr/GSTRDashboard'), 'default');
const Notifications = lazyPage(() => import('../pages/notifications/Notifications'), 'Notifications');
const Settings = lazyPage(() => import('../pages/settings/Settings'), 'Settings');
const WhatsAppSettingsPage = lazyPage(() => import('../pages/settings/WhatsAppSettingsPage'), 'default');
const CustomerWebsiteSettingsPage = lazyPage(() => import('../pages/settings/CustomerWebsiteSettingsPage'), 'default');
const Profile = lazyPage(() => import('../pages/profile/Profile'), 'Profile');
const SaaSAccount = lazyPage(() => import('../pages/saas/SaaSAccount'), 'SaaSAccount');

const DocumentTemplates = lazyPage(() => import('../pages/saas/DocumentTemplates'), 'DocumentTemplates');
const StorageHistory = lazyPage(() => import('../pages/saas/StorageHistory'), 'StorageHistory');
const StorageDayDetails = lazyPage(() => import('../pages/saas/StorageDayDetails'), 'StorageDayDetails');
const AccountSecurity = lazyPage(() => import('../pages/account/AccountSecurity'), 'AccountSecurity');

// Workshop registration lives on the public website, not in the company panel.
function PublicSignupRedirect() {
  useEffect(() => {
    window.location.replace('https://cubixgear.tech/signup');
  }, []);

  return (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <p>
        Opening workshop registration…{' '}
        <a href="https://cubixgear.tech/signup">Continue to registration</a>
      </p>
    </main>
  );
}

function RootRedirect() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  return (
    <Navigate
      to={`${isAuthenticated ? getStaffLandingPath(user) : "/dashboard"}${location.search}`}
      replace
    />
  );
}

function LegacyFinanceRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/finance${pathname}${search}${hash}`} replace />;
}

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<Login />} />
    <Route path="/plans" element={<Navigate to="/account/credits/buy" replace />} />
    <Route path="/signup" element={<PublicSignupRedirect />} />
    <Route path="/set-password/:token" element={<StaffSetPasswordPage />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/setup-password" element={<SetupPassword />} />
    <Route path="/magic-link/verify" element={<MagicLinkVerify />} />

    <Route element={<ProtectedRoute />}>
      <Route path="/subscribe" element={<Navigate to="/account/credits/buy" replace />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/my-attendance" element={<Navigate to="/my-attendance/calendar" replace />} />
      <Route path="/my-attendance/calendar" element={<MyAttendance />} />
      <Route path="/my-attendance/history" element={<MyAttendance />} />
      <Route path="/my-attendance/leave" element={<MyAttendance />} />
      <Route path="/my-attendance/overtime" element={<MyAttendance />} />
      <Route path="/my-attendance/summary" element={<MyAttendance />} />
      <Route path="/my-attendance/salary" element={<Navigate to="/my-attendance/calendar" replace />} />

      <Route path="/attendance-manager" element={<Navigate to="/attendance-manager/overview" replace />} />
      <Route path="/attendance-manager/overview" element={<AttendanceManager />} />
      <Route path="/attendance-manager/daily" element={<AttendanceManager />} />
      <Route path="/attendance-manager/calendar" element={<AttendanceManager />} />
      <Route path="/attendance-manager/leave-requests" element={<AttendanceManager />} />
      <Route path="/attendance-manager/shifts" element={<AttendanceManager />} />
      <Route path="/attendance-manager/reports" element={<AttendanceManager />} />
      <Route path="/attendance-manager/rules" element={<AttendanceManager />} />

      <Route path="/attendance-manager/approvals" element={<Navigate to="/attendance-manager/leave-requests" replace />} />
      <Route path="/attendance-manager/team-review" element={<Navigate to="/attendance-manager/daily" replace />} />
      <Route path="/attendance-manager/team-review/:staffId/:date" element={<StaffAttendanceDetails />} />
      <Route path="/attendance-manager/master-records" element={<Navigate to="/attendance-manager/reports" replace />} />
      <Route path="/attendance-manager/leave-types" element={<Navigate to="/attendance-manager/leave-requests" replace />} />
      <Route path="/attendance-manager/holidays" element={<Navigate to="/attendance-manager/calendar" replace />} />

      <Route path="/staff-management" element={<Navigate to="/staff-management/overview" replace />} />
      <Route path="/staff-management/overview" element={<StaffManagement />} />
      <Route path="/staff-management/staff" element={<StaffManagement />} />
      <Route path="/staff-management/staff/:staffId" element={<StaffManagement />} />
      <Route path="/staff-management/add" element={<StaffManagement />} />
      <Route path="/staff-management/roles" element={<StaffManagement />} />
      <Route path="/staff-management/teams" element={<StaffManagement />} />
      <Route path="/staff-management/shifts" element={<StaffManagement />} />
      <Route path="/staff-management/performance" element={<StaffManagement />} />
      <Route path="/staff-management/documents" element={<StaffManagement />} />
      <Route path="/staff-management/reports" element={<StaffManagement />} />
      <Route path="/staff-management/payroll" element={<Navigate to="/payroll/daily-wages" replace />} />
      <Route path="/payroll" element={<Navigate to="/payroll/daily-wages" replace />} />
      <Route path="/payroll/daily-wages" element={<DailyWagePage mode="overview" />} />
      <Route path="/payroll/daily-wages/history" element={<DailyWagePage mode="history" />} />
      <Route path="/payroll/daily-wages/overtime-approvals" element={<OvertimeApprovalPage />} />
      <Route path="/payroll/payments" element={<DailyWagePage mode="payments" />} />
      <Route path="/staff/:id/wages" element={<DailyWageAccountPage />} />
      <Route path="/payroll/employees" element={<Navigate to="/payroll/daily-wages" replace />} />
      <Route path="/payroll/attendance" element={<Navigate to="/payroll/daily-wages" replace />} />
      <Route path="/payroll/incentives" element={<Navigate to="/payroll/daily-wages" replace />} />
      <Route path="/payroll/overtime" element={<Navigate to="/payroll/daily-wages/overtime-approvals" replace />} />
      <Route path="/payroll/advances" element={<Navigate to="/payroll/daily-wages" replace />} />
      <Route path="/payroll/reports" element={<Navigate to="/payroll/daily-wages/history" replace />} />

      <Route path="/payroll/monthly" element={<Navigate to="/payroll/daily-wages" replace />} />
      <Route path="/payroll/approvals" element={<Navigate to="/payroll/daily-wages" replace />} />
      <Route path="/payroll/disbursal" element={<Navigate to="/payroll/daily-wages" replace />} />

      <Route path="/customers" element={<CustomerList />} />
      <Route path="/customers/overview" element={<Navigate to="/customers" replace />} />
      <Route path="/customers/all" element={<Navigate to="/customers" replace />} />
      <Route path="/customers/new" element={<AddCustomer />} />
      <Route path="/customers/add" element={<Navigate to="/customers/new" replace />} />
      <Route path="/customers/vehicles" element={<CustomerManagement section="vehicles" />} />
      <Route path="/customers/service-history" element={<Navigate to="/customers" replace />} />
      <Route path="/customers/outstanding" element={<Navigate to="/customers" replace />} />
      <Route path="/customers/reminders" element={<Navigate to="/customers" replace />} />
      <Route path="/customers/reports" element={<Navigate to="/customers" replace />} />
      <Route path="/customers/:id" element={<CustomerDetails />} />
      <Route path="/customers/:id/edit" element={<EditCustomer />} />
      <Route path="/customers/edit/:id" element={<EditCustomer />} />

      <Route path="/vehicles" element={<VehicleList />} />
      <Route path="/vehicles/new" element={<AddVehicle />} />
      <Route path="/vehicles/add" element={<Navigate to="/vehicles/new" replace />} />
      <Route path="/vehicles/:id" element={<VehicleDetails />} />
      <Route path="/vehicles/:id/edit" element={<EditVehicle />} />
      <Route path="/vehicles/:id/delete" element={<Navigate to="/vehicles" replace />} />

      <Route path="/services" element={<ServiceList />} />
      <Route path="/services/new" element={<ServiceList />} />
      <Route path="/services/:id" element={<ServiceList />} />
      <Route path="/services/:id/edit" element={<ServiceList />} />
      <Route path="/services/:id/delete" element={<ServiceList />} />

      <Route path="/jobs" element={<JobList />} />
      <Route path="/jobs/new" element={<JobCreatePage />} />
      <Route path="/jobs/outside-labour" element={<OutsideLabourPage />} />
      <Route path="/jobs/reports" element={<JobReports />} />
      <Route path="/jobs/add" element={<Navigate to="/jobs/new" replace />} />
      <Route path="/jobs/:id" element={<JobDetails />} />
      <Route path="/jobs/:id/overview" element={<JobDetails />} />
      <Route path="/jobs/:id/complaints" element={<JobDetails />} />
      <Route path="/jobs/:id/complaints/:complaintId" element={<JobComplaintDetails />} />
      <Route path="/jobs/:id/inspection" element={<JobDetails />} />
      <Route path="/jobs/:id/work" element={<JobDetails />} />
      <Route path="/jobs/:id/parts" element={<JobDetails />} />
      <Route path="/jobs/:id/estimate" element={<JobDetails />} />
      <Route path="/jobs/:id/updates" element={<JobDetails />} />
      <Route path="/jobs/:id/qc" element={<JobDetails />} />
      <Route path="/jobs/:id/invoice" element={<JobDetails />} />
      <Route path="/jobs/:id/activity" element={<JobDetails />} />
      <Route path="/jobs/:id/full-log" element={<JobDetails />} />
      <Route path="/jobs/:id/edit" element={<JobDetails />} />
      <Route path="/jobs/:id/status" element={<JobStatus />} />

      <Route path="/jobs/:id/costs" element={<JobDetails />} />
      <Route path="/jobs/:id/photos" element={<JobDetails />} />
      <Route path="/jobs/:id/history" element={<JobDetails />} />
      <Route path="/jobs/:id/*" element={<JobDetails />} />

      <Route path="/suppliers" element={<SuppliersPage />} />
      <Route path="/suppliers/credits" element={<LegacySupplierRouteRedirect />} />
      <Route path="/suppliers/purchases" element={<SuppliersPage section="purchases" />} />
      <Route path="/suppliers/payments" element={<LegacySupplierRouteRedirect />} />
      <Route path="/suppliers/:id" element={<SuppliersPage />} />
      <Route path="/stock" element={<StockEasyPage />} />
      <Route path="/stock/suppliers" element={<LegacySupplierRouteRedirect />} />
      <Route path="/stock/*" element={<Navigate to="/stock" replace />} />

      <Route path="/invoices" element={<InvoiceList />} />
      <Route path="/invoices/e-way-bills" element={<EWayBillPage />} />
      <Route path="/invoices/e-way-bills/new" element={<EWayBillPage />} />
      <Route path="/invoices/e-way-bills/:ewbId" element={<EWayBillPage />} />
      <Route path="/invoices/e-way-bills/:ewbId/edit" element={<EWayBillPage />} />
      <Route path="/invoices/e-way-bills/:ewbId/delete" element={<EWayBillPage />} />
      <Route path="/invoices/new" element={<InvoiceList />} />
      <Route path="/invoices/create" element={<Navigate to="/invoices/new" replace />} />
      <Route path="/invoices/:id" element={<InvoiceList />} />
      <Route path="/invoices/:id/edit" element={<InvoiceList />} />
      <Route path="/invoices/:id/delete" element={<InvoiceList />} />
      <Route path="/quotations" element={<Navigate to="/invoices?kind=estimate" replace />} />
      <Route path="/quotations/new" element={<Navigate to="/invoices/new?kind=estimate" replace />} />

      {/* Existing external bookmarks keep working; there is only one Finance UI. */}
      <Route path="/payments" element={<LegacyFinanceRedirect />} />
      <Route path="/payments/:id" element={<LegacyFinanceRedirect />} />
      <Route path="/payments/*" element={<LegacyFinanceRedirect />} />
      <Route path="/expenses" element={<LegacyFinanceRedirect />} />
      <Route path="/expenses/:id" element={<LegacyFinanceRedirect />} />
      <Route path="/expenses/*" element={<LegacyFinanceRedirect />} />

      <Route path="/finance" element={<FinanceWorkspace />}>
        <Route index element={<FinanceDashboard />} />
        <Route path="/finance/payments" element={<PaymentList />} />
        <Route path="/finance/payments/new" element={<PaymentList />} />
        <Route path="/finance/payments/:id" element={<PaymentList />} />
        <Route path="/finance/payments/:id/edit" element={<PaymentList />} />
        <Route path="/finance/payments/:id/delete" element={<PaymentList />} />
        <Route path="/finance/expenses" element={<ExpenseList />} />
        <Route path="/finance/expenses/new" element={<ExpenseList />} />
        <Route path="/finance/expenses/:id" element={<ExpenseList />} />
        <Route path="/finance/expenses/:id/edit" element={<ExpenseList />} />
        <Route path="/finance/expenses/:id/delete" element={<ExpenseList />} />
        <Route path="/finance/accounting" element={<AccountingWorkspace />} />
        <Route path="/finance/accounts" element={<AccountsPage />} />
        <Route path="/finance/accounts/new" element={<AccountsPage />} />
        <Route path="/finance/accounts/:id" element={<AccountsPage />} />
        <Route path="/finance/transfers" element={<TransfersPage />} />
        <Route path="/finance/transfers/new" element={<TransfersPage />} />
        <Route path="/finance/transactions" element={<TransactionsPage />} />
      </Route>

      <Route path="/gstr" element={<GSTRDashboard />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/reports/new" element={<Reports />} />
      <Route path="/reports/:id" element={<Reports />} />
      <Route path="/reports/:id/edit" element={<Reports />} />
      <Route path="/reports/:id/delete" element={<Reports />} />

      <Route path="/notifications" element={<Notifications />} />
      <Route path="/notifications/new" element={<Notifications />} />
      <Route path="/notifications/:id" element={<Notifications />} />
      <Route path="/notifications/:id/edit" element={<Notifications />} />
      <Route path="/notifications/:id/delete" element={<Notifications />} />

      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/whatsapp" element={<WhatsAppSettingsPage />} />
      <Route path="/settings/customer-website" element={<CustomerWebsiteSettingsPage />} />
      <Route path="/settings/customer-website/domains" element={<Navigate to="/settings/customer-website" replace />} />
      <Route path="/account" element={<CreditWorkspace section="overview" />} />
      <Route path="/account/credits/buy" element={<CreditWorkspace section="buy" />} />
      <Route path="/account/credits" element={<CreditWorkspace section="overview" />} />
      <Route path="/account/credits/features" element={<Navigate to="/account/credits" replace />} />
      <Route path="/account/credits/logs" element={<CreditWorkspace section="logs" />} />
      <Route path="/account/company" element={<OwnerCompanyProfile />} />
      <Route path="/onboarding" element={<OwnerOnboarding />} />
      <Route path="/account/billing" element={<Navigate to="/account" replace />} />
      <Route path="/account/plans" element={<Navigate to="/account/credits" replace />} />
      <Route path="/account/storage" element={<SaaSAccount section="storage" />} />
      <Route path="/account/storage/history" element={<StorageHistory />} />
      <Route path="/account/storage/history/:date" element={<StorageDayDetails />} />
      <Route path="/account/templates" element={<DocumentTemplates />} />
      <Route path="/account/security" element={<AccountSecurity />} />
    </Route>

    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);
