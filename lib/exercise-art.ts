import { EXERCISE_ART, formatMuscleName, muscleArt, type ExerciseArt, type MuscleArt } from "./exercise-art.generated";
import type { Exercise } from "./workout-data";

export type ExerciseMediaSelection = {
  art: ExerciseArt;
  isExact: boolean;
  referenceName?: string;
};

const DEMO_MATCHERS: Array<{ pattern: RegExp; id: string; name: string }> = [
  { pattern: /(?:shoulder|deltoid).{0,16}press|press.{0,16}(?:shoulder|deltoid)/i, id: "seated-shoulder-press", name: "Machine shoulder press" },
  { pattern: /(?:incline|inclined).{0,18}(?:dumbbell|db).{0,12}press|(?:dumbbell|db).{0,12}(?:incline|inclined).{0,12}press/i, id: "incline-dumbbell-press", name: "Incline dumbbell press" },
  { pattern: /(?:machine|flat|chest|bench).{0,16}press|press.{0,16}(?:chest|bench)/i, id: "machine-chest-press", name: "Machine chest press" },
  { pattern: /pec.?deck|chest fly|chest flye/i, id: "pec-deck", name: "Pec deck" },
  { pattern: /lateral raise|side raise/i, id: "push-cable-lateral-raise", name: "Cable lateral raise" },
  { pattern: /overhead.{0,18}triceps?.{0,18}extension|triceps?.{0,18}overhead.{0,18}extension/i, id: "push-overhead-cable-triceps-extension", name: "Overhead cable triceps extension" },
  { pattern: /triceps?.{0,18}push.?down|push.?down.{0,18}triceps?/i, id: "push-overhead-cable-triceps-extension", name: "Overhead cable triceps extension" },
  { pattern: /leg extension|knee extension/i, id: "push-leg-extension", name: "Leg extension" },
  { pattern: /close.{0,12}(?:grip|neutral).{0,12}pulldown/i, id: "upper-close-neutral-grip-pulldown", name: "Close-grip lat pulldown" },
  { pattern: /lat.?pulldown|pulldown/i, id: "lat-pulldown", name: "Lat pulldown" },
  { pattern: /chest.supported.{0,12}row/i, id: "chest-supported-row", name: "Chest-supported row" },
  { pattern: /wide.grip.{0,12}(?:seated|cable).{0,12}row|seated.{0,12}cable.{0,12}row/i, id: "upper-wide-grip-seated-cable-row", name: "Seated cable row" },
  { pattern: /row/i, id: "chest-supported-row", name: "Chest-supported row" },
  { pattern: /incline.{0,12}(?:dumbbell|db).{0,12}curl/i, id: "incline-dumbbell-curl", name: "Incline dumbbell curl" },
  { pattern: /curl/i, id: "upper-cable-ez-bar-curl", name: "Cable curl" },
  { pattern: /reverse pec|rear.delt|reverse.fly/i, id: "reverse-pec-deck-rear-delt-fly", name: "Reverse pec-deck fly" },
  { pattern: /leg curl|hamstring curl/i, id: "seated-leg-curl", name: "Seated leg curl" },
  { pattern: /leg press/i, id: "leg-press", name: "Leg press" },
  { pattern: /romanian deadlift|\brdl\b|hip hinge/i, id: "romanian-deadlift", name: "Romanian deadlift" },
  { pattern: /hip abduction|outer glute/i, id: "lower-hip-abduction", name: "Hip abduction" },
  { pattern: /calf raise|calf machine/i, id: "standing-calf-raises", name: "Standing calf raise" },
  { pattern: /cable crunch|crunch/i, id: "cable-crunches", name: "Cable crunch" },
];

export function getExerciseMediaSelection(exercise: Exercise): ExerciseMediaSelection | undefined {
  const exact = EXERCISE_ART[exercise.id];
  if (exact) return { art: exact, isExact: true };

  const description = `${exercise.name} ${exercise.equipment} ${exercise.target}`;
  const match = DEMO_MATCHERS.find(({ pattern }) => pattern.test(description));
  const familyFallback = {
    push: { id: "machine-chest-press", name: "Machine chest press" },
    pull: { id: "lat-pulldown", name: "Lat pulldown" },
    legs: { id: "leg-press", name: "Leg press" },
    core: { id: "cable-crunches", name: "Cable crunch" },
  }[exercise.family];
  const selected = match ?? familyFallback;
  const art = EXERCISE_ART[selected.id];
  return art ? { art, isExact: false, referenceName: selected.name } : undefined;
}

const TARGET_ALIASES: Array<[RegExp, string[]]> = [
  [/upper chest|chest|pecs?/i, ["pectoralis_major"]],
  [/front delts?|anterior delts?|front shoulders?/i, ["anterior_deltoid"]],
  [/side delts?|lateral delts?/i, ["lateral_deltoid"]],
  [/rear delts?|posterior delts?/i, ["posterior_deltoid"]],
  [/triceps?/i, ["triceps_brachii"]],
  [/biceps?/i, ["biceps_brachii"]],
  [/brachialis/i, ["brachialis"]],
  [/forearms?/i, ["forearm_flexors"]],
  [/lats?/i, ["latissimus_dorsi"]],
  [/(?:mid|upper)\s*-?\s*back|rhomboids?/i, ["rhomboids", "trapezius"]],
  [/traps?|trapezius/i, ["trapezius"]],
  [/quadriceps?|quads?/i, ["quadriceps"]],
  [/hamstrings?/i, ["hamstrings"]],
  [/outer glutes?|glute medius|hip abductors?/i, ["gluteus_medius"]],
  [/glutes?/i, ["gluteus_maximus"]],
  [/calves|calf/i, ["gastrocnemius", "soleus"]],
  [/obliques?/i, ["obliques"]],
  [/abs|abdominals?|core/i, ["rectus_abdominis", "obliques"]],
];

function musclesFromTarget(value: string): string[] {
  const ids = new Set<string>();
  for (const [pattern, matches] of TARGET_ALIASES) {
    if (pattern.test(value)) matches.forEach((id) => ids.add(id));
  }
  if (/\b(?:shoulders?|delts?)\b/i.test(value) && !/\b(?:front|side|rear|anterior|lateral|posterior)\s+(?:delts?|shoulders?)\b/i.test(value)) {
    ids.add("anterior_deltoid");
    ids.add("lateral_deltoid");
  }
  if (/\bback\b/i.test(value) && !/\b(?:mid|upper|lower)\s*-?\s*back\b/i.test(value)) {
    ids.add("latissimus_dorsi");
    ids.add("rhomboids");
  }
  if (/\bglutes?\b/i.test(value) && !/outer glutes?|glute medius/i.test(value)) ids.add("gluteus_maximus");
  return [...ids];
}

function resolveMuscleArt(ids: string[]): MuscleArt[] {
  return ids.map((id) => muscleArt(id)).filter((muscle): muscle is MuscleArt => Boolean(muscle));
}

export function getTargetMuscleArt(exercise: Exercise): { primary: MuscleArt[]; assisting: MuscleArt[] } {
  const exact = EXERCISE_ART[exercise.id];
  const primaryIds = exact?.primaryMuscles ?? musclesFromTarget(exercise.target);
  const assistingIds = exact?.secondaryMuscles ?? musclesFromTarget(exercise.secondary);
  const primary = resolveMuscleArt(primaryIds);
  const primarySet = new Set(primary.map((muscle) => muscle.id));
  const assisting = resolveMuscleArt(assistingIds).filter((muscle) => !primarySet.has(muscle.id));
  return { primary, assisting };
}

export const getExerciseMediaThumbnail = (exercise: Exercise) => {
  const selection = getExerciseMediaSelection(exercise);
  return selection?.art.finish ?? selection?.art.start;
};

export const muscleName = (id: string) => formatMuscleName(id);
