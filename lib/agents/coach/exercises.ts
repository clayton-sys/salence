export type Equipment =
  | 'bodyweight'
  | 'bands'
  | 'dumbbells'
  | 'barbell'
  | 'rack'
  | 'cables'
  | 'kettlebell'
  | 'machine'

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'full_body'
  | 'cardio'

export type Tier = 'beginner' | 'intermediate' | 'advanced'

export interface Exercise {
  name: string
  equipment: Equipment[]
  muscles: Muscle[]
  tier: Tier
  notes?: string
}

export const EXERCISES: Exercise[] = [
  // ── Bodyweight ────────────────────────────────────────────
  { name: 'Push-up', equipment: ['bodyweight'], muscles: ['chest', 'triceps', 'shoulders'], tier: 'beginner' },
  { name: 'Incline push-up', equipment: ['bodyweight'], muscles: ['chest', 'triceps'], tier: 'beginner' },
  { name: 'Decline push-up', equipment: ['bodyweight'], muscles: ['chest', 'shoulders'], tier: 'intermediate' },
  { name: 'Diamond push-up', equipment: ['bodyweight'], muscles: ['triceps', 'chest'], tier: 'intermediate' },
  { name: 'Pike push-up', equipment: ['bodyweight'], muscles: ['shoulders', 'triceps'], tier: 'intermediate' },
  { name: 'Handstand push-up', equipment: ['bodyweight'], muscles: ['shoulders', 'triceps'], tier: 'advanced' },
  { name: 'Bodyweight squat', equipment: ['bodyweight'], muscles: ['quads', 'glutes'], tier: 'beginner' },
  { name: 'Jump squat', equipment: ['bodyweight'], muscles: ['quads', 'glutes'], tier: 'intermediate' },
  { name: 'Pistol squat', equipment: ['bodyweight'], muscles: ['quads', 'glutes', 'core'], tier: 'advanced' },
  { name: 'Bulgarian split squat', equipment: ['bodyweight', 'dumbbells'], muscles: ['quads', 'glutes'], tier: 'intermediate' },
  { name: 'Reverse lunge', equipment: ['bodyweight', 'dumbbells'], muscles: ['quads', 'glutes'], tier: 'beginner' },
  { name: 'Walking lunge', equipment: ['bodyweight', 'dumbbells'], muscles: ['quads', 'glutes'], tier: 'beginner' },
  { name: 'Step-up', equipment: ['bodyweight', 'dumbbells'], muscles: ['quads', 'glutes'], tier: 'beginner' },
  { name: 'Glute bridge', equipment: ['bodyweight'], muscles: ['glutes', 'hamstrings'], tier: 'beginner' },
  { name: 'Single-leg glute bridge', equipment: ['bodyweight'], muscles: ['glutes', 'hamstrings'], tier: 'intermediate' },
  { name: 'Plank', equipment: ['bodyweight'], muscles: ['core'], tier: 'beginner' },
  { name: 'Side plank', equipment: ['bodyweight'], muscles: ['core'], tier: 'beginner' },
  { name: 'Hollow body hold', equipment: ['bodyweight'], muscles: ['core'], tier: 'intermediate' },
  { name: 'Dead bug', equipment: ['bodyweight'], muscles: ['core'], tier: 'beginner' },
  { name: 'Bird dog', equipment: ['bodyweight'], muscles: ['core', 'back'], tier: 'beginner' },
  { name: 'Hanging leg raise', equipment: ['bodyweight'], muscles: ['core'], tier: 'advanced' },
  { name: 'Burpee', equipment: ['bodyweight'], muscles: ['full_body', 'cardio'], tier: 'intermediate' },
  { name: 'Mountain climber', equipment: ['bodyweight'], muscles: ['core', 'cardio'], tier: 'beginner' },
  { name: 'Jumping jacks', equipment: ['bodyweight'], muscles: ['cardio'], tier: 'beginner' },
  { name: 'Pull-up', equipment: ['bodyweight', 'rack'], muscles: ['back', 'biceps'], tier: 'intermediate' },
  { name: 'Chin-up', equipment: ['bodyweight', 'rack'], muscles: ['back', 'biceps'], tier: 'intermediate' },
  { name: 'Inverted row', equipment: ['bodyweight', 'rack'], muscles: ['back'], tier: 'beginner' },
  { name: 'Dip', equipment: ['bodyweight', 'rack'], muscles: ['triceps', 'chest'], tier: 'intermediate' },

  // ── Dumbbells ─────────────────────────────────────────────
  { name: 'DB bench press', equipment: ['dumbbells'], muscles: ['chest', 'triceps'], tier: 'beginner' },
  { name: 'DB incline press', equipment: ['dumbbells'], muscles: ['chest'], tier: 'beginner' },
  { name: 'DB fly', equipment: ['dumbbells'], muscles: ['chest'], tier: 'beginner' },
  { name: 'DB row', equipment: ['dumbbells'], muscles: ['back', 'biceps'], tier: 'beginner' },
  { name: 'DB pullover', equipment: ['dumbbells'], muscles: ['back', 'chest'], tier: 'intermediate' },
  { name: 'DB shoulder press', equipment: ['dumbbells'], muscles: ['shoulders', 'triceps'], tier: 'beginner' },
  { name: 'DB lateral raise', equipment: ['dumbbells'], muscles: ['shoulders'], tier: 'beginner' },
  { name: 'DB rear delt fly', equipment: ['dumbbells'], muscles: ['shoulders', 'back'], tier: 'beginner' },
  { name: 'DB bicep curl', equipment: ['dumbbells'], muscles: ['biceps'], tier: 'beginner' },
  { name: 'DB hammer curl', equipment: ['dumbbells'], muscles: ['biceps'], tier: 'beginner' },
  { name: 'DB tricep extension', equipment: ['dumbbells'], muscles: ['triceps'], tier: 'beginner' },
  { name: 'DB skull crusher', equipment: ['dumbbells'], muscles: ['triceps'], tier: 'intermediate' },
  { name: 'Goblet squat', equipment: ['dumbbells', 'kettlebell'], muscles: ['quads', 'glutes'], tier: 'beginner' },
  { name: 'DB Romanian deadlift', equipment: ['dumbbells'], muscles: ['hamstrings', 'glutes'], tier: 'beginner' },
  { name: 'DB stiff-leg deadlift', equipment: ['dumbbells'], muscles: ['hamstrings', 'glutes'], tier: 'beginner' },
  { name: 'DB farmer carry', equipment: ['dumbbells'], muscles: ['full_body', 'core'], tier: 'beginner' },
  { name: 'DB thruster', equipment: ['dumbbells'], muscles: ['full_body'], tier: 'intermediate' },

  // ── Barbell ───────────────────────────────────────────────
  { name: 'Back squat', equipment: ['barbell', 'rack'], muscles: ['quads', 'glutes'], tier: 'intermediate' },
  { name: 'Front squat', equipment: ['barbell', 'rack'], muscles: ['quads', 'core'], tier: 'intermediate' },
  { name: 'Bench press', equipment: ['barbell', 'rack'], muscles: ['chest', 'triceps'], tier: 'intermediate' },
  { name: 'Incline bench press', equipment: ['barbell', 'rack'], muscles: ['chest'], tier: 'intermediate' },
  { name: 'Deadlift', equipment: ['barbell'], muscles: ['back', 'hamstrings', 'glutes'], tier: 'intermediate' },
  { name: 'Romanian deadlift', equipment: ['barbell'], muscles: ['hamstrings', 'glutes'], tier: 'intermediate' },
  { name: 'Overhead press', equipment: ['barbell', 'rack'], muscles: ['shoulders', 'triceps'], tier: 'intermediate' },
  { name: 'Barbell row', equipment: ['barbell'], muscles: ['back', 'biceps'], tier: 'intermediate' },
  { name: 'Pendlay row', equipment: ['barbell'], muscles: ['back'], tier: 'intermediate' },
  { name: 'Hip thrust', equipment: ['barbell', 'rack'], muscles: ['glutes', 'hamstrings'], tier: 'intermediate' },
  { name: 'Barbell curl', equipment: ['barbell'], muscles: ['biceps'], tier: 'beginner' },
  { name: 'Close-grip bench press', equipment: ['barbell', 'rack'], muscles: ['triceps', 'chest'], tier: 'intermediate' },

  // ── Bands ─────────────────────────────────────────────────
  { name: 'Band pull-apart', equipment: ['bands'], muscles: ['back', 'shoulders'], tier: 'beginner' },
  { name: 'Band row', equipment: ['bands'], muscles: ['back'], tier: 'beginner' },
  { name: 'Band chest press', equipment: ['bands'], muscles: ['chest'], tier: 'beginner' },
  { name: 'Band overhead press', equipment: ['bands'], muscles: ['shoulders'], tier: 'beginner' },
  { name: 'Band squat', equipment: ['bands'], muscles: ['quads', 'glutes'], tier: 'beginner' },
  { name: 'Band deadlift', equipment: ['bands'], muscles: ['hamstrings', 'glutes'], tier: 'beginner' },
  { name: 'Band curl', equipment: ['bands'], muscles: ['biceps'], tier: 'beginner' },
  { name: 'Band tricep pushdown', equipment: ['bands'], muscles: ['triceps'], tier: 'beginner' },
  { name: 'Band face pull', equipment: ['bands'], muscles: ['shoulders', 'back'], tier: 'beginner' },
  { name: 'Band lateral raise', equipment: ['bands'], muscles: ['shoulders'], tier: 'beginner' },

  // ── Cables ────────────────────────────────────────────────
  { name: 'Cable lat pulldown', equipment: ['cables', 'machine'], muscles: ['back', 'biceps'], tier: 'beginner' },
  { name: 'Cable row', equipment: ['cables', 'machine'], muscles: ['back'], tier: 'beginner' },
  { name: 'Cable tricep pushdown', equipment: ['cables'], muscles: ['triceps'], tier: 'beginner' },
  { name: 'Cable face pull', equipment: ['cables'], muscles: ['shoulders', 'back'], tier: 'beginner' },
  { name: 'Cable fly', equipment: ['cables'], muscles: ['chest'], tier: 'beginner' },
  { name: 'Cable curl', equipment: ['cables'], muscles: ['biceps'], tier: 'beginner' },
  { name: 'Cable woodchopper', equipment: ['cables'], muscles: ['core'], tier: 'intermediate' },
  { name: 'Cable kickback', equipment: ['cables'], muscles: ['glutes'], tier: 'beginner' },

  // ── Kettlebell ────────────────────────────────────────────
  { name: 'Kettlebell swing', equipment: ['kettlebell'], muscles: ['glutes', 'hamstrings', 'cardio'], tier: 'intermediate' },
  { name: 'Kettlebell goblet squat', equipment: ['kettlebell'], muscles: ['quads', 'glutes'], tier: 'beginner' },
  { name: 'Kettlebell Turkish get-up', equipment: ['kettlebell'], muscles: ['full_body', 'core'], tier: 'advanced' },
  { name: 'Kettlebell clean', equipment: ['kettlebell'], muscles: ['full_body'], tier: 'intermediate' },
  { name: 'Kettlebell press', equipment: ['kettlebell'], muscles: ['shoulders'], tier: 'intermediate' },
  { name: 'Kettlebell snatch', equipment: ['kettlebell'], muscles: ['full_body'], tier: 'advanced' },
]

export function exerciseSummary(): string {
  return EXERCISES.map(
    (e) => `- ${e.name} [${e.equipment.join('/')}] ${e.muscles.join(',')} (${e.tier})`
  ).join('\n')
}
