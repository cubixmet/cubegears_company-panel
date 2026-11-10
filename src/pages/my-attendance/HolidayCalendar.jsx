import { useEffect, useMemo, useState } from "react";
import {
  AttendanceHistoryTable,
  AttendanceKpis,
  AttendanceMonthStrip,
  AttendanceOverviewHeader,
  AttendancePunchPanel,
  EmployeeAttendanceCard,
} from '../../components/my-attendance';
import { minutesToHours, parseAttendanceLocalDate } from '../../components/my-attendance/attendance.utils';
import { attendanceService } from '../../services/attendance.service';
import { MySalaryPayments } from './MySalaryPayments';
import '../../styles/attendance-calendar.css';
import '../../styles/attendance-punch-readable.css';

const monthKey = (date) => date.getFullYear() * 12 + date.getMonth();

export const HolidayCalendar = () => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [search, setSearch] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      setLoading(true);
      setLoadError('');
      // Do not display previous-month records while a new month is loading.
      setEvents([]);
      setLogs([]);
      // Calendar, history and profile are separate endpoints. Keep successful
      // results visible if one endpoint fails, and never reject the effect.
      const [calendarResult, logsResult, statusResult] = await Promise.allSettled([
        attendanceService.getCalendarEvents(month, year),
        attendanceService.getPersonalAttendanceLogs({ month, year }),
        attendanceService.getAttendanceStatus(),
      ]);
      if (!active) return;
      setEvents(calendarResult.status === 'fulfilled' && Array.isArray(calendarResult.value)
        ? calendarResult.value : []);
      setLogs(logsResult.status === 'fulfilled' && Array.isArray(logsResult.value)
        ? logsResult.value : []);
      if (statusResult.status === 'fulfilled') setAttendanceStatus(statusResult.value || null);
      const failures = [
        ['calendar', calendarResult],
        ['attendance records', logsResult],
        ['employee profile', statusResult],
      ].filter(([, result]) => result.status === 'rejected');
      if (failures.length) {
        setLoadError(`Could not load ${failures.map(([name]) => name).join(', ')}. Check your connection and retry.`);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [currentDate, refreshKey]);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const attendanceStartDate = useMemo(() => {
    const joiningDate = parseAttendanceLocalDate(
      attendanceStatus?.employee?.joiningDate ||
      attendanceStatus?.employee?.joining_date,
    );

    if (joiningDate) return joiningDate > today ? today : joiningDate;

    const logDates = logs
      .map((log) => parseAttendanceLocalDate(log.date))
      .filter(Boolean)
      .sort((a, b) => a - b);

    return logDates[0] || today;
  }, [attendanceStatus, logs, today]);

  useEffect(() => {
    const currentKey = monthKey(currentDate);
    const minimumKey = monthKey(attendanceStartDate);
    const maximumKey = monthKey(today);

    if (currentKey < minimumKey) {
      setCurrentDate(
        new Date(attendanceStartDate.getFullYear(), attendanceStartDate.getMonth(), 1),
      );
      return;
    }

    if (currentKey > maximumKey) {
      setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    }
  }, [attendanceStartDate, currentDate, today]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthLabel = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const currentMonthKey = year * 12 + month;
  const startMonthKey = monthKey(attendanceStartDate);
  const todayMonthKey = monthKey(today);
  const visibleStartDay =
    currentMonthKey === startMonthKey ? attendanceStartDate.getDate() : 1;
  const visibleEndDay =
    currentMonthKey === todayMonthKey ? today.getDate() : totalDays;

  useEffect(() => {
    setSelectedDay((day) =>
      Math.min(Math.max(day, visibleStartDay), visibleEndDay),
    );
  }, [visibleStartDay, visibleEndDay]);

  const setCalendarMonth = (nextYear, nextMonth) => {
    let targetMonth = nextYear * 12 + nextMonth;
    const minimumMonth = monthKey(attendanceStartDate);
    const maximumMonth = monthKey(today);

    targetMonth = Math.max(minimumMonth, Math.min(maximumMonth, targetMonth));

    const clampedYear = Math.floor(targetMonth / 12);
    const clampedMonth = targetMonth % 12;
    const firstVisibleDay =
      targetMonth === minimumMonth ? attendanceStartDate.getDate() : 1;

    setSelectedDay(firstVisibleDay);
    setCurrentDate(new Date(clampedYear, clampedMonth, 1));
  };

  const monthLogs = useMemo(
    () =>
      logs.filter((log) => {
        const date = parseAttendanceLocalDate(log.date);
        return Boolean(date) && (
          date.getFullYear() === year &&
          date.getMonth() === month &&
          date >= attendanceStartDate &&
          date <= today
        );
      }),
    [logs, month, year, attendanceStartDate, today],
  );

  const logByDay = useMemo(() => {
    const map = new Map();
    monthLogs.forEach((log) => {
      const date = parseAttendanceLocalDate(log.date);
      if (date) map.set(date.getDate(), log);
    });
    return map;
  }, [monthLogs]);

  const eventByDay = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const date = parseAttendanceLocalDate(event.date);
      if (
        date &&
        date.getFullYear() === year &&
        date.getMonth() === month &&
        date >= attendanceStartDate &&
        date <= today
      ) {
        map.set(date.getDate(), event);
      }
    });
    return map;
  }, [events, month, year, attendanceStartDate, today]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return monthLogs;

    return monthLogs.filter((log) =>
      [log.date, log.dayOfWeek, log.status, log.shiftName]
        .some((value) => String(value || '').toLowerCase().includes(query)),
    );
  }, [monthLogs, search]);

  const exportCsv = () => {
    const rows = [
      ['Date', 'Day', 'Status', 'Clock In', 'Clock Out', 'Worked'],
      ...monthLogs.map((log) => [
        log.date,
        log.dayOfWeek,
        log.status,
        log.sessions?.[0]?.clockIn || '-',
        log.sessions?.[log.sessions.length - 1]?.clockOut || '-',
        minutesToHours(log.totalWorkedMinutes),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((item) => `"${String(item ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `attendance-${year}-${String(month + 1).padStart(2, '0')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="attendance-calendar-redesign">
      {loadError && (
        <div className="attendance-calendar-fetch-error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {loading && <p className="attendance-calendar-loading" role="status">Loading attendance calendar…</p>}
      <AttendanceOverviewHeader
        monthLabel={monthLabel}
        month={month}
        year={year}
        minDate={attendanceStartDate}
        maxDate={today}
        onMonthChange={(nextMonth) => setCalendarMonth(year, nextMonth)}
        onYearChange={(nextYear) => setCalendarMonth(nextYear, month)}
        onPreviousMonth={() => setCalendarMonth(year, month - 1)}
        onNextMonth={() => setCalendarMonth(year, month + 1)}
      />

      <EmployeeAttendanceCard employee={attendanceStatus?.employee || null} />

      <MySalaryPayments />

      <AttendancePunchPanel onChanged={() => setRefreshKey((value) => value + 1)} />

      <AttendanceKpis logs={monthLogs} />

      <AttendanceMonthStrip
        monthLabel={monthLabel}
        totalDays={totalDays}
        startDay={visibleStartDay}
        endDay={visibleEndDay}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        logByDay={logByDay}
        eventByDay={eventByDay}
      />

      <AttendanceHistoryTable
        logs={filteredLogs}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onExport={exportCsv}
      />
    </div>
  );
};
