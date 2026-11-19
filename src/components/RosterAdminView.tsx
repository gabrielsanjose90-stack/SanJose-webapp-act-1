import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { BeltRank, StudentRosterItem, UserRole } from '../types';
import { BeltMark, UserAvatar } from './BeltMark';

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  status: 'active' | 'inactive';
  created_at: string;
  avatar_url: string;
  current_belt_id?: number;
  belt_name?: string;
  belt_color?: string;
  total_hours?: number;
  dan_rank?: string;
  specialty?: string;
}

interface RosterAdminViewProps {
  role: UserRole;
  onEvaluateStudent: () => void;
  onDataChanged: () => void;
}

export const RosterAdminView: React.FC<RosterAdminViewProps> = ({ role, onEvaluateStudent, onDataChanged }) => {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [belts, setBelts] = useState<BeltRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'users' | 'belts'>('students');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [studRes, beltRes] = await Promise.all([
        apiFetch<{ students: StudentRosterItem[] }>('/api/students'),
        apiFetch<{ belts: BeltRank[] }>('/api/belts'),
      ]);
      setStudents(studRes.students);
      setBelts(beltRes.belts);

      if (role === 'admin') {
        const usersRes = await apiFetch<{ users: AdminUserRow[] }>('/api/admin/users');
        setUsers(usersRes.users);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load roster data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  const handleUpdateUser = async (userId: number, patch: { role?: UserRole; status?: 'active' | 'inactive'; beltId?: number }) => {
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setSuccess('User permissions and academy profile updated.');
      await loadData();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user.');
    }
  };

  const handleUpdateBeltHours = async (belt: BeltRank, minHours: number, minAttendancePct: number) => {
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/belts/${belt.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ minHours, minAttendancePct }),
      });
      setSuccess(`Updated promotion requirements for ${belt.name}.`);
      await loadData();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update belt standards.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111317]">
            {role === 'admin' ? 'Dojang Administration & Roster' : 'Student Roster Management'}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {role === 'admin'
              ? 'Manage students, instructors, user permissions, and official belt promotion criteria.'
              : 'Monitor registered students, training hours, attendance consistency, and belt progression.'}
          </p>
        </div>

        {role === 'admin' && (
          <div className="flex items-center p-1 bg-[#EFEFF1] rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                activeTab === 'students' ? 'bg-white text-[#111317] shadow-sm' : 'text-[#6B7280]'
              }`}
            >
              Student Roster
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                activeTab === 'users' ? 'bg-white text-[#111317] shadow-sm' : 'text-[#6B7280]'
              }`}
            >
              Users & Roles
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('belts')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                activeTab === 'belts' ? 'bg-white text-[#111317] shadow-sm' : 'text-[#6B7280]'
              }`}
            >
              Belt Standards
            </button>
          </div>
        )}
      </div>

      {error && <div className="p-3 text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] rounded-lg">{success}</div>}

      {loading && students.length === 0 ? (
        <div className="h-64 bg-white border border-[#E5E7EB] rounded-xl animate-pulse" />
      ) : (
        <>
          {/* Student Roster Tab */}
          {activeTab === 'students' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-semibold text-[#6B7280]">
                      <th className="py-3 px-5">Student</th>
                      <th className="py-3 px-4">Belt Rank</th>
                      <th className="py-3 px-4 text-right">Mat Hours</th>
                      <th className="py-3 px-4 text-right">Attendance</th>
                      <th className="py-3 px-4 text-right">Modules</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-sm">
                    {students.map((st) => {
                      const attPct = st.total_att > 0 ? Math.round((st.present_att / st.total_att) * 100) : 100;
                      return (
                        <tr key={st.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <UserAvatar name={st.name} avatarUrl={st.avatar_url} size="sm" />
                              <div>
                                <div className="font-semibold text-[#111317]">{st.name}</div>
                                <div className="text-xs text-[#6B7280]">{st.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <BeltMark colorHex={st.belt_color} beltName={st.belt_name} size="sm" />
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#374151]">
                            {st.total_hours}h
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#374151]">{attPct}%</td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#374151]">
                            {st.completed_modules}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              type="button"
                              onClick={onEvaluateStudent}
                              className="px-3 py-1.5 text-xs font-semibold border border-[#E5E7EB] rounded-lg hover:border-[#111317] text-[#111317] whitespace-nowrap cursor-pointer"
                            >
                              Evaluate
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin Users & Permissions Tab */}
          {role === 'admin' && activeTab === 'users' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-semibold text-[#6B7280]">
                      <th className="py-3 px-5">Account</th>
                      <th className="py-3 px-4">Role Permission</th>
                      <th className="py-3 px-4">Belt Rank</th>
                      <th className="py-3 px-5">Account Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-sm">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F9FAFB]">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={u.name} avatarUrl={u.avatar_url} size="sm" />
                            <div>
                              <div className="font-semibold text-[#111317]">{u.name}</div>
                              <div className="text-xs text-[#6B7280]">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateUser(u.id, { role: e.target.value as UserRole })}
                            className="px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded-md"
                          >
                            <option value="student">Student</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4">
                          {u.role === 'student' ? (
                            <select
                              value={u.current_belt_id || ''}
                              onChange={(e) => handleUpdateUser(u.id, { beltId: Number(e.target.value) })}
                              className="px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded-md"
                            >
                              {belts.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-[#6B7280]">{u.dan_rank || 'Coaching Staff'}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateUser(u.id, { status: u.status === 'active' ? 'inactive' : 'active' })
                            }
                            className={`px-3 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                              u.status === 'active'
                                ? 'border-[#BBF7D0] text-[#166534] bg-[#F0FDF4]'
                                : 'border-[#FECACA] text-[#991B1B] bg-[#FEF2F2]'
                            }`}
                          >
                            {u.status === 'active' ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin Belt Standards Tab */}
          {role === 'admin' && activeTab === 'belts' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#111317]">Configure Belt Promotion Thresholds</h2>
              <div className="divide-y divide-[#E5E7EB]">
                {belts.map((belt) => (
                  <div key={belt.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <BeltMark colorHex={belt.color_hex} beltName={belt.name} size="sm" />
                      <div className="text-xs text-[#6B7280] mt-1">{belt.required_poomsae}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs text-[#6B7280] flex items-center gap-1.5">
                        <span>Min Hours:</span>
                        <input
                          type="number"
                          defaultValue={belt.min_hours}
                          min={0}
                          max={500}
                          onBlur={(e) => handleUpdateBeltHours(belt, Number(e.target.value), belt.min_attendance_pct)}
                          className="w-20 px-2 py-1 text-xs font-mono border border-[#D1D5DB] rounded-md"
                        />
                      </label>
                      <label className="text-xs text-[#6B7280] flex items-center gap-1.5">
                        <span>Attendance %:</span>
                        <input
                          type="number"
                          defaultValue={belt.min_attendance_pct}
                          min={0}
                          max={100}
                          onBlur={(e) => handleUpdateBeltHours(belt, belt.min_hours, Number(e.target.value))}
                          className="w-20 px-2 py-1 text-xs font-mono border border-[#D1D5DB] rounded-md"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
