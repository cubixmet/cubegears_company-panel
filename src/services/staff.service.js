import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';
import { mockStaffList } from '../mock/staff.mock';
import { enrichWorkshopStaff } from '../mock/staffManagement.mock';

const employeeLabel = (staff = {}) => {
  const source =
    staff.displayEmployeeNo ||
    staff.employeeId ||
    staff.employee_code ||
    '';
  const match = String(source).match(/(\d+)(?!.*\d)/);
  return match ? `EMP${Number(match[1])}` : 'EMP';
};


const normalizeStaff = (staff = {}) => ({
  ...staff,
  id: staff.id,
  employeeId: staff.employeeId || staff.employee_code || '',
  displayEmployeeNo: employeeLabel(staff),
  name: staff.name || '',
  branch: staff.branchName || staff.branch?.name || staff.branch || '',
  role: staff.role || staff.role_name || '',
  roleId: staff.assignedRoleId || staff.roleId || '',
  department:
    staff.department ||
    staff.department_name ||
    staff.teamName ||
    staff.team?.name ||
    '',
  teamId: staff.teamId || staff.team?.id || '',
  teamName: staff.teamName || staff.team?.name || '',
  shift:
    staff.shift ||
    staff.shift_label ||
    staff.shiftName ||
    staff.shiftDetails?.name ||
    '',
  shiftId: staff.shiftId || staff.shiftDetails?.id || '',
  joiningDate: staff.joiningDate || staff.joining_date || '',
  employmentStatus: staff.employmentStatus || staff.status || 'Active',
  emergencyContact: staff.emergencyContact || staff.emergency_contact || '',
  accountStatus: staff.accountStatus || 'Active',
  loginStatus: staff.loginStatus || 'Not Invited',
});

export const staffService = {
  getStaff: async ({ liveOnly = false } = {}) => {
    if (liveOnly || !USE_MOCK_API) {
      const rows = await apiClient.get('/employees');
      const list = Array.isArray(rows) ? rows : rows?.results || [];
      return list.map(normalizeStaff);
    }
    return new Promise((resolve) => {
      setTimeout(
        () => resolve(mockStaffList.map((staff) => normalizeStaff(enrichWorkshopStaff(staff)))),
        150,
      );
    });
  },

  getStaffById: async (id) => {
    if (!USE_MOCK_API) {
      return normalizeStaff(await apiClient.get(`/employees/${id}`));
    }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const found = mockStaffList.find((staff) => staff.id === id);
        if (found) resolve(normalizeStaff(enrichWorkshopStaff(found)));
        else reject(new Error('Staff member not found'));
      }, 150);
    });
  },

  getMyStaff: async () => {
    if (!USE_MOCK_API) {
      return normalizeStaff(await apiClient.get('/employees/me'));
    }

    const authUser = (() => {
      try {
        return JSON.parse(localStorage.getItem('auth_user') || '{}');
      } catch {
        return {};
      }
    })();

    const id = authUser.employeeProfileId || mockStaffList[0]?.id;
    return staffService.getStaffById(id);
  },

  getActivities: async (staffId) => {
    if (!USE_MOCK_API) {
      const rows = await apiClient.get('/employees/activities', {
        params: { employee: staffId },
      });
      return Array.isArray(rows) ? rows : rows?.results || [];
    }

    const staff = mockStaffList.find((item) => item.id === staffId);
    return (staff?.activityHistory || []).map((item) => ({
      ...item,
      actorName: item.actor,
      details:
        item.details ||
        [item.oldValue, item.newValue].filter(Boolean).join(' → '),
      created_at: item.created_at || item.timestamp,
    }));
  },

  createStaff: async (staffData) => {
    if (!USE_MOCK_API) {
      const payload = {
        name: staffData.name || '',
        phone: staffData.phone || '',
        loginAccessEnabled: Boolean(staffData.loginAccessEnabled),
        whatsappConsent: Boolean(staffData.whatsappConsent),
        whatsappConsentSource: staffData.whatsappConsentSource || '',
        designation: staffData.designation || '',
        role: staffData.role || '',
        ...(staffData.roleId ? {roleId:staffData.roleId} : {}),
        department: staffData.department || '',
        employmentStatus: staffData.employmentStatus || 'Active',
        teamId: staffData.teamId || null,
        shiftId: staffData.shiftId || null,
        branchId: staffData.branchId || null,
        ...(staffData.loginAccessEnabled && Array.isArray(staffData.allowedBranchIds)
          ? { allowedBranchIds: staffData.allowedBranchIds } : {}),
      };
      const created = await apiClient.post('/employees', payload);

      const employee = normalizeStaff(created);
      if (staffData.setSalaryNow && staffData.salarySetup?.dailyWageRate) {
        try {
          const { dailyWageService } = await import('./dailyWage.service');
          await dailyWageService.addRate(created.id, {
            rate: String(staffData.salarySetup.dailyWageRate),
            effectiveFrom: staffData.salarySetup.effectiveDate,
            reason: 'Initial daily wage rate on staff creation',
          });
        } catch (error) {
          // Employee creation succeeded: never report it as a failed create,
          // otherwise retrying would create a duplicate staff member.
          return {
            ...employee,
            wageSetupError: error?.message || 'Daily wage rate was not saved. Configure it in the Wage Account.',
          };
        }
      }
      return normalizeStaff(created);
    }

    return new Promise(async (resolve) => {
      setTimeout(async () => {
        const existingNumbers = mockStaffList
          .map((item) => Number(String(item.id || '').match(/(\d+)$/)?.[1] || 0));
        const nextNumber = Math.max(0, ...existingNumbers) + 1;
        const newId = `EMP-${String(nextNumber).padStart(4, '0')}`;
        const newStaff = enrichWorkshopStaff({
          ...staffData,
          id: newId,
          employeeId: newId,
          displayEmployeeNo: `EMP${nextNumber}`,
          employmentStatus: staffData.employmentStatus || 'Active',
          accountStatus: 'Active',
          loginStatus: 'Not Invited',
          lastLogin: '-',
          documents: [],
          activityHistory: [{
            id: `ACT-${Date.now()}`,
            action: 'Staff Created',
            oldValue: '-',
            newValue: 'Active',
            actor: 'Current Admin',
            timestamp: new Date().toLocaleString(),
          }],
        });
        mockStaffList.unshift(newStaff);

        // Mock staff records never create legacy monthly compensation plans.
        resolve(normalizeStaff(newStaff));
      }, 200);
    });
  },

  updateStaff: async (id, staffData) => {
    if (!USE_MOCK_API) {
      const allowedKeys = [
        'name',
        'phone',
        'email',
        'designation',
        'role',
        'roleId',
        'department',
        'joiningDate',
        'employmentStatus',
        // Explicit manual WhatsApp consent can be recorded from Staff Profile.
        'whatsappConsent',
        'whatsappConsentSource',
        'emergencyContact',
        'address',
        'notes',
        'teamId',
        'shiftId',
        'branchId',
        'allowedBranchIds',
      ];
      const payload = Object.fromEntries(
        allowedKeys
          .filter((key) => Object.prototype.hasOwnProperty.call(staffData, key))
          .map((key) => [
            key,
            ['teamId', 'shiftId', 'branchId'].includes(key)
              ? staffData[key] || null
              : staffData[key],
          ]),
      );
      return normalizeStaff(await apiClient.patch(`/employees/${id}`, payload));
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const idx = mockStaffList.findIndex((staff) => staff.id === id);
        if (idx !== -1) {
          const previous = mockStaffList[idx];
          mockStaffList[idx] = {
            ...previous,
            ...staffData,
          };
          mockStaffList[idx].activityHistory =
            mockStaffList[idx].activityHistory || [];
          mockStaffList[idx].activityHistory.unshift({
            id: `ACT-${Date.now()}`,
            action: 'Profile Updated',
            oldValue: 'Previous Data',
            newValue: 'Updated Details',
            actor: 'Current Admin',
            timestamp: new Date().toLocaleString(),
          });
          resolve(normalizeStaff(enrichWorkshopStaff(mockStaffList[idx])));
        } else resolve(null);
      }, 200);
    });
  },

  toggleAccountStatus: async (id) => {
    if (!USE_MOCK_API) {
      return normalizeStaff(
        await apiClient.patch(`/employees/${id}/toggle-account`),
      );
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        const idx = mockStaffList.findIndex((staff) => staff.id === id);
        if (idx !== -1) {
          const current = mockStaffList[idx].accountStatus;
          const nextStatus = current === 'Active' ? 'Inactive' : 'Active';
          mockStaffList[idx].accountStatus = nextStatus;
          mockStaffList[idx].employmentStatus = nextStatus;
          mockStaffList[idx].loginStatus = nextStatus;
          resolve(normalizeStaff(mockStaffList[idx]));
        } else resolve(null);
      }, 150);
    });
  },

  setLoginAccess: async (id, enabled) => {
    if (USE_MOCK_API) throw new Error('Staff login access can only be changed using the real Django backend.');
    return normalizeStaff(await apiClient.patch(`/employees/${id}/login-access`, { enabled }));
  },

  sendLoginInvite: async (id, options = {}) => {
    if (USE_MOCK_API) throw new Error('One-time setup links require the real Django backend.');
    return apiClient.post(`/employees/${id}/invite`, { ...options, manualOnly: true });
  },

};
