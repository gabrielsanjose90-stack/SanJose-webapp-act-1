import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.ts';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tkd_hub.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'instructor', 'student')),
      avatar_url TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS belt_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      rank_order INTEGER NOT NULL UNIQUE,
      korean_name TEXT NOT NULL,
      color_hex TEXT NOT NULL,
      min_hours INTEGER NOT NULL DEFAULT 20,
      min_attendance_pct INTEGER NOT NULL DEFAULT 75,
      required_techniques TEXT NOT NULL,
      required_poomsae TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      current_belt_id INTEGER NOT NULL REFERENCES belt_rankings(id),
      date_of_birth TEXT DEFAULT '',
      emergency_contact TEXT DEFAULT '',
      join_date TEXT NOT NULL DEFAULT (date('now')),
      total_hours REAL NOT NULL DEFAULT 0,
      flexibility_score INTEGER NOT NULL DEFAULT 60,
      stamina_score INTEGER NOT NULL DEFAULT 60,
      speed_score INTEGER NOT NULL DEFAULT 60,
      strength_score INTEGER NOT NULL DEFAULT 60,
      xp_points INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS instructor_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      dan_rank TEXT NOT NULL DEFAULT '4th Dan Black Belt',
      specialty TEXT NOT NULL DEFAULT 'All-Around Taekwondo',
      certification_id TEXT DEFAULT '',
      years_experience INTEGER NOT NULL DEFAULT 5
    );

    CREATE TABLE IF NOT EXISTS training_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK(category IN ('Basic Techniques', 'Kicking Techniques', 'Forms (Poomsae)', 'Sparring Training')),
      title TEXT NOT NULL,
      korean_term TEXT NOT NULL DEFAULT '',
      belt_level TEXT NOT NULL DEFAULT 'All Belts',
      difficulty TEXT NOT NULL DEFAULT 'Fundamental',
      duration_mins INTEGER NOT NULL DEFAULT 20,
      description TEXT NOT NULL,
      key_points TEXT NOT NULL DEFAULT '[]',
      video_url TEXT NOT NULL DEFAULT '',
      video_duration TEXT NOT NULL DEFAULT '04:30',
      image_url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS student_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id INTEGER NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed')),
      mastery_score INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS training_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      instructor_id INTEGER NOT NULL REFERENCES users(id),
      session_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT NOT NULL,
      belt_requirement TEXT NOT NULL DEFAULT 'All Belts',
      capacity INTEGER NOT NULL DEFAULT 24,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES training_schedules(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      UNIQUE(schedule_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES training_schedules(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('present', 'late', 'absent', 'excused')),
      recorded_by INTEGER NOT NULL REFERENCES users(id),
      notes TEXT DEFAULT '',
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(schedule_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS grading_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      location TEXT NOT NULL,
      target_belt_id INTEGER NOT NULL REFERENCES belt_rankings(id),
      examiner_id INTEGER NOT NULL REFERENCES users(id),
      registration_deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'completed'))
    );

    CREATE TABLE IF NOT EXISTS exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES grading_exams(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_belt_id INTEGER NOT NULL REFERENCES belt_rankings(id),
      forms_score INTEGER NOT NULL DEFAULT 0,
      kicking_score INTEGER NOT NULL DEFAULT 0,
      sparring_score INTEGER NOT NULL DEFAULT 0,
      theory_score INTEGER NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      promoted_at TEXT DEFAULT NULL,
      notes TEXT DEFAULT '',
      UNIQUE(exam_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS instructor_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      flexibility_delta INTEGER NOT NULL DEFAULT 0,
      stamina_delta INTEGER NOT NULL DEFAULT 0,
      speed_delta INTEGER NOT NULL DEFAULT 0,
      strength_delta INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal', 'important')),
      author_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS terminology (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      korean TEXT NOT NULL,
      romanized TEXT NOT NULL,
      english TEXT NOT NULL,
      category TEXT NOT NULL,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS conditioning_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      focus_area TEXT NOT NULL CHECK(focus_area IN ('Flexibility', 'Stamina', 'Speed', 'Strength')),
      sets_reps TEXT NOT NULL,
      duration_mins INTEGER NOT NULL,
      instructions TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      threshold INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      earned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, achievement_id)
    );
  `);

  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCountRow.count === 0) {
    seedDatabase();
  }
}

function seedDatabase(): void {
  // 1. Seed Belt Rankings
  const belts = [
    {
      name: 'White Belt',
      rank_order: 1,
      korean_name: '10th Geup · Baek-dae',
      color_hex: '#E5E7EB',
      min_hours: 0,
      min_attendance_pct: 70,
      required_techniques: 'Ready Stance, Walking Stance, Front Stance, Low Block, Middle Punch, Front Kick',
      required_poomsae: 'Basic Form 1 (Kibon Il Jang)',
      description: 'Signifies innocence and a clean slate as the student begins their Taekwondo journey.',
    },
    {
      name: 'Yellow Belt',
      rank_order: 2,
      korean_name: '8th Geup · No-rang-dae',
      color_hex: '#EAB308',
      min_hours: 20,
      min_attendance_pct: 75,
      required_techniques: 'Front Kick, Roundhouse Kick, High Block, Inside Middle Block, Step Sparring',
      required_poomsae: 'Taegeuk Il Jang',
      description: 'Signifies the earth from which a plant sprouts and takes root as foundational skills develop.',
    },
    {
      name: 'Green Belt',
      rank_order: 3,
      korean_name: '6th Geup · Cho-rok-dae',
      color_hex: '#16A34A',
      min_hours: 45,
      min_attendance_pct: 78,
      required_techniques: 'Side Kick, Back Kick, Knife-Hand Block, Controlled One-Step Sparring',
      required_poomsae: 'Taegeuk Ee Jang & Taegeuk Sam Jang',
      description: 'Signifies the plant growth as Taekwondo techniques begin to develop speed and precision.',
    },
    {
      name: 'Blue Belt',
      rank_order: 4,
      korean_name: '4th Geup · Pa-rang-dae',
      color_hex: '#2563EB',
      min_hours: 80,
      min_attendance_pct: 80,
      required_techniques: 'Axe Kick, Spin Back Kick, Double Forearm Block, Free Sparring Footwork',
      required_poomsae: 'Taegeuk Sa Jang & Taegeuk Oh Jang',
      description: 'Signifies the sky toward which the plant matures into a towering tree.',
    },
    {
      name: 'Red Belt',
      rank_order: 5,
      korean_name: '2nd Geup · Bpal-gang-dae',
      color_hex: '#C81E2B',
      min_hours: 130,
      min_attendance_pct: 85,
      required_techniques: 'Hook Kick, Spinning Hook Kick, Counter-Sparring Combinations, Board Breaking',
      required_poomsae: 'Taegeuk Yuk Jang – Pal Jang',
      description: 'Signifies danger, cautioning the student to exercise self-control and maturity.',
    },
    {
      name: 'Black Belt',
      rank_order: 6,
      korean_name: '1st Dan · Geom-eun-dae',
      color_hex: '#111317',
      min_hours: 200,
      min_attendance_pct: 90,
      required_techniques: 'Full Technical Mastery, Competition Sparring Strategy, Leadership & Teaching',
      required_poomsae: 'Koryo Poomsae',
      description: 'Opposite of white, signifying maturity, proficiency, and mastery beyond darkness and fear.',
    },
  ];

  const insertBelt = db.prepare(`
    INSERT INTO belt_rankings (name, rank_order, korean_name, color_hex, min_hours, min_attendance_pct, required_techniques, required_poomsae, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const b of belts) {
    insertBelt.run(
      b.name,
      b.rank_order,
      b.korean_name,
      b.color_hex,
      b.min_hours,
      b.min_attendance_pct,
      b.required_techniques,
      b.required_poomsae,
      b.description
    );
  }

  // 2. Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, avatar_url, phone, bio, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  const adminId = Number(
    insertUser.run(
      'Master Min-ho Park',
      'admin@tkdhub.com',
      hashPassword('TkdAdmin2026!'),
      'admin',
      '',
      '+1 (415) 890-3310',
      'Head Grandmaster & Academy Director · Kukkiwon 7th Dan Black Belt'
    ).lastInsertRowid
  );

  const inst1Id = Number(
    insertUser.run(
      'Sabumnim Elena Vance',
      'elena@tkdhub.com',
      hashPassword('Instructor2026!'),
      'instructor',
      '',
      '+1 (415) 890-4102',
      'Senior Poomsae & Technical Fundamentals Coach · Former National Poomsae Medalist'
    ).lastInsertRowid
  );

  const inst2Id = Number(
    insertUser.run(
      'Sabumnim Marcus Thorne',
      'marcus@tkdhub.com',
      hashPassword('Instructor2026!'),
      'instructor',
      '',
      '+1 (415) 890-4219',
      'Head Olympic Sparring & Conditioning Coach · World Taekwondo Level 2 Certified'
    ).lastInsertRowid
  );

  const student1Id = Number(
    insertUser.run(
      'Alex Rivera',
      'alex@tkdhub.com',
      hashPassword('Student2026!'),
      'student',
      '',
      '+1 (415) 555-0148',
      'Dedicated Blue Belt athlete preparing for the December Red Belt promotion exam.'
    ).lastInsertRowid
  );

  const student2Id = Number(
    insertUser.run(
      'Maya Lin',
      'maya@tkdhub.com',
      hashPassword('Student2026!'),
      'student',
      '',
      '+1 (415) 555-0192',
      'Red Belt Poomsae specialist aiming for 1st Dan Black Belt certification.'
    ).lastInsertRowid
  );

  const student3Id = Number(
    insertUser.run(
      'Jordan Brooks',
      'jordan@tkdhub.com',
      hashPassword('Student2026!'),
      'student',
      '',
      '+1 (415) 555-0164',
      'Green Belt competitor focusing on spinning kicks and sparring footwork.'
    ).lastInsertRowid
  );

  const student4Id = Number(
    insertUser.run(
      'Sofia Patel',
      'sofia@tkdhub.com',
      hashPassword('Student2026!'),
      'student',
      '',
      '+1 (415) 555-0177',
      'Yellow Belt student building core stance discipline and flexibility.'
    ).lastInsertRowid
  );

  const student5Id = Number(
    insertUser.run(
      "Liam O'Connor",
      'liam@tkdhub.com',
      hashPassword('Student2026!'),
      'student',
      '',
      '+1 (415) 555-0181',
      '1st Dan Black Belt assistant peer mentor and sparring team captain.'
    ).lastInsertRowid
  );

  // Instructor Profiles
  const insertInstProfile = db.prepare(`
    INSERT INTO instructor_profiles (user_id, dan_rank, specialty, certification_id, years_experience)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertInstProfile.run(adminId, '7th Dan Black Belt', 'Grandmaster & Grading Examiner', 'KKW-07-48120', 26);
  insertInstProfile.run(inst1Id, '5th Dan Black Belt', 'Poomsae & Basic Fundamentals', 'KKW-05-88214', 14);
  insertInstProfile.run(inst2Id, '4th Dan Black Belt', 'Olympic Sparring & Conditioning', 'WT-L2-39104', 11);

  // Student Profiles (belt IDs 1..6)
  const insertStudProfile = db.prepare(`
    INSERT INTO student_profiles (user_id, current_belt_id, date_of_birth, emergency_contact, join_date, total_hours, flexibility_score, stamina_score, speed_score, strength_score, xp_points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStudProfile.run(student1Id, 4, '2004-06-14', 'Carmen Rivera · (415) 555-0100', '2025-02-10', 84.5, 82, 86, 84, 79, 2450);
  insertStudProfile.run(student2Id, 5, '2002-11-03', 'David Lin · (415) 555-0112', '2024-04-18', 142.0, 91, 88, 89, 84, 4120);
  insertStudProfile.run(student3Id, 3, '2006-03-22', 'Dana Brooks · (415) 555-0134', '2025-07-05', 48.0, 74, 79, 81, 75, 1380);
  insertStudProfile.run(student4Id, 2, '2008-09-19', 'Raj Patel · (415) 555-0155', '2026-03-12', 24.5, 68, 72, 70, 66, 740);
  insertStudProfile.run(student5Id, 6, '2000-01-29', "Claire O'Connor · (415) 555-0199", '2022-09-01', 248.0, 94, 93, 95, 92, 6890);

  // 3. Seed Training Modules (exact categories & techniques requested)
  const modulesData = [
    // Basic Techniques
    {
      category: 'Basic Techniques',
      title: 'Ready Stance',
      korean_term: 'Joonbi Seogi',
      belt_level: 'White Belt',
      difficulty: 'Fundamental',
      duration_mins: 15,
      description: 'Establish mental focus, shoulder-width foot alignment, and centered posture before every form or drill.',
      key_points: ['Feet parallel at one shoulder width', 'Fists held one fist distance in front of belt knot', 'Relaxed shoulders with steady nasal breathing'],
      video_duration: '03:40',
      image_url: '/src/assets/images/module_basic_techniques_1795076516571.jpg',
    },
    {
      category: 'Basic Techniques',
      title: 'Walking Stance',
      korean_term: 'Ap Seogi',
      belt_level: 'White Belt',
      difficulty: 'Fundamental',
      duration_mins: 18,
      description: 'Natural forward stepping stance balancing mobility and upright defensive structure.',
      key_points: ['One natural walking pace between front and rear foot', '50/50 weight distribution', 'Front knee softly straight, rear foot angled 30 degrees'],
      video_duration: '04:15',
      image_url: '/src/assets/images/module_basic_techniques_1795076516571.jpg',
    },
    {
      category: 'Basic Techniques',
      title: 'Front Stance',
      korean_term: 'Ap Kubi',
      belt_level: 'White Belt',
      difficulty: 'Fundamental',
      duration_mins: 22,
      description: 'Deep, grounded power stance engineered to drive force forward in strikes and strong blocks.',
      key_points: ['Front knee bent over the ankle joint', '70% weight forward, 30% on locked rear leg', 'Hips squared forward at full extension'],
      video_duration: '05:10',
      image_url: '/src/assets/images/module_basic_techniques_1795076516571.jpg',
    },
    {
      category: 'Basic Techniques',
      title: 'Punching Techniques',
      korean_term: 'Momtong Jireugi',
      belt_level: 'White Belt',
      difficulty: 'Fundamental',
      duration_mins: 20,
      description: 'Crisp linear middle and high punches utilizing hip rotation and opposite-hand chambering.',
      key_points: ['Strike with the first two knuckles aligned with forearm', 'Rotate wrist at final 20% of extension', 'Pull reaction hand tightly to the hip'],
      video_duration: '04:45',
      image_url: '/src/assets/images/module_basic_techniques_1795076516571.jpg',
    },
    {
      category: 'Basic Techniques',
      title: 'Blocking Techniques',
      korean_term: 'Arae / Momtong / Eolgul Makgi',
      belt_level: 'Yellow Belt',
      difficulty: 'Fundamental',
      duration_mins: 25,
      description: 'Core low, middle inward, and rising high blocks protecting vital target zones.',
      key_points: ['Cross arms cleanly at the shoulder chamber', 'Rotate forearm on impact to deflect force', 'Keep wrist rigid and aligned'],
      video_duration: '06:05',
      image_url: '/src/assets/images/module_basic_techniques_1795076516571.jpg',
    },

    // Kicking Techniques
    {
      category: 'Kicking Techniques',
      title: 'Front Kick (Ap Chagi)',
      korean_term: 'Ap Chagi',
      belt_level: 'White Belt',
      difficulty: 'Fundamental',
      duration_mins: 20,
      description: 'Explosive linear snap kick striking with the ball of the foot while keeping guard upright.',
      key_points: ['High knee chamber above belt level', 'Snap lower leg upward with toes pulled back', 'Re-chamber cleanly before setting down'],
      video_duration: '04:50',
      image_url: '/src/assets/images/module_kicking_techniques_1795076516858.jpg',
    },
    {
      category: 'Kicking Techniques',
      title: 'Roundhouse Kick (Dollyo Chagi)',
      korean_term: 'Dollyo Chagi',
      belt_level: 'Yellow Belt',
      difficulty: 'Intermediate',
      duration_mins: 25,
      description: 'Signature rotational kick pivoting on the standing foot to deliver whip-like instep impact.',
      key_points: ['Pivot base foot 135–180 degrees', 'Stack hip, knee, and ankle horizontally', 'Strike with instep or ball of the foot'],
      video_duration: '05:45',
      image_url: '/src/assets/images/module_kicking_techniques_1795076516858.jpg',
    },
    {
      category: 'Kicking Techniques',
      title: 'Side Kick (Yop Chagi)',
      korean_term: 'Yop Chagi',
      belt_level: 'Green Belt',
      difficulty: 'Intermediate',
      duration_mins: 25,
      description: 'Penetrating thrust kick extending along a straight line using the heel and outer blade of the foot.',
      key_points: ['Chamber knee tight across chest', 'Thrust heel along target line with hips stacked', 'Keep foot edge horizontal at extension'],
      video_duration: '06:20',
      image_url: '/src/assets/images/module_kicking_techniques_1795076516858.jpg',
    },
    {
      category: 'Kicking Techniques',
      title: 'Back Kick (Dwi Chagi)',
      korean_term: 'Dwi Chagi',
      belt_level: 'Green Belt',
      difficulty: 'Intermediate',
      duration_mins: 28,
      description: 'Spinning linear counter-kick delivering maximum heel power directly behind the body.',
      key_points: ['Turn head over kicking shoulder to spot target first', 'Keep knees brushing close together', 'Drive heel straight back without swinging wide'],
      video_duration: '05:55',
      image_url: '/src/assets/images/module_kicking_techniques_1795076516858.jpg',
    },
    {
      category: 'Kicking Techniques',
      title: 'Axe Kick (Naeryo Chagi)',
      korean_term: 'Naeryo Chagi',
      belt_level: 'Blue Belt',
      difficulty: 'Advanced',
      duration_mins: 25,
      description: 'Vertical overhead arc kick dropping the heel downward onto an opponent shoulder or head guard.',
      key_points: ['Swing straight or slightly crescent leg above head height', 'Snap heel downward using hamstring acceleration', 'Maintain upright torso balance'],
      video_duration: '05:30',
      image_url: '/src/assets/images/module_kicking_techniques_1795076516858.jpg',
    },
    {
      category: 'Kicking Techniques',
      title: 'Hook Kick (Huryeo Chagi)',
      korean_term: 'Huryeo Chagi',
      belt_level: 'Red Belt',
      difficulty: 'Advanced',
      duration_mins: 30,
      description: 'Deceptive lateral whipping kick passing the target line and hooking the heel cleanly across.',
      key_points: ['Extend leg just outside the target line', 'Whip heel horizontally across target via hip & knee flexion', 'Recover smoothly into fighting stance'],
      video_duration: '06:40',
      image_url: '/src/assets/images/module_kicking_techniques_1795076516858.jpg',
    },

    // Forms (Poomsae)
    {
      category: 'Forms (Poomsae)',
      title: 'Taegeuk Il Jang',
      korean_term: '태극 1장 · Heaven & Light',
      belt_level: 'Yellow Belt',
      difficulty: 'Fundamental',
      duration_mins: 25,
      description: '18-movement foundational poomsae introducing walking stances, front stances, and basic blocks.',
      key_points: ['18 movements representing Keon (Heaven)', 'Clean transitions between Ap Seogi and Ap Kubi', 'Sharp kihap on final 18th punch'],
      video_duration: '04:30',
      image_url: '/src/assets/images/module_poomsae_forms_1795076516258.jpg',
    },
    {
      category: 'Forms (Poomsae)',
      title: 'Taegeuk Ee Jang',
      korean_term: '태극 2장 · Joyfulness',
      belt_level: 'Green Belt',
      difficulty: 'Fundamental',
      duration_mins: 25,
      description: '18-movement form blending gentle flow with forceful rising blocks and high punches.',
      key_points: ['18 movements representing Tae (Lake)', 'Controlled pacing with crisp high blocks', 'Front kicks followed immediately by deep Front Stance'],
      video_duration: '04:55',
      image_url: '/src/assets/images/module_poomsae_forms_1795076516258.jpg',
    },
    {
      category: 'Forms (Poomsae)',
      title: 'Taegeuk Sam Jang',
      korean_term: '태극 3장 · Fire & Sun',
      belt_level: 'Green Belt',
      difficulty: 'Intermediate',
      duration_mins: 30,
      description: '20-movement form introducing Back Stance (Dwit Kubi), knife-hand blocks, and double-punch sequences.',
      key_points: ['20 movements representing Ri (Fire)', '70% rear weight distribution in Back Stance', 'Immediate front-kick to double-punch cadence'],
      video_duration: '05:25',
      image_url: '/src/assets/images/module_poomsae_forms_1795076516258.jpg',
    },
    {
      category: 'Forms (Poomsae)',
      title: 'Taegeuk Sa Jang',
      korean_term: '태극 4장 · Thunder',
      belt_level: 'Blue Belt',
      difficulty: 'Intermediate',
      duration_mins: 30,
      description: '20-movement form introducing side kicks, double knife-hand blocks, and swallow-form strikes.',
      key_points: ['20 movements representing Jin (Thunder)', 'Double knife-hand middle block timing', 'Side kick directly into Back Stance inward block'],
      video_duration: '05:50',
      image_url: '/src/assets/images/module_poomsae_forms_1795076516258.jpg',
    },
    {
      category: 'Forms (Poomsae)',
      title: 'Taegeuk Oh Jang',
      korean_term: '태극 5장 · Wind',
      belt_level: 'Blue Belt',
      difficulty: 'Intermediate',
      duration_mins: 35,
      description: '20-movement form alternating calm wind-like flow with explosive hammer fist and elbow strikes.',
      key_points: ['20 movements representing Seon (Wind)', 'Slow controlled hammer-fist descent', 'Cross-stance (Koa Seogi) landing with backfist strike'],
      video_duration: '06:15',
      image_url: '/src/assets/images/module_poomsae_forms_1795076516258.jpg',
    },
    {
      category: 'Forms (Poomsae)',
      title: 'Advanced Poomsae',
      korean_term: 'Koryo & Keumgang',
      belt_level: 'Black Belt',
      difficulty: 'Advanced',
      duration_mins: 45,
      description: 'Black belt master forms featuring slow breathing control, crane stances, and double side kicks.',
      key_points: ['Koryo: Double side kick height consistency', 'Keumgang: Crane stance (Hakdari Seogi) stillness', '8-second slow mountain block control'],
      video_duration: '08:10',
      image_url: '/src/assets/images/module_poomsae_forms_1795076516258.jpg',
    },

    // Sparring Training
    {
      category: 'Sparring Training',
      title: 'Offensive Techniques',
      korean_term: 'Gong-gyeok Gisul',
      belt_level: 'Yellow Belt',
      difficulty: 'Intermediate',
      duration_mins: 30,
      description: 'Lead-leg cut kicks, sliding roundhouse entries, and multi-kick feint combinations for scoring.',
      key_points: ['Disguise lead-leg chamber for cut or roundhouse', 'Follow primary kick immediately with rear-leg follow-up', 'Maintain compact guard on exit'],
      video_duration: '05:40',
      image_url: '/src/assets/images/module_sparring_training_1795076516384.jpg',
    },
    {
      category: 'Sparring Training',
      title: 'Defensive Techniques',
      korean_term: 'Bang-eo Gisul',
      belt_level: 'Green Belt',
      difficulty: 'Intermediate',
      duration_mins: 30,
      description: 'Evading, checking lead kicks, forearm-shield blocks, and immediate counter-kick transitions.',
      key_points: ['Step 45 degrees off center line rather than straight back', 'Absorb body kicks on tightened forearms', 'Counter within 0.3 seconds of opponent foot drop'],
      video_duration: '05:35',
      image_url: '/src/assets/images/module_sparring_training_1795076516384.jpg',
    },
    {
      category: 'Sparring Training',
      title: 'Footwork',
      korean_term: 'Seutep & Bal-no-ri',
      belt_level: 'All Belts',
      difficulty: 'Fundamental',
      duration_mins: 25,
      description: 'Light athletic bounce, switch steps, angled pivots, and rapid ring-control repositioning.',
      key_points: ['Stay on balls of feet with minimal vertical bounce', 'Never cross feet while moving laterally', 'Use micro-steps to draw opponent reactions'],
      video_duration: '04:50',
      image_url: '/src/assets/images/module_sparring_training_1795076516384.jpg',
    },
    {
      category: 'Sparring Training',
      title: 'Distance Control',
      korean_term: 'Geori Jojeol',
      belt_level: 'Green Belt',
      difficulty: 'Intermediate',
      duration_mins: 25,
      description: 'Managing long, mid, and clinch ranges so attacks land cleanly while staying outside counter range.',
      key_points: ['Measure opponent reach during opening 15 seconds', 'Hold the edge of kicking range before entry', 'Close clinch immediately when jammed'],
      video_duration: '05:15',
      image_url: '/src/assets/images/module_sparring_training_1795076516384.jpg',
    },
    {
      category: 'Sparring Training',
      title: 'Reaction and Timing',
      korean_term: 'Baneung & Taiming',
      belt_level: 'Blue Belt',
      difficulty: 'Advanced',
      duration_mins: 30,
      description: 'Reading shoulder/hip telegraphs and executing intercepting back kicks and head-kick counters.',
      key_points: ['Track center of chest rather than feet', 'Trigger intercept kick on first hip rotation', 'Train visual paddle stimulus drills'],
      video_duration: '06:00',
      image_url: '/src/assets/images/module_sparring_training_1795076516384.jpg',
    },
    {
      category: 'Sparring Training',
      title: 'Controlled Sparring Drills',
      korean_term: 'Jehan Gyeorugi',
      belt_level: 'All Belts',
      difficulty: 'Intermediate',
      duration_mins: 35,
      description: 'Structured 2-minute partner rounds focusing on technical control, scoring accuracy, and ring etiquette.',
      key_points: ['One-for-one counter exchange rounds', 'Body-only tactical rounds with light contact', 'Bow before and after every partner rotation'],
      video_duration: '07:10',
      image_url: '/src/assets/images/module_sparring_training_1795076516384.jpg',
    },
  ];

  const insertModule = db.prepare(`
    INSERT INTO training_modules (category, title, korean_term, belt_level, difficulty, duration_mins, description, key_points, video_url, video_duration, image_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const moduleIds: number[] = [];
  modulesData.forEach((m, idx) => {
    const res = insertModule.run(
      m.category,
      m.title,
      m.korean_term,
      m.belt_level,
      m.difficulty,
      m.duration_mins,
      m.description,
      JSON.stringify(m.key_points),
      `#drill-${idx + 1}`,
      m.video_duration,
      m.image_url,
      idx + 1
    );
    moduleIds.push(Number(res.lastInsertRowid));
  });

  // 4. Seed Student Progress for Alex (student1Id) & Maya (student2Id)
  const insertProgress = db.prepare(`
    INSERT INTO student_progress (student_id, module_id, status, mastery_score, completed_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  moduleIds.forEach((modId, idx) => {
    if (idx < 14) {
      insertProgress.run(student1Id, modId, 'completed', 85 + (idx % 14), '2026-10-28 18:30:00');
    } else if (idx < 18) {
      insertProgress.run(student1Id, modId, 'in_progress', 68 + (idx % 10), null);
    }
    if (idx < 20) {
      insertProgress.run(student2Id, modId, 'completed', 90 + (idx % 9), '2026-11-05 19:15:00');
    }
    if (idx < 9) {
      insertProgress.run(student3Id, modId, 'completed', 80 + (idx % 12), '2026-10-19 17:45:00');
    }
  });

  // 5. Seed Training Schedules (current week & month around 2026-11-19)
  const schedules = [
    { title: 'Foundations & Stance Precision', category: 'Basic Techniques', instructor_id: inst1Id, session_date: '2026-11-12', start_time: '17:30', end_time: '18:30', location: 'Main Dojang · Mat A', belt_requirement: 'All Belts', capacity: 24, description: 'Stance transitions, hip alignment, and core blocking mechanics.' },
    { title: 'High Kicks & Rotational Power', category: 'Kicking Techniques', instructor_id: inst2Id, session_date: '2026-11-14', start_time: '18:00', end_time: '19:15', location: 'Main Dojang · Mat A', belt_requirement: 'Yellow Belt+', capacity: 20, description: 'Roundhouse, side kick, and back kick paddle drills.' },
    { title: 'Taegeuk Poomsae Synchronization', category: 'Forms (Poomsae)', instructor_id: inst1Id, session_date: '2026-11-16', start_time: '17:00', end_time: '18:15', location: 'Poomsae Studio B', belt_requirement: 'Yellow Belt+', capacity: 18, description: 'Rhythm, breathing, and technical scoring standards for Taegeuk 1–5.' },
    { title: 'Olympic Sparring Footwork & Timing', category: 'Sparring Training', instructor_id: inst2Id, session_date: '2026-11-18', start_time: '18:30', end_time: '20:00', location: 'Sparring Arena B', belt_requirement: 'Green Belt+', capacity: 16, description: 'Distance control, cut kicks, and electronic scoring guard tactics.' },
    { title: 'Evening Kicking Mechanics Lab', category: 'Kicking Techniques', instructor_id: inst2Id, session_date: '2026-11-19', start_time: '18:00', end_time: '19:15', location: 'Main Dojang · Mat A', belt_requirement: 'All Belts', capacity: 22, description: 'Chamber height, pivot angles, and axe/hook kick control.' },
    { title: 'Poomsae Grading Readiness Clinic', category: 'Forms (Poomsae)', instructor_id: inst1Id, session_date: '2026-11-20', start_time: '17:30', end_time: '18:45', location: 'Poomsae Studio B', belt_requirement: 'Yellow Belt+', capacity: 20, description: 'Mock examination run-throughs with live instructor scoring.' },
    { title: 'Saturday Conditioning & Sparring', category: 'Sparring Training', instructor_id: inst2Id, session_date: '2026-11-21', start_time: '10:00', end_time: '11:30', location: 'Sparring Arena B', belt_requirement: 'Green Belt+', capacity: 18, description: 'Controlled sparring rounds paired with explosive agility ladders.' },
    { title: 'Sunday Open Mat & Flexibility', category: 'Basic Techniques', instructor_id: inst1Id, session_date: '2026-11-22', start_time: '11:00', end_time: '12:15', location: 'Main Dojang · Mat A', belt_requirement: 'All Belts', capacity: 28, description: 'Deep hip mobility, balance holds, and self-paced technique review.' },
    { title: 'Junior & Beginner Fundamentals', category: 'Basic Techniques', instructor_id: inst1Id, session_date: '2026-11-24', start_time: '17:00', end_time: '18:00', location: 'Main Dojang · Mat A', belt_requirement: 'White & Yellow', capacity: 24, description: 'Ready stance, walking stance, front kicks, and dojang etiquette.' },
    { title: 'Spinning Kicks & Counter Timing', category: 'Kicking Techniques', instructor_id: inst2Id, session_date: '2026-11-25', start_time: '18:30', end_time: '19:45', location: 'Sparring Arena B', belt_requirement: 'Blue Belt+', capacity: 16, description: 'Back kick and spinning hook kick reaction timing under pressure.' },
    { title: 'Pre-Exam Taegeuk 4–8 Workshop', category: 'Forms (Poomsae)', instructor_id: inst1Id, session_date: '2026-11-27', start_time: '17:30', end_time: '19:00', location: 'Poomsae Studio B', belt_requirement: 'Blue Belt+', capacity: 20, description: 'Final polish for Blue and Red belt candidates.' },
    { title: 'Monthly Black Belt Leadership Seminar', category: 'Forms (Poomsae)', instructor_id: adminId, session_date: '2026-11-29', start_time: '09:30', end_time: '11:30', location: 'Main Dojang · Mat A', belt_requirement: 'Red & Black', capacity: 16, description: 'Koryo & Keumgang depth clinic with Grandmaster Min-ho Park.' },
  ];

  const insertSched = db.prepare(`
    INSERT INTO training_schedules (title, category, instructor_id, session_date, start_time, end_time, location, belt_requirement, capacity, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const schedIds: number[] = [];
  for (const s of schedules) {
    const res = insertSched.run(s.title, s.category, s.instructor_id, s.session_date, s.start_time, s.end_time, s.location, s.belt_requirement, s.capacity, s.description);
    schedIds.push(Number(res.lastInsertRowid));
  }

  // 6. Seed Registrations & Attendance
  const insertReg = db.prepare('INSERT INTO session_registrations (schedule_id, student_id, reminder_sent) VALUES (?, ?, ?)');
  const insertAtt = db.prepare('INSERT INTO attendance_records (schedule_id, student_id, status, recorded_by, notes) VALUES (?, ?, ?, ?, ?)');

  const students = [student1Id, student2Id, student3Id, student4Id, student5Id];
  // Register students for upcoming sessions (indices 4..11)
  for (let i = 4; i < schedIds.length; i++) {
    insertReg.run(schedIds[i], student1Id, i === 4 ? 1 : 0);
    insertReg.run(schedIds[i], student2Id, 0);
    if (i % 2 === 0) insertReg.run(schedIds[i], student3Id, 0);
    if (i === 4 || i === 7 || i === 8) insertReg.run(schedIds[i], student4Id, 0);
    if (i === 6 || i === 10 || i === 11) insertReg.run(schedIds[i], student5Id, 0);
  }

  // Record historical attendance for past sessions (indices 0..3)
  const statuses: Array<'present' | 'late' | 'absent'> = ['present', 'present', 'present', 'late', 'present'];
  for (let sIdx = 0; sIdx < 4; sIdx++) {
    for (let uIdx = 0; uIdx < students.length; uIdx++) {
      const st = sIdx === 2 && uIdx === 3 ? 'absent' : statuses[(sIdx + uIdx) % statuses.length];
      insertAtt.run(schedIds[sIdx], students[uIdx], st, sIdx % 2 === 0 ? inst1Id : inst2Id, st === 'late' ? 'Arrived 5 mins after bow-in' : '');
    }
  }

  // 7. Seed Grading Exams & Results
  const insertExam = db.prepare(`
    INSERT INTO grading_exams (title, exam_date, location, target_belt_id, examiner_id, registration_deadline, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const pastExam1 = Number(insertExam.run('Summer Promotion Grading 2026', '2026-08-15', 'Main Dojang · Mat A', 4, adminId, '2026-08-08', 'completed').lastInsertRowid);
  const pastExam2 = Number(insertExam.run('Autumn Red & Black Belt Grading', '2026-10-18', 'Main Dojang · Mat A', 5, adminId, '2026-10-10', 'completed').lastInsertRowid);
  insertExam.run('Winter Belt Promotion Examination', '2026-12-12', 'Main Dojang · Mat A', 5, adminId, '2026-12-05', 'upcoming');
  insertExam.run('Year-End Fundamental Promotion', '2026-12-19', 'Main Dojang · Mat A', 3, inst1Id, '2026-12-12', 'upcoming');

  const insertResult = db.prepare(`
    INSERT INTO exam_results (exam_id, student_id, target_belt_id, forms_score, kicking_score, sparring_score, theory_score, passed, promoted_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertResult.run(pastExam1, student1Id, 4, 88, 91, 86, 90, 1, '2026-08-15', 'Strong balance in Taegeuk Sa Jang and clean roundhouse combinations.');
  insertResult.run(pastExam1, student3Id, 3, 84, 86, 82, 85, 1, '2026-08-15', 'Solid Green Belt promotion; continue deepening front stances.');
  insertResult.run(pastExam2, student2Id, 5, 94, 90, 89, 95, 1, '2026-10-18', 'Exceptional poomsae rhythm and control. Promoted to Red Belt.');
  insertResult.run(pastExam2, student5Id, 6, 95, 96, 94, 96, 1, '2026-10-18', 'Passed 1st Dan board breaking and Koryo evaluation with distinction.');

  // 8. Seed Instructor Feedback
  const insertFeedback = db.prepare(`
    INSERT INTO instructor_feedback (student_id, instructor_id, category, rating, comment, flexibility_delta, stamina_delta, speed_delta, strength_delta, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertFeedback.run(student1Id, inst1Id, 'Forms (Poomsae)', 5, 'Taegeuk Oh Jang stance transitions look sharp. Keep shoulders relaxed during the hammer fist strike.', 2, 1, 2, 1, '2026-11-16 19:00:00');
  insertFeedback.run(student1Id, inst2Id, 'Sparring Training', 4, 'Great cut-kick intercept timing! Work on keeping your back hand higher when exiting clinch range.', 1, 2, 3, 1, '2026-11-18 20:15:00');
  insertFeedback.run(student2Id, inst1Id, 'Forms (Poomsae)', 5, 'Textbook rhythm on Taegeuk Pal Jang. Ready to begin preliminary Koryo sequences.', 2, 2, 2, 1, '2026-11-15 18:10:00');

  // 9. Seed Announcements & Notifications
  const insertAnnouncement = db.prepare('INSERT INTO announcements (title, body, priority, author_id, created_at) VALUES (?, ?, ?, ?, ?)');
  insertAnnouncement.run(
    'Winter Promotion Examination Registration Open',
    'Candidates for Yellow through Red Belt must submit exam readiness check-ins with their primary instructor by December 5, 2026.',
    'important',
    adminId,
    '2026-11-15 09:00:00'
  );
  insertAnnouncement.run(
    'New Electronic Hogu Calibration Complete',
    'Sparring Arena B mats have been upgraded with calibrated Gen-3 scoring vests for Saturday competition rounds.',
    'normal',
    inst2Id,
    '2026-11-17 14:30:00'
  );

  const insertNotif = db.prepare('INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  insertNotif.run(student1Id, 'Upcoming Session Tonight', 'Evening Kicking Mechanics Lab starts at 18:00 on Main Dojang · Mat A.', 'reminder', 0, '2026-11-19 08:00:00');
  insertNotif.run(student1Id, 'New Instructor Evaluation', 'Sabumnim Marcus Thorne posted feedback on your Sparring Training progress.', 'feedback', 0, '2026-11-18 20:20:00');
  insertNotif.run(student1Id, 'Winter Grading Exam Scheduled', 'Registration closes December 5 for the Winter Belt Promotion Examination.', 'exam', 1, '2026-11-15 09:05:00');

  // 10. Seed Terminology Dictionary
  const terms = [
    ['차렷', 'Charyeot', 'Attention', 'Commands', 'Stand straight with heels together and hands at sides'],
    ['경례', 'Gyeongnye', 'Bow', 'Commands', 'Respectful bow from the waist at 30 degrees'],
    ['준비', 'Joonbi', 'Ready', 'Commands', 'Assume ready stance before forms or drills'],
    ['시작', 'Sijak', 'Begin / Start', 'Commands', 'Signal to begin a form, drill, or sparring round'],
    ['그만', 'Geuman', 'Stop / Finish', 'Commands', 'Halt movement immediately and return to attention'],
    ['도복', 'Dobok', 'Training Uniform', 'Etiquette', 'Traditional white Taekwondo uniform'],
    ['도장', 'Dojang', 'Training Hall', 'Etiquette', 'Sacred space for martial arts study and discipline'],
    ['사범님', 'Sabumnim', 'Master Instructor', 'Etiquette', 'Respectful title for 4th Dan+ head instructors'],
    ['기합', 'Kihap', 'Spirit Shout', 'Etiquette', 'Explosive vocal breath focusing core energy at impact'],
    ['앞차기', 'Ap Chagi', 'Front Kick', 'Kicks', 'Linear snap kick striking with ball of the foot'],
    ['돌려차기', 'Dollyo Chagi', 'Roundhouse Kick', 'Kicks', 'Rotational whip kick striking with instep'],
    ['옆차기', 'Yop Chagi', 'Side Kick', 'Kicks', 'Linear thrust kick using outer edge and heel'],
    ['뒤차기', 'Dwi Chagi', 'Back Kick', 'Kicks', 'Spinning linear heel thrust directly behind'],
    ['내려차기', 'Naeryo Chagi', 'Axe Kick', 'Kicks', 'Overhead vertical heel drop strike'],
    ['앞굽이', 'Ap Kubi', 'Front Stance', 'Stances', 'Deep forward-weighted power stance'],
    ['뒷굽이', 'Dwit Kubi', 'Back Stance', 'Stances', 'L-shaped defensive stance with 70% rear weight'],
    ['품새', 'Poomsae', 'Forms / Patterns', 'Training', 'Choreographed defensive and offensive sequences'],
    ['겨루기', 'Gyeorugi', 'Sparring', 'Training', 'Controlled or competitive martial combat'],
  ];
  const insertTerm = db.prepare('INSERT INTO terminology (korean, romanized, english, category, notes) VALUES (?, ?, ?, ?, ?)');
  for (const t of terms) {
    insertTerm.run(t[0], t[1], t[2], t[3], t[4]);
  }

  // 11. Seed Conditioning Exercises
  const exercises = [
    ['Dynamic Side-Split & Hamstring Swing', 'Flexibility', '3 sets × 15 swings/leg', 10, 'Stand beside wall support and swing straight leg smoothly across and upward without rounding lower back.'],
    ['Slow-Motion Side Kick Chamber Hold', 'Flexibility', '4 sets × 20s hold/leg', 12, 'Lift knee high, extend side kick cleanly at target height, and hold horizontal foot alignment under tension.'],
    ['HIIT Kick-Paddle Tabata Rounds', 'Stamina', '8 rounds × 20s work / 10s rest', 12, 'Alternate rapid left/right roundhouse kicks at maximum cadence into target paddles.'],
    ['3-Minute Sparring Footwork Shadow Drill', 'Stamina', '4 rounds × 3 mins', 15, 'Continuous bouncing footwork, switch steps, and angled pivots mimicking tournament pacing.'],
    ['Reaction Ball & Double-Kick Burst', 'Speed', '5 sets × 10 bursts', 10, 'Explode from relaxed guard on visual cue into a lead-leg cut kick immediately followed by rear roundhouse.'],
    ['Resistance Band Knee-Drive Snap', 'Speed', '3 sets × 12 reps/leg', 10, 'Anchor light band around ankle and drive knee into front-kick chamber with maximum acceleration.'],
    ['Single-Leg Pistol Squat Progression', 'Strength', '3 sets × 8 reps/leg', 12, 'Builds unilateral leg drive and knee stability for landing jumping and spinning kicks.'],
    ['Hollow-Body & Plank Kick-Chamber Core', 'Strength', '4 sets × 40s', 10, 'Maintain flat lower back while alternating controlled knee chambers to strengthen hip flexors.'],
  ];
  const insertEx = db.prepare('INSERT INTO conditioning_exercises (title, focus_area, sets_reps, duration_mins, instructions) VALUES (?, ?, ?, ?, ?)');
  for (const ex of exercises) {
    insertEx.run(ex[0], ex[1], ex[2], ex[3], ex[4]);
  }

  // 12. Seed Achievements
  const achievements = [
    ['FIRST_STEP', 'First Step on the Mat', 'Complete your first Taekwondo training module.', 'Curriculum', 1],
    ['TECHNIQUE_SCHOLAR', 'Technique Scholar', 'Master 10 or more curriculum training modules.', 'Curriculum', 10],
    ['IRON_ATTENDANCE', 'Iron Attendance', 'Maintain 85%+ training session attendance.', 'Discipline', 85],
    ['FIFTY_HOURS', '50 Mat Hours', 'Accumulate 50 hours of logged dojang training.', 'Endurance', 50],
    ['CENTURY_MAT', '100 Mat Hours', 'Accumulate 100 hours of dedicated Taekwondo practice.', 'Endurance', 100],
    ['BELT_CLIMBER', 'Belt Promotion', 'Successfully pass an official belt grading examination.', 'Rank', 1],
  ];
  const insertAch = db.prepare('INSERT INTO achievements (code, title, description, category, threshold) VALUES (?, ?, ?, ?, ?)');
  const achIds: number[] = [];
  for (const a of achievements) {
    achIds.push(Number(insertAch.run(a[0], a[1], a[2], a[3], a[4]).lastInsertRowid));
  }

  const insertUserAch = db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)');
  // Grant Alex (student1) 4 earned achievements
  insertUserAch.run(student1Id, achIds[0]);
  insertUserAch.run(student1Id, achIds[1]);
  insertUserAch.run(student1Id, achIds[2]);
  insertUserAch.run(student1Id, achIds[3]);
  insertUserAch.run(student1Id, achIds[5]);
  // Grant Maya (student2) all 6
  achIds.forEach((aid) => insertUserAch.run(student2Id, aid));
}
