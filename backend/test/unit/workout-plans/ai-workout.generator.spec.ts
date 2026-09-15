import { generateWorkoutPlan, normalizeGoal, normalizeLevel, parseEquipment } from '../../../src/workout-plans/ai-workout.generator';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

describe('ai-workout generator', () => {
  it('normalises free-text goal/level inputs', () => {
    expect(normalizeGoal('muscle gain')).toBe('MUSCLE_GAIN');
    expect(normalizeGoal('Weight-Loss')).toBe('WEIGHT_LOSS');
    expect(normalizeGoal('nonsense')).toBe('GENERAL_FITNESS');
    expect(normalizeLevel('advanced')).toBe('ADVANCED');
    expect(normalizeLevel(undefined)).toBe('BEGINNER');
  });

  it('parses equipment text; bodyweight is always available', () => {
    expect(parseEquipment('')).toEqual(['bodyweight']);
    expect(parseEquipment('dumbbells, resistance bands')).toEqual(expect.arrayContaining(['bodyweight', 'dumbbell', 'band']));
    expect(parseEquipment('full gym')).toEqual(expect.arrayContaining(['barbell', 'machine', 'cardio']));
    expect(parseEquipment('treadmill')).toContain('cardio');
  });

  it('produces different programmes for different inputs (not a stub)', () => {
    const a = generateWorkoutPlan({ goal: 'MUSCLE_GAIN', level: 'ADVANCED', daysPerWeek: 5, equipment: 'full gym' });
    const b = generateWorkoutPlan({ goal: 'WEIGHT_LOSS', level: 'BEGINNER', daysPerWeek: 3 });
    const c = generateWorkoutPlan({ goal: 'FLEXIBILITY', level: 'BEGINNER', daysPerWeek: 4 });
    expect(a.exercises.map((e) => e.name)).not.toEqual(b.exercises.map((e) => e.name));
    expect(new Set(a.exercises.map((e) => e.day)).size).toBe(5);
    expect(new Set(b.exercises.map((e) => e.day)).size).toBe(3);
    expect(c.exercises.every((e) => ['mobility', 'core', 'legs'].includes(e.muscle))).toBe(true);
    expect(a.name).toContain('5-day');
    expect(a.difficulty).toBe('ADVANCED');
  });

  it('is deterministic for identical input', () => {
    const x = generateWorkoutPlan({ goal: 'ENDURANCE', level: 'INTERMEDIATE', daysPerWeek: 4, equipment: 'bike' });
    const y = generateWorkoutPlan({ goal: 'ENDURANCE', level: 'INTERMEDIATE', daysPerWeek: 4, equipment: 'bike' });
    expect(x).toEqual(y);
  });

  it('only schedules on real weekday names the mobile detail screen filters by', () => {
    for (const days of [3, 4, 5, 6]) {
      const p = generateWorkoutPlan({ goal: 'GENERAL_FITNESS', level: 'BEGINNER', daysPerWeek: days });
      expect(p.exercises.every((e) => DAYS.includes(e.day))).toBe(true);
      expect(new Set(p.exercises.map((e) => e.day)).size).toBe(days);
      p.exercises.forEach((e) => { expect(e.sets).toBeGreaterThan(0); expect(e.rest).toBeGreaterThanOrEqual(0); expect(e.reps).toBeTruthy(); });
    }
  });

  it('respects equipment: bodyweight-only plans never require a barbell or machine', () => {
    const p = generateWorkoutPlan({ goal: 'MUSCLE_GAIN', level: 'INTERMEDIATE', daysPerWeek: 4, equipment: '' });
    const names = p.exercises.map((e) => e.name);
    expect(names.some((n) => /Barbell|Machine|Cable|Leg Press|Lat Pulldown/.test(n))).toBe(false);
    expect(names).toEqual(expect.arrayContaining(['Push-ups']));
  });

  it('advanced muscle-gain uses heavier compound dosing than beginner weight-loss', () => {
    const adv = generateWorkoutPlan({ goal: 'MUSCLE_GAIN', level: 'ADVANCED', daysPerWeek: 4, equipment: 'barbell dumbbell' });
    const beg = generateWorkoutPlan({ goal: 'WEIGHT_LOSS', level: 'BEGINNER', daysPerWeek: 4 });
    const squat = adv.exercises.find((e) => e.name === 'Barbell Back Squat');
    expect(squat).toBeDefined();
    expect(squat?.sets).toBe(5);
    expect(squat?.rest).toBe(150);
    expect(beg.exercises.some((e) => e.muscle === 'cardio')).toBe(true);
    expect(Math.max(...beg.exercises.filter((e) => e.muscle !== 'cardio' && e.muscle !== 'core').map((e) => e.rest))).toBeLessThanOrEqual(45);
  });

  it('clamps daysPerWeek into 3–6', () => {
    expect(new Set(generateWorkoutPlan({ goal: 'GENERAL_FITNESS', level: 'BEGINNER', daysPerWeek: 1 }).exercises.map((e) => e.day)).size).toBe(3);
    expect(new Set(generateWorkoutPlan({ goal: 'GENERAL_FITNESS', level: 'BEGINNER', daysPerWeek: 9 }).exercises.map((e) => e.day)).size).toBe(6);
  });
});
