import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { AchievementItem, FeedbackItem, StudentRosterItem, UserAccount } from '../types';
import { BeltMark } from './BeltMark';
import { AttributeRadarChart, CategoryProgressBars } from './Charts';

interface ProgressPayload {
  student: UserAccount;
  categoryBreakdown: Array<{ category: string; total: number; completed: number; avg_mastery: number }>;
  feedback: FeedbackItem[];
  history: Array<{ title: string; category: string; session_date: string; start_time: string; location: string; status: string }>;
  achievements: AchievementItem[];
}

interface ProgressViewProps {
  user: UserAccount;
  onDataChanged: () => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ user, onDataChanged }) => {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number>(user.id);
  const [data, setData] = useState<ProgressPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Instructor feedback form
  const [fbCategory, setFbCategory] = useState('Kicking Techniques');
  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState('');
  const [flexDelta, setFlexDelta] = useState(2);
  const [stamDelta, setStamDelta] = useState(1);
  const [speedDelta, setSpeedDelta] = useState(2);
  const [strDelta, setStrDelta] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const loadProgress = async (studentId: number) => {
    setLoading(true);
    setError('');
    try {
      const query = user.role !== 'student' ? `?studentId=${studentId}` : '';
      const payload = await apiFetch<ProgressPayload>(`/api/progress${query}`);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load progress metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (user.role !== 'student') {
        try {
          const roster = await apiFetch<{ students: StudentRosterItem[] }>('/api/students');
          setStudents(roster.students);
          if (roster.students.length > 0) {
            const firstId = roster.students[0].id;
            setSelectedStudentId(firstId);
            await loadProgress(firstId);
            return;
          }
        } catch {
          // fallback
        }
      }
      await loadProgress(user.id);
    };
    init();
  }, [user.id, user.role]);

  const handleSelectStudent = async (id: number) => {
    setSelectedStudentId(id);
    await loadProgress(id);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentId,
          category: fbCategory,
          rating: fbRating,
          comment: fbComment,
          flexibilityDelta: flexDelta,
          staminaDelta: stamDelta,
          speedDelta,
          strengthDelta: strDelta,
        }),
      });
      setFbComment('');
      setSuccess('Evaluation posted and student conditioning scores updated.');
      await loadProgress(selectedStudentId);
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const sp = data?.student?.studentProfile;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111317]">
            Progress & Performance Analytics
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Monitor flexibility, stamina, speed, strength, technique mastery, and instructor evaluations.
          </p>
        </div>

        {user.role !== 'student' && students.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="progress-student-select" className="text-xs font-semibold text-[#6B7280] whitespace-nowrap">
              Student:
            </label>
            <select
              id="progress-student-select"
              value={selectedStudentId}
              onChange={(e) => handleSelectStudent(Number(e.target.value))}
              className="px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} · {st.belt_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div className="p-3 text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] rounded-lg">{success}</div>}

      {loading && !data ? (
        <div className="h-64 bg-white border border-[#E5E7EB] rounded-xl animate-pulse" />
      ) : (
        data && (
          <>
            {/* Athlete Snapshot */}
            {sp && (
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-[#6B7280]">Evaluated Athlete</div>
                  <h2 className="font-display text-xl font-bold text-[#111317]">{data.student.name}</h2>
                  <BeltMark colorHex={sp.belt_color} beltName={sp.belt_name} size="sm" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-left md:text-right">
                  <div>
                    <div className="text-xs text-[#6B7280]">Flexibility</div>
                    <div className="font-mono tabular-nums text-xl font-semibold text-[#111317]">{sp.flexibility_score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Stamina</div>
                    <div className="font-mono tabular-nums text-xl font-semibold text-[#111317]">{sp.stamina_score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Speed</div>
                    <div className="font-mono tabular-nums text-xl font-semibold text-[#111317]">{sp.speed_score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Strength</div>
                    <div className="font-mono tabular-nums text-xl font-semibold text-[#111317]">{sp.strength_score}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-xl p-6">
                <h2 className="font-display text-lg font-bold text-[#111317]">Physical Conditioning Radar</h2>
                <p className="text-xs text-[#6B7280] mb-4">Updated dynamically from instructor evaluations</p>
                {sp && (
                  <AttributeRadarChart
                    flexibility={sp.flexibility_score}
                    stamina={sp.stamina_score}
                    speed={sp.speed_score}
                    strength={sp.strength_score}
                  />
                )}
              </div>

              <div className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-5">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#111317]">Technique Completion by Category</h2>
                  <p className="text-xs text-[#6B7280]">Completed drills across all four core curriculum pillars</p>
                </div>
                <CategoryProgressBars items={data.categoryBreakdown} />
              </div>
            </div>

            {/* Instructor Evaluation Form (Instructors & Admins) */}
            {user.role !== 'student' && (
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#111317]">Submit Instructor Evaluation</h2>
                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-[#374151] mb-1">Category</label>
                      <select
                        value={fbCategory}
                        onChange={(e) => setFbCategory(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                      >
                        <option>Basic Techniques</option>
                        <option>Kicking Techniques</option>
                        <option>Forms (Poomsae)</option>
                        <option>Sparring Training</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">Rating (1–5)</label>
                      <input type="number" min={1} max={5} value={fbRating} onChange={(e) => setFbRating(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">Flexibility +/-</label>
                      <input type="number" min={-5} max={10} value={flexDelta} onChange={(e) => setFlexDelta(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">Stamina +/-</label>
                      <input type="number" min={-5} max={10} value={stamDelta} onChange={(e) => setStamDelta(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">Speed / Str +/-</label>
                      <div className="grid grid-cols-2 gap-1">
                        <input type="number" min={-5} max={10} value={speedDelta} onChange={(e) => setSpeedDelta(Number(e.target.value))} title="Speed Delta" className="w-full px-2 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                        <input type="number" min={-5} max={10} value={strDelta} onChange={(e) => setStrDelta(Number(e.target.value))} title="Strength Delta" className="w-full px-2 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1">Evaluation Feedback</label>
                    <textarea
                      rows={2}
                      required
                      value={fbComment}
                      onChange={(e) => setFbComment(e.target.value)}
                      placeholder="Provide specific corrections on stance depth, kick chamber, or sparring timing..."
                      className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-semibold bg-[#C81E2B] hover:bg-[#A61722] text-white rounded-lg cursor-pointer"
                    >
                      {submitting ? 'Submitting...' : 'Save Evaluation'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Feedback & Training History + Achievements */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#111317]">Instructor Evaluations</h2>
                {data.feedback.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No evaluations recorded yet for this student.</p>
                ) : (
                  <div className="divide-y divide-[#E5E7EB]">
                    {data.feedback.map((fb) => (
                      <div key={fb.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#111317]">{fb.category}</span>
                          <span className="font-mono tabular-nums text-[#C59B27] font-semibold">{fb.rating}/5</span>
                        </div>
                        <p className="text-sm text-[#374151]">{fb.comment}</p>
                        <div className="text-xs text-[#6B7280]">
                          {fb.instructor_name} · <span className="font-mono tabular-nums">{fb.created_at.slice(0, 10)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#111317]">Achievements & Training History</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className={`p-3 rounded-lg border ${
                        ach.earned_at ? 'border-[#C59B27]/50 bg-[#C59B27]/[0.05]' : 'border-[#E5E7EB] opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#111317]">
                        {ach.earned_at ? (
                          <Award className="w-4 h-4 text-[#C59B27] shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                        )}
                        <span>{ach.title}</span>
                      </div>
                      <p className="text-xs text-[#6B7280] mt-1">{ach.description}</p>
                    </div>
                  ))}
                </div>

                {data.history.length > 0 && (
                  <div className="pt-4 border-t border-[#E5E7EB] space-y-2">
                    <h3 className="text-xs font-semibold text-[#6B7280]">Recent Training History</h3>
                    <div className="divide-y divide-[#E5E7EB] text-xs">
                      {data.history.slice(0, 5).map((h, i) => (
                        <div key={i} className="py-2 flex items-center justify-between gap-2">
                          <span className="font-medium text-[#111317] truncate">{h.title}</span>
                          <span className="font-mono tabular-nums text-[#6B7280] shrink-0">
                            {h.session_date} · {h.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};
