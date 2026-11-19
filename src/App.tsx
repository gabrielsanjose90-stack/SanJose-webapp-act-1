/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboard,
  Layers,
  Calendar,
  ClipboardCheck,
  Award,
  Activity,
  BookOpen,
  Users,
  Bell,
  LogOut,
  Menu,
  X,
  Settings,
} from 'lucide-react';
import { apiFetch, setStoredToken } from './lib/api';
import type { NotificationItem, UserAccount } from './types';
import { AuthGate } from './components/AuthGate';
import { UserAvatar } from './components/BeltMark';
import { ProfileModal } from './components/ProfileModal';
import { OverviewView } from './components/OverviewView';
import { ModulesView } from './components/ModulesView';
import { ScheduleView } from './components/ScheduleView';
import { AttendanceView } from './components/AttendanceView';
import { BeltsView } from './components/BeltsView';
import { ProgressView } from './components/ProgressView';
import { LibraryView } from './components/LibraryView';
import { RosterAdminView } from './components/RosterAdminView';

type TabKey = 'overview' | 'modules' | 'schedule' | 'attendance' | 'belts' | 'progress' | 'library' | 'roster';

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<'admin' | 'instructor' | 'student'>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['student', 'instructor', 'admin'] },
  { key: 'modules', label: 'Training Modules', icon: Layers, roles: ['student', 'instructor', 'admin'] },
  { key: 'schedule', label: 'Schedule', icon: Calendar, roles: ['student', 'instructor', 'admin'] },
  { key: 'attendance', label: 'Attendance', icon: ClipboardCheck, roles: ['student', 'instructor', 'admin'] },
  { key: 'belts', label: 'Belt & Grading', icon: Award, roles: ['student', 'instructor', 'admin'] },
  { key: 'progress', label: 'Progress & Skills', icon: Activity, roles: ['student', 'instructor', 'admin'] },
  { key: 'library', label: 'Academy Library', icon: BookOpen, roles: ['student', 'instructor', 'admin'] },
  { key: 'roster', label: 'Roster & Users', icon: Users, roles: ['instructor', 'admin'] },
];

export default function App() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const loadNotifications = async () => {
    try {
      const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(res.notifications);
    } catch {
      // ignore if unauthenticated
    }
  };

  const refreshUser = async () => {
    try {
      const res = await apiFetch<{ user: UserAccount }>('/api/auth/me');
      setUser(res.user);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiFetch<{ user: UserAccount }>('/api/auth/me');
        setUser(res.user);
      } catch {
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, refreshSignal]);

  const handleAuthenticated = (authedUser: UserAccount) => {
    setUser(authedUser);
    setActiveTab('overview');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setNotifications([]);
  };

  const handleMarkNotificationRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // ignore
    }
  };

  const handleDataChanged = () => {
    setRefreshSignal((s) => s + 1);
    refreshUser();
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0D0F12] text-white flex items-center justify-center">
        <div className="text-sm font-medium text-[#9CA3AF]">Loading TKD Training Hub...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  const permittedNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const currentNav = permittedNav.find((n) => n.key === activeTab) || permittedNav[0];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const navigateTo = (tab: string) => {
    const valid = permittedNav.find((n) => n.key === tab);
    if (valid) {
      setActiveTab(valid.key);
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#111317] flex">
      {/* Desktop Obsidian Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:fixed lg:inset-y-0 bg-[#0D0F12] text-white border-r border-[#23262E]">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-[#23262E] shrink-0">
          <div className="w-7 h-7 bg-[#C81E2B] flex items-center justify-center font-display font-bold text-xs text-white shrink-0">
            태권
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
            TKD Training Hub
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
          {permittedNav.map((item) => {
            const Icon = item.icon;
            const active = currentNav.key === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigateTo(item.key)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#C81E2B] text-white'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#23262E] space-y-3">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
          >
            <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{user.name}</div>
              <div className="text-xs text-[#9CA3AF] capitalize truncate">
                {user.role}
                {user.studentProfile ? ` · ${user.studentProfile.belt_name}` : ''}
              </div>
            </div>
            <Settings className="w-4 h-4 text-[#9CA3AF] shrink-0" />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-[#0D0F12] text-white flex flex-col h-full z-10">
            <div className="h-14 px-5 flex items-center justify-between border-b border-[#23262E]">
              <span className="font-display text-base font-bold text-white">TKD Training Hub</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-[#9CA3AF] hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {permittedNav.map((item) => {
                const Icon = item.icon;
                const active = currentNav.key === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateTo(item.key)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg ${
                      active ? 'bg-[#C81E2B] text-white' : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#23262E] space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileOpen(true);
                }}
                className="w-full py-2 px-3 text-left text-xs font-medium text-white bg-white/10 rounded-lg"
              >
                Account & Profile Settings
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 px-3 text-left text-xs font-medium text-[#D1D5DB]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-w-0">
        {/* Top Workspace Bar */}
        <header className="h-14 lg:h-16 bg-white border-b border-[#E5E7EB] px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#111317] hover:bg-[#F3F4F6] rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-[#6B7280] flex items-center gap-2 truncate">
              <span className="hidden sm:inline">TKD Training Hub</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-semibold text-[#111317] truncate">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 text-[#4B5563] hover:text-[#111317] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#C81E2B] text-white text-[10px] font-mono tabular-nums font-semibold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            >
              <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
              <span className="hidden sm:inline text-xs font-semibold text-[#111317] whitespace-nowrap">
                {user.name}
              </span>
            </button>

            {/* Notifications Popover */}
            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-[#111317]">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-[#C81E2B] hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#6B7280]">No notifications yet.</div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleMarkNotificationRead(n.id)}
                        className={`w-full text-left p-3.5 hover:bg-[#F9FAFB] transition-colors ${
                          n.is_read ? 'opacity-70' : 'bg-[#C81E2B]/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#111317]">{n.title}</span>
                          {!n.is_read && <span className="text-[10px] font-semibold text-[#C81E2B]">New</span>}
                        </div>
                        <p className="text-xs text-[#4B5563] mt-0.5">{n.message}</p>
                        <div className="text-[10px] font-mono text-[#9CA3AF] mt-1">{n.created_at.slice(0, 16)}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1280px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentNav.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {currentNav.key === 'overview' && (
                <OverviewView onNavigate={navigateTo} refreshSignal={refreshSignal} />
              )}
              {currentNav.key === 'modules' && (
                <ModulesView role={user.role} onDataChanged={handleDataChanged} />
              )}
              {currentNav.key === 'schedule' && (
                <ScheduleView role={user.role} onDataChanged={handleDataChanged} />
              )}
              {currentNav.key === 'attendance' && (
                <AttendanceView role={user.role} onDataChanged={handleDataChanged} />
              )}
              {currentNav.key === 'belts' && (
                <BeltsView user={user} onDataChanged={handleDataChanged} />
              )}
              {currentNav.key === 'progress' && (
                <ProgressView user={user} onDataChanged={handleDataChanged} />
              )}
              {currentNav.key === 'library' && (
                <LibraryView
                  role={user.role}
                  onOpenCurriculum={() => navigateTo('modules')}
                  onDataChanged={handleDataChanged}
                />
              )}
              {currentNav.key === 'roster' && user.role !== 'student' && (
                <RosterAdminView
                  role={user.role}
                  onEvaluateStudent={() => navigateTo('progress')}
                  onDataChanged={handleDataChanged}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Account & Profile Modal */}
      {profileOpen && (
        <ProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onUpdated={(updated) => {
            setUser(updated);
            setRefreshSignal((s) => s + 1);
          }}
        />
      )}
    </div>
  );
}
