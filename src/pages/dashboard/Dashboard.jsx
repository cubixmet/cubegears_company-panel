import { useEffect, useRef, useState } from "react";
import { useNavigate } from 'react-router-dom';
import {
  DashboardBottomGrid,
  DashboardStats,
  QuickActionsPanel,
  ServiceOperations,
} from '../../components/dashboard';
import { DashboardAttendance } from '../../components/dashboard/DashboardAttendance';
import { Loader } from '../../components/common/Loader';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { getDashboardData } from '../../services/dashboard.service';
import '../../styles/dashboard.css';
import '../../styles/dashboard-readable.css';
import '../../styles/dashboard-simple.css';
import '../../styles/dashboard-booking-cards.css';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = useFeatureAccess();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latestDashboardRequest = useRef(0);
  const [filterPeriod, setFilterPeriod] = useState('today');
  const [filterBranch, setFilterBranch] = useState('main');

  const fetchDashboard = async () => {
    const requestId = ++latestDashboardRequest.current;
    setLoading(true);
    setError('');
    try {
      const response = await getDashboardData({
        period: filterPeriod,
        branch: filterBranch,
      });
      if (!response || typeof response !== 'object') {
        throw new Error('Dashboard data is unavailable from the server.');
      }
      if (requestId === latestDashboardRequest.current) setData(response);
    } catch (cause) {
      if (requestId === latestDashboardRequest.current) {
        setData(null);
        setError(cause?.message || 'Unable to load dashboard data.');
      }
    } finally {
      if (requestId === latestDashboardRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    // Dashboard is a free module. Django strips data from paid modules the
    // user's role has not purchased, and widgets have their own can() checks.
    fetchDashboard();
    return () => { latestDashboardRequest.current += 1; };
  }, [filterPeriod, filterBranch]);

  if (loading) return <Loader />;
  if (error || !data) {
    return (
      <section className="dashboard-page dashboard-load-failure" role="alert">
        <h2>Unable to load dashboard</h2>
        <p>{error || 'The server returned no dashboard data.'}</p>
        <button type="button" onClick={fetchDashboard}>Retry Dashboard</button>
      </section>
    );
  }

  return (
    <div className="dashboard-page">
      <section className="dashboard-top-actions" aria-label="Dashboard Quick Actions">
        <QuickActionsPanel onNavigate={navigate} />
      </section>
      {can('attendance.self') && <DashboardAttendance key={user?.id} />}
      <DashboardStats data={data} />

      {can('jobs.view') && <ServiceOperations
        data={data}
        user={user}
        filterPeriod={filterPeriod}
        setFilterPeriod={setFilterPeriod}
        filterBranch={filterBranch}
        setFilterBranch={setFilterBranch}
        onNavigate={navigate}
      />}

      <DashboardBottomGrid data={data} />
    </div>
  );
};
