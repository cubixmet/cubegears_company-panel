import { recordLabel } from '../../utils/recordReferences.js';
import { useEffect, useMemo, useState } from "react";
import { staffService } from '../../services/staff.service';
import { staffManagementService } from '../../services/staffManagement.service';
import { jobService } from '../../services/job.service';
import { USE_MOCK_API } from '../../api/apiConfig';
import { StaffShiftCrud } from './StaffShiftCrud';
import { StaffDocumentCrud } from './StaffDocumentCrud';
import { StaffOverview } from '../../components/staff-management/StaffOverview';
import { StaffTeamsSection } from '../../components/staff-management/StaffTeamsSection';
import { StaffPerformanceSection } from '../../components/staff-management/StaffPerformanceSection';
import { StaffReportsSection } from '../../components/staff-management/StaffReportsSection';
import {
  staffJobAssignments,
  staffPerformance,
} from '../../mock/staffManagement.mock';

const safeDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const WorkshopStaffSection = ({ section }) => {
  const [staff, setStaff] = useState([]);
  const [teams, setTeams] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      staffService.getStaff(),
      staffManagementService.getTeams(),
      jobService.getJobs()
    ])
      .then(([staffData, teamData, jobData]) => {
        setStaff(Array.isArray(staffData) ? staffData : []);
        setTeams(Array.isArray(teamData) ? teamData : []);
        setJobs(Array.isArray(jobData) ? jobData : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeStaff = useMemo(
    () => staff.filter((item) => ['Active', 'Probation', 'Notice Period'].includes(item.employmentStatus)),
    [staff]
  );

  const overview = useMemo(() => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    return {
      total: staff.length,
      active: staff.filter((item) => item.employmentStatus === 'Active').length,
      onLeave: staff.filter((item) => item.employmentStatus === 'On Leave').length,
      newJoiners: staff.filter((item) => {
        const joined = safeDate(item.joiningDate);
        return joined && joined >= oneYearAgo;
      }).length,
      inactive: staff.filter((item) =>
        ['Inactive', 'Resigned', 'Terminated', 'Suspended'].includes(item.employmentStatus)
      ).length
    };
  }, [staff]);

  const performanceRows = useMemo(
    () =>
      activeStaff.map((person) => {
        if (USE_MOCK_API) {
          return {
            person,
            metrics: staffPerformance[person.id] || staffPerformance[person.employeeId] || {
              jobsCompleted: 0,
              labourRevenue: 0,
              productiveHours: 0,
              utilization: 0,
              comebackJobs: 0,
              customerRating: 0
            }
          };
        }

        const assigned = jobs.filter(
          (job) => String(job.assignedEmployeeId || '') === String(person.id)
        );
        const completed = assigned.filter((job) => job.status === 'Delivered');
        const labourRevenue = completed.reduce(
          (sum, job) => sum + Number(job.labourTotal || job.labour_total || 0),
          0
        );
        const productiveHours = assigned.reduce((sum, job) => {
          const work = Array.isArray(job.work) ? job.work : [];
          const workHours = work.reduce(
            (hours, item) => hours + Number(item.hours || item.actualHours || 0),
            0
          );
          return sum + workHours;
        }, 0);
        const ratings = assigned
          .map((job) => Number(job.customerRating || job.customer_rating || 0))
          .filter((value) => value > 0);

        return {
          person,
          metrics: {
            jobsCompleted: completed.length,
            labourRevenue,
            productiveHours,
            utilization: productiveHours
              ? Math.min(100, Math.round((productiveHours / 160) * 100))
              : 0,
            comebackJobs: assigned.filter(
              (job) => job.isComeback || job.comeback
            ).length,
            customerRating: ratings.length
              ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
              : 0
          }
        };
      }),
    [activeStaff, jobs]
  );

  const activeAssignments = useMemo(() => {
    if (USE_MOCK_API) return staffJobAssignments;

    const progressByStatus = {
      New: 8,
      Inspection: 18,
      'Estimate Pending': 28,
      Approved: 38,
      'In Progress': 58,
      'Waiting for Parts': 55,
      QC: 78,
      'Ready for Delivery': 92,
      Delivered: 100
    };

    return jobs
      .filter((job) => !['Delivered', 'Cancelled'].includes(job.status))
      .filter((job) => job.assignedEmployeeId)
      .slice(0, 12)
      .map((job) => ({
        id: recordLabel(job.jobNumber || job.id),
        jobId: job.id,
        staffId: job.assignedEmployeeId,
        vehicle: job.vehicleReg || job.vehicleInfo || 'Vehicle',
        work:
          (Array.isArray(job.work) && job.work[0]?.description) ||
          job.notes ||
          'Workshop assignment',
        status: job.status,
        bookedHours: (Array.isArray(job.work) ? job.work : []).reduce(
          (sum, item) => sum + Number(item.hours || item.estimatedHours || 0),
          0
        ),
        progress: progressByStatus[job.status] || 0
      }));
  }, [jobs]);

  if (loading) {
    return <div className="staff-workshop-empty">Loading staff management data...</div>;
  }

  if (section === 'overview') {
    return (
      <StaffOverview
        overview={overview}
        staff={staff}
        teams={teams}
        activeStaff={activeStaff}
        assignments={activeAssignments}
      />
    );
  }

  if (section === 'teams') {
    return (
      <StaffTeamsSection
        staff={staff}
        teams={teams}
        setTeams={setTeams}
        setStaff={setStaff}
      />
    );
  }

  if (section === 'shifts') {
    return <StaffShiftCrud staff={staff} />;
  }


  if (section === 'performance') {
    return <StaffPerformanceSection rows={performanceRows} />;
  }

  if (section === 'documents') {
    return <StaffDocumentCrud staff={staff} />;
  }

  if (section === 'reports') {
    return (
      <StaffReportsSection
        staff={staff}
        performanceRows={performanceRows}
      />
    );
  }

  return <div className="staff-workshop-empty">This staff management section is not available.</div>;
};
