import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Calendar as CalendarIcon, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { ScheduleSession, UserRole } from '../types';

interface ScheduleViewProps {
  role: UserRole;
  onDataChanged: () => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ role, onDataChanged }) => {
  const [schedules, setSchedules] = useState<ScheduleSession[]>([]);
  const [instructors, setInstructors] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Basic Techniques');
  const [instructorId, setInstructorId] = useState<number | ''>('');
  const [sessionDate, setSessionDate] = useState('2026-11-26');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:15');
  const [location, setLocation] = useState('Main Dojang · Mat A');
  const [beltRequirement, setBeltRequirement] = useState('All Belts');
  const [capacity, setCapacity] = useState(22);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSchedules = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{
        schedules: ScheduleSession[];
        instructors: Array<{ id: number; name: string; role: string }>;
      }>('/api/schedules');
      setSchedules(res.schedules);
      setInstructors(res.instructors);
      if (res.instructors.length > 0 && instructorId === '') {
        setInstructorId(res.instructors[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load training schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleToggleRegister = async (session: ScheduleSession) => {
    setNotice('');
    setError('');
    try {
      if (session.is_registered) {
        await apiFetch(`/api/schedules/${session.id}/register`, { method: 'DELETE' });
        setNotice(`Canceled registration for ${session.title}.`);
      } else {
        await apiFetch(`/api/schedules/${session.id}/register`, { method: 'POST' });
        setNotice(`Reserved spot for ${session.title} on ${session.session_date}.`);
      }
      await loadSchedules();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update reservation.');
    }
  };

  const handleSendReminder = async (session: ScheduleSession) => {
    setNotice('');
    try {
      const res = await apiFetch<{ count: number }>(`/api/schedules/${session.id}/remind`, { method: 'POST' });
      setNotice(
        role === 'student'
          ? `Reminder armed for ${session.title}.`
          : `Sent session reminder to ${res.count} registered student(s).`
      );
      await loadSchedules();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger reminder.');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/api/schedules', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          instructorId: instructorId || undefined,
          sessionDate,
          startTime,
          endTime,
          location,
          beltRequirement,
          capacity,
          description,
        }),
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setNotice('New training session published to the academy calendar.');
      await loadSchedules();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = async (id: number) => {
    try {
      await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      await loadSchedules();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete session.');
    }
  };

  const visibleSessions = useMemo(() => {
    if (viewMode === 'weekly') {
      return schedules.filter((s) => s.session_date >= '2026-11-16' && s.session_date <= '2026-11-23');
    }
    return schedules;
  }, [schedules, viewMode]);

  // November 2026 Calendar grid (starts Sunday Nov 1, 2026, 30 days)
  const novemberDays = useMemo(() => {
    const days: Array<{ dateStr: string; dayNum: number; sessions: ScheduleSession[] }> = [];
    for (let d = 1; d <= 30; d++) {
      const dateStr = `2026-11-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        sessions: schedules.filter((s) => s.session_date === dateStr),
      });
    }
    return days;
  }, [schedules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111317]">Training Schedule</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Weekly & monthly dojang sessions with live capacity tracking and session reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-[#EFEFF1] rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'weekly' ? 'bg-white text-[#111317] shadow-sm' : 'text-[#6B7280]'
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'monthly' ? 'bg-white text-[#111317] shadow-sm' : 'text-[#6B7280]'
              }`}
            >
              Monthly Calendar
            </button>
          </div>

          {role !== 'student' && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C81E2B] hover:bg-[#A61722] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Session</span>
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg">{error}</div>}
      {notice && <div className="p-3 text-sm bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] rounded-lg">{notice}</div>}

      {viewMode === 'monthly' && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#111317] flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#C81E2B]" />
              <span>November 2026</span>
            </h2>
            <span className="text-xs text-[#6B7280] font-mono tabular-nums">{schedules.length} total sessions</span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#6B7280] pb-1">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {novemberDays.map((day) => {
              const isToday = day.dayNum === 19;
              return (
                <div
                  key={day.dateStr}
                  className={`min-h-[92px] p-2 rounded-lg border text-left ${
                    isToday ? 'border-[#C81E2B] bg-[#C81E2B]/[0.03]' : 'border-[#E5E7EB] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono tabular-nums text-xs font-semibold ${isToday ? 'text-[#C81E2B]' : 'text-[#374151]'}`}>
                      {day.dayNum}
                    </span>
                    {isToday && <span className="text-[10px] font-semibold text-[#C81E2B]">Today</span>}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {day.sessions.map((s) => (
                      <div key={s.id} className="text-[11px] leading-tight p-1 bg-[#F3F4F6] rounded text-[#111317] truncate" title={s.title}>
                        <span className="font-mono text-[#C81E2B] mr-1">{s.start_time}</span>
                        {s.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session List Table / Cards */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-[#111317]">
            {viewMode === 'weekly' ? 'This Week (Nov 16 – Nov 23, 2026)' : 'All Scheduled Sessions'}
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#6B7280]">{visibleSessions.length} sessions</span>
        </div>

        {loading && schedules.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#F3F4F6] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {visibleSessions.map((session) => (
              <div key={session.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-bold text-[#111317]">{session.title}</h3>
                    <span className="text-xs text-[#6B7280]">· {session.belt_requirement}</span>
                  </div>
                  <p className="text-sm text-[#4B5563]">{session.description || session.category}</p>
                  <div className="text-xs text-[#6B7280] flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5">
                    <span className="font-mono tabular-nums text-[#111317] font-medium">{session.session_date}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {session.start_time}–{session.end_time}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{session.location}</span>
                    <span aria-hidden="true">·</span>
                    <span>Instructor: {session.instructor_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {session.registered_count}/{session.capacity} spots
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {role === 'student' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleRegister(session)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          session.is_registered
                            ? 'bg-[#F3F4F6] text-[#111317] hover:bg-[#E5E7EB]'
                            : 'bg-[#C81E2B] text-white hover:bg-[#A61722]'
                        }`}
                      >
                        {session.is_registered ? 'Cancel Reservation' : 'Register'}
                      </button>
                      {Boolean(session.is_registered) && (
                        <button
                          type="button"
                          onClick={() => handleSendReminder(session)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#E5E7EB] rounded-lg hover:border-[#111317] text-[#111317] whitespace-nowrap cursor-pointer"
                        >
                          <Bell className="w-3.5 h-3.5 text-[#C59B27]" />
                          <span>{session.reminder_sent ? 'Reminder Set' : 'Remind Me'}</span>
                        </button>
                      )}
                    </>
                  )}

                  {role !== 'student' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendReminder(session)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#E5E7EB] rounded-lg hover:border-[#111317] text-[#111317] whitespace-nowrap cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5 text-[#C59B27]" />
                        <span>Send Reminder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-2 text-[#6B7280] hover:text-[#C81E2B] rounded-lg hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                        aria-label={`Delete ${session.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <h2 className="font-display text-lg font-bold text-[#111317]">Schedule Training Session</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="p-1.5 text-[#6B7280] hover:text-[#111317]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., High-Precision Kicking Workshop"
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  >
                    <option>Basic Techniques</option>
                    <option>Kicking Techniques</option>
                    <option>Forms (Poomsae)</option>
                    <option>Sparring Training</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Belt Requirement</label>
                  <select
                    value={beltRequirement}
                    onChange={(e) => setBeltRequirement(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  >
                    <option>All Belts</option>
                    <option>Yellow Belt+</option>
                    <option>Green Belt+</option>
                    <option>Blue Belt+</option>
                    <option>Red & Black</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Start</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">End</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Location</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Capacity</label>
                  <input
                    type="number"
                    min={4}
                    max={60}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
              </div>

              {role === 'admin' && instructors.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Assigned Instructor</label>
                  <select
                    value={instructorId}
                    onChange={(e) => setInstructorId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  >
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Focus Notes</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs font-medium text-[#6B7280]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#C81E2B] text-white rounded-lg cursor-pointer"
                >
                  {submitting ? 'Publishing...' : 'Publish Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
