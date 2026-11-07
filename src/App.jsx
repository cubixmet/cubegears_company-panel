
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FeatureAccessProvider } from './context/FeatureAccessContext';
import { CompanyProvider } from './context/CompanyContext';
import { ThemeProvider } from './context/ThemeContext';
import { PayrollPeriodProvider } from './context/PayrollPeriodContext';
import { AppErrorBoundary } from './components/feedback/AppErrorBoundary';
import { BackendConnectionBanner } from './components/feedback/BackendConnectionBanner';
import { GlobalFormValidation } from './components/common/GlobalFormValidation';
import { AppDialogHost } from './components/common/AppDialogHost';
import './api/registerSaasEndpoints';
import { AppRoutes } from './routes/AppRoutes';
import './routes/saasRouteRegistration';

// Tailwind is the global UI foundation. Keep only shared tokens/reset plus
// feature styles that still contain page-specific rules.
import './styles/component-system.css';
import './styles/crud-system.css';
import './styles/settings-system.css';
import './styles/saas-account.css';
import './styles/workflow-enhancements.css';
import './styles/billing-system.css';
import './styles/job-card-simple.css';
import './styles/simple-workflow.css';
import './styles/simple-jobs.css';
import './styles/my-attendance.css';
import './styles/attendance-manager.css';
import './styles/staff-management.css';
import './styles/payroll.css';
import './styles/job-management.css';
import './styles/customer-management.css';
import './styles/jobs-dashboard-alignment.css';
import './styles/outside-labour.css';
import './styles/jobs-ops-polish.css';
import './styles/outside-labour-dashboard.css';
import './styles/form-validation.css';
import './styles/job-invoice-dashboard.css';
import './styles/job-workspace-dashboard.css';
import './styles/job-parts-ui.css';
import './styles/job-inspection-simple.css';
import './styles/job-estimate-quick.css';
import './styles/job-create-customer.css';
import './styles/job-create-alignment.css';
import './styles/job-complaint-detail.css';
import './styles/billing-ui-unified.css';
import './styles/account-workspace-unified.css';
import './styles/account-ui-polish.css';
import './styles/workspace-responsive-polish.css';
// Connection banner CSS must precede the final global typography/form layers.
import './styles/backend-connection.css';
import './styles/responsive-typography.css';
// Last shared layers: preserve regular text and a single clean search border.
import './styles/form-typography.css';
import './styles/form-controls-unified.css';
import './styles/form-errors-unified.css';
// Final regular-weight typography and responsive hierarchy over legacy page styles.
import './styles/desktop-typography.css';
// Shared accessible outlined floating labels for standard form controls.
import './styles/floating-fields.css';

export function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <BackendConnectionBanner />
        <GlobalFormValidation />
        <ThemeProvider>
          <AppDialogHost />
          <AuthProvider>
            <FeatureAccessProvider>
            <CompanyProvider>
              <PayrollPeriodProvider>
                <AppRoutes />
              </PayrollPeriodProvider>
            </CompanyProvider>
            </FeatureAccessProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;