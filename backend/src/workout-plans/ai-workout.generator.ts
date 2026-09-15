/**
 * Rule-based workout programme generator (no external AI service).
 *
 * Deterministic for a given input, so the same goal/level/days/equipment always
 * yields the same programme. Output shape matches what WorkoutDetailScreen renders:
 * { day, name, sets, reps, rest, notes?, muscle }.
 */

export type Goal = 'WEIGHT_LOSS' | 'MUSCLE_GAIN' | 'ENDURANCE' | 'FLEXIBILITY' | 'GENERAL_FITNESS';
export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
type Equipment = 'bodyweight' | 'dumbbell' | 'barbell' | 'band' | 'kettlebell' | 'machine' | 'cardio';
type Muscle = 'chest' | 'back' | 'shoulders' | 'legs' | 'glutes' | 'arms' | 'core' | 'full' | 'cardio' | 'mobility';
type Pattern = 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'mobility';

interface Exercise { name: string; muscle: Muscle; pattern: Pattern; equipment: Equipment[]; compound?: boolean; unilateral?: boolean }

export interface PlannedExercise {
  day: string;
  name: string;
  sets: number;
  reps: string | number;
  rest: number;
  muscle: Muscle;
  notes?: string;
}

export interface GeneratorInput { goal: string; level: string; daysPerWeek?: number; equipment?: string }
export interface GeneratedPlan {
  name: string;
  goal: Goal;
  difficulty: Level;
  durationWeeks: number;
  description: string;
  exercises: PlannedExercise[];
}

// ─── Library ────────────────────────────────────────────────────────────────

const LIB: Exercise[] = [
  // push
  { name: 'Push-ups', muscle: 'chest', pattern: 'push', equipment: ['bodyweight'], compound: true },
  { name: 'Incline Push-ups', muscle: 'chest', pattern: 'push', equipment: ['bodyweight'] },
  { name: 'Barbell Bench Press', muscle: 'chest', pattern: 'push', equipment: ['barbell'], compound: true },
  { name: 'Dumbbell Bench Press', muscle: 'chest', pattern: 'push', equipment: ['dumbbell'], compound: true },
  { name: 'Incline Dumbbell Press', muscle: 'chest', pattern: 'push', equipment: ['dumbbell'] },
  { name: 'Chest Press Machine', muscle: 'chest', pattern: 'push', equipment: ['machine'], compound: true },
  { name: 'Overhead Press', muscle: 'shoulders', pattern: 'push', equipment: ['barbell'], compound: true },
  { name: 'Dumbbell Shoulder Press', muscle: 'shoulders', pattern: 'push', equipment: ['dumbbell'], compound: true },
  { name: 'Pike Push-ups', muscle: 'shoulders', pattern: 'push', equipment: ['bodyweight'] },
  { name: 'Lateral Raises', muscle: 'shoulders', pattern: 'push', equipment: ['dumbbell', 'band'] },
  { name: 'Tricep Dips', muscle: 'arms', pattern: 'push', equipment: ['bodyweight'] },
  { name: 'Overhead Tricep Extension', muscle: 'arms', pattern: 'push', equipment: ['dumbbell', 'band'] },
  { name: 'Cable Tricep Pushdown', muscle: 'arms', pattern: 'push', equipment: ['machine'] },
  // pull
  { name: 'Pull-ups', muscle: 'back', pattern: 'pull', equipment: ['bodyweight'], compound: true },
  { name: 'Inverted Rows', muscle: 'back', pattern: 'pull', equipment: ['bodyweight'], compound: true },
  { name: 'Barbell Row', muscle: 'back', pattern: 'pull', equipment: ['barbell'], compound: true },
  { name: 'One-arm Dumbbell Row', muscle: 'back', pattern: 'pull', equipment: ['dumbbell'], compound: true, unilateral: true },
  { name: 'Lat Pulldown', muscle: 'back', pattern: 'pull', equipment: ['machine'], compound: true },
  { name: 'Seated Cable Row', muscle: 'back', pattern: 'pull', equipment: ['machine'], compound: true },
  { name: 'Band Pull-aparts', muscle: 'back', pattern: 'pull', equipment: ['band'] },
  { name: 'Face Pulls', muscle: 'shoulders', pattern: 'pull', equipment: ['band', 'machine'] },
  { name: 'Dumbbell Bicep Curls', muscle: 'arms', pattern: 'pull', equipment: ['dumbbell'] },
  { name: 'Band Bicep Curls', muscle: 'arms', pattern: 'pull', equipment: ['band'] },
  { name: 'Barbell Curl', muscle: 'arms', pattern: 'pull', equipment: ['barbell'] },
  // legs
  { name: 'Bodyweight Squats', muscle: 'legs', pattern: 'legs', equipment: ['bodyweight'], compound: true },
  { name: 'Goblet Squats', muscle: 'legs', pattern: 'legs', equipment: ['dumbbell', 'kettlebell'], compound: true },
  { name: 'Barbell Back Squat', muscle: 'legs', pattern: 'legs', equipment: ['barbell'], compound: true },
  { name: 'Leg Press', muscle: 'legs', pattern: 'legs', equipment: ['machine'], compound: true },
  { name: 'Romanian Deadlift', muscle: 'glutes', pattern: 'legs', equipment: ['barbell', 'dumbbell'], compound: true },
  { name: 'Kettlebell Swings', muscle: 'glutes', pattern: 'legs', equipment: ['kettlebell'], compound: true },
  { name: 'Walking Lunges', muscle: 'legs', pattern: 'legs', equipment: ['bodyweight', 'dumbbell'], unilateral: true },
  { name: 'Bulgarian Split Squats', muscle: 'legs', pattern: 'legs', equipment: ['bodyweight', 'dumbbell'], unilateral: true },
  { name: 'Glute Bridges', muscle: 'glutes', pattern: 'legs', equipment: ['bodyweight', 'band'] },
  { name: 'Hip Thrusts', muscle: 'glutes', pattern: 'legs', equipment: ['barbell', 'dumbbell'], compound: true },
  { name: 'Leg Curl Machine', muscle: 'legs', pattern: 'legs', equipment: ['machine'] },
  { name: 'Calf Raises', muscle: 'legs', pattern: 'legs', equipment: ['bodyweight', 'dumbbell', 'machine'] },
  // core
  { name: 'Plank', muscle: 'core', pattern: 'core', equipment: ['bodyweight'] },
  { name: 'Dead Bug', muscle: 'core', pattern: 'core', equipment: ['bodyweight'] },
  { name: 'Hanging Leg Raises', muscle: 'core', pattern: 'core', equipment: ['bodyweight'] },
  { name: 'Russian Twists', muscle: 'core', pattern: 'core', equipment: ['bodyweight', 'dumbbell', 'kettlebell'] },
  { name: 'Cable Woodchop', muscle: 'core', pattern: 'core', equipment: ['machine', 'band'] },
  { name: 'Mountain Climbers', muscle: 'core', pattern: 'core', equipment: ['bodyweight'] },
  // cardio
  { name: 'Jump Rope', muscle: 'cardio', pattern: 'cardio', equipment: ['bodyweight'] },
  { name: 'Burpees', muscle: 'cardio', pattern: 'cardio', equipment: ['bodyweight'] },
  { name: 'High Knees', muscle: 'cardio', pattern: 'cardio', equipment: ['bodyweight'] },
  { name: 'Treadmill Intervals', muscle: 'cardio', pattern: 'cardio', equipment: ['cardio'] },
  { name: 'Rowing Machine', muscle: 'cardio', pattern: 'cardio', equipment: ['cardio'] },
  { name: 'Stationary Bike', muscle: 'cardio', pattern: 'cardio', equipment: ['cardio'] },
  { name: 'Kettlebell Complex', muscle: 'cardio', pattern: 'cardio', equipment: ['kettlebell'] },
  // mobility
  { name: 'Cat-Cow Flow', muscle: 'mobility', pattern: 'mobility', equipment: ['bodyweight'] },
  { name: 'World’s Greatest Stretch', muscle: 'mobility', pattern: 'mobility', equipment: ['bodyweight'] },
  { name: 'Hip Flexor Stretch', muscle: 'mobility', pattern: 'mobility', equipment: ['bodyweight'] },
  { name: 'Downward Dog to Cobra', muscle: 'mobility', pattern: 'mobility', equipment: ['bodyweight'] },
  { name: 'Thoracic Rotations', muscle: 'mobility', pattern: 'mobility', equipment: ['bodyweight'] },
  { name: 'Hamstring Stretch', muscle: 'mobility', pattern: 'mobility', equipment: ['bodyweight', 'band'] },
  { name: 'Pigeon Pose', muscle: 'mobility', pattern: 'mobility', equipment: ['bodyweight'] },
  { name: 'Shoulder Dislocates', muscle: 'mobility', pattern: 'mobility', equipment: ['band'] },
  { name: 'Deep Squat Hold', muscle: 'mobility', pattern: 'mobility', equipment: ['bodyweight'] },
];

// ─── Inputs ─────────────────────────────────────────────────────────────────

const GOALS: Goal[] = ['WEIGHT_LOSS', 'MUSCLE_GAIN', 'ENDURANCE', 'FLEXIBILITY', 'GENERAL_FITNESS'];
const LEVELS: Level[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export function normalizeGoal(g?: string): Goal {
  const k = (g ?? '').toUpperCase().replace(/[\s-]+/g, '_') as Goal;
  return GOALS.includes(k) ? k : 'GENERAL_FITNESS';
}
export function normalizeLevel(l?: string): Level {
  const k = (l ?? '').toUpperCase() as Level;
  return LEVELS.includes(k) ? k : 'BEGINNER';
}

/** "dumbbells, resistance bands" → ['bodyweight','dumbbell','band']. Bodyweight is always available. */
export function parseEquipment(text?: string): Equipment[] {
  const t = (text ?? '').toLowerCase();
  const out = new Set<Equipment>(['bodyweight']);
  if (!t.trim() || /\b(full|complete)\s*gym\b|\beverything\b|\ball\b/.test(t)) {
    if (t.trim()) (['dumbbell', 'barbell', 'band', 'kettlebell', 'machine', 'cardio'] as Equipment[]).forEach((e) => out.add(e));
    return [...out];
  }
  if (/dumbbell|dumbell|db\b/.test(t)) out.add('dumbbell');
  if (/barbell|bar\b|rack|bench/.test(t)) out.add('barbell');
  if (/band|resistance/.test(t)) out.add('band');
  if (/kettlebell|kettle|kb\b/.test(t)) out.add('kettlebell');
  if (/machine|cable|gym/.test(t)) out.add('machine');
  if (/treadmill|bike|cycle|rower|rowing|cardio|elliptical/.test(t)) out.add('cardio');
  return [...out];
}

// ─── Programme structure ────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SLOTS: Record<number, number[]> = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };

type Session = { focus: string; blocks: { pattern: Pattern; count: number }[] };

function splitFor(goal: Goal, days: number): Session[] {
  const fullBody: Session = { focus: 'Full body', blocks: [{ pattern: 'legs', count: 2 }, { pattern: 'push', count: 2 }, { pattern: 'pull', count: 2 }, { pattern: 'core', count: 1 }] };
  const upper: Session = { focus: 'Upper body', blocks: [{ pattern: 'push', count: 3 }, { pattern: 'pull', count: 3 }, { pattern: 'core', count: 1 }] };
  const lower: Session = { focus: 'Lower body', blocks: [{ pattern: 'legs', count: 4 }, { pattern: 'core', count: 2 }] };
  const push: Session = { focus: 'Push', blocks: [{ pattern: 'push', count: 5 }, { pattern: 'core', count: 1 }] };
  const pull: Session = { focus: 'Pull', blocks: [{ pattern: 'pull', count: 5 }, { pattern: 'core', count: 1 }] };
  const legs: Session = { focus: 'Legs', blocks: [{ pattern: 'legs', count: 5 }, { pattern: 'core', count: 1 }] };
  const conditioning: Session = { focus: 'Conditioning', blocks: [{ pattern: 'cardio', count: 3 }, { pattern: 'core', count: 2 }] };
  const circuit: Session = { focus: 'Metabolic circuit', blocks: [{ pattern: 'legs', count: 2 }, { pattern: 'push', count: 1 }, { pattern: 'pull', count: 1 }, { pattern: 'cardio', count: 2 }, { pattern: 'core', count: 1 }] };
  const mobility: Session = { focus: 'Mobility & flexibility', blocks: [{ pattern: 'mobility', count: 6 }, { pattern: 'core', count: 1 }] };
  const yogaStrength: Session = { focus: 'Mobility + light strength', blocks: [{ pattern: 'mobility', count: 4 }, { pattern: 'legs', count: 1 }, { pattern: 'core', count: 2 }] };

  switch (goal) {
    case 'MUSCLE_GAIN':
      return days <= 3 ? [fullBody, fullBody, fullBody]
        : days === 4 ? [upper, lower, upper, lower]
        : days === 5 ? [push, pull, legs, upper, lower]
        : [push, pull, legs, push, pull, legs];
    case 'WEIGHT_LOSS':
      return days <= 3 ? [circuit, conditioning, circuit]
        : days === 4 ? [circuit, conditioning, circuit, conditioning]
        : days === 5 ? [circuit, conditioning, circuit, conditioning, fullBody]
        : [circuit, conditioning, circuit, conditioning, fullBody, mobility];
    case 'ENDURANCE':
      return days <= 3 ? [conditioning, circuit, conditioning]
        : days === 4 ? [conditioning, circuit, conditioning, fullBody]
        : days === 5 ? [conditioning, circuit, conditioning, circuit, mobility]
        : [conditioning, circuit, conditioning, circuit, fullBody, mobility];
    case 'FLEXIBILITY':
      return days <= 3 ? [mobility, yogaStrength, mobility]
        : days === 4 ? [mobility, yogaStrength, mobility, yogaStrength]
        : days === 5 ? [mobility, yogaStrength, mobility, yogaStrength, mobility]
        : [mobility, yogaStrength, mobility, yogaStrength, mobility, yogaStrength];
    default:
      return days <= 3 ? [fullBody, conditioning, fullBody]
        : days === 4 ? [upper, lower, conditioning, fullBody]
        : days === 5 ? [upper, lower, conditioning, fullBody, mobility]
        : [push, pull, legs, conditioning, fullBody, mobility];
  }
}

// ─── Dose (sets / reps / rest) ──────────────────────────────────────────────

function dose(goal: Goal, level: Level, ex: Exercise): Pick<PlannedExercise, 'sets' | 'reps' | 'rest'> {
  const L = level === 'BEGINNER' ? 0 : level === 'INTERMEDIATE' ? 1 : 2;
  if (ex.pattern === 'mobility') return { sets: 1 + Math.min(L, 1), reps: ['45s hold', '60s hold', '90s hold'][L], rest: 15 };
  if (ex.pattern === 'cardio') {
    if (ex.equipment.includes('cardio')) return { sets: 1, reps: ['15 min steady', '20 min intervals', '25 min intervals'][L], rest: 0 };
    return { sets: [3, 4, 5][L], reps: ['30s', '40s', '45s'][L], rest: [45, 30, 20][L] };
  }
  if (ex.pattern === 'core') return { sets: [2, 3, 3][L], reps: ex.name === 'Plank' ? ['30s', '45s', '60s'][L] : [12, 15, 20][L], rest: 45 };
  switch (goal) {
    case 'MUSCLE_GAIN':
      return ex.compound
        ? { sets: [3, 4, 5][L], reps: ['8-10', '6-8', '5-6'][L], rest: [90, 120, 150][L] }
        : { sets: [3, 3, 4][L], reps: ['10-12', '10-12', '8-12'][L], rest: [60, 75, 90][L] };
    case 'WEIGHT_LOSS':
      return { sets: [3, 3, 4][L], reps: ['12-15', '15', '15-20'][L], rest: [45, 30, 30][L] };
    case 'ENDURANCE':
      return { sets: [2, 3, 3][L], reps: ['15-20', '20', '20-25'][L], rest: [30, 30, 20][L] };
    case 'FLEXIBILITY':
      return { sets: 2, reps: '12', rest: 45 };
    default:
      return ex.compound
        ? { sets: [3, 3, 4][L], reps: ['10', '8-10', '8'][L], rest: [75, 90, 90][L] }
        : { sets: [2, 3, 3][L], reps: ['12', '12', '10-12'][L], rest: 60 };
  }
}

// ─── Selection ──────────────────────────────────────────────────────────────

/** Deterministic rotation so the same pattern on a second day picks different movements. */
function pick(pattern: Pattern, count: number, avail: Set<Equipment>, level: Level, used: Set<string>, seed: number): Exercise[] {
  const pool = LIB.filter((e) => e.pattern === pattern && e.equipment.some((q) => avail.has(q)));
  // Advanced: prefer compound/free-weight; beginner: prefer machines/bodyweight first.
  const ranked = [...pool].sort((a, b) => {
    const score = (e: Exercise) => (e.compound ? 2 : 0) + (level === 'ADVANCED' ? (e.equipment.includes('barbell') ? 2 : 0) : level === 'BEGINNER' ? (e.equipment.includes('bodyweight') || e.equipment.includes('machine') ? 1 : 0) : 0);
    return score(b) - score(a);
  });
  const out: Exercise[] = [];
  let i = seed % Math.max(1, ranked.length);
  let guard = 0;
  while (out.length < count && guard++ < ranked.length * 2) {
    const e = ranked[i % ranked.length];
    i++;
    if (!e || used.has(e.name) || out.includes(e)) continue;
    out.push(e);
  }
  // If the pool is tiny, allow repeats rather than returning short.
  let j = 0;
  while (out.length < count && ranked.length > 0) out.push(ranked[j++ % ranked.length]);
  out.forEach((e) => used.add(e.name));
  return out;
}

export function generateWorkoutPlan(input: GeneratorInput): GeneratedPlan {
  const goal = normalizeGoal(input.goal);
  const level = normalizeLevel(input.level);
  const days = Math.min(6, Math.max(3, Math.round(Number(input.daysPerWeek) || 3)));
  const avail = new Set(parseEquipment(input.equipment));
  const sessions = splitFor(goal, days);
  const slots = DAY_SLOTS[days];
  const used = new Set<string>();
  const exercises: PlannedExercise[] = [];

  sessions.forEach((session, dayIdx) => {
    const day = DAY_NAMES[slots[dayIdx]];
    if (dayIdx % 3 === 0) used.clear(); // allow repeats across the week, but not within 3 consecutive sessions
    session.blocks.forEach((block, bIdx) => {
      const picked = pick(block.pattern, block.count, avail, level, used, dayIdx * 7 + bIdx * 3);
      picked.forEach((ex, k) => {
        const d = dose(goal, level, ex);
        const notes = k === 0 && bIdx === 0 && ex.pattern !== 'mobility' && ex.pattern !== 'cardio'
          ? 'Warm up 5 min + 2 light sets first'
          : ex.unilateral ? 'Per side' : undefined;
        exercises.push({ day, name: ex.name, muscle: ex.muscle, ...d, ...(notes ? { notes } : {}) });
      });
    });
    // Tag the session focus on the first exercise of the day for the UI.
    const first = exercises.find((e) => e.day === day);
    if (first) first.notes = first.notes ? `${session.focus} · ${first.notes}` : session.focus;
  });

  const goalLabel = goal.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const levelLabel = level.charAt(0) + level.slice(1).toLowerCase();
  return {
    name: `${goalLabel} · ${days}-day ${levelLabel} plan`,
    goal,
    difficulty: level,
    durationWeeks: goal === 'MUSCLE_GAIN' ? 8 : goal === 'FLEXIBILITY' ? 4 : 6,
    description: `${days} sessions/week · ${sessions.map((s) => s.focus).join(', ')} · equipment: ${[...avail].join(', ')}`,
    exercises,
  };
}
