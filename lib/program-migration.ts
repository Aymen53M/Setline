import {
  DEFAULT_PROGRAM_IDS,
  LEGACY_DEFAULT_PROGRAM_IDS,
  WORKOUT_DAYS,
  type Exercise,
  type WorkoutDay,
} from "./workout-data";

const LEGACY_DAY_BY_CURRENT: Partial<Record<WorkoutDay, string>> = {
  Lower: "Legs & Abs",
  Upper: "Full Body",
};

function sameIds(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((id, index) => id === expected[index]);
}

const EXERCISE_DEFINITION_FIELDS: Array<keyof Exercise> = [
  "id", "name", "day", "target", "secondary", "equipment", "instructions", "technique",
  "sets", "minReps", "maxReps", "startingWeight", "unit", "family", "rirMin", "rirMax",
  "restSeconds", "supersetGroup", "supersetRestSeconds", "alternative", "tempo", "planNote",
];

function sameExerciseDefinition(left: Exercise, right: Exercise): boolean {
  return EXERCISE_DEFINITION_FIELDS.every((field) => Object.is(left[field], right[field]));
}

export function preserveEditedBuiltInExercises(
  storedExercises: Exercise[],
  currentDefaults: Exercise[],
  previousDefaults: Exercise[],
): Exercise[] {
  const currentById = new Map(currentDefaults.map((exercise) => [exercise.id, exercise]));
  const previousById = new Map(previousDefaults.map((exercise) => [exercise.id, exercise]));
  const preserved: Exercise[] = [];

  for (const exercise of storedExercises) {
    const currentDefault = currentById.get(exercise.id);
    if (!currentDefault) continue;
    if (exercise.userEdited) {
      preserved.push(exercise);
      continue;
    }

    const previousDefault = previousById.get(exercise.id);
    if (sameExerciseDefinition(exercise, currentDefault)) continue;
    if (previousDefault && sameExerciseDefinition(exercise, previousDefault)) continue;
    preserved.push({ ...exercise, userEdited: true });
  }

  return preserved;
}

export function removeUserDeletedBuiltIns(defaults: Exercise[], archived: Exercise[]): Exercise[] {
  const deletedIds = new Set(archived.filter((exercise) => exercise.userDeleted === true).map((exercise) => exercise.id));
  return defaults.filter((exercise) => !deletedIds.has(exercise.id));
}

export function migratePrograms(
  value: unknown,
  availableIds: Set<string>,
): Record<WorkoutDay, string[]> {
  const source = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(WORKOUT_DAYS.map((day) => {
    const legacyDay = LEGACY_DAY_BY_CURRENT[day];
    const candidate = Array.isArray(source[day])
      ? source[day]
      : legacyDay && Array.isArray(source[legacyDay])
        ? source[legacyDay]
        : undefined;
    const previousDefault = LEGACY_DEFAULT_PROGRAM_IDS[legacyDay ?? day];

    // Upgrade only the exact, untouched previous starter list. A user's reordered,
    // expanded, or reduced routine remains theirs.
    if (candidate && previousDefault && sameIds(candidate, previousDefault)) {
      return [day, DEFAULT_PROGRAM_IDS[day].filter((id) => availableIds.has(id))];
    }

    if (Array.isArray(candidate)) {
      const ids = candidate.filter((id): id is string => typeof id === "string" && availableIds.has(id));
      return [day, Array.from(new Set(ids))];
    }

    return [day, DEFAULT_PROGRAM_IDS[day].filter((id) => availableIds.has(id))];
  })) as Record<WorkoutDay, string[]>;
}
