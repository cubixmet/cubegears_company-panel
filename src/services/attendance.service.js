import apiClient from '../api/apiClient';
import { acquireWorkshopLocation } from '../utils/attendanceGeolocation';

const dayName = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { weekday: 'long' });
};

const normalizeSession = (session = {}, fallbackId = '') => ({
  ...session,
  id: session.id || fallbackId,
  sessionNumber: Number(session.sessionNumber ?? session.session_number ?? 0) || null,
  clockIn: session.clockIn ?? session.clock_in ?? null,
  clockOut: session.clockOut ?? session.clock_out ?? null,
  workedMinutes: Number(session.workedMinutes ?? session.worked_minutes ?? 0),
  autoClosed: Boolean(session.autoClosed ?? session.auto_closed ?? false),
  source: session.source || '',
  clockInLocation: session.clockInLocation ?? session.clock_in_location ?? {},
  clockOutLocation: session.clockOutLocation ?? session.clock_out_location ?? {},
});

const normalizeAttendanceLog = (row = {}) => {
  const rawSessions = Array.isArray(row.sessions)
    ? row.sessions
    : [];

  return {
    ...row,
    dayOfWeek: row.dayOfWeek || dayName(row.date),
    shiftName: row.shiftName ?? row.shift_name ?? '',
    employeeCode: row.employeeCode ?? row.employee_code ?? '',
    totalWorkedMinutes: Number(
      row.totalWorkedMinutes ?? row.worked_minutes ?? row.workedMinutes ?? 0,
    ),
    lateMinutes: Number(row.lateMinutes ?? row.late_minutes ?? 0),
    earlyExitMinutes: Number(
      row.earlyExitMinutes ?? row.early_exit_minutes ?? 0,
    ),
    overtimeMinutes: Number(
      row.overtimeMinutes ?? row.overtime_minutes ?? 0,
    ),
    sessions: rawSessions.map((session, index) =>
      normalizeSession(
        session,
        row.id ? `${row.id}-${index + 1}` : `session-${index + 1}`,
      ),
    ),
  };
};

export const getPersonalAttendanceLogs = async (params) => {
  const rows = await apiClient.get('/my-attendance/logs', { params });
  const list = Array.isArray(rows) ? rows : rows?.results || [];
  return list.map(normalizeAttendanceLog);
};

export const getCalendarEvents = async (month, year) => {
  const rows = await apiClient.get('/my-attendance/calendar', {
    params: { month, year },
  });
  return Array.isArray(rows) ? rows : rows?.results || [];
};

const getBrowserLocation = (strict = false) =>
  new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error('Location is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () =>
        reject(
          new Error('Location permission is required for attendance.'),
        ),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: strict ? 0 : 60000,
      },
    );
  });

export const getAttendanceStatus = async () => {
  const data = await apiClient.get('/attendance/status');

  const record = data?.record
    ? {
        ...data.record,
        sessions: (data.record.sessions || []).map((session, index) =>
          normalizeSession(
            session,
            data.record.id
              ? `${data.record.id}-${index + 1}`
              : `session-${index + 1}`,
          ),
        ),
      }
    : null;

  return {
    ...data,
    record,
  };
};

export const punchAttendance = async (action, options = {}) => {
  let location = {};

  const locationMandatory = Boolean(options.locationRequired || options.punchLocationMode === 'workshop');
  if (locationMandatory || options.locationTrackingEnabled) {
    // Optional location recording should never block an employee from punching.
    // Workshop-radius or required-location policies still fail closed.
    try {
      location = options.punchLocationMode === 'workshop'
        ? await acquireWorkshopLocation(
            navigator.geolocation,
            options.punchRadiusMeters,
            options.onLocationProgress,
          )
        : await getBrowserLocation(locationMandatory);
    } catch (error) {
      if (locationMandatory) throw error;
    }
  }

  return apiClient.post('/attendance/toggle', {
    action,
    source: 'web',
    location,
  });
};

export const submitOvertimeRequest = async (payload) =>
  apiClient.post('/my-attendance/overtime', payload);

export const getMyOvertimeRequests = async () => {
  const rows = await apiClient.get('/my-attendance/overtime');
  return Array.isArray(rows) ? rows : rows?.results || [];
};

export const cancelOvertimeRequest = async (id) =>
  apiClient.post(`/my-attendance/overtime/${id}/cancel`);

export const submitPunchCorrection = async (correctionData) =>
  apiClient.post('/my-attendance/corrections', correctionData);

export const getMySalaryPayments = async () => {
  const rows = await apiClient.get('/my-attendance/salary');
  return Array.isArray(rows) ? rows : rows?.results || [];
};

export const attendanceService = {
  getMySalaryPayments,
  getPersonalAttendanceLogs,
  getCalendarEvents,
  getAttendanceStatus,
  punchAttendance,
  submitPunchCorrection,
  submitOvertimeRequest,
  getMyOvertimeRequests,
  cancelOvertimeRequest,
};
