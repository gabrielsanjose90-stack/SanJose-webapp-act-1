export type UserRole = 'admin' | 'instructor' | 'student';

export interface StudentProfile {
  user_id: number;
  current_belt_id: number;
  belt_name: string;
  rank_order: number;
  belt_korean_name: string;
  belt_color: string;
  date_of_birth: string;
  emergency_contact: string;
  join_date: string;
  total_hours: number;
  flexibility_score: number;
  stamina_score: number;
  speed_score: number;
  strength_score: number;
  xp_points: number;
}

export interface InstructorProfile {
  user_id: number;
  dan_rank: string;
  specialty: string;
  certification_id: string;
  years_experience: number;
}

export interface UserAccount {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string;
  phone: string;
  bio: string;
  status: 'active' | 'inactive';
  created_at: string;
  studentProfile?: StudentProfile | null;
  instructorProfile?: InstructorProfile | null;
}

export interface BeltRank {
  id: number;
  name: string;
  rank_order: number;
  korean_name: string;
  color_hex: string;
  min_hours: number;
  min_attendance_pct: number;
  required_techniques: string;
  required_poomsae: string;
  description: string;
}

export interface TrainingModule {
  id: number;
  category: 'Basic Techniques' | 'Kicking Techniques' | 'Forms (Poomsae)' | 'Sparring Training';
  title: string;
  korean_term: string;
  belt_level: string;
  difficulty: string;
  duration_mins: number;
  description: string;
  key_points: string[];
  video_url: string;
  video_duration: string;
  image_url: string;
  sort_order: number;
  progress_status: 'not_started' | 'in_progress' | 'completed';
  mastery_score: number;
  completed_at: string | null;
}

export interface ScheduleSession {
  id: number;
  title: string;
  category: string;
  instructor_id: number;
  instructor_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  belt_requirement: string;
  capacity: number;
  description: string;
  is_registered: number;
  reminder_sent: number;
  registered_count: number;
}

export interface AttendanceRecord {
  id: number;
  schedule_id: number;
  student_id: number;
  student_name?: string;
  belt_name?: string;
  belt_color?: string;
  session_title: string;
  category: string;
  session_date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  recorder_name: string;
  notes: string;
  recorded_at: string;
}

export interface StudentAttendanceSummary {
  student_id: number;
  student_name: string;
  belt_name: string;
  belt_color: string;
  total_hours: number;
  total_sessions: number;
  attended_sessions: number;
}

export interface GradingExam {
  id: number;
  title: string;
  exam_date: string;
  location: string;
  target_belt_id: number;
  target_belt_name: string;
  target_belt_color: string;
  examiner_id: number;
  examiner_name: string;
  registration_deadline: string;
  status: 'upcoming' | 'completed';
}

export interface ExamResult {
  id: number;
  exam_id: number;
  exam_title: string;
  exam_date: string;
  student_id: number;
  student_name: string;
  target_belt_id: number;
  target_belt_name: string;
  target_belt_color: string;
  forms_score: number;
  kicking_score: number;
  sparring_score: number;
  theory_score: number;
  passed: number;
  promoted_at: string | null;
  notes: string;
}

export interface FeedbackItem {
  id: number;
  student_id: number;
  student_name?: string;
  instructor_id: number;
  instructor_name: string;
  category: string;
  rating: number;
  comment: string;
  flexibility_delta: number;
  stamina_delta: number;
  speed_delta: number;
  strength_delta: number;
  created_at: string;
}

export interface AnnouncementItem {
  id: number;
  title: string;
  body: string;
  priority: 'normal' | 'important';
  author_name: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

export interface TerminologyItem {
  id: number;
  korean: string;
  romanized: string;
  english: string;
  category: string;
  notes: string;
}

export interface ConditioningExercise {
  id: number;
  title: string;
  focus_area: 'Flexibility' | 'Stamina' | 'Speed' | 'Strength';
  sets_reps: string;
  duration_mins: number;
  instructions: string;
}

export interface AchievementItem {
  id: number;
  code: string;
  title: string;
  description: string;
  category: string;
  threshold: number;
  earned_at: string | null;
}

export interface StudentRosterItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  status: 'active' | 'inactive';
  bio: string;
  current_belt_id: number;
  belt_name: string;
  belt_color: string;
  rank_order: number;
  total_hours: number;
  flexibility_score: number;
  stamina_score: number;
  speed_score: number;
  strength_score: number;
  join_date: string;
  emergency_contact: string;
  completed_modules: number;
  total_att: number;
  present_att: number;
}
