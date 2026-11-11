import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';
import {
  workshopDepartments,
  workshopShifts,
  staffWorkshopProfiles,
} from '../mock/staffManagement.mock';
import { mockStaffList } from '../mock/staff.mock';

const clone = (value) => JSON.parse(JSON.stringify(value));

const collectStaffSkills = (rows = []) => {
  const map = new Map();

  rows.forEach((staff) => {
    (Array.isArray(staff?.skills) ? staff.skills : []).forEach((skill) => {
      const normalized =
        typeof skill === 'string'
          ? { id: skill, name: skill }
          : {
              id: skill?.id || skill?.name || skill?.label,
              name: skill?.name || skill?.label || String(skill?.id || ''),
            };

      if (normalized.name) {
        map.set(String(normalized.id || normalized.name), normalized);
      }
    });
  });

  return [...map.values()];
};

const staffUsingShift = (shiftName) =>
  mockStaffList.filter((staff) =>
    String(staff.shift || '').toLowerCase().includes(
      String(shiftName || '').replace(' Shift', '').toLowerCase(),
    ),
  );

const touchActivity = (staff, action, oldValue, newValue) => {
  staff.activityHistory = Array.isArray(staff.activityHistory)
    ? staff.activityHistory
    : [];
  staff.activityHistory.unshift({
    id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    oldValue,
    newValue,
    actor: 'Current Admin',
    timestamp: new Date().toLocaleString(),
  });
};

const mockService = {
  getTeams: async () =>
    new Promise((resolve) => {
      setTimeout(
        () => resolve(workshopDepartments.map((team) => ({ ...team }))),
        120,
      );
    }),

  createTeam: async (teamData) =>
    new Promise((resolve) => {
      setTimeout(() => {
        const team = {
          id: `DEP-${Date.now()}`,
          name: teamData.name.trim(),
          lead: teamData.leadName || teamData.lead || 'Not Assigned',
          branchId: teamData.branchId || '',
          branch: teamData.branchName || teamData.branch || 'All Branches',
          branchName: teamData.branchName || teamData.branch || 'All Branches',
          description: teamData.description?.trim() || '',
          icon: 'Users',
        };
        workshopDepartments.push(team);
        resolve({ ...team });
      }, 180);
    }),

  assignStaffToTeam: async (teamId, staffIds = []) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const team = workshopDepartments.find((item) => item.id === teamId);
        if (!team) return reject(new Error('Team not found.'));

        const assigned = [];
        staffIds.forEach((staffId) => {
          const staff = mockStaffList.find((item) => item.id === staffId);
          if (!staff) return;
          const oldValue =
            staff.department ||
            staffWorkshopProfiles[staff.id]?.department ||
            'Unassigned';
          staff.department = team.name;
          touchActivity(staff, 'Team Assigned', oldValue, team.name);
          assigned.push(staff.id);
        });

        resolve({
          ...team,
          assignedStaffIds: mockStaffList
            .filter(
              (staff) =>
                (staff.department ||
                  staffWorkshopProfiles[staff.id]?.department) === team.name,
            )
            .map((staff) => staff.id),
          addedStaffIds: assigned,
        });
      }, 180);
    }),

  getSkills: async () =>
    new Promise((resolve) => {
      setTimeout(() => resolve(collectStaffSkills(mockStaffList)), 100);
    }),

  getShifts: async () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          workshopShifts.map((shift) => ({
            ...shift,
            assignedStaffIds: staffUsingShift(shift.name).map(
              (staff) => staff.id,
            ),
          })),
        );
      }, 120);
    }),

  createShift: async (shiftData) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const name = shiftData.name?.trim();
        if (!name) return reject(new Error('Shift name is required.'));
        if (
          workshopShifts.some(
            (shift) => shift.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          return reject(new Error('A shift with this name already exists.'));
        }

        const shift = {
          id: `SHIFT-${Date.now()}`,
          name,
          time: shiftData.time?.trim() || '09:00 AM - 06:00 PM',
          weeklyOff: shiftData.weeklyOff || 'Sunday',
          branchId: shiftData.branchId || '',
          branch: shiftData.branchName || shiftData.branch || 'All Branches',
          branchName:
            shiftData.branchName || shiftData.branch || 'All Branches',
        };
        workshopShifts.push(shift);

        const assignedIds = new Set(shiftData.assignedStaffIds || []);
        mockStaffList.forEach((staff) => {
          if (assignedIds.has(staff.id)) {
            const oldValue = staff.shift || '';
            staff.shift = `${shift.name} (${shift.time})`;
            touchActivity(staff, 'Shift Assigned', oldValue, staff.shift);
          }
        });

        resolve({ ...shift, assignedStaffIds: [...assignedIds] });
      }, 180);
    }),

  updateShift: async (id, shiftData) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = workshopShifts.findIndex((shift) => shift.id === id);
        if (index === -1) return reject(new Error('Shift not found.'));

        const previous = { ...workshopShifts[index] };
        const name = shiftData.name?.trim() || previous.name;
        const duplicate = workshopShifts.some(
          (shift) =>
            shift.id !== id &&
            shift.name.toLowerCase() === name.toLowerCase(),
        );
        if (duplicate) {
          return reject(new Error('A shift with this name already exists.'));
        }

        const next = {
          ...previous,
          name,
          time: shiftData.time?.trim() || previous.time,
          weeklyOff: shiftData.weeklyOff || previous.weeklyOff,
          branchId: shiftData.branchId ?? previous.branchId ?? '',
          branch:
            shiftData.branchName ||
            shiftData.branch ||
            previous.branch ||
            'All Branches',
          branchName:
            shiftData.branchName ||
            shiftData.branch ||
            previous.branchName ||
            'All Branches',
        };
        workshopShifts[index] = next;

        const assignedIds = new Set(shiftData.assignedStaffIds || []);
        mockStaffList.forEach((staff) => {
          const wasAssigned = String(staff.shift || '')
            .toLowerCase()
            .includes(previous.name.replace(' Shift', '').toLowerCase());
          const shouldAssign = assignedIds.has(staff.id);

          if (shouldAssign) {
            const oldValue = staff.shift || '';
            staff.shift = `${next.name} (${next.time})`;
            if (oldValue !== staff.shift) {
              touchActivity(staff, 'Shift Updated', oldValue, staff.shift);
            }
          } else if (wasAssigned && previous.id !== 'SHIFT-GENERAL') {
            const oldValue = staff.shift || '';
            staff.shift = 'General Shift (09:00 AM - 06:00 PM)';
            touchActivity(
              staff,
              'Shift Reassigned',
              oldValue,
              staff.shift,
            );
          }
        });

        resolve({ ...next, assignedStaffIds: [...assignedIds] });
      }, 180);
    }),

  deleteShift: async (id) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = workshopShifts.findIndex((shift) => shift.id === id);
        if (index === -1) return reject(new Error('Shift not found.'));
        if (workshopShifts[index].id === 'SHIFT-GENERAL') {
          return reject(
            new Error('General Shift is protected and cannot be deleted.'),
          );
        }

        const [removed] = workshopShifts.splice(index, 1);
        mockStaffList.forEach((staff) => {
          if (
            String(staff.shift || '')
              .toLowerCase()
              .includes(removed.name.replace(' Shift', '').toLowerCase())
          ) {
            const oldValue = staff.shift || '';
            staff.shift = 'General Shift (09:00 AM - 06:00 PM)';
            touchActivity(
              staff,
              'Shift Reassigned',
              oldValue,
              staff.shift,
            );
          }
        });
        resolve({ ...removed });
      }, 150);
    }),

  getDocuments: async () =>
    new Promise((resolve) => {
      setTimeout(() => {
        const documents = mockStaffList.flatMap((staff) =>
          (staff.documents || []).map((document) => ({
            ...clone(document),
            staffId: staff.id,
            staffName: staff.name,
            designation: staff.designation,
          })),
        );
        resolve(documents);
      }, 120);
    }),

  createDocument: async (staffId, documentData) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const staff = mockStaffList.find((item) => item.id === staffId);
        if (!staff) return reject(new Error('Staff member not found.'));

        staff.documents = Array.isArray(staff.documents)
          ? staff.documents
          : [];
        const document = {
          id: `DOC-${Date.now()}`,
          name:
            documentData.name?.trim() ||
            documentData.fileName ||
            'Document',
          type: documentData.type || 'Document',
          uploadedDate:
            documentData.uploadedDate ||
            new Date().toISOString().split('T')[0],
          uploadedBy: documentData.uploadedBy || 'Current Admin',
          expiryDate: documentData.expiryDate || '',
          status: documentData.status || 'Valid',
          fileName: documentData.fileName || '',
          fileUrl: documentData.fileUrl || '',
        };
        staff.documents.push(document);
        touchActivity(staff, 'Document Added', '-', document.name);
        resolve({
          ...document,
          staffId: staff.id,
          staffName: staff.name,
          designation: staff.designation,
        });
      }, 180);
    }),

  updateDocument: async (staffId, documentId, documentData) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const staff = mockStaffList.find((item) => item.id === staffId);
        if (!staff) return reject(new Error('Staff member not found.'));
        const index = (staff.documents || []).findIndex(
          (document) => document.id === documentId,
        );
        if (index === -1) return reject(new Error('Document not found.'));

        const previous = staff.documents[index];
        const next = {
          ...previous,
          name: documentData.name?.trim() || previous.name,
          type: documentData.type || previous.type,
          uploadedDate: documentData.uploadedDate || previous.uploadedDate,
          uploadedBy: documentData.uploadedBy || previous.uploadedBy,
          expiryDate:
            documentData.expiryDate ?? previous.expiryDate ?? '',
          status: documentData.status || previous.status || 'Valid',
          fileName:
            documentData.fileName || previous.fileName || '',
          fileUrl: documentData.fileUrl || previous.fileUrl || '',
        };
        staff.documents[index] = next;
        touchActivity(
          staff,
          'Document Updated',
          previous.name,
          next.name,
        );
        resolve({
          ...next,
          staffId: staff.id,
          staffName: staff.name,
          designation: staff.designation,
        });
      }, 180);
    }),

  deleteDocument: async (staffId, documentId) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const staff = mockStaffList.find((item) => item.id === staffId);
        if (!staff) return reject(new Error('Staff member not found.'));
        const index = (staff.documents || []).findIndex(
          (document) => document.id === documentId,
        );
        if (index === -1) return reject(new Error('Document not found.'));

        const [removed] = staff.documents.splice(index, 1);
        touchActivity(
          staff,
          'Document Deleted',
          removed.name,
          '-',
        );
        resolve({ ...removed });
      }, 150);
    }),
};

const parseShiftTime = (value = '') => {
  const parts = String(value).split('-').map((part) => part.trim());
  const to24 = (text, fallback) => {
    const match = String(text).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return fallback;
    let hour = Number(match[1]);
    const minute = match[2];
    const suffix = (match[3] || '').toUpperCase();
    if (suffix === 'PM' && hour < 12) hour += 12;
    if (suffix === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  };
  return {
    start_time: to24(parts[0], '09:00'),
    end_time: to24(parts[1], '18:00'),
  };
};

const realService = {
  getSkills: async () => {
    const rows = await apiClient.get('/employees');
    const list = Array.isArray(rows) ? rows : rows?.results || [];
    return collectStaffSkills(list);
  },

  getTeams: async () => {
    const rows = await apiClient.get('/employees/teams');
    const list = Array.isArray(rows) ? rows : rows?.results || [];
    return list.map((team) => ({
      ...team,
      lead:
        team.leadName ||
        (team.lead ? 'Assigned Lead' : 'Not Assigned'),
      branch: team.branchName || 'All Branches',
      branchId: team.branchId || '',
    }));
  },

  createTeam: async (teamData) =>
    apiClient.post('/employees/teams', {
      name: teamData.name,
      lead: teamData.leadUserId || teamData.lead || null,
      branchId: teamData.branchId || null,
      description: teamData.description || '',
      is_active: true,
    }),

  // One validated and atomic Django transaction, never several partial PATCHes.
  assignStaffToTeam: (teamId, staffIds = []) =>
    apiClient.post(`/employees/teams/${encodeURIComponent(teamId)}/assign`, { staffIds }),

  getShifts: async () => {
    const rows = await apiClient.get('/employees/shifts');
    const list = Array.isArray(rows) ? rows : rows?.results || [];
    const formatTime = (value = '') => {
      const parts = String(value).split(':');
      if (parts.length < 2) return value;
      const hours = Number(parts[0]);
      const minutes = parts[1];
      const suffix = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${String(hour12).padStart(2, '0')}:${minutes} ${suffix}`;
    };

    return list.map((shift) => ({
      ...shift,
      time: `${formatTime(shift.start_time)} - ${formatTime(
        shift.end_time,
      )}`,
      weeklyOff: shift.weekly_off?.[0] || 'Sunday',
      branch: shift.branchName || 'All Branches',
      branchId: shift.branchId || '',
      assignedStaffIds: shift.assignedStaffIds || [],
    }));
  },

  createShift: async (shiftData) => {
    const created = await apiClient.post('/employees/shifts', {
      name: shiftData.name,
      ...parseShiftTime(shiftData.time),
      weekly_off: shiftData.weeklyOff ? [shiftData.weeklyOff] : [],
      branchId: shiftData.branchId || null,
      is_active: true,
    });
    if (Array.isArray(shiftData.assignedStaffIds)) {
      await apiClient.post(`/employees/shifts/${created.id}/assign`, {
        staffIds: shiftData.assignedStaffIds,
      });
    }
    return created;
  },

  updateShift: async (id, shiftData) => {
    const updated = await apiClient.patch(`/employees/shifts/${id}`, {
      name: shiftData.name,
      ...parseShiftTime(shiftData.time),
      weekly_off: shiftData.weeklyOff
        ? [shiftData.weeklyOff]
        : undefined,
      branchId: shiftData.branchId || null,
    });
    if (Array.isArray(shiftData.assignedStaffIds)) {
      await apiClient.post(`/employees/shifts/${id}/assign`, {
        staffIds: shiftData.assignedStaffIds,
      });
    }
    return updated;
  },

  deleteShift: async (id) => apiClient.delete(`/employees/shifts/${id}`),

  getDocuments: async () => apiClient.get('/employees/documents'),

  createDocument: async (staffId, documentData) =>
    apiClient.post('/employees/documents', {
      employee: staffId,
      document_type:
        documentData.documentType ||
        documentData.type ||
        'Other',
      title:
        documentData.title ||
        documentData.name ||
        'Document',
      file_url: documentData.fileUrl || documentData.url || '',
      expiry_date: documentData.expiryDate || null,
      notes: documentData.notes || '',
    }),

  updateDocument: async (_staffId, documentId, documentData) =>
    apiClient.patch(`/employees/documents/${documentId}`, {
      document_type:
        documentData.documentType || documentData.type,
      title: documentData.title || documentData.name,
      file_url: documentData.fileUrl || documentData.url,
      expiry_date: documentData.expiryDate || null,
      notes: documentData.notes,
    }),

  deleteDocument: async (_staffId, documentId) =>
    apiClient.delete(`/employees/documents/${documentId}`),
};

export const staffManagementService = USE_MOCK_API
  ? mockService
  : realService;
