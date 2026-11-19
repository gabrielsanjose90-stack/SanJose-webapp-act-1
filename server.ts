import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  type AuthenticatedRequest,
  type UserRole,
  hashPassword,
  requireAuth,
  requireRole,
  signSessionToken,
  verifyPassword,
} from './server/auth.ts';
import { db, initializeDatabase } from './server/db.ts';

initializeDatabase();

const DAILY_TIPS = [
  'Keep your standing foot pivoted cleanly during Dollyo Chagi to protect your knee and unlock full hip whip.',
  'Exhale sharply at the final 10% of every punch or block—tension before impact slows down hand speed.',
  'In Ap Kubi (Front Stance), verify your front knee aligns vertically above your ankle without caving inward.',
  'During sparring footwork, keep your weight centered on the balls of your feet so directional changes stay silent and instant.',
  'Practice Taegeuk forms at 50% speed once per week to spot balance shifts and chamber alignment flaws.',
  'Warm up hip flexors dynamically with leg swings before attempting high Axe or Hook kicks.',
  'Breathe evenly through the nose between sparring exchanges to preserve mental clarity in the final 30 seconds.',
];

function getDailyTip(): string {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % DAILY_TIPS.length;
  return DAILY_TIPS[dayIndex];
}

function getSafeUser(userId: number) {
  const user = db
    .prepare('SELECT id, name, email, role, avatar_url, phone, bio, status, created_at FROM users WHERE id = ?')
    .get(userId) as Record<string, unknown> | undefined;
  if (!user) return null;

  if (user.role === 'student') {
    const profile = db
      .prepare(`
        SELECT sp.*, br.name as belt_name, br.rank_order, br.korean_name as belt_korean_name, br.color_hex as belt_color
        FROM student_profiles sp
        JOIN belt_rankings br ON br.id = sp.current_belt_id
        WHERE sp.user_id = ?
      `)
      .get(userId) as Record<string, unknown> | undefined;
    return { ...user, studentProfile: profile ?? null };
  }

  const instProfile = db
    .prepare('SELECT * FROM instructor_profiles WHERE user_id = ?')
    .get(userId) as Record<string, unknown> | undefined;
  return { ...user, instructorProfile: instProfile ?? null };
}

function unlockAchievement(userId: number, code: string): void {
  const ach = db.prepare('SELECT id, title FROM achievements WHERE code = ?').get(code) as
    | { id: number; title: string }
    | undefined;
  if (!ach) return;
  const existing = db
    .prepare('SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?')
    .get(userId, ach.id);
  if (!existing) {
    db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, ach.id);
    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      userId,
      'Achievement Unlocked',
      `You earned the "${ach.title}" milestone.`,
      'achievement'
    );
  }
}

function checkStudentMilestones(studentId: number): void {
  const completedModules = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM student_progress WHERE student_id = ? AND status = 'completed'")
      .get(studentId) as { cnt: number }
  ).cnt;
  if (completedModules >= 1) unlockAchievement(studentId, 'FIRST_STEP');
  if (completedModules >= 10) unlockAchievement(studentId, 'TECHNIQUE_SCHOLAR');

  const profile = db
    .prepare('SELECT total_hours FROM student_profiles WHERE user_id = ?')
    .get(studentId) as { total_hours: number } | undefined;
  if (profile) {
    if (profile.total_hours >= 50) unlockAchievement(studentId, 'FIFTY_HOURS');
    if (profile.total_hours >= 100) unlockAchievement(studentId, 'CENTURY_MAT');
  }

  const attStats = db
    .prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as attended
       FROM attendance_records WHERE student_id = ?`
    )
    .get(studentId) as { total: number; attended: number };
  if (attStats.total >= 3 && Math.round((attStats.attended / attStats.total) * 100) >= 85) {
    unlockAchievement(studentId, 'IRON_ATTENDANCE');
  }
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie('tkd_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // =========================================================================
  // AUTHENTICATION & ACCOUNT MANAGEMENT
  // =========================================================================

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = db
      .prepare('SELECT id, password_hash, role, status FROM users WHERE LOWER(email) = LOWER(?)')
      .get(email.trim()) as { id: number; password_hash: string; role: UserRole; status: string } | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: 'This account has been deactivated. Contact a dojang administrator.' });
      return;
    }

    const token = signSessionToken(user.id, user.role);
    setSessionCookie(res, token);
    res.json({ token, user: getSafeUser(user.id) });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { name, email, password, role, phone, emergencyContact } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    // Allow self-registration as student or instructor (never self-assigned admin)
    const assignedRole: UserRole = role === 'instructor' ? 'instructor' : 'student';

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (existing) {
      res.status(409).json({ error: 'An account with that email already exists.' });
      return;
    }

    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, role, phone, bio) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        name.trim(),
        email.trim().toLowerCase(),
        hashPassword(password),
        assignedRole,
        typeof phone === 'string' ? phone.trim() : '',
        assignedRole === 'instructor'
          ? 'Certified Taekwondo Academy Instructor'
          : 'Taekwondo student training at TKD Training Hub.'
      );
    const newUserId = Number(result.lastInsertRowid);

    if (assignedRole === 'student') {
      const whiteBelt = db.prepare('SELECT id FROM belt_rankings WHERE rank_order = 1').get() as { id: number };
      db.prepare(
        `INSERT INTO student_profiles (user_id, current_belt_id, emergency_contact, total_hours, flexibility_score, stamina_score, speed_score, strength_score)
         VALUES (?, ?, ?, 0, 62, 64, 62, 60)`
      ).run(newUserId, whiteBelt.id, typeof emergencyContact === 'string' ? emergencyContact.trim() : '');
    } else {
      db.prepare(
        `INSERT INTO instructor_profiles (user_id, dan_rank, specialty, certification_id, years_experience)
         VALUES (?, '1st Dan Black Belt', 'General Taekwondo', 'KKW-NEW', 2)`
      ).run(newUserId);
    }

    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      newUserId,
      'Welcome to TKD Training Hub',
      'Your dojang profile is active. Explore your training curriculum and reserve an upcoming session.',
      'info'
    );

    const token = signSessionToken(newUserId, assignedRole);
    setSessionCookie(res, token);
    res.status(201).json({ token, user: getSafeUser(newUserId) });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('tkd_session', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = getSafeUser(req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    res.json({ user });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId;
    const { name, phone, bio, emergencyContact, avatarUrl, currentPassword, newPassword } = req.body ?? {};

    if (typeof name === 'string' && name.trim().length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }

    if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
      if (!avatarUrl.startsWith('data:image/') && !avatarUrl.startsWith('/')) {
        res.status(400).json({ error: 'Invalid profile picture format.' });
        return;
      }
      if (avatarUrl.length > 2_500_000) {
        res.status(400).json({ error: 'Profile image must be smaller than 2 MB.' });
        return;
      }
    }

    const currentUser = db.prepare('SELECT id, name, phone, bio, avatar_url, password_hash, role FROM users WHERE id = ?').get(userId) as
      | { id: number; name: string; phone: string; bio: string; avatar_url: string; password_hash: string; role: UserRole }
      | undefined;
    if (!currentUser) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    let nextPasswordHash = String(currentUser.password_hash);
    if (typeof newPassword === 'string' && newPassword.length > 0) {
      if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, nextPasswordHash)) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters.' });
        return;
      }
      nextPasswordHash = hashPassword(newPassword);
    }

    db.prepare(
      `UPDATE users
       SET name = ?, phone = ?, bio = ?, avatar_url = ?, password_hash = ?
       WHERE id = ?`
    ).run(
      typeof name === 'string' && name.trim() ? name.trim() : currentUser.name,
      typeof phone === 'string' ? phone.trim() : currentUser.phone,
      typeof bio === 'string' ? bio.trim() : currentUser.bio,
      typeof avatarUrl === 'string' ? avatarUrl : currentUser.avatar_url,
      nextPasswordHash,
      userId
    );

    if (currentUser.role === 'student' && typeof emergencyContact === 'string') {
      db.prepare('UPDATE student_profiles SET emergency_contact = ? WHERE user_id = ?').run(
        emergencyContact.trim(),
        userId
      );
    }

    res.json({ user: getSafeUser(userId) });
  });

  // =========================================================================
  // ROLE-TAILORED DASHBOARD SUMMARY
  // =========================================================================

  app.get('/api/dashboard', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { userId, role } = req.auth!;
    const user = getSafeUser(userId);
    const announcements = db
      .prepare(
        `SELECT a.*, u.name as author_name
         FROM announcements a JOIN users u ON u.id = a.author_id
         ORDER BY a.created_at DESC LIMIT 4`
      )
      .all();

    const unreadNotifications = (
      db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0').get(userId) as {
        cnt: number;
      }
    ).cnt;

    if (role === 'student') {
      const attStats = db
        .prepare(
          `SELECT COUNT(*) as total,
                  SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as attended
           FROM attendance_records WHERE student_id = ?`
        )
        .get(userId) as { total: number; attended: number };
      const attendancePct = attStats.total > 0 ? Math.round((attStats.attended / attStats.total) * 100) : 100;

      const modStats = db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM training_modules) as total_modules,
             (SELECT COUNT(*) FROM student_progress WHERE student_id = ? AND status = 'completed') as completed_modules,
             (SELECT COUNT(*) FROM student_progress WHERE student_id = ? AND status = 'in_progress') as in_progress_modules`
        )
        .get(userId, userId) as { total_modules: number; completed_modules: number; in_progress_modules: number };

      const upcomingSessions = db
        .prepare(
          `SELECT ts.*, u.name as instructor_name,
                  EXISTS(SELECT 1 FROM session_registrations sr WHERE sr.schedule_id = ts.id AND sr.student_id = ?) as is_registered,
                  (SELECT COUNT(*) FROM session_registrations sr WHERE sr.schedule_id = ts.id) as registered_count
           FROM training_schedules ts
           JOIN users u ON u.id = ts.instructor_id
           WHERE ts.session_date >= '2026-11-19'
           ORDER BY ts.session_date ASC, ts.start_time ASC
           LIMIT 5`
        )
        .all(userId);

      const earnedAchievements = db
        .prepare(
          `SELECT a.*, ua.earned_at
           FROM user_achievements ua
           JOIN achievements a ON a.id = ua.achievement_id
           WHERE ua.user_id = ?
           ORDER BY ua.earned_at DESC`
        )
        .all(userId);

      const recentFeedback = db
        .prepare(
          `SELECT f.*, u.name as instructor_name
           FROM instructor_feedback f
           JOIN users u ON u.id = f.instructor_id
           WHERE f.student_id = ?
           ORDER BY f.created_at DESC LIMIT 3`
        )
        .all(userId);

      const nextBelt = db
        .prepare(
          `SELECT br.*
           FROM belt_rankings br
           JOIN student_profiles sp ON sp.user_id = ?
           JOIN belt_rankings cur ON cur.id = sp.current_belt_id
           WHERE br.rank_order = cur.rank_order + 1`
        )
        .get(userId);

      res.json({
        role,
        user,
        dailyTip: getDailyTip(),
        unreadNotifications,
        announcements,
        studentMetrics: {
          attendancePct,
          sessionsAttended: attStats.attended,
          sessionsRecorded: attStats.total,
          totalModules: modStats.total_modules,
          completedModules: modStats.completed_modules,
          inProgressModules: modStats.in_progress_modules,
          completionPct:
            modStats.total_modules > 0 ? Math.round((modStats.completed_modules / modStats.total_modules) * 100) : 0,
        },
        nextBelt: nextBelt ?? null,
        upcomingSessions,
        earnedAchievements,
        recentFeedback,
      });
      return;
    }

    // Instructor or Admin overview metrics
    const totalStudents = (
      db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'student' AND status = 'active'").get() as {
        cnt: number;
      }
    ).cnt;
    const totalInstructors = (
      db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role IN ('instructor', 'admin') AND status = 'active'").get() as {
        cnt: number;
      }
    ).cnt;
    const upcomingCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM training_schedules WHERE session_date >= '2026-11-19'").get() as {
        cnt: number;
      }
    ).cnt;
    const attOverall = db
      .prepare(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as attended
         FROM attendance_records`
      )
      .get() as { total: number; attended: number };
    const avgAttendancePct = attOverall.total > 0 ? Math.round((attOverall.attended / attOverall.total) * 100) : 0;

    const upcomingSessions = db
      .prepare(
        `SELECT ts.*, u.name as instructor_name,
                (SELECT COUNT(*) FROM session_registrations sr WHERE sr.schedule_id = ts.id) as registered_count
         FROM training_schedules ts
         JOIN users u ON u.id = ts.instructor_id
         WHERE ts.session_date >= '2026-11-19'
         ORDER BY ts.session_date ASC, ts.start_time ASC
         LIMIT 6`
      )
      .all();

    const beltDistribution = db
      .prepare(
        `SELECT br.name, br.color_hex, br.rank_order, COUNT(sp.user_id) as student_count
         FROM belt_rankings br
         LEFT JOIN student_profiles sp ON sp.current_belt_id = br.id
         GROUP BY br.id
         ORDER BY br.rank_order ASC`
      )
      .all();

    const recentFeedback = db
      .prepare(
        `SELECT f.*, s.name as student_name, i.name as instructor_name
         FROM instructor_feedback f
         JOIN users s ON s.id = f.student_id
         JOIN users i ON i.id = f.instructor_id
         ORDER BY f.created_at DESC LIMIT 5`
      )
      .all();

    const upcomingExams = db
      .prepare(
        `SELECT ge.*, br.name as target_belt_name, u.name as examiner_name
         FROM grading_exams ge
         JOIN belt_rankings br ON br.id = ge.target_belt_id
         JOIN users u ON u.id = ge.examiner_id
         WHERE ge.status = 'upcoming'
         ORDER BY ge.exam_date ASC`
      )
      .all();

    res.json({
      role,
      user,
      dailyTip: getDailyTip(),
      unreadNotifications,
      announcements,
      academyMetrics: {
        totalStudents,
        totalInstructors,
        upcomingSessions: upcomingCount,
        avgAttendancePct,
        upcomingExamsCount: upcomingExams.length,
      },
      upcomingSessions,
      beltDistribution,
      recentFeedback,
      upcomingExams,
    });
  });

  // =========================================================================
  // TRAINING MODULES & PROGRESS
  // =========================================================================

  app.get('/api/modules', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId;
    const rows = db
      .prepare(
        `SELECT tm.*,
                COALESCE(sp.status, 'not_started') as progress_status,
                COALESCE(sp.mastery_score, 0) as mastery_score,
                sp.completed_at
         FROM training_modules tm
         LEFT JOIN student_progress sp ON sp.module_id = tm.id AND sp.student_id = ?
         ORDER BY tm.sort_order ASC, tm.id ASC`
      )
      .all(userId) as Array<Record<string, unknown>>;

    const modules = rows.map((row) => ({
      ...row,
      key_points: (() => {
        try {
          return JSON.parse(String(row.key_points || '[]'));
        } catch {
          return [];
        }
      })(),
    }));

    res.json({ modules });
  });

  app.post('/api/modules', requireAuth, requireRole('instructor', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const { category, title, koreanTerm, beltLevel, difficulty, durationMins, description, keyPoints } = req.body ?? {};
    const validCategories = ['Basic Techniques', 'Kicking Techniques', 'Forms (Poomsae)', 'Sparring Training'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: 'Invalid training module category.' });
      return;
    }
    if (typeof title !== 'string' || title.trim().length < 2 || typeof description !== 'string' || description.trim().length < 5) {
      res.status(400).json({ error: 'Title and description are required.' });
      return;
    }

    const imageByCategory: Record<string, string> = {
      'Basic Techniques': '/src/assets/images/module_basic_techniques_1795076516571.jpg',
      'Kicking Techniques': '/src/assets/images/module_kicking_techniques_1795076516858.jpg',
      'Forms (Poomsae)': '/src/assets/images/module_poomsae_forms_1795076516258.jpg',
      'Sparring Training': '/src/assets/images/module_sparring_training_1795076516384.jpg',
    };

    const pointsArray = Array.isArray(keyPoints)
      ? keyPoints.map((p) => String(p).trim()).filter(Boolean)
      : typeof keyPoints === 'string'
        ? keyPoints.split('\n').map((s) => s.trim()).filter(Boolean)
        : ['Maintain proper posture and breathing control'];

    const resDb = db
      .prepare(
        `INSERT INTO training_modules (category, title, korean_term, belt_level, difficulty, duration_mins, description, key_points, video_duration, image_url, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '05:00', ?, 99)`
      )
      .run(
        category,
        title.trim(),
        typeof koreanTerm === 'string' ? koreanTerm.trim() : '',
        typeof beltLevel === 'string' ? beltLevel.trim() : 'All Belts',
        typeof difficulty === 'string' ? difficulty.trim() : 'Intermediate',
        Number(durationMins) > 0 ? Number(durationMins) : 25,
        description.trim(),
        JSON.stringify(pointsArray),
        imageByCategory[category]
      );

    res.status(201).json({ id: Number(resDb.lastInsertRowid) });
  });

  app.post('/api/modules/:id/progress', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const moduleId = Number(req.params.id);
    const targetStudentId =
      req.auth!.role !== 'student' && req.body?.studentId ? Number(req.body.studentId) : req.auth!.userId;
    const { status, masteryScore } = req.body ?? {};

    if (!['not_started', 'in_progress', 'completed'].includes(status)) {
      res.status(400).json({ error: 'Invalid progress status.' });
      return;
    }

    const mod = db.prepare('SELECT id, duration_mins FROM training_modules WHERE id = ?').get(moduleId) as
      | { id: number; duration_mins: number }
      | undefined;
    if (!mod) {
      res.status(404).json({ error: 'Training module not found.' });
      return;
    }

    const existing = db
      .prepare('SELECT status FROM student_progress WHERE student_id = ? AND module_id = ?')
      .get(targetStudentId, moduleId) as { status: string } | undefined;

    const score =
      typeof masteryScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(masteryScore)))
        : status === 'completed'
          ? 90
          : status === 'in_progress'
            ? 50
            : 0;
    const completedAt = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

    db.prepare(
      `INSERT INTO student_progress (student_id, module_id, status, mastery_score, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(student_id, module_id) DO UPDATE SET
         status = excluded.status,
         mastery_score = excluded.mastery_score,
         completed_at = COALESCE(excluded.completed_at, student_progress.completed_at),
         updated_at = datetime('now')`
    ).run(targetStudentId, moduleId, status, score, completedAt);

    // Award training hours & XP when newly completed
    if (status === 'completed' && existing?.status !== 'completed') {
      const hoursAdded = Number((mod.duration_mins / 60).toFixed(2));
      db.prepare('UPDATE student_profiles SET total_hours = ROUND(total_hours + ?, 2), xp_points = xp_points + 120 WHERE user_id = ?').run(
        hoursAdded,
        targetStudentId
      );
      checkStudentMilestones(targetStudentId);
    }

    res.json({ ok: true, status, masteryScore: score });
  });

  // =========================================================================
  // TRAINING SCHEDULES & REGISTRATIONS
  // =========================================================================

  app.get('/api/schedules', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId;
    const schedules = db
      .prepare(
        `SELECT ts.*, u.name as instructor_name,
                EXISTS(SELECT 1 FROM session_registrations sr WHERE sr.schedule_id = ts.id AND sr.student_id = ?) as is_registered,
                COALESCE((SELECT sr.reminder_sent FROM session_registrations sr WHERE sr.schedule_id = ts.id AND sr.student_id = ?), 0) as reminder_sent,
                (SELECT COUNT(*) FROM session_registrations sr WHERE sr.schedule_id = ts.id) as registered_count
         FROM training_schedules ts
         JOIN users u ON u.id = ts.instructor_id
         ORDER BY ts.session_date ASC, ts.start_time ASC`
      )
      .all(userId, userId);

    const instructors = db
      .prepare("SELECT id, name, role FROM users WHERE role IN ('instructor', 'admin') AND status = 'active' ORDER BY name ASC")
      .all();

    res.json({ schedules, instructors });
  });

  app.post('/api/schedules', requireAuth, requireRole('instructor', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const { title, category, instructorId, sessionDate, startTime, endTime, location, beltRequirement, capacity, description } =
      req.body ?? {};

    if (typeof title !== 'string' || title.trim().length < 3) {
      res.status(400).json({ error: 'Session title must be at least 3 characters.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sessionDate || ''))) {
      res.status(400).json({ error: 'Valid session date (YYYY-MM-DD) is required.' });
      return;
    }
    if (!startTime || !endTime || !location) {
      res.status(400).json({ error: 'Start time, end time, and location are required.' });
      return;
    }

    const assignedInstructorId = req.auth!.role === 'admin' && instructorId ? Number(instructorId) : req.auth!.userId;

    const resDb = db
      .prepare(
        `INSERT INTO training_schedules (title, category, instructor_id, session_date, start_time, end_time, location, belt_requirement, capacity, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title.trim(),
        category || 'Basic Techniques',
        assignedInstructorId,
        sessionDate,
        startTime,
        endTime,
        String(location).trim(),
        beltRequirement || 'All Belts',
        Math.max(4, Math.min(60, Number(capacity) || 20)),
        typeof description === 'string' ? description.trim() : ''
      );

    res.status(201).json({ id: Number(resDb.lastInsertRowid) });
  });

  app.delete('/api/schedules/:id', requireAuth, requireRole('instructor', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const scheduleId = Number(req.params.id);
    const existing = db.prepare('SELECT instructor_id FROM training_schedules WHERE id = ?').get(scheduleId) as
      | { instructor_id: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Training session not found.' });
      return;
    }
    if (req.auth!.role === 'instructor' && existing.instructor_id !== req.auth!.userId) {
      res.status(403).json({ error: 'Instructors can only cancel their own training sessions.' });
      return;
    }
    db.prepare('DELETE FROM training_schedules WHERE id = ?').run(scheduleId);
    res.json({ ok: true });
  });

  app.post('/api/schedules/:id/register', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const scheduleId = Number(req.params.id);
    const studentId = req.auth!.userId;

    const sched = db
      .prepare(
        `SELECT ts.*, (SELECT COUNT(*) FROM session_registrations sr WHERE sr.schedule_id = ts.id) as registered_count
         FROM training_schedules ts WHERE ts.id = ?`
      )
      .get(scheduleId) as { id: number; title: string; session_date: string; start_time: string; capacity: number; registered_count: number } | undefined;

    if (!sched) {
      res.status(404).json({ error: 'Training session not found.' });
      return;
    }
    if (sched.registered_count >= sched.capacity) {
      res.status(409).json({ error: 'This training session has reached full capacity.' });
      return;
    }

    db.prepare('INSERT OR IGNORE INTO session_registrations (schedule_id, student_id) VALUES (?, ?)').run(
      scheduleId,
      studentId
    );

    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      studentId,
      'Session Reservation Confirmed',
      `Registered for "${sched.title}" on ${sched.session_date} at ${sched.start_time}.`,
      'reminder'
    );

    res.json({ ok: true });
  });

  app.delete('/api/schedules/:id/register', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const scheduleId = Number(req.params.id);
    db.prepare('DELETE FROM session_registrations WHERE schedule_id = ? AND student_id = ?').run(
      scheduleId,
      req.auth!.userId
    );
    res.json({ ok: true });
  });

  app.post('/api/schedules/:id/remind', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const scheduleId = Number(req.params.id);
    const userId = req.auth!.userId;
    const sched = db.prepare('SELECT title, session_date, start_time, location FROM training_schedules WHERE id = ?').get(scheduleId) as
      | { title: string; session_date: string; start_time: string; location: string }
      | undefined;
    if (!sched) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    if (req.auth!.role === 'student') {
      db.prepare('UPDATE session_registrations SET reminder_sent = 1 WHERE schedule_id = ? AND student_id = ?').run(
        scheduleId,
        userId
      );
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        userId,
        'Session Reminder Armed',
        `Reminder set for ${sched.title} · ${sched.session_date} at ${sched.start_time} (${sched.location}).`,
        'reminder'
      );
      res.json({ ok: true, count: 1 });
      return;
    }

    // Instructor/Admin sends reminder to all registered students
    const regs = db
      .prepare('SELECT student_id FROM session_registrations WHERE schedule_id = ?')
      .all(scheduleId) as Array<{ student_id: number }>;
    const insertNotif = db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)');
    for (const r of regs) {
      insertNotif.run(
        r.student_id,
        'Instructor Session Reminder',
        `Don't forget: ${sched.title} on ${sched.session_date} at ${sched.start_time} (${sched.location}).`,
        'reminder'
      );
    }
    db.prepare('UPDATE session_registrations SET reminder_sent = 1 WHERE schedule_id = ?').run(scheduleId);
    res.json({ ok: true, count: regs.length });
  });

  // =========================================================================
  // ATTENDANCE MANAGEMENT
  // =========================================================================

  app.get('/api/attendance', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { userId, role } = req.auth!;
    if (role === 'student') {
      const records = db
        .prepare(
          `SELECT ar.*, ts.title as session_title, ts.category, ts.session_date, ts.start_time, ts.end_time, ts.location, u.name as recorder_name
           FROM attendance_records ar
           JOIN training_schedules ts ON ts.id = ar.schedule_id
           JOIN users u ON u.id = ar.recorded_by
           WHERE ar.student_id = ?
           ORDER BY ts.session_date DESC, ts.start_time DESC`
        )
        .all(userId);
      res.json({ records });
      return;
    }

    const scheduleIdFilter = req.query.scheduleId ? Number(req.query.scheduleId) : null;
    const records = scheduleIdFilter
      ? db
          .prepare(
            `SELECT ar.*, ts.title as session_title, ts.category, ts.session_date, ts.start_time,
                    s.name as student_name, br.name as belt_name, br.color_hex as belt_color, rec.name as recorder_name
             FROM attendance_records ar
             JOIN training_schedules ts ON ts.id = ar.schedule_id
             JOIN users s ON s.id = ar.student_id
             JOIN student_profiles sp ON sp.user_id = s.id
             JOIN belt_rankings br ON br.id = sp.current_belt_id
             JOIN users rec ON rec.id = ar.recorded_by
             WHERE ar.schedule_id = ?
             ORDER BY s.name ASC`
          )
          .all(scheduleIdFilter)
      : db
          .prepare(
            `SELECT ar.*, ts.title as session_title, ts.category, ts.session_date, ts.start_time,
                    s.name as student_name, br.name as belt_name, br.color_hex as belt_color, rec.name as recorder_name
             FROM attendance_records ar
             JOIN training_schedules ts ON ts.id = ar.schedule_id
             JOIN users s ON s.id = ar.student_id
             JOIN student_profiles sp ON sp.user_id = s.id
             JOIN belt_rankings br ON br.id = sp.current_belt_id
             JOIN users rec ON rec.id = ar.recorded_by
             ORDER BY ts.session_date DESC, s.name ASC
             LIMIT 100`
          )
          .all();

    const studentSummaries = db
      .prepare(
        `SELECT u.id as student_id, u.name as student_name, br.name as belt_name, br.color_hex as belt_color,
                sp.total_hours,
                COUNT(ar.id) as total_sessions,
                SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) as attended_sessions
         FROM users u
         JOIN student_profiles sp ON sp.user_id = u.id
         JOIN belt_rankings br ON br.id = sp.current_belt_id
         LEFT JOIN attendance_records ar ON ar.student_id = u.id
         WHERE u.role = 'student'
         GROUP BY u.id
         ORDER BY u.name ASC`
      )
      .all();

    res.json({ records, studentSummaries });
  });

  app.post('/api/attendance', requireAuth, requireRole('instructor', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const { scheduleId, entries } = req.body ?? {};
    if (!scheduleId || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'Schedule ID and attendance entries are required.' });
      return;
    }

    const sched = db.prepare('SELECT id FROM training_schedules WHERE id = ?').get(Number(scheduleId));
    if (!sched) {
      res.status(404).json({ error: 'Training session not found.' });
      return;
    }

    const upsert = db.prepare(
      `INSERT INTO attendance_records (schedule_id, student_id, status, recorded_by, notes, recorded_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(schedule_id, student_id) DO UPDATE SET
         status = excluded.status,
         recorded_by = excluded.recorded_by,
         notes = excluded.notes,
         recorded_at = datetime('now')`
    );

    const validStatuses = ['present', 'late', 'absent', 'excused'];
    let updatedCount = 0;

    for (const entry of entries) {
      const studentId = Number(entry.studentId);
      const status = String(entry.status);
      if (!studentId || !validStatuses.includes(status)) continue;

      const prev = db
        .prepare('SELECT status FROM attendance_records WHERE schedule_id = ? AND student_id = ?')
        .get(Number(scheduleId), studentId) as { status: string } | undefined;

      upsert.run(Number(scheduleId), studentId, status, req.auth!.userId, String(entry.notes || '').trim());
      updatedCount++;

      // Increment training hours by 1.25h if newly marked present/late
      const wasCounted = prev && ['present', 'late'].includes(prev.status);
      const nowCounted = ['present', 'late'].includes(status);
      if (!wasCounted && nowCounted) {
        db.prepare('UPDATE student_profiles SET total_hours = ROUND(total_hours + 1.25, 2), xp_points = xp_points + 60 WHERE user_id = ?').run(
          studentId
        );
      } else if (wasCounted && !nowCounted) {
        db.prepare('UPDATE student_profiles SET total_hours = MAX(0, ROUND(total_hours - 1.25, 2)) WHERE user_id = ?').run(
          studentId
        );
      }
      checkStudentMilestones(studentId);
    }

    res.json({ ok: true, updatedCount });
  });

  // =========================================================================
  // BELT RANKINGS, GRADING EXAMS & PROMOTIONS
  // =========================================================================

  app.get('/api/belts', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { userId, role } = req.auth!;
    const belts = db.prepare('SELECT * FROM belt_rankings ORDER BY rank_order ASC').all();
    const exams = db
      .prepare(
        `SELECT ge.*, br.name as target_belt_name, br.color_hex as target_belt_color, u.name as examiner_name
         FROM grading_exams ge
         JOIN belt_rankings br ON br.id = ge.target_belt_id
         JOIN users u ON u.id = ge.examiner_id
         ORDER BY ge.exam_date DESC`
      )
      .all();

    const examResults =
      role === 'student'
        ? db
            .prepare(
              `SELECT er.*, ge.title as exam_title, ge.exam_date, br.name as target_belt_name, br.color_hex as target_belt_color, s.name as student_name
               FROM exam_results er
               JOIN grading_exams ge ON ge.id = er.exam_id
               JOIN belt_rankings br ON br.id = er.target_belt_id
               JOIN users s ON s.id = er.student_id
               WHERE er.student_id = ?
               ORDER BY ge.exam_date DESC`
            )
            .all(userId)
        : db
            .prepare(
              `SELECT er.*, ge.title as exam_title, ge.exam_date, br.name as target_belt_name, br.color_hex as target_belt_color, s.name as student_name
               FROM exam_results er
               JOIN grading_exams ge ON ge.id = er.exam_id
               JOIN belt_rankings br ON br.id = er.target_belt_id
               JOIN users s ON s.id = er.student_id
               ORDER BY ge.exam_date DESC, s.name ASC`
            )
            .all();

    res.json({ belts, exams, examResults });
  });

  app.post('/api/exams', requireAuth, requireRole('instructor', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const { title, examDate, location, targetBeltId, registrationDeadline } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length < 3 || !examDate || !targetBeltId) {
      res.status(400).json({ error: 'Exam title, date, and target belt are required.' });
      return;
    }

    const resDb = db
      .prepare(
        `INSERT INTO grading_exams (title, exam_date, location, target_belt_id, examiner_id, registration_deadline, status)
         VALUES (?, ?, ?, ?, ?, ?, 'upcoming')`
      )
      .run(
        title.trim(),
        examDate,
        location || 'Main Dojang · Mat A',
        Number(targetBeltId),
        req.auth!.userId,
        registrationDeadline || examDate
      );

    res.status(201).json({ id: Number(resDb.lastInsertRowid) });
  });

  app.post('/api/exams/:id/results', requireAuth, requireRole('instructor', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const examId = Number(req.params.id);
    const { studentId, formsScore, kickingScore, sparringScore, theoryScore, passed, notes } = req.body ?? {};

    const exam = db.prepare('SELECT * FROM grading_exams WHERE id = ?').get(examId) as
      | { id: number; target_belt_id: number; exam_date: string }
      | undefined;
    if (!exam) {
      res.status(404).json({ error: 'Grading exam not found.' });
      return;
    }

    const student = db.prepare('SELECT user_id FROM student_profiles WHERE user_id = ?').get(Number(studentId));
    if (!student) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }

    const isPassed = Boolean(passed);
    const promotedAt = isPassed ? new Date().toISOString().slice(0, 10) : null;

    db.prepare(
      `INSERT INTO exam_results (exam_id, student_id, target_belt_id, forms_score, kicking_score, sparring_score, theory_score, passed, promoted_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(exam_id, student_id) DO UPDATE SET
         forms_score = excluded.forms_score,
         kicking_score = excluded.kicking_score,
         sparring_score = excluded.sparring_score,
         theory_score = excluded.theory_score,
         passed = excluded.passed,
         promoted_at = excluded.promoted_at,
         notes = excluded.notes`
    ).run(
      examId,
      Number(studentId),
      exam.target_belt_id,
      Number(formsScore) || 0,
      Number(kickingScore) || 0,
      Number(sparringScore) || 0,
      Number(theoryScore) || 0,
      isPassed ? 1 : 0,
      promotedAt,
      String(notes || '').trim()
    );

    if (isPassed) {
      db.prepare('UPDATE student_profiles SET current_belt_id = ? WHERE user_id = ? AND current_belt_id < ?').run(
        exam.target_belt_id,
        Number(studentId),
        exam.target_belt_id
      );
      const belt = db.prepare('SELECT name FROM belt_rankings WHERE id = ?').get(exam.target_belt_id) as { name: string };
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        Number(studentId),
        'Belt Promotion Confirmed',
        `Congratulations! You passed the grading examination and have been promoted to ${belt.name}.`,
        'exam'
      );
      unlockAchievement(Number(studentId), 'BELT_CLIMBER');
    }

    res.json({ ok: true });
  });

  app.patch('/api/belts/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const beltId = Number(req.params.id);
    const { minHours, minAttendancePct, requiredTechniques, requiredPoomsae, description } = req.body ?? {};
    const existing = db.prepare('SELECT min_hours, min_attendance_pct, required_techniques, required_poomsae, description FROM belt_rankings WHERE id = ?').get(beltId) as
      | { min_hours: number; min_attendance_pct: number; required_techniques: string; required_poomsae: string; description: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Belt rank not found.' });
      return;
    }
    db.prepare(
      `UPDATE belt_rankings
       SET min_hours = ?, min_attendance_pct = ?, required_techniques = ?, required_poomsae = ?, description = ?
       WHERE id = ?`
    ).run(
      typeof minHours === 'number' ? Math.max(0, minHours) : existing.min_hours,
      typeof minAttendancePct === 'number' ? Math.max(0, Math.min(100, minAttendancePct)) : existing.min_attendance_pct,
      typeof requiredTechniques === 'string' && requiredTechniques.trim() ? requiredTechniques.trim() : existing.required_techniques,
      typeof requiredPoomsae === 'string' && requiredPoomsae.trim() ? requiredPoomsae.trim() : existing.required_poomsae,
      typeof description === 'string' && description.trim() ? description.trim() : existing.description,
      beltId
    );
    res.json({ ok: true });
  });

  // =========================================================================
  // PROGRESS TRACKING & INSTRUCTOR EVALUATIONS
  // =========================================================================

  app.get('/api/progress', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const targetStudentId =
      req.auth!.role !== 'student' && req.query.studentId ? Number(req.query.studentId) : req.auth!.userId;

    const student = getSafeUser(targetStudentId);
    const categoryBreakdown = db
      .prepare(
        `SELECT tm.category,
                COUNT(tm.id) as total,
                SUM(CASE WHEN sp.status = 'completed' THEN 1 ELSE 0 END) as completed,
                ROUND(AVG(COALESCE(sp.mastery_score, 0))) as avg_mastery
         FROM training_modules tm
         LEFT JOIN student_progress sp ON sp.module_id = tm.id AND sp.student_id = ?
         GROUP BY tm.category`
      )
      .all(targetStudentId);

    const feedback = db
      .prepare(
        `SELECT f.*, u.name as instructor_name
         FROM instructor_feedback f
         JOIN users u ON u.id = f.instructor_id
         WHERE f.student_id = ?
         ORDER BY f.created_at DESC`
      )
      .all(targetStudentId);

    const history = db
      .prepare(
        `SELECT ts.title, ts.category, ts.session_date, ts.start_time, ts.location, ar.status
         FROM attendance_records ar
         JOIN training_schedules ts ON ts.id = ar.schedule_id
         WHERE ar.student_id = ?
         ORDER BY ts.session_date DESC
         LIMIT 15`
      )
      .all(targetStudentId);

    const allAchievements = db
      .prepare(
        `SELECT a.*, ua.earned_at
         FROM achievements a
         LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ?
         ORDER BY a.id ASC`
      )
      .all(targetStudentId);

    res.json({
      student,
      categoryBreakdown,
      feedback,
      history,
      achievements: allAchievements,
    });
  });

  app.post('/api/feedback', requireAuth, requireRole('instructor', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const { studentId, category, rating, comment, flexibilityDelta, staminaDelta, speedDelta, strengthDelta } = req.body ?? {};
    if (!studentId || typeof comment !== 'string' || comment.trim().length < 5) {
      res.status(400).json({ error: 'Student ID and evaluation comment (min 5 characters) are required.' });
      return;
    }

    const flexD = Math.max(-5, Math.min(10, Number(flexibilityDelta) || 0));
    const stamD = Math.max(-5, Math.min(10, Number(staminaDelta) || 0));
    const speedD = Math.max(-5, Math.min(10, Number(speedDelta) || 0));
    const strD = Math.max(-5, Math.min(10, Number(strengthDelta) || 0));

    db.prepare(
      `INSERT INTO instructor_feedback (student_id, instructor_id, category, rating, comment, flexibility_delta, stamina_delta, speed_delta, strength_delta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      Number(studentId),
      req.auth!.userId,
      category || 'General Technique',
      Math.max(1, Math.min(5, Number(rating) || 5)),
      comment.trim(),
      flexD,
      stamD,
      speedD,
      strD
    );

    db.prepare(
      `UPDATE student_profiles
       SET flexibility_score = MIN(100, MAX(20, flexibility_score + ?)),
           stamina_score = MIN(100, MAX(20, stamina_score + ?)),
           speed_score = MIN(100, MAX(20, speed_score + ?)),
           strength_score = MIN(100, MAX(20, strength_score + ?))
       WHERE user_id = ?`
    ).run(flexD, stamD, speedD, strD, Number(studentId));

    const inst = db.prepare('SELECT name FROM users WHERE id = ?').get(req.auth!.userId) as { name: string };
    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      Number(studentId),
      'New Instructor Evaluation',
      `${inst.name} posted new feedback on your ${category || 'technique'} performance.`,
      'feedback'
    );

    res.status(201).json({ ok: true });
  });

  // =========================================================================
  // STUDENTS ROSTER & ADMIN MANAGEMENT
  // =========================================================================

  app.get('/api/students', requireAuth, requireRole('instructor', 'admin'), (_req: AuthenticatedRequest, res: Response) => {
    const students = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.status, u.bio,
                sp.current_belt_id, sp.total_hours, sp.flexibility_score, sp.stamina_score, sp.speed_score, sp.strength_score, sp.join_date, sp.emergency_contact,
                br.name as belt_name, br.color_hex as belt_color, br.rank_order,
                (SELECT COUNT(*) FROM student_progress p WHERE p.student_id = u.id AND p.status = 'completed') as completed_modules,
                (SELECT COUNT(*) FROM attendance_records ar WHERE ar.student_id = u.id) as total_att,
                (SELECT SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) FROM attendance_records ar WHERE ar.student_id = u.id) as present_att
         FROM users u
         JOIN student_profiles sp ON sp.user_id = u.id
         JOIN belt_rankings br ON br.id = sp.current_belt_id
         WHERE u.role = 'student'
         ORDER BY br.rank_order DESC, u.name ASC`
      )
      .all();

    res.json({ students });
  });

  app.get('/api/admin/users', requireAuth, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
    const users = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.phone, u.status, u.created_at, u.avatar_url,
                sp.current_belt_id, br.name as belt_name, br.color_hex as belt_color, sp.total_hours,
                ip.dan_rank, ip.specialty
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         LEFT JOIN belt_rankings br ON br.id = sp.current_belt_id
         LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
         ORDER BY CASE u.role WHEN 'admin' THEN 1 WHEN 'instructor' THEN 2 ELSE 3 END, u.name ASC`
      )
      .all();
    res.json({ users });
  });

  app.patch('/api/admin/users/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    const targetId = Number(req.params.id);
    const { role, status, beltId } = req.body ?? {};
    const target = db.prepare('SELECT id, role, status FROM users WHERE id = ?').get(targetId) as
      | { id: number; role: UserRole; status: string }
      | undefined;

    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (targetId === req.auth!.userId && status === 'inactive') {
      res.status(400).json({ error: 'You cannot deactivate your own administrator account.' });
      return;
    }

    const nextRole: UserRole = ['admin', 'instructor', 'student'].includes(role) ? role : target.role;
    const nextStatus = ['active', 'inactive'].includes(status) ? status : target.status;

    db.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').run(nextRole, nextStatus, targetId);

    if (nextRole === 'student') {
      const hasStudentProfile = db.prepare('SELECT user_id FROM student_profiles WHERE user_id = ?').get(targetId);
      if (!hasStudentProfile) {
        const whiteBelt = db.prepare('SELECT id FROM belt_rankings WHERE rank_order = 1').get() as { id: number };
        db.prepare('INSERT INTO student_profiles (user_id, current_belt_id) VALUES (?, ?)').run(targetId, whiteBelt.id);
      }
      if (beltId) {
        db.prepare('UPDATE student_profiles SET current_belt_id = ? WHERE user_id = ?').run(Number(beltId), targetId);
      }
    } else if (nextRole === 'instructor' || nextRole === 'admin') {
      const hasInstProfile = db.prepare('SELECT user_id FROM instructor_profiles WHERE user_id = ?').get(targetId);
      if (!hasInstProfile) {
        db.prepare('INSERT INTO instructor_profiles (user_id) VALUES (?)').run(targetId);
      }
    }

    res.json({ ok: true, user: getSafeUser(targetId) });
  });

  app.get('/api/admin/reports/attendance.csv', requireAuth, requireRole('instructor', 'admin'), (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT ts.session_date, ts.title as session_title, u.name as student_name, br.name as belt_rank, ar.status, ar.notes
         FROM attendance_records ar
         JOIN training_schedules ts ON ts.id = ar.schedule_id
         JOIN users u ON u.id = ar.student_id
         JOIN student_profiles sp ON sp.user_id = u.id
         JOIN belt_rankings br ON br.id = sp.current_belt_id
         ORDER BY ts.session_date DESC, u.name ASC`
      )
      .all() as Array<Record<string, string>>;

    const escapeCsv = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'Date,Session,Student,Belt Rank,Status,Notes';
    const lines = rows.map((r) =>
      [r.session_date, r.session_title, r.student_name, r.belt_rank, r.status, r.notes].map(escapeCsv).join(',')
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tkd-attendance-report.csv"');
    res.send([header, ...lines].join('\n'));
  });

  // =========================================================================
  // RESOURCES, TERMINOLOGY, CONDITIONING, ANNOUNCEMENTS & NOTIFICATIONS
  // =========================================================================

  app.get('/api/resources', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const terminology = db.prepare('SELECT * FROM terminology ORDER BY category ASC, romanized ASC').all();
    const exercises = db.prepare('SELECT * FROM conditioning_exercises ORDER BY focus_area ASC, id ASC').all();
    const announcements = db
      .prepare(
        `SELECT a.*, u.name as author_name
         FROM announcements a JOIN users u ON u.id = a.author_id
         ORDER BY a.created_at DESC`
      )
      .all();

    res.json({
      dailyTip: getDailyTip(),
      terminology,
      exercises,
      announcements,
    });
  });

  app.post('/api/announcements', requireAuth, requireRole('instructor', 'admin'), (req: AuthenticatedRequest, res: Response) => {
    const { title, body, priority } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length < 3 || typeof body !== 'string' || body.trim().length < 5) {
      res.status(400).json({ error: 'Announcement title and message body are required.' });
      return;
    }

    const p = priority === 'important' ? 'important' : 'normal';
    const resDb = db
      .prepare('INSERT INTO announcements (title, body, priority, author_id) VALUES (?, ?, ?, ?)')
      .run(title.trim(), body.trim(), p, req.auth!.userId);

    const activeUsers = db.prepare("SELECT id FROM users WHERE status = 'active' AND id != ?").all(req.auth!.userId) as Array<{
      id: number;
    }>;
    const insertNotif = db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)');
    for (const u of activeUsers) {
      insertNotif.run(u.id, title.trim(), body.trim(), 'announcement');
    }

    res.status(201).json({ id: Number(resDb.lastInsertRowid) });
  });

  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const notifications = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 25')
      .all(req.auth!.userId);
    res.json({ notifications });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
      Number(req.params.id),
      req.auth!.userId
    );
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.auth!.userId);
    res.json({ ok: true });
  });

  // =========================================================================
  // VITE MIDDLEWARE (DEV) OR STATIC SERVING (PROD)
  // =========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`TKD Training Hub running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TKD Training Hub server:', err);
  process.exit(1);
});
