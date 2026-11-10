import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { StaffManagementHeader, StaffManagementTabs } from '../../components/staff-management';
import { Staff } from '../staff-management/Staff';
import { StaffProfile } from '../staff-management/staff/StaffProfile';
import { StaffAddPage } from '../staff-management/StaffAddPage';
import { UserRoles } from '../staff-management/UserRoles';
import { WorkshopStaffSection } from '../staff-management/WorkshopStaffSection';
import { SimpleStaffOverview } from '../staff-management/SimpleStaffOverview';
import '../../styles/staff-management.css';
import '../../styles/staff-simple-overview.css';
import '../../styles/staff-management-readable.css';
import '../../styles/staff-management-compact.css';

const resolveSection = (pathname) => {
  if (pathname.endsWith('/overview')) return 'overview';
  if (/^\/staff-management\/staff\/[^/]+$/.test(pathname)) return 'profile';
  if (pathname.endsWith('/staff')) return 'staff';
  if (pathname.endsWith('/add')) return 'add';
  if (pathname.endsWith('/roles')) return 'roles';
  if (pathname.endsWith('/teams')) return 'teams';
  if (pathname.endsWith('/shifts')) return 'shifts';
  if (pathname.endsWith('/performance')) return 'performance';
  if (pathname.endsWith('/documents')) return 'documents';
  if (pathname.endsWith('/reports')) return 'reports';
  return 'overview';
};

export const StaffManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { staffId } = useParams();
  const activeSection = resolveSection(location.pathname);

  useEffect(() => {
    if (
      location.pathname === '/staff-management' ||
      location.pathname === '/staff' ||
      location.pathname === '/staff/'
    ) {
      navigate('/staff-management/overview', { replace: true });
    }
  }, [location.pathname, navigate]);

  const renderSection = () => {
    if (activeSection === 'profile') {
      return (
        <StaffProfile
          staffId={staffId}
          onBack={() => navigate('/staff-management/staff')}
        />
      );
    }
    if (activeSection === 'overview') return <SimpleStaffOverview />;
    if (activeSection === 'staff') return <Staff />;
    if (activeSection === 'add') return <StaffAddPage />;
    if (activeSection === 'roles') return <UserRoles />;
    return <WorkshopStaffSection section={activeSection} />;
  };

  return (
    <div className="staff-management-page cg-staff-management">
      {activeSection === 'overview' ? (
        <header className="staff-overview-page-heading">
          <h1>Staff Overview</h1>
          <p>Current staff records from your workshop database.</p>
        </header>
      ) : activeSection === 'profile' ? null : <StaffManagementHeader />}
      {activeSection !== 'profile' && <StaffManagementTabs />}

      <main className="staff-management-content">
        {renderSection()}
      </main>
    </div>
  );
};
