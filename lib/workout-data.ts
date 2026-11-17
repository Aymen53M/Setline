import { TRAINING_DAYS, TRAINING_EXERCISES } from "./training-plan";
import { MEDIA } from "./workout-media";
import { getExerciseMediaSelection } from "./exercise-art";

export { MEDIA };

export const WORKOUT_DAYS = TRAINING_DAYS;
export type WorkoutDay = (typeof WORKOUT_DAYS)[number];
export const LEGACY_WORKOUT_DAYS = ["Legs & Abs", "Full Body"] as const;
export type LegacyWorkoutDay = (typeof LEGACY_WORKOUT_DAYS)[number];
export type WorkoutRecordDay = WorkoutDay | LegacyWorkoutDay;
export type MetricKey = "weight" | "reps" | "volume" | "oneRepMax";

export type Exercise = {
  id: string;
  name: string;
  day: WorkoutDay;
  target: string;
  secondary: string;
  equipment: string;
  instructions: string;
  technique: string;
  sets: number;
  minReps: number;
  maxReps: number;
  startingWeight: number | null;
  unit?: "kg" | "sec";
  family: "push" | "pull" | "legs" | "core";
  rirMin?: number;
  rirMax?: number;
  restSeconds?: number;
  supersetGroup?: string;
  supersetRestSeconds?: number;
  alternative?: string;
  tempo?: string;
  planNote?: string;
  userEdited?: boolean;
  userDeleted?: boolean;
};

export type WorkoutSet = {
  id: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rir: number;
  completed: boolean;
  notes?: string;
  exerciseNameSnapshot?: string;
  exerciseTargetSnapshot?: string;
  exerciseSecondarySnapshot?: string;
};

export type WorkoutRecord = {
  id: string;
  day: WorkoutRecordDay;
  date: string;
  durationMinutes: number;
  notes?: string;
  sets: WorkoutSet[];
};

export type RestTimerMode = "set" | "exercise";

export type BodyWeightEntry = {
  id: string;
  date: string;
  weight: number;
  unit: "kg" | "lb";
  note?: string;
};

export type WorkoutDraft = {
  id: string;
  day: WorkoutDay;
  startedAt: string;
  sets: WorkoutSet[];
  notes: string;
  exerciseIds: string[];
  currentExerciseIndex: number;
  exerciseSnapshots: Record<string, Exercise>;
  restDeadlineAt: number | null;
  restMode: RestTimerMode | null;
};

export const DAY_META: Record<WorkoutDay, { short: string; eyebrow: string; muscles: string; family: Exercise["family"]; plannedSets: number; durationMinutes: number }> = {
  Push: { short: "Push", eyebrow: "Day 1", muscles: "Chest · Shoulders · Triceps · Quads", family: "push", plannedSets: 15, durationMinutes: 50 },
  Pull: { short: "Pull", eyebrow: "Day 2", muscles: "Back · Rear delts · Biceps · Hamstrings", family: "pull", plannedSets: 13, durationMinutes: 45 },
  Lower: { short: "Lower", eyebrow: "Day 3", muscles: "Quads · Hamstrings · Glutes · Calves · Core", family: "legs", plannedSets: 16, durationMinutes: 55 },
  Upper: { short: "Upper", eyebrow: "Day 4", muscles: "Chest · Back · Shoulders · Arms · Core", family: "core", plannedSets: 17, durationMinutes: 50 },
};

const LEGACY_DAY_META: Record<LegacyWorkoutDay, { short: string; eyebrow: string; muscles: string; family: Exercise["family"]; plannedSets: number; durationMinutes: number }> = {
  "Legs & Abs": { short: "Legs + abs", eyebrow: "Archived day", muscles: "Quads · Hamstrings · Glutes · Core", family: "legs", plannedSets: 0, durationMinutes: 0 },
  "Full Body": { short: "Full body", eyebrow: "Archived day", muscles: "Chest · Back · Lower body · Core", family: "core", plannedSets: 0, durationMinutes: 0 },
};

export function normalizeWorkoutDay(value: unknown): WorkoutDay | undefined {
  if (typeof value !== "string") return undefined;
  if ((WORKOUT_DAYS as readonly string[]).includes(value)) return value as WorkoutDay;
  if (value === "Legs & Abs") return "Lower";
  if (value === "Full Body") return "Upper";
  return undefined;
}

export function getWorkoutDayMeta(day: WorkoutRecordDay) {
  return (WORKOUT_DAYS as readonly string[]).includes(day)
    ? DAY_META[day as WorkoutDay]
    : LEGACY_DAY_META[day as LegacyWorkoutDay];
}

export const WEEK_SCHEDULE: Array<{
  day: string;
  workout?: WorkoutDay;
  activity: string;
  dateOffset: number;
}> = [
  { day: "Mon", workout: "Push", activity: "Lift · 7:30 pm", dateOffset: -3 },
  { day: "Tue", workout: "Pull", activity: "Lift · 2 × 25 min easy ride", dateOffset: -2 },
  { day: "Wed", activity: "Recovery · 2 × 25 min easy ride", dateOffset: -1 },
  { day: "Thu", workout: "Lower", activity: "Lift · 7:30 pm", dateOffset: 0 },
  { day: "Fri", workout: "Upper", activity: "Lift · 7:30 pm", dateOffset: 1 },
  { day: "Sat", activity: "Off", dateOffset: 2 },
  { day: "Sun", activity: "Off", dateOffset: 3 },
];

export const EXERCISES: Exercise[] = TRAINING_EXERCISES;
export const PROGRAM: Record<WorkoutDay, Exercise[]> = Object.fromEntries(
  WORKOUT_DAYS.map((day) => [day, EXERCISES.filter((exercise) => exercise.day === day)]),
) as Record<WorkoutDay, Exercise[]>;

export const DEFAULT_PROGRAM_IDS: Record<WorkoutDay, string[]> = Object.fromEntries(
  WORKOUT_DAYS.map((day) => [day, PROGRAM[day].map((exercise) => exercise.id)]),
) as Record<WorkoutDay, string[]>;

// These previous IDs identify old defaults during migration and keep customized old lists resolvable.
export const LEGACY_DEFAULT_PROGRAM_IDS: Record<string, string[]> = {
  Push: ["machine-chest-press", "incline-chest-press", "seated-shoulder-press", "lateral-raises", "cable-triceps-pushdown"],
  Pull: ["lat-pulldown", "chest-supported-row", "seated-cable-row", "reverse-pec-deck-rear-delt-fly", "biceps-curls", "hammer-curls"],
  "Legs & Abs": ["leg-press", "romanian-deadlift", "seated-leg-curl", "leg-extension", "standing-calf-raises", "cable-crunches"],
  "Full Body": ["machine-chest-press", "lat-pulldown", "goblet-squat", "seated-cable-row", "seated-leg-curl", "lateral-raises", "biceps-curls", "triceps-pushdown", "plank", "standing-calf-raises"],
};

// Old definitions are migration fallbacks only; they never appear in a new user's default library.
export const LEGACY_DEFAULT_EXERCISES: Exercise[] = [
  { id: "incline-chest-press", name: "Incline Chest Press", day: "Push", target: "Upper chest", secondary: "Front delts · Triceps", equipment: "Incline press machine", instructions: "Drive the handles up and slightly in, keeping your ribcage quiet.", technique: "Use a controlled two-second lower and avoid shrugging.", sets: 2, minReps: 8, maxReps: 12, startingWeight: 35, family: "push" },
  { id: "seated-shoulder-press", name: "Seated Shoulder Press", day: "Push", target: "Shoulders", secondary: "Triceps · Upper chest", equipment: "Shoulder press machine", instructions: "Press from ear level until arms are extended, then return under control.", technique: "Keep ribs down and elbows slightly forward of the torso.", sets: 2, minReps: 8, maxReps: 12, startingWeight: 15, family: "push" },
  { id: "lateral-raises", name: "Lateral Raises", day: "Push", target: "Side delts", secondary: "Traps", equipment: "Dumbbells or cable", instructions: "Raise hands to shoulder height with soft elbows, then lower slowly.", technique: "Lead with elbows and keep the movement in the shoulder, not the wrists.", sets: 2, minReps: 12, maxReps: 20, startingWeight: 10, family: "push" },
  { id: "cable-triceps-pushdown", name: "Cable Triceps Pushdown", day: "Push", target: "Triceps", secondary: "Core · Forearms", equipment: "Cable stack", instructions: "Pin elbows to your sides and extend the bar until elbows are straight.", technique: "Do not rock your torso; pause at full extension.", sets: 2, minReps: 10, maxReps: 15, startingWeight: 11, family: "push" },
  { id: "machine-chest-press", name: "Machine Chest Press", day: "Push", target: "Chest", secondary: "Front delts · Triceps", equipment: "Chest press machine", instructions: "Set the seat so handles sit at mid-chest. Press smoothly without locking out hard.", technique: "Keep shoulder blades pinned and wrists stacked over elbows.", sets: 3, minReps: 5, maxReps: 8, startingWeight: 40, family: "push" },
  { id: "lat-pulldown", name: "Lat Pulldown", day: "Pull", target: "Lats", secondary: "Biceps · Mid-back", equipment: "Pulldown machine", instructions: "Pull the bar toward the top of your chest while keeping your torso tall.", technique: "Start by drawing shoulders down, then drive elbows toward your ribs.", sets: 3, minReps: 6, maxReps: 10, startingWeight: 28, family: "pull" },
  { id: "chest-supported-row", name: "Chest-Supported Row", day: "Pull", target: "Mid-back", secondary: "Lats · Rear delts", equipment: "Chest-supported row", instructions: "Brace against the pad and row handles toward the lower ribs.", technique: "Keep chest connected to the pad and squeeze shoulder blades together.", sets: 3, minReps: 8, maxReps: 12, startingWeight: null, family: "pull" },
  { id: "seated-cable-row", name: "Seated Cable Row", day: "Pull", target: "Mid-back", secondary: "Lats · Biceps", equipment: "Cable stack", instructions: "Sit tall, reach forward, then pull the handle toward your navel.", technique: "Finish with a proud chest; do not turn it into a low-back swing.", sets: 2, minReps: 10, maxReps: 12, startingWeight: 30, family: "pull" },
  { id: "reverse-pec-deck-rear-delt-fly", name: "Reverse Pec Deck / Rear Delt Fly", day: "Pull", target: "Rear delts", secondary: "Upper back", equipment: "Pec deck machine", instructions: "Open your arms until they line up with your shoulders, then return slowly.", technique: "Keep a soft bend in the elbows and avoid shrugging.", sets: 2, minReps: 12, maxReps: 20, startingWeight: null, family: "pull" },
  { id: "biceps-curls", name: "Biceps Curls", day: "Pull", target: "Biceps", secondary: "Forearms", equipment: "Dumbbells", instructions: "Curl without moving your upper arms, then lower through the full range.", technique: "Keep elbows under shoulders and finish with a quiet wrist.", sets: 2, minReps: 8, maxReps: 12, startingWeight: 10, family: "pull" },
  { id: "hammer-curls", name: "Hammer Curls", day: "Pull", target: "Brachialis", secondary: "Biceps · Forearms", equipment: "Dumbbells", instructions: "Curl with palms facing inward, keeping the dumbbells close to your sides.", technique: "Avoid swinging; stop just short of losing elbow position.", sets: 1, minReps: 10, maxReps: 15, startingWeight: null, family: "pull" },
  { id: "leg-extension", name: "Leg Extension", day: "Lower", target: "Quads", secondary: "Knee extensors", equipment: "Leg extension machine", instructions: "Extend knees until legs are straight, then lower smoothly.", technique: "Align the machine pivot with your knee joint.", sets: 2, minReps: 10, maxReps: 15, startingWeight: null, family: "legs" },
  { id: "leg-press", name: "Leg Press", day: "Lower", target: "Quads", secondary: "Glutes · Hamstrings", equipment: "Leg press machine", instructions: "Lower the sled until your knees are comfortably bent, then drive through mid-foot.", technique: "Keep hips and lower back against the pad throughout.", sets: 3, minReps: 6, maxReps: 10, startingWeight: null, family: "legs" },
  { id: "romanian-deadlift", name: "Romanian Deadlift", day: "Lower", target: "Hamstrings", secondary: "Glutes · Back", equipment: "Barbell or dumbbells", instructions: "Hinge hips back with a long spine, then stand by driving hips forward.", technique: "Keep the load close and stop when hamstrings are fully loaded.", sets: 2, minReps: 8, maxReps: 10, startingWeight: null, family: "legs" },
  { id: "seated-leg-curl", name: "Seated Leg Curl", day: "Lower", target: "Hamstrings", secondary: "Calves", equipment: "Leg curl machine", instructions: "Curl the pad toward you without lifting the hips from the seat.", technique: "Pause in the shortened position and control the return.", sets: 2, minReps: 10, maxReps: 15, startingWeight: null, family: "legs" },
  { id: "standing-calf-raises", name: "Standing Calf Raises", day: "Lower", target: "Calves", secondary: "Feet · Ankles", equipment: "Calf raise machine", instructions: "Rise onto the balls of your feet, pause high, then sink into a stretch.", technique: "Use a full range and keep pressure even across the foot.", sets: 2, minReps: 10, maxReps: 15, startingWeight: null, family: "core" },
  { id: "cable-crunches", name: "Cable Crunches", day: "Lower", target: "Abs", secondary: "Hip flexors", equipment: "Cable stack", instructions: "Kneel, brace, and curl ribs toward hips without pulling with your arms.", technique: "Think spine flexion, not a hip hinge.", sets: 2, minReps: 10, maxReps: 15, startingWeight: null, family: "core" },
  { id: "goblet-squat", name: "Goblet Squat", day: "Upper", target: "Quads", secondary: "Glutes · Core", equipment: "Dumbbell or kettlebell", instructions: "Hold the load at your chest and sit between your hips before standing tall.", technique: "Keep the chest proud and knees tracking over toes.", sets: 2, minReps: 10, maxReps: 12, startingWeight: null, family: "legs" },
  { id: "plank", name: "Plank", day: "Upper", target: "Core", secondary: "Shoulders · Glutes", equipment: "Bodyweight", instructions: "Make a straight line from head to heels while breathing behind the brace.", technique: "Squeeze glutes and keep ribs tucked; stop before form changes.", sets: 2, minReps: 30, maxReps: 60, startingWeight: 0, unit: "sec", family: "core" },
  { id: "triceps-pushdown", name: "Triceps Pushdown", day: "Upper", target: "Triceps", secondary: "Core · Forearms", equipment: "Cable stack", instructions: "Extend the handle down and return until the triceps are stretched.", technique: "Keep upper arms fixed and finish with a brief squeeze.", sets: 1, minReps: 10, maxReps: 15, startingWeight: 11, family: "push" },
];

export const getExercise = (id: string) => EXERCISES.find((exercise) => exercise.id === id);
export const getMediaForExercise = (exercise: Exercise) => {
  const selection = getExerciseMediaSelection(exercise);
  const illustration = selection?.art.finish ?? selection?.art.start;

  // Current built-in exercises use the RepDB movement art as their cover.
  // Keep legacy photos for older/custom exercises that only have a family match.
  if (selection?.isExact && illustration) return illustration;
  return MEDIA[exercise.id as keyof typeof MEDIA] ?? illustration;
};
export const formatWeight = (exercise: Exercise, weight: number | null | undefined) => exercise.unit === "sec" ? `${weight ?? 0}s` : weight ? `${weight} kg` : "To establish";
export const formatRepRange = (exercise: Exercise) => exercise.unit === "sec" ? `${exercise.minReps}–${exercise.maxReps} sec` : `${exercise.minReps}–${exercise.maxReps}`;
export const totalVolume = (workouts: WorkoutRecord[]) => workouts.reduce((sum, workout) => sum + workout.sets.filter((set) => set.completed).reduce((setSum, set) => setSum + set.weight * set.reps, 0), 0);
export const estimateOneRepMax = (weight: number, reps: number) => Math.round(weight * (1 + reps / 30) * 10) / 10;
export const latestSetForExercise = (workouts: WorkoutRecord[], exerciseId: string) => workouts.flatMap((workout) => workout.sets.map((set) => ({ ...set, date: workout.date }))).filter((set) => set.exerciseId === exerciseId && set.completed).sort((a, b) => b.date.localeCompare(a.date))[0];
export const lastNDays = (workouts: WorkoutRecord[], days: number) => workouts.filter((workout) => Date.now() - new Date(workout.date).getTime() <= days * 86400000);
export const getRecommendation = (exercise: Exercise, workouts: WorkoutRecord[]) => {
  // Ignore sessions where the exercise was in the plan but no set was completed.
  // Partial sessions should not erase the last usable training performance.
  const relevant = workouts
    .filter((workout) => workout.sets.some((set) => set.exerciseId === exercise.id && set.completed))
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = relevant[0]?.sets.filter((set) => set.exerciseId === exercise.id && set.completed) ?? [];
  if (!latest.length) return { label: "Start here", detail: "Log your first session to unlock a recommendation." };
  const minRir = exercise.rirMin ?? 0;
  const maxRir = exercise.rirMax ?? 2;
  const allTop = latest.length >= exercise.sets && latest.every((set) => set.reps >= exercise.maxReps && set.rir >= minRir && set.rir <= maxRir);
  if (allTop) return { label: "Increase next session", detail: "Every set reached the top of the rep range at the target effort. Add the smallest practical increment." };
  const average = latest.reduce((sum, set) => sum + set.reps, 0) / latest.length;
  if (average < exercise.minReps) return { label: "Hold the load", detail: "Keep the weight steady and build reps before moving up." };
  return { label: "Build the reps", detail: "Keep the same load and add one clean rep where possible." };
};

export const muscleGroups = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quadriceps", "Hamstrings", "Glutes", "Calves", "Abs"];
