import React, { useEffect, useState } from 'react';
import { Download, Check } from 'lucide-react';
import { apiFetch, getStoredToken } from '../lib/api';
import type {
  AttendanceRecord,
  ScheduleSession,
  StudentAttendanceSummary,
  StudentRosterItem,
  UserRole,
} from '../types';
import { BeltMark } from './BeltMark';

interface AttendanceViewProps {
  role: UserRole;
  onDataChanged: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ role, onDataChanged }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summaries, setSummaries] = useState<StudentAttendanceSummary[]>([]);
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [rollState, setRollState] = useState<Record<number, { status: 'present' | 'late' | 'absent' | 'excused'; notes: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingRoll, setSavingRoll] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const attRes = await apiFetch<{
        records: AttendanceRecord[];
        studentSummaries?: StudentAttendanceSummary[];
      }>('/api/attendance');
      setRecords(attRes.records);
      if (attRes.studentSummaries) setSummaries(attRes.studentSummaries);

      if (role !== 'student') {
        const [schedRes, rosterRes] = await Promise.all([
          apiFetch<{ schedules: ScheduleSession[] }>('/api/schedules'),
          apiFetch<{ students: StudentRosterItem[] }>('/api/students'),
        ]);
        setSessions(schedRes.schedules);
        setStudents(rosterRes.students);

        const defaultSession = schedRes.schedules.find((s) => s.session_date >= '2026-11-18') || schedRes.schedules[0];
        if (defaultSession && selectedSessionId === '') {
          setSelectedSessionId(defaultSession.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  useEffect(() => {
    if (role === 'student' || !selectedSessionId || students.length === 0) return;
    const nextRoll: Record<number, { status: 'present' | 'late' | 'absent' | 'excused'; notes: string }> = {};
    for (const s of students) {
      const existing = records.find((r) => r.schedule_id === Number(selectedSessionId) && r.student_id === s.id);
      nextRoll[s.id] = {
        status: existing ? existing.status : 'present',
        notes: existing ? existing.notes : '',
      };
    }
    setRollState(nextRoll);
  }, [selectedSessionId, students, records, role]);

  const handleSaveRoll = async () => {
    if (!selectedSessionId) return;
    setSavingRoll(true);
    setError('');
    setSuccess('');
    try {
      const entries = Object.entries(rollState).map(([studentId, val]) => ({
        studentId: Number(studentId),
        status: val.status,
        notes: val.notes,
      }));
      const res = await apiFetch<{ updatedCount: number }>('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ scheduleId: Number(selectedSessionId), entries }),
      });
      setSuccess(`Recorded attendance for ${res.updatedCount} students.`);
      await loadData();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance.');
    } finally {
      setSavingRoll(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const token = getStoredToken();
      const response = await fetch('/api/admin/reports/attendance.csv', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tkd-attendance-report.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download report.');
    }
  };

  const totalCount = records.length;
  const attendedCount = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const studentPct = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111317]">Attendance Management</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {role === 'student'
              ? 'Your verified dojang attendance log and consistency percentage.'
              : 'Take roll call for training sessions, review student attendance percentages, and export reports.'}
          </p>
        </div>

        {role !== 'student' && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111317] hover:bg-[#272A30] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Report</span>
          </button>
        )}
      </div>

      {error && <div className="p-3 text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] rounded-lg">{success}</div>}

      {/* Student Summary Strip */}
      {role === 'student' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Attendance Rate</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-1">{studentPct}%</div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Sessions Attended</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-1">{attendedCount}</div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Total Recorded</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-1">{totalCount}</div>
          </div>
        </div>
      )}

      {/* Instructor / Admin Roll-Call Sheet */}
      {role !== 'student' && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#111317]">Session Roll Call</h2>
              <p className="text-xs text-[#6B7280]">Select a training session and record attendance status for each student.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg min-w-[260px]"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.session_date} · {s.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={savingRoll || !selectedSessionId}
                onClick={handleSaveRoll}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C81E2B] hover:bg-[#A61722] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingRoll ? 'Saving...' : 'Save Roll Call'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280]">
                  <th className="py-2.5 pr-4">Student</th>
                  <th className="py-2.5 px-4">Belt Rank</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 pl-4">Instructor Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {students.map((st) => {
                  const row = rollState[st.id] || { status: 'present', notes: '' };
                  return (
                    <tr key={st.id} className="hover:bg-[#F9FAFB]">
                      <td className="py-3 pr-4 font-medium text-[#111317]">{st.name}</td>
                      <td className="py-3 px-4">
                        <BeltMark colorHex={st.belt_color} beltName={st.belt_name} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1 p-0.5 bg-[#F3F4F6] rounded-lg">
                          {(['present', 'late', 'absent', 'excused'] as const).map((statusOpt) => (
                            <button
                              key={statusOpt}
                              type="button"
                              onClick={() =>
                                setRollState((prev) => ({
                                  ...prev,
                                  [st.id]: { ...row, status: statusOpt },
                                }))
                              }
                              className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                                row.status === statusOpt
                                  ? statusOpt === 'absent'
                                    ? 'bg-[#C81E2B] text-white'
                                    : 'bg-white text-[#111317] shadow-sm'
                                  : 'text-[#6B7280] hover:text-[#111317]'
                              }`}
                            >
                              {statusOpt}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pl-4">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) =>
                            setRollState((prev) => ({
                              ...prev,
                              [st.id]: { ...row, notes: e.target.value },
                            }))
                          }
                          placeholder="Optional note..."
                          className="w-full px-2.5 py-1.5 text-xs border border-[#E5E7EB] rounded-md"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance Percentage Report (Instructor/Admin) */}
      {role !== 'student' && summaries.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#111317]">Student Attendance Report</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280]">
                  <th className="py-2.5 pr-4">Student</th>
                  <th className="py-2.5 px-4">Belt Rank</th>
                  <th className="py-2.5 px-4 text-right">Sessions Attended</th>
                  <th className="py-2.5 px-4 text-right">Total Hours</th>
                  <th className="py-2.5 pl-4 text-right">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {summaries.map((sum) => {
                  const pct = sum.total_sessions > 0 ? Math.round((sum.attended_sessions / sum.total_sessions) * 100) : 100;
                  return (
                    <tr key={sum.student_id} className="hover:bg-[#F9FAFB]">
                      <td className="py-3 pr-4 font-medium text-[#111317]">{sum.student_name}</td>
                      <td className="py-3 px-4">
                        <BeltMark colorHex={sum.belt_color} beltName={sum.belt_name} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#374151]">
                        {sum.attended_sessions}/{sum.total_sessions}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#374151]">
                        {sum.total_hours}h
                      </td>
                      <td className={`py-3 pl-4 text-right font-mono tabular-nums font-semibold ${pct >= 80 ? 'text-[#166534]' : 'text-[#C81E2B]'}`}>
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance History Log */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-[#111317]">Attendance History</h2>
        {loading && records.length === 0 ? (
          <div className="h-32 bg-[#F3F4F6] rounded-lg animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280]">
                  <th className="py-2.5 pr-4">Date</th>
                  <th className="py-2.5 px-4">Session</th>
                  {role !== 'student' && <th className="py-2.5 px-4">Student</th>}
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Recorded By</th>
                  <th className="py-2.5 pl-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-3 pr-4 font-mono tabular-nums text-xs text-[#4B5563] whitespace-nowrap">
                      {rec.session_date}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#111317]">{rec.session_title}</td>
                    {role !== 'student' && <td className="py-3 px-4 text-[#374151]">{rec.student_name}</td>}
                    <td className="py-3 px-4 capitalize font-medium">
                      <span
                        className={
                          rec.status === 'present'
                            ? 'text-[#166534]'
                            : rec.status === 'late'
                              ? 'text-[#92400E]'
                              : 'text-[#C81E2B]'
                        }
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#6B7280]">{rec.recorder_name}</td>
                    <td className="py-3 pl-4 text-xs text-[#6B7280]">{rec.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
