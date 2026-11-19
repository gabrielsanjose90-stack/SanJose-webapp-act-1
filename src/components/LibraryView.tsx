import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Megaphone, Play, Search, Dumbbell } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type {
  AnnouncementItem,
  ConditioningExercise,
  TerminologyItem,
  TrainingModule,
  UserRole,
} from '../types';

interface LibraryViewProps {
  role: UserRole;
  onOpenCurriculum: () => void;
  onDataChanged: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ role, onOpenCurriculum, onDataChanged }) => {
  const [dailyTip, setDailyTip] = useState('');
  const [terminology, setTerminology] = useState<TerminologyItem[]>([]);
  const [exercises, setExercises] = useState<ConditioningExercise[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [termQuery, setTermQuery] = useState('');
  const [focusFilter, setFocusFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  // Announcement composer
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPriority, setAnnPriority] = useState<'normal' | 'important'>('normal');
  const [posting, setPosting] = useState(false);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const [resData, modData] = await Promise.all([
        apiFetch<{
          dailyTip: string;
          terminology: TerminologyItem[];
          exercises: ConditioningExercise[];
          announcements: AnnouncementItem[];
        }>('/api/resources'),
        apiFetch<{ modules: TrainingModule[] }>('/api/modules'),
      ]);
      setDailyTip(resData.dailyTip);
      setTerminology(resData.terminology);
      setExercises(resData.exercises);
      setAnnouncements(resData.announcements);
      setModules(modData.modules);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: annTitle, body: annBody, priority: annPriority }),
      });
      setAnnTitle('');
      setAnnBody('');
      await loadLibrary();
      onDataChanged();
    } finally {
      setPosting(false);
    }
  };

  const filteredTerms = useMemo(() => {
    const q = termQuery.trim().toLowerCase();
    if (!q) return terminology;
    return terminology.filter(
      (t) =>
        t.romanized.toLowerCase().includes(q) ||
        t.english.toLowerCase().includes(q) ||
        t.korean.includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [terminology, termQuery]);

  const filteredExercises = useMemo(() => {
    if (focusFilter === 'All') return exercises;
    return exercises.filter((ex) => ex.focus_area === focusFilter);
  }, [exercises, focusFilter]);

  if (loading && terminology.length === 0) {
    return <div className="h-64 bg-white border border-[#E5E7EB] rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#111317]">Academy Library & Resources</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Video drill catalog, Korean Taekwondo terminology dictionary, conditioning workouts, and dojang announcements.
        </p>
      </div>

      {/* Daily Training Tip Banner */}
      <div className="bg-[#111317] text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#C59B27] flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>Daily Training Tip</span>
          </div>
          <p className="text-base text-white leading-relaxed max-w-3xl">{dailyTip}</p>
        </div>
        <button
          type="button"
          onClick={onOpenCurriculum}
          className="px-4 py-2 bg-[#C81E2B] hover:bg-[#A61722] text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          Practice Drills
        </button>
      </div>

      {/* Training Video Library Strip */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[#111317]">Training Video Library</h2>
          <button type="button" onClick={onOpenCurriculum} className="text-xs font-semibold text-[#C81E2B] hover:underline">
            Open Full Curriculum
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.slice(0, 8).map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={onOpenCurriculum}
              className="text-left bg-white border border-[#E5E7EB] rounded-xl overflow-hidden hover:border-[#111317]/40 transition-colors cursor-pointer"
            >
              <div className="aspect-[16/9] bg-[#111317] relative">
                <img
                  src={mod.image_url}
                  alt={mod.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end justify-between p-3 text-white">
                  <span className="inline-flex items-center gap-1 text-xs font-medium">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Lesson</span>
                  </span>
                  <span className="font-mono tabular-nums text-xs">{mod.video_duration}</span>
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-xs text-[#6B7280]">{mod.category}</div>
                <div className="font-display text-sm font-bold text-[#111317] mt-0.5 truncate">{mod.title}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Conditioning Exercises & Terminology */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Terminology Dictionary */}
        <section className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-[#111317]">Taekwondo Terminology Dictionary</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={termQuery}
                onChange={(e) => setTermQuery(e.target.value)}
                placeholder="Search Korean or English..."
                className="pl-8 pr-3 py-1.5 text-xs border border-[#D1D5DB] rounded-lg w-full sm:w-52"
              />
            </div>
          </div>

          <div className="divide-y divide-[#E5E7EB] max-h-[440px] overflow-y-auto pr-1">
            {filteredTerms.map((term) => (
              <div key={term.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="font-display font-bold text-sm text-[#111317]">{term.romanized}</span>
                    <span className="text-sm text-[#6B7280] ml-2">{term.korean}</span>
                  </div>
                  <span className="text-xs font-medium text-[#C81E2B]">{term.english}</span>
                </div>
                <div className="text-xs text-[#6B7280] mt-0.5">
                  {term.category} · {term.notes}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fitness & Conditioning Exercises */}
        <section className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#C81E2B]" />
              <h2 className="font-display text-lg font-bold text-[#111317]">Fitness & Conditioning</h2>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-[#F3F4F6] rounded-lg overflow-x-auto">
              {['All', 'Flexibility', 'Stamina', 'Speed', 'Strength'].map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setFocusFilter(area)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                    focusFilter === area ? 'bg-white text-[#111317] shadow-sm' : 'text-[#6B7280]'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#E5E7EB] max-h-[440px] overflow-y-auto pr-1">
            {filteredExercises.map((ex) => (
              <div key={ex.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#111317]">{ex.title}</h3>
                  <span className="text-xs font-mono tabular-nums text-[#C81E2B] whitespace-nowrap">{ex.duration_mins} min</span>
                </div>
                <div className="text-xs font-mono text-[#6B7280]">
                  {ex.focus_area} · {ex.sets_reps}
                </div>
                <p className="text-xs text-[#4B5563] leading-relaxed">{ex.instructions}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Announcements Board */}
      <section className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#C81E2B]" />
          <h2 className="font-display text-lg font-bold text-[#111317]">Dojang Announcements</h2>
        </div>

        {role !== 'student' && (
          <form onSubmit={handlePublishAnnouncement} className="p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Announcement headline..."
                className="sm:col-span-2 px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg"
              />
              <select
                value={annPriority}
                onChange={(e) => setAnnPriority(e.target.value as 'normal' | 'important')}
                className="px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg"
              >
                <option value="normal">Standard Notice</option>
                <option value="important">Important Priority</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Share schedule updates, tournament registrations, or gear reminders..."
                className="flex-1 px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg"
              />
              <button
                type="submit"
                disabled={posting}
                className="px-4 py-2 bg-[#111317] hover:bg-[#C81E2B] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {posting ? 'Posting...' : 'Post & Notify All'}
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-[#E5E7EB]">
          {announcements.map((ann) => (
            <div key={ann.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#111317]">{ann.title}</h3>
                {ann.priority === 'important' && <span className="text-xs font-semibold text-[#C81E2B]">Important</span>}
              </div>
              <p className="text-sm text-[#4B5563]">{ann.body}</p>
              <div className="text-xs text-[#6B7280]">
                {ann.author_name} · <span className="font-mono tabular-nums">{ann.created_at.slice(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
