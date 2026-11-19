import React, { useEffect, useState } from 'react';
import { Plus, X, Award } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { BeltRank, ExamResult, GradingExam, StudentRosterItem, UserAccount } from '../types';
import { BeltMark } from './BeltMark';

interface BeltsViewProps {
  user: UserAccount;
  onDataChanged: () => void;
}

export const BeltsView: React.FC<BeltsViewProps> = ({ user, onDataChanged }) => {
  const [belts, setBelts] = useState<BeltRank[]>([]);
  const [exams, setExams] = useState<GradingExam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Instructor/Admin Modals
  const [showExamModal, setShowExamModal] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState('2026-12-20');
  const [examLocation, setExamLocation] = useState('Main Dojang · Mat A');
  const [targetBeltId, setTargetBeltId] = useState<number>(3);
  const [deadline, setDeadline] = useState('2026-12-13');

  const [gradeModalExam, setGradeModalExam] = useState<GradingExam | null>(null);
  const [gradeStudentId, setGradeStudentId] = useState<number | ''>('');
  const [formsScore, setFormsScore] = useState(88);
  const [kickingScore, setKickingScore] = useState(90);
  const [sparringScore, setSparringScore] = useState(86);
  const [theoryScore, setTheoryScore] = useState(92);
  const [passed, setPassed] = useState(true);
  const [gradeNotes, setGradeNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ belts: BeltRank[]; exams: GradingExam[]; examResults: ExamResult[] }>('/api/belts');
      setBelts(res.belts);
      setExams(res.exams);
      setResults(res.examResults);

      if (user.role !== 'student') {
        const roster = await apiFetch<{ students: StudentRosterItem[] }>('/api/students');
        setStudents(roster.students);
        if (roster.students.length > 0 && gradeStudentId === '') {
          setGradeStudentId(roster.students[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load belt ranking data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.role]);

  const handleScheduleExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await apiFetch('/api/exams', {
        method: 'POST',
        body: JSON.stringify({
          title: examTitle,
          examDate,
          location: examLocation,
          targetBeltId,
          registrationDeadline: deadline,
        }),
      });
      setShowExamModal(false);
      setExamTitle('');
      setSuccess('Grading examination scheduled.');
      await loadData();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule exam.');
    }
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeModalExam || !gradeStudentId) return;
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/exams/${gradeModalExam.id}/results`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: Number(gradeStudentId),
          formsScore,
          kickingScore,
          sparringScore,
          theoryScore,
          passed,
          notes: gradeNotes,
        }),
      });
      setGradeModalExam(null);
      setGradeNotes('');
      setSuccess('Examination result saved and student promotion processed.');
      await loadData();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save examination result.');
    }
  };

  const currentRankOrder = user.studentProfile?.rank_order ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111317]">Belt Ranking & Promotion</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Official Kukkiwon progression ladder, grading examinations, and promotion history.
          </p>
        </div>

        {user.role !== 'student' && (
          <button
            type="button"
            onClick={() => setShowExamModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C81E2B] hover:bg-[#A61722] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Grading Exam</span>
          </button>
        )}
      </div>

      {error && <div className="p-3 text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg">{error}</div>}
      {success && <div className="p-3 text-sm bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] rounded-lg">{success}</div>}

      {/* 6-Belt Progression Ladder */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#111317]">Belt Progression Standards</h2>
        {loading && belts.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 bg-white border border-[#E5E7EB] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {belts.map((belt) => {
              const isCurrent = user.role === 'student' && belt.rank_order === currentRankOrder;
              const isEarned = user.role === 'student' && belt.rank_order < currentRankOrder;
              return (
                <div
                  key={belt.id}
                  className={`bg-white rounded-xl p-5 border flex flex-col justify-between space-y-4 ${
                    isCurrent ? 'border-[#C81E2B] ring-1 ring-[#C81E2B]/20' : 'border-[#E5E7EB]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <BeltMark colorHex={belt.color_hex} beltName={belt.name} size="md" />
                      {isCurrent && <span className="text-xs font-semibold text-[#C81E2B]">Current Rank</span>}
                      {isEarned && <span className="text-xs font-semibold text-[#166534]">Achieved</span>}
                    </div>
                    <div className="text-xs text-[#6B7280]">{belt.korean_name}</div>
                    <p className="text-xs text-[#4B5563] leading-relaxed">{belt.description}</p>
                  </div>

                  <div className="pt-3 border-t border-[#E5E7EB] space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Minimum Hours</span>
                      <span className="font-mono tabular-nums font-semibold text-[#111317]">{belt.min_hours}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Required Attendance</span>
                      <span className="font-mono tabular-nums font-semibold text-[#111317]">{belt.min_attendance_pct}%</span>
                    </div>
                    <div className="pt-1 text-[#374151]">
                      <span className="font-semibold">Poomsae:</span> {belt.required_poomsae}
                    </div>
                    <div className="text-[#4B5563]">
                      <span className="font-semibold text-[#374151]">Techniques:</span> {belt.required_techniques}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Grading Examinations Schedule */}
      <section className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-[#111317]">Grading Examination Schedule</h2>
        <div className="divide-y divide-[#E5E7EB]">
          {exams.map((exam) => (
            <div key={exam.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-display text-base font-bold text-[#111317]">{exam.title}</h3>
                  <span className={`text-xs font-semibold ${exam.status === 'upcoming' ? 'text-[#C81E2B]' : 'text-[#6B7280]'}`}>
                    · {exam.status === 'upcoming' ? 'Upcoming' : 'Completed'}
                  </span>
                </div>
                <div className="text-xs text-[#6B7280] flex flex-wrap items-center gap-2">
                  <span className="font-mono tabular-nums text-[#111317] font-medium">{exam.exam_date}</span>
                  <span aria-hidden="true">·</span>
                  <span>{exam.location}</span>
                  <span aria-hidden="true">·</span>
                  <span>Examiner: {exam.examiner_name}</span>
                  <span aria-hidden="true">·</span>
                  <span>Target: {exam.target_belt_name}</span>
                </div>
              </div>

              {user.role !== 'student' && (
                <button
                  type="button"
                  onClick={() => setGradeModalExam(exam)}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#111317] hover:bg-[#C81E2B] text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Record Exam Score
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Examination Results & Promotion History */}
      <section className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#C59B27]" />
          <h2 className="font-display text-lg font-bold text-[#111317]">Examination Results & Promotion History</h2>
        </div>

        {results.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No examination results recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280]">
                  <th className="py-2.5 pr-4">Date</th>
                  {user.role !== 'student' && <th className="py-2.5 px-4">Candidate</th>}
                  <th className="py-2.5 px-4">Examination</th>
                  <th className="py-2.5 px-4">Target Rank</th>
                  <th className="py-2.5 px-4 text-right">Forms</th>
                  <th className="py-2.5 px-4 text-right">Kicks</th>
                  <th className="py-2.5 px-4 text-right">Sparring</th>
                  <th className="py-2.5 px-4 text-right">Theory</th>
                  <th className="py-2.5 pl-4">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {results.map((res) => (
                  <tr key={res.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-3 pr-4 font-mono tabular-nums text-xs text-[#4B5563] whitespace-nowrap">
                      {res.exam_date}
                    </td>
                    {user.role !== 'student' && <td className="py-3 px-4 font-medium text-[#111317]">{res.student_name}</td>}
                    <td className="py-3 px-4 font-medium text-[#111317]">{res.exam_title}</td>
                    <td className="py-3 px-4">
                      <BeltMark colorHex={res.target_belt_color} beltName={res.target_belt_name} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{res.forms_score}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{res.kicking_score}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{res.sparring_score}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{res.theory_score}</td>
                    <td className="py-3 pl-4 font-semibold text-xs">
                      <span className={res.passed ? 'text-[#166534]' : 'text-[#C81E2B]'}>
                        {res.passed ? 'Promoted' : 'Retest Required'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Schedule Exam Modal */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <h2 className="font-display text-lg font-bold text-[#111317]">Schedule Grading Exam</h2>
              <button type="button" onClick={() => setShowExamModal(false)} className="p-1 text-[#6B7280]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleScheduleExam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Exam Title</label>
                <input
                  type="text"
                  required
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="e.g., Q1 Color Belt Promotion"
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Exam Date</label>
                  <input
                    type="date"
                    required
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Reg. Deadline</label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Target Belt</label>
                  <select
                    value={targetBeltId}
                    onChange={(e) => setTargetBeltId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  >
                    {belts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Location</label>
                  <input
                    type="text"
                    required
                    value={examLocation}
                    onChange={(e) => setExamLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowExamModal(false)} className="px-4 py-2 text-xs font-medium text-[#6B7280]">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-[#C81E2B] text-white rounded-lg cursor-pointer">
                  Schedule Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Exam Result Modal */}
      {gradeModalExam && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div>
                <h2 className="font-display text-lg font-bold text-[#111317]">Record Exam Evaluation</h2>
                <p className="text-xs text-[#6B7280]">{gradeModalExam.title}</p>
              </div>
              <button type="button" onClick={() => setGradeModalExam(null)} className="p-1 text-[#6B7280]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGradeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Candidate Student</label>
                <select
                  value={gradeStudentId}
                  onChange={(e) => setGradeStudentId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.belt_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Forms Score (0–100)</label>
                  <input type="number" min={0} max={100} value={formsScore} onChange={(e) => setFormsScore(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Kicking Score (0–100)</label>
                  <input type="number" min={0} max={100} value={kickingScore} onChange={(e) => setKickingScore(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Sparring Score (0–100)</label>
                  <input type="number" min={0} max={100} value={sparringScore} onChange={(e) => setSparringScore(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Theory Score (0–100)</label>
                  <input type="number" min={0} max={100} value={theoryScore} onChange={(e) => setTheoryScore(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg font-mono" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-[#111317] cursor-pointer">
                <input type="checkbox" checked={passed} onChange={(e) => setPassed(e.target.checked)} className="accent-[#C81E2B]" />
                <span>Pass & Promote to {gradeModalExam.target_belt_name}</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Examiner Notes</label>
                <textarea rows={2} value={gradeNotes} onChange={(e) => setGradeNotes(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setGradeModalExam(null)} className="px-4 py-2 text-xs font-medium text-[#6B7280]">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-[#C81E2B] text-white rounded-lg cursor-pointer">
                  Save Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
