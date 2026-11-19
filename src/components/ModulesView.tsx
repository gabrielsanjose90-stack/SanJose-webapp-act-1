import React, { useEffect, useMemo, useState } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Clock, Plus, X, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { TrainingModule, UserRole } from '../types';

const CATEGORIES: Array<TrainingModule['category'] | 'All'> = [
  'All',
  'Basic Techniques',
  'Kicking Techniques',
  'Forms (Poomsae)',
  'Sparring Training',
];

const CATEGORY_IMAGES: Record<TrainingModule['category'], string> = {
  'Basic Techniques': '/src/assets/images/module_basic_techniques_1795076516571.jpg',
  'Kicking Techniques': '/src/assets/images/module_kicking_techniques_1795076516858.jpg',
  'Forms (Poomsae)': '/src/assets/images/module_poomsae_forms_1795076516258.jpg',
  'Sparring Training': '/src/assets/images/module_sparring_training_1795076516384.jpg',
};

interface ModulesViewProps {
  role: UserRole;
  onDataChanged: () => void;
}

export const ModulesView: React.FC<ModulesViewProps> = ({ role, onDataChanged }) => {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Drill timer inside modal
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [updatingProgress, setUpdatingProgress] = useState(false);

  // Create form state (Instructors/Admins)
  const [newCategory, setNewCategory] = useState<TrainingModule['category']>('Basic Techniques');
  const [newTitle, setNewTitle] = useState('');
  const [newKorean, setNewKorean] = useState('');
  const [newBelt, setNewBelt] = useState('Yellow Belt');
  const [newDifficulty, setNewDifficulty] = useState('Intermediate');
  const [newDuration, setNewDuration] = useState(25);
  const [newDescription, setNewDescription] = useState('');
  const [newKeyPoints, setNewKeyPoints] = useState('');
  const [creating, setCreating] = useState(false);

  const loadModules = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ modules: TrainingModule[] }>('/api/modules');
      setModules(res.modules);
      if (selectedModule) {
        const refreshed = res.modules.find((m) => m.id === selectedModule.id);
        if (refreshed) setSelectedModule(refreshed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load training modules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const openModule = (mod: TrainingModule) => {
    setSelectedModule(mod);
    setTimerRunning(false);
    setTimerSeconds(mod.duration_mins * 60);
  };

  const updateProgress = async (modId: number, status: 'in_progress' | 'completed') => {
    setUpdatingProgress(true);
    try {
      await apiFetch(`/api/modules/${modId}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          masteryScore: status === 'completed' ? 92 : 60,
        }),
      });
      await loadModules();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update progress.');
    } finally {
      setUpdatingProgress(false);
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/api/modules', {
        method: 'POST',
        body: JSON.stringify({
          category: newCategory,
          title: newTitle,
          koreanTerm: newKorean,
          beltLevel: newBelt,
          difficulty: newDifficulty,
          durationMins: newDuration,
          description: newDescription,
          keyPoints: newKeyPoints,
        }),
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewKorean('');
      setNewDescription('');
      setNewKeyPoints('');
      await loadModules();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create training module.');
    } finally {
      setCreating(false);
    }
  };

  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const catMatch = activeCategory === 'All' || m.category === activeCategory;
      const q = search.trim().toLowerCase();
      const qMatch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.korean_term.toLowerCase().includes(q) ||
        m.belt_level.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q);
      return catMatch && qMatch;
    });
  }, [modules, activeCategory, search]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111317]">
            Taekwondo Training Curriculum
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Structured drills across Basic Techniques, Kicking Techniques, Forms (Poomsae), and Sparring Training.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search techniques or Korean terms..."
              className="pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#C81E2B] w-64"
            />
          </div>
          {role !== 'student' && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C81E2B] hover:bg-[#A61722] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Program</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#EFEFF1] rounded-lg overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeCategory === cat
                ? 'bg-white text-[#111317] shadow-sm'
                : 'text-[#6B7280] hover:text-[#111317]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg">{error}</div>
      )}

      {/* Category Feature Banner when specific category selected */}
      {activeCategory !== 'All' && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-4 min-h-[160px] bg-[#111317] relative">
            <img
              src={CATEGORY_IMAGES[activeCategory as TrainingModule['category']]}
              alt={activeCategory}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="md:col-span-8 p-6 flex flex-col justify-center">
            <p className="text-xs font-semibold text-[#C81E2B]">Category Focus</p>
            <h2 className="font-display text-xl font-bold text-[#111317] mt-1">{activeCategory}</h2>
            <p className="text-sm text-[#4B5563] mt-1.5">
              {filteredModules.length} curriculum modules available · Select any drill below to launch the guided posture checklist, timer, and mastery tracker.
            </p>
          </div>
        </div>
      )}

      {/* Modules Grid */}
      {loading && modules.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-white border border-[#E5E7EB] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredModules.map((mod) => (
            <article
              key={mod.id}
              className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden flex flex-col hover:border-[#111317]/40 transition-colors"
            >
              <div className="aspect-[16/9] bg-[#111317] relative overflow-hidden">
                <img
                  src={mod.image_url || CATEGORY_IMAGES[mod.category]}
                  alt={mod.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white">
                  <span className="font-medium">{mod.category}</span>
                  <span className="font-mono tabular-nums">{mod.video_duration}</span>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-xs text-[#6B7280] flex items-center gap-2">
                    <span>{mod.korean_term || mod.difficulty}</span>
                    <span aria-hidden="true">·</span>
                    <span>{mod.belt_level}</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#111317] mt-1">{mod.title}</h3>
                  <p className="text-sm text-[#4B5563] mt-1.5 line-clamp-2">{mod.description}</p>
                </div>

                <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between gap-3">
                  <div className="text-xs font-medium flex items-center gap-1.5">
                    {mod.progress_status === 'completed' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                        <span className="text-[#166534]">Mastered</span>
                      </>
                    ) : mod.progress_status === 'in_progress' ? (
                      <>
                        <Clock className="w-4 h-4 text-[#D97706]" />
                        <span className="text-[#92400E]">In Progress</span>
                      </>
                    ) : (
                      <span className="text-[#6B7280] font-mono tabular-nums">{mod.duration_mins} min drill</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openModule(mod)}
                    className="px-3.5 py-1.5 bg-[#111317] hover:bg-[#C81E2B] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Open Drill
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {filteredModules.length === 0 && !loading && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#111317]">No training modules match your search filter.</p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('All');
              setSearch('');
            }}
            className="mt-3 px-4 py-2 text-xs font-semibold text-[#C81E2B] border border-[#E5E7EB] rounded-lg"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Interactive Drill & Video Inspection Modal */}
      {selectedModule && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div>
                <div className="text-xs text-[#6B7280] flex items-center gap-2">
                  <span>{selectedModule.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedModule.belt_level}</span>
                </div>
                <h2 className="font-display text-xl font-bold text-[#111317] mt-0.5">
                  {selectedModule.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setSelectedModule(null);
                }}
                className="p-2 text-[#6B7280] hover:text-[#111317] rounded-lg hover:bg-[#F3F4F6]"
                aria-label="Close drill modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Visual Video Player Surface */}
              <div className="aspect-[16/9] bg-[#0D0F12] rounded-xl overflow-hidden relative">
                <img
                  src={selectedModule.image_url || CATEGORY_IMAGES[selectedModule.category]}
                  alt={selectedModule.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-5 text-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs text-[#C59B27] font-medium">{selectedModule.korean_term}</div>
                      <div className="font-display text-lg font-bold mt-0.5">Guided Practice Session</div>
                    </div>
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-white/15 rounded-lg px-3 py-2">
                      <span className="font-mono tabular-nums text-lg font-semibold mr-2">
                        {formatTimer(timerSeconds)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTimerRunning((r) => !r)}
                        className="p-1.5 bg-[#C81E2B] rounded-md hover:bg-[#A61722] transition-colors cursor-pointer"
                        aria-label={timerRunning ? 'Pause drill timer' : 'Start drill timer'}
                      >
                        {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTimerRunning(false);
                          setTimerSeconds(selectedModule.duration_mins * 60);
                        }}
                        className="p-1.5 bg-white/15 rounded-md hover:bg-white/25 transition-colors cursor-pointer"
                        aria-label="Reset drill timer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-7 space-y-3">
                  <h3 className="font-display text-sm font-bold text-[#111317]">Technical Breakdown</h3>
                  <p className="text-sm text-[#4B5563] leading-relaxed">{selectedModule.description}</p>
                </div>
                <div className="md:col-span-5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-4 space-y-2.5">
                  <h3 className="font-display text-sm font-bold text-[#111317]">Key Execution Points</h3>
                  <ul className="space-y-2 text-xs text-[#374151]">
                    {selectedModule.key_points.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono tabular-nums text-[#C81E2B] font-semibold">0{idx + 1}.</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[#6B7280]">
                  Status:{' '}
                  <span className="font-semibold text-[#111317]">
                    {selectedModule.progress_status === 'completed'
                      ? 'Completed & Mastered'
                      : selectedModule.progress_status === 'in_progress'
                        ? 'In Progress'
                        : 'Not Started'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={updatingProgress}
                    onClick={() => updateProgress(selectedModule.id, 'in_progress')}
                    className="px-4 py-2 text-xs font-semibold border border-[#D1D5DB] text-[#111317] rounded-lg hover:bg-[#F3F4F6] cursor-pointer"
                  >
                    Mark In Progress
                  </button>
                  <button
                    type="button"
                    disabled={updatingProgress}
                    onClick={() => updateProgress(selectedModule.id, 'completed')}
                    className="px-4 py-2 text-xs font-semibold bg-[#C81E2B] hover:bg-[#A61722] text-white rounded-lg transition-colors cursor-pointer"
                  >
                    {updatingProgress ? 'Saving...' : 'Complete & Log Practice'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructor Create Module Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <h2 className="font-display text-lg font-bold text-[#111317]">Add Training Module</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1.5 text-[#6B7280] hover:text-[#111317]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateModule} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TrainingModule['category'])}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  >
                    <option>Basic Techniques</option>
                    <option>Kicking Techniques</option>
                    <option>Forms (Poomsae)</option>
                    <option>Sparring Training</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Belt Level</label>
                  <select
                    value={newBelt}
                    onChange={(e) => setNewBelt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  >
                    <option>All Belts</option>
                    <option>White Belt</option>
                    <option>Yellow Belt</option>
                    <option>Green Belt</option>
                    <option>Blue Belt</option>
                    <option>Red Belt</option>
                    <option>Black Belt</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Module Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Spinning Hook Kick"
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Korean Term</label>
                  <input
                    type="text"
                    value={newKorean}
                    onChange={(e) => setNewKorean(e.target.value)}
                    placeholder="e.g., Dwi Huryeo Chagi"
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Difficulty</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  >
                    <option>Fundamental</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    min={5}
                    max={90}
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Key Technical Points (one per line)</label>
                <textarea
                  rows={3}
                  value={newKeyPoints}
                  onChange={(e) => setNewKeyPoints(e.target.value)}
                  placeholder="Pivot base foot cleanly&#10;Spot target over shoulder"
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-xs font-medium text-[#6B7280]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-semibold bg-[#C81E2B] text-white rounded-lg cursor-pointer"
                >
                  {creating ? 'Creating...' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
