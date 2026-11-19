import React, { useEffect, useState } from 'react';
import { Calendar, Award, BookOpen, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type {
  AchievementItem,
  AnnouncementItem,
  BeltRank,
  FeedbackItem,
  GradingExam,
  ScheduleSession,
  UserAccount,
} from '../types';
import { BeltMark, UserAvatar } from './BeltMark';
import { AttributeRadarChart, BeltDistributionChart } from './Charts';

interface DashboardPayload {
  role: 'admin' | 'instructor' | 'student';
  user: UserAccount;
  dailyTip: string;
  unreadNotifications: number;
  announcements: AnnouncementItem[];
  studentMetrics?: {
    attendancePct: number;
    sessionsAttended: number;
    sessionsRecorded: number;
    totalModules: number;
    completedModules: number;
    inProgressModules: number;
    completionPct: number;
  };
  nextBelt?: BeltRank | null;
  upcomingSessions: ScheduleSession[];
  earnedAchievements?: AchievementItem[];
  recentFeedback: FeedbackItem[];
  academyMetrics?: {
    totalStudents: number;
    totalInstructors: number;
    upcomingSessions: number;
    avgAttendancePct: number;
    upcomingExamsCount: number;
  };
  beltDistribution?: Array<{ name: string; color_hex: string; rank_order: number; student_count: number }>;
  upcomingExams?: GradingExam[];
}

interface OverviewProps {
  onNavigate: (tab: string) => void;
  refreshSignal: number;
}

export const OverviewView: React.FC<OverviewProps> = ({ onNavigate, refreshSignal }) => {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registeringId, setRegisteringId] = useState<number | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiFetch<DashboardPayload>('/api/dashboard');
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [refreshSignal]);

  const toggleRegistration = async (session: ScheduleSession) => {
    setRegisteringId(session.id);
    try {
      if (session.is_registered) {
        await apiFetch(`/api/schedules/${session.id}/register`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/schedules/${session.id}/register`, { method: 'POST' });
      }
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setRegisteringId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-white border border-[#E5E7EB] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-[#E5E7EB] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-white border border-[#FECACA] rounded-xl text-sm text-[#991B1B]">
        {error || 'Dashboard unavailable.'}
      </div>
    );
  }

  const { user, role } = data;

  return (
    <div className="space-y-8">
      {/* Header Summary Strip */}
      <section className="bg-[#111317] text-white rounded-xl p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="xl" />
          <div>
            <p className="text-xs font-medium text-[#C59B27] tracking-wide">
              {role === 'admin'
                ? 'Dojang Administrator Console'
                : role === 'instructor'
                  ? `Instructor Portal · ${user.instructorProfile?.dan_rank || 'Black Belt Coach'}`
                  : `Student Athlete · ${user.studentProfile?.belt_korean_name || 'Taekwondo Member'}`}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-white">
              Welcome back, {user.name}
            </h1>
            <p className="text-sm text-[#D1D5DB] mt-1 max-w-2xl">
              {role === 'student' && user.studentProfile
                ? `${user.studentProfile.belt_name} · ${user.studentProfile.total_hours} logged mat hours · ${user.bio}`
                : user.bio}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {role === 'student' && user.studentProfile && (
            <div className="bg-white/10 border border-white/15 rounded-lg px-4 py-2.5">
              <div className="text-[11px] text-[#9CA3AF]">Current Rank</div>
              <div className="mt-1 text-sm font-semibold text-white">{user.studentProfile.belt_name}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onNavigate(role === 'student' ? 'modules' : 'attendance')}
            className="px-4 py-2.5 bg-[#C81E2B] hover:bg-[#A61722] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {role === 'student' ? 'Continue Training' : 'Record Attendance'}
          </button>
        </div>
      </section>

      {/* 4-Column KPI Row */}
      {role === 'student' && data.studentMetrics && user.studentProfile && (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Training Attendance</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-2">
              {data.studentMetrics.attendancePct}%
            </div>
            <div className="text-xs text-[#6B7280] mt-1 font-mono tabular-nums">
              {data.studentMetrics.sessionsAttended}/{data.studentMetrics.sessionsRecorded} recorded sessions
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Total Training Hours</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-2">
              {user.studentProfile.total_hours}h
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {data.nextBelt
                ? `${Math.max(0, Number((data.nextBelt.min_hours - user.studentProfile.total_hours).toFixed(1)))}h to ${data.nextBelt.name}`
                : 'Black Belt mastery track'}
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Curriculum Progress</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-2">
              {data.studentMetrics.completionPct}%
            </div>
            <div className="text-xs text-[#6B7280] mt-1 font-mono tabular-nums">
              {data.studentMetrics.completedModules} of {data.studentMetrics.totalModules} modules mastered
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Earned Milestones</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-2">
              {data.earnedAchievements?.length ?? 0}
            </div>
            <div className="text-xs text-[#6B7280] mt-1 font-mono tabular-nums">
              {user.studentProfile.xp_points} academy points
            </div>
          </div>
        </section>
      )}

      {role !== 'student' && data.academyMetrics && (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Active Students</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-2">
              {data.academyMetrics.totalStudents}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">Enrolled across all belt ranks</div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Dojang Attendance Rate</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-2">
              {data.academyMetrics.avgAttendancePct}%
            </div>
            <div className="text-xs text-[#6B7280] mt-1">Present & punctual sessions</div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Scheduled Sessions</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-2">
              {data.academyMetrics.upcomingSessions}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">Active training calendar slots</div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs font-medium text-[#6B7280]">Upcoming Grading Exams</div>
            <div className="font-mono tabular-nums text-3xl font-semibold text-[#111317] mt-2">
              {data.academyMetrics.upcomingExamsCount}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {data.academyMetrics.totalInstructors} certified instructors
            </div>
          </div>
        </section>
      )}

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upcoming Training Schedule */}
        <div className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#111317]">Upcoming Training Schedule</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">Reserve mat spots or inspect instructor assignments</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('schedule')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#C81E2B] hover:underline whitespace-nowrap"
            >
              <span>Full Calendar</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#E5E7EB]">
            {data.upcomingSessions.map((session) => (
              <div key={session.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium text-sm text-[#111317]">{session.title}</div>
                  <div className="text-xs text-[#6B7280] flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono tabular-nums">{session.session_date}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {session.start_time}–{session.end_time}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{session.location}</span>
                    <span aria-hidden="true">·</span>
                    <span>{session.instructor_name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono tabular-nums text-[#6B7280]">
                    {session.registered_count}/{session.capacity}
                  </span>
                  {role === 'student' ? (
                    <button
                      type="button"
                      disabled={registeringId === session.id}
                      onClick={() => toggleRegistration(session)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        session.is_registered
                          ? 'bg-[#F3F4F6] text-[#111317] hover:bg-[#E5E7EB]'
                          : 'bg-[#C81E2B] text-white hover:bg-[#A61722]'
                      }`}
                    >
                      {registeringId === session.id
                        ? 'Updating...'
                        : session.is_registered
                          ? 'Registered'
                          : 'Reserve Spot'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigate('attendance')}
                      className="px-3 py-1.5 text-xs font-semibold border border-[#E5E7EB] rounded-lg hover:border-[#111317] text-[#111317] whitespace-nowrap"
                    >
                      Manage Roll
                    </button>
                  )}
                </div>
              </div>
            ))}
            {data.upcomingSessions.length === 0 && (
              <p className="text-sm text-[#6B7280] py-4">No upcoming training sessions scheduled yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Physical Radar / Belt Distribution + Daily Tip */}
        <div className="lg:col-span-5 space-y-6">
          {role === 'student' && user.studentProfile ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#111317]">Conditioning Profile</h2>
                  <p className="text-xs text-[#6B7280]">Instructor-evaluated athletic balance</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('progress')}
                  className="text-xs font-semibold text-[#C81E2B] hover:underline whitespace-nowrap"
                >
                  Details
                </button>
              </div>
              <AttributeRadarChart
                flexibility={user.studentProfile.flexibility_score}
                stamina={user.studentProfile.stamina_score}
                speed={user.studentProfile.speed_score}
                strength={user.studentProfile.strength_score}
              />
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#111317]">Belt Rank Distribution</h2>
                  <p className="text-xs text-[#6B7280]">Enrolled students per belt tier</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('belts')}
                  className="text-xs font-semibold text-[#C81E2B] hover:underline whitespace-nowrap"
                >
                  Grading
                </button>
              </div>
              {data.beltDistribution && <BeltDistributionChart items={data.beltDistribution} />}
            </div>
          )}

          {/* Daily Training Tip */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#C59B27]">
              <BookOpen className="w-4 h-4" />
              <span>Daily Training Tip</span>
            </div>
            <p className="text-sm text-[#111317] leading-relaxed">{data.dailyTip}</p>
          </div>
        </div>
      </div>

      {/* Bottom Row: Achievements / Feedback & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#111317]">
              {role === 'student' ? 'Personal Achievements & Next Belt' : 'Recent Instructor Evaluations'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate(role === 'student' ? 'belts' : 'progress')}
              className="text-xs font-semibold text-[#C81E2B] hover:underline whitespace-nowrap"
            >
              View All
            </button>
          </div>

          {role === 'student' && data.nextBelt && user.studentProfile && (
            <div className="p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#6B7280]">Next Promotion Target</span>
                <BeltMark colorHex={data.nextBelt.color_hex} beltName={data.nextBelt.name} size="sm" />
              </div>
              <p className="text-xs text-[#4B5563]">
                Required Poomsae: <span className="font-medium text-[#111317]">{data.nextBelt.required_poomsae}</span>
              </p>
              <p className="text-xs text-[#4B5563] font-mono tabular-nums">
                Minimum {data.nextBelt.min_hours}h mat time · {data.nextBelt.min_attendance_pct}% attendance
              </p>
            </div>
          )}

          {role === 'student' && data.earnedAchievements && (
            <div className="divide-y divide-[#E5E7EB]">
              {data.earnedAchievements.slice(0, 4).map((ach) => (
                <div key={ach.id} className="py-3 flex items-start gap-3">
                  <Award className="w-4 h-4 text-[#C59B27] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-[#111317]">{ach.title}</div>
                    <div className="text-xs text-[#6B7280]">{ach.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {role !== 'student' && (
            <div className="divide-y divide-[#E5E7EB]">
              {data.recentFeedback.map((fb) => (
                <div key={fb.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#111317]">{fb.student_name}</span>
                    <span className="font-mono tabular-nums text-xs text-[#C59B27]">{fb.rating}/5</span>
                  </div>
                  <p className="text-xs text-[#4B5563]">{fb.comment}</p>
                  <div className="text-[11px] text-[#6B7280]">
                    {fb.category} · Evaluated by {fb.instructor_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#111317]">Dojang Announcements</h2>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="text-xs font-semibold text-[#C81E2B] hover:underline whitespace-nowrap"
            >
              Academy Board
            </button>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {data.announcements.map((ann) => (
              <div key={ann.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#111317]">{ann.title}</h3>
                  {ann.priority === 'important' && (
                    <span className="text-xs font-semibold text-[#C81E2B] whitespace-nowrap">Important</span>
                  )}
                </div>
                <p className="text-sm text-[#4B5563] leading-relaxed">{ann.body}</p>
                <div className="text-xs text-[#6B7280] flex items-center gap-2 pt-0.5">
                  <span>{ann.author_name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{ann.created_at.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>

          {role === 'student' && data.recentFeedback.length > 0 && (
            <div className="pt-4 border-t border-[#E5E7EB]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#111317] mb-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>Latest Coach Note</span>
              </div>
              <p className="text-sm text-[#374151]">{data.recentFeedback[0].comment}</p>
              <p className="text-xs text-[#6B7280] mt-1">
                {data.recentFeedback[0].instructor_name} · {data.recentFeedback[0].category}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
