import { useEffect, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import {
  VehicleDirectoryPanel,
  VehicleOverviewStats,
  VehicleSearchToolbar,
  VehiclesHeader,
} from '../../components/vehicles';
import { OPEN_JOB_STATUSES, dateDiff } from '../../components/vehicles/vehicles.utils';
import { customerService } from '../../services/customer.service';
import { jobService } from '../../services/job.service';
import { vehicleService } from '../../services/vehicle.service';
import '../../styles/vehicle-management.css';
import '../../styles/vehicle-polish.css';
import '../../styles/vehicle-readable.css';
import '../../styles/vehicle-compact-cleanup.css';
import '../../styles/vehicle-directory-refined.css';

export const VehicleList = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        // Fetch jobs once and index by registration instead of repeating the
        // same full jobs request for every vehicle in the directory.
        const [vehicleRows, customers, jobs] = await Promise.all([
          vehicleService.getVehicles(),
          customerService.getCustomers(),
          jobService.getJobs(),
        ]);

        const normalizeRegistration = (value) =>
          String(value || '').replace(/\s+/g, '').toLowerCase();
        const customerMap = new Map(
          (Array.isArray(customers) ? customers : []).map((customer) => [String(customer.id), customer]),
        );
        const jobsByRegistration = new Map();

        (Array.isArray(jobs) ? jobs : []).forEach((job) => {
          const key = normalizeRegistration(job.vehicleReg);
          if (!key) return;
          if (!jobsByRegistration.has(key)) jobsByRegistration.set(key, []);
          jobsByRegistration.get(key).push(job);
        });
        jobsByRegistration.forEach((items) =>
          items.sort((a, b) => String(b.createdDate || '').localeCompare(String(a.createdDate || ''))),
        );

        const enriched = (Array.isArray(vehicleRows) ? vehicleRows : []).map((vehicle) => {
          const customer = customerMap.get(String(vehicle.customerId));
          const history = jobsByRegistration.get(normalizeRegistration(vehicle.registration)) || [];
          const openJob = history.find((job) => OPEN_JOB_STATUSES.has(job.status)) || null;

          return {
            ...vehicle,
            customer,
            customerName: customer?.name || vehicle.customerName || 'Unknown Customer',
            customerPhone: customer?.phone || vehicle.customerPhone || '',
            history,
            openJob,
            latestJob: history[0] || null,
          };
        });

        if (active) setVehicles(enriched);
      } catch (loadError) {
        if (active) {
          setVehicles([]);
          setError(loadError?.message || 'Unable to load vehicles. Please try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [reloadKey]);

  const filteredVehicles = useMemo(() => {
    const search = query.trim().toLowerCase().replace(/\s+/g, '');

    return vehicles.filter((vehicle) => {
      if (statusFilter === 'open-job' && !vehicle.openJob) return false;
      if (statusFilter === 'active' && ['inactive', 'archived'].includes(String(vehicle.status || '').toLowerCase())) return false;
      if (statusFilter === 'inactive' && !['inactive', 'archived'].includes(String(vehicle.status || '').toLowerCase())) return false;
      if (!search) return true;
      return [
        vehicle.registration,
        vehicle.vin,
        vehicle.make,
        vehicle.model,
        vehicle.customerName,
        vehicle.customerPhone,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .replace(/\s+/g, '')
          .includes(search),
      );
    });
  }, [vehicles, query, statusFilter]);

  const metrics = useMemo(() => {
    const openJobIds = new Set(vehicles.flatMap((vehicle) =>
      (vehicle.history || []).filter((job) => OPEN_JOB_STATUSES.has(job.status))
        .map((job) => String(job.id)),
    ));
    const serviceDue = vehicles.filter((vehicle) => {
      const days = dateDiff(vehicle.nextServiceDue);
      return days !== null && days <= 30;
    }).length;

    const insuranceDue = vehicles.filter((vehicle) => {
      const days = dateDiff(vehicle.insuranceExpiry);
      return days !== null && days <= 30;
    }).length;

    return {
      total: vehicles.length,
      active: vehicles.filter((vehicle) => vehicle.status !== 'Inactive').length,
      openJobs: openJobIds.size,
      serviceDue,
      insuranceDue,
    };
  }, [vehicles]);

  return (
    <div className="vehicle-management-page cg-vehicles vehicle-dashboard cg-vehicle-directory-refined">
      <VehiclesHeader onAddVehicle={() => navigate('/vehicles/new')} />

      {loading ? (
        <div className="vehicle-dashboard-loading" role="status">Loading vehicles…</div>
      ) : error ? (
        <div className="vehicle-dashboard-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
        </div>
      ) : (
        <>
          <VehicleOverviewStats metrics={metrics} />

          <VehicleSearchToolbar
            query={query}
            onQueryChange={setQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            resultCount={filteredVehicles.length}
            onReset={() => { setQuery(''); setStatusFilter('all'); }}
          />

          <VehicleDirectoryPanel
            vehicles={filteredVehicles}
            onNavigate={navigate}
            hasFilters={Boolean(query.trim() || statusFilter !== 'all')}
            onReset={() => { setQuery(''); setStatusFilter('all'); }}
          />
        </>
      )}
    </div>
  );
};

export const AddVehicle = VehicleList;

export default VehicleList;
