import type { Exercise, RestTimerMode, WorkoutDay, WorkoutDraft, WorkoutRecord, WorkoutSet } from "./workout-data";

export type ExerciseLookup = (id: string) => Exercise | undefined;

const uniqueIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

export function latestSetsForExercise(workouts: WorkoutRecord[], exerciseId: string): WorkoutSet[] {
  const latestWorkout = workouts
    .filter((workout) => workout.sets.some((set) => set.exerciseId === exerciseId && set.completed))
    .sort((left, right) => right.date.localeCompare(left.date))[0];
  return latestWorkout
    ? latestWorkout.sets
        .filter((set) => set.exerciseId === exerciseId && set.completed)
        .sort((left, right) => left.setNumber - right.setNumber)
    : [];
}

export function getRestRemainingSeconds(deadlineAt: number | null, now: number): number {
  if (deadlineAt === null || !Number.isFinite(deadlineAt)) return 0;
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

export function getWorkoutElapsedSeconds(draft: Pick<WorkoutDraft, "startedAt">, now: number): number {
  const startedAt = new Date(draft.startedAt).getTime();
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function createExerciseSets(
  exercise: Exercise,
  latestWeight: (exerciseId: string) => number,
  timestamp = Date.now(),
  latestPerformance: (exerciseId: string) => WorkoutSet[] = () => [],
): WorkoutSet[] {
  const previousSets = latestPerformance(exercise.id);
  return Array.from({ length: Math.max(1, exercise.sets) }, (_, index) => {
    const setNumber = index + 1;
    const previousSet = previousSets.find((set) => set.setNumber === setNumber)
      ?? previousSets[index]
      ?? previousSets[previousSets.length - 1];
    return {
      id: `${exercise.id}-${timestamp}-${setNumber}`,
      exerciseId: exercise.id,
      setNumber,
      weight: previousSet?.weight ?? latestWeight(exercise.id) ?? exercise.startingWeight ?? 0,
      reps: previousSet?.reps ?? exercise.minReps,
      rir: previousSet?.rir ?? exercise.rirMax ?? 2,
      completed: false,
      notes: previousSet?.notes,
      exerciseNameSnapshot: exercise.name,
      exerciseTargetSnapshot: exercise.target,
      exerciseSecondarySnapshot: exercise.secondary,
    };
  });
}

export function createWorkoutDraft(
  day: WorkoutDay,
  exercises: Exercise[],
  latestWeight: (exerciseId: string) => number,
  latestPerformance: (exerciseId: string) => WorkoutSet[] = () => [],
): WorkoutDraft {
  const orderedExercises = exercises.filter(
    (exercise, index, list) => list.findIndex((candidate) => candidate.id === exercise.id) === index,
  );
  const exerciseIds = orderedExercises.map((exercise) => exercise.id);

  return {
    id: `draft-${Date.now()}`,
    day,
    startedAt: new Date().toISOString(),
    notes: "",
    exerciseIds,
    currentExerciseIndex: 0,
    restDeadlineAt: null,
    restMode: null,
    exerciseSnapshots: Object.fromEntries(
      orderedExercises.map((exercise) => [exercise.id, exercise]),
    ),
    sets: orderedExercises.flatMap((exercise) => createExerciseSets(exercise, latestWeight, Date.now(), latestPerformance)),
  };
}

export function normalizeWorkoutDraft(
  source: Partial<WorkoutDraft>,
  fallbackDay: WorkoutDay,
  fallbackExercises: Exercise[],
  lookup: ExerciseLookup,
): WorkoutDraft {
  const sets = Array.isArray(source.sets)
    ? source.sets.filter(
        (set): set is WorkoutSet => Boolean(set && typeof set.id === "string" && typeof set.exerciseId === "string"),
      )
    : [];
  const idsFromSets = uniqueIds(sets.map((set) => set.exerciseId));
  const candidateIds = Array.isArray(source.exerciseIds)
    ? uniqueIds(source.exerciseIds.filter((id): id is string => typeof id === "string"))
    : idsFromSets.length > 0
      ? idsFromSets
      : fallbackExercises.map((exercise) => exercise.id);
  const exerciseIds = candidateIds.filter((id) => lookup(id) || source.exerciseSnapshots?.[id]);
  const savedSnapshots = source.exerciseSnapshots && typeof source.exerciseSnapshots === "object"
    ? source.exerciseSnapshots
    : {};
  const exerciseSnapshots: Record<string, Exercise> = {};

  for (const id of uniqueIds([...exerciseIds, ...idsFromSets])) {
    const saved = savedSnapshots[id];
    const resolved = saved && typeof saved.name === "string" ? saved : lookup(id);
    if (resolved) exerciseSnapshots[id] = resolved;
  }

  const normalizedSets = sets.map((set) => {
    const exercise = exerciseSnapshots[set.exerciseId] ?? lookup(set.exerciseId);
    return {
      ...set,
      exerciseNameSnapshot:
        set.exerciseNameSnapshot ?? exercise?.name ?? `Archived exercise (${set.exerciseId})`,
      exerciseTargetSnapshot: set.exerciseTargetSnapshot ?? exercise?.target ?? "Exercise",
      exerciseSecondarySnapshot: set.exerciseSecondarySnapshot ?? exercise?.secondary ?? "",
    };
  });
  const requestedIndex = Number.isInteger(source.currentExerciseIndex)
    ? Number(source.currentExerciseIndex)
    : 0;
  const candidateRestMode: RestTimerMode | null = source.restMode === "set" || source.restMode === "exercise"
    ? source.restMode
    : null;
  const restDeadlineAt = candidateRestMode !== null && typeof source.restDeadlineAt === "number" && Number.isFinite(source.restDeadlineAt)
    ? source.restDeadlineAt
    : null;
  const restMode = restDeadlineAt === null ? null : candidateRestMode;

  return {
    id: typeof source.id === "string" ? source.id : `draft-${Date.now()}`,
    day: source.day ?? fallbackDay,
    startedAt: typeof source.startedAt === "string" ? source.startedAt : new Date().toISOString(),
    notes: typeof source.notes === "string" ? source.notes : "",
    sets: normalizedSets,
    exerciseIds,
    currentExerciseIndex: exerciseIds.length
      ? Math.min(Math.max(requestedIndex, 0), exerciseIds.length - 1)
      : 0,
    exerciseSnapshots,
    restDeadlineAt,
    restMode,
  };
}

export function updateDraftSet(
  draft: WorkoutDraft,
  setId: string,
  patch: Partial<WorkoutSet>,
): WorkoutDraft {
  return {
    ...draft,
    sets: draft.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
  };
}

export function setWorkoutExerciseIds(
  draft: WorkoutDraft,
  requestedIds: string[],
  lookup: ExerciseLookup,
  latestWeight: (exerciseId: string) => number,
  latestPerformance: (exerciseId: string) => WorkoutSet[] = () => [],
): WorkoutDraft {
  const exerciseIds = uniqueIds(requestedIds).filter((id) => lookup(id));
  const exerciseSnapshots = { ...draft.exerciseSnapshots };
  let sets = [...draft.sets];

  for (const id of exerciseIds) {
    const exercise = lookup(id);
    if (!exercise) continue;
    exerciseSnapshots[id] = exercise;
    if (!sets.some((set) => set.exerciseId === id)) {
      sets = [...sets, ...createExerciseSets(exercise, latestWeight, Date.now(), latestPerformance)];
    }
  }

  const activeId = draft.exerciseIds[draft.currentExerciseIndex];
  const currentExerciseIndex = activeId && exerciseIds.includes(activeId)
    ? exerciseIds.indexOf(activeId)
    : Math.min(draft.currentExerciseIndex, Math.max(exerciseIds.length - 1, 0));

  return { ...draft, exerciseIds, exerciseSnapshots, sets, currentExerciseIndex };
}

export function includeAndFocusWorkoutExercise(
  draft: WorkoutDraft,
  exerciseId: string,
  lookup: ExerciseLookup,
  latestWeight: (exerciseId: string) => number,
  latestPerformance: (exerciseId: string) => WorkoutSet[] = () => [],
): WorkoutDraft {
  const requestedIds = draft.exerciseIds.includes(exerciseId)
    ? draft.exerciseIds
    : [...draft.exerciseIds, exerciseId];
  const updated = setWorkoutExerciseIds(draft, requestedIds, lookup, latestWeight, latestPerformance);
  const index = updated.exerciseIds.indexOf(exerciseId);
  return index < 0 ? updated : { ...updated, currentExerciseIndex: index };
}

export function moveWorkoutExercise(draft: WorkoutDraft, direction: -1 | 1): WorkoutDraft {
  const current = draft.currentExerciseIndex;
  const next = current + direction;
  if (next < 0 || next >= draft.exerciseIds.length) return draft;
  return { ...draft, currentExerciseIndex: next };
}

export function completeWorkoutSet(
  draft: WorkoutDraft,
  setId: string,
): { draft: WorkoutDraft; completedExercise: boolean; advanced: boolean } {
  const target = draft.sets.find((set) => set.id === setId);
  if (!target) return { draft, completedExercise: false, advanced: false };

  const completing = !target.completed;
  const nextSets = draft.sets.map((set) =>
    set.id === setId ? { ...set, completed: completing } : set,
  );
  const currentId = draft.exerciseIds[draft.currentExerciseIndex];
  const currentSets = nextSets.filter((set) => set.exerciseId === currentId);
  const completedExercise =
    completing && target.exerciseId === currentId && currentSets.length > 0 && currentSets.every((set) => set.completed);
  let nextIndex = draft.currentExerciseIndex;
  const pending = (id: string) => nextSets.some((set) => set.exerciseId === id && !set.completed);
  const nextPendingIndex = (excludedGroup?: string) => {
    for (let offset = 1; offset <= draft.exerciseIds.length; offset += 1) {
      const index = (draft.currentExerciseIndex + offset) % draft.exerciseIds.length;
      const id = draft.exerciseIds[index];
      if (id !== currentId && pending(id) && (!excludedGroup || draft.exerciseSnapshots[id]?.supersetGroup !== excludedGroup)) {
        return index;
      }
    }
    return -1;
  };

  if (completing && target.exerciseId === currentId) {
    const currentExercise = draft.exerciseSnapshots[currentId];
    const group = currentExercise?.supersetGroup;

    if (group) {
      const partnerIndex = draft.exerciseIds.findIndex((id, index) =>
        index !== draft.currentExerciseIndex && draft.exerciseSnapshots[id]?.supersetGroup === group && pending(id),
      );
      if (partnerIndex >= 0) {
        nextIndex = partnerIndex;
      } else if (completedExercise) {
        const nextPending = nextPendingIndex(group);
        if (nextPending >= 0) nextIndex = nextPending;
      }
    } else if (completedExercise) {
      const nextPending = nextPendingIndex();
      if (nextPending >= 0) nextIndex = nextPending;
    }
  }

  const advanced = nextIndex !== draft.currentExerciseIndex;

  return {
    draft: {
      ...draft,
      sets: nextSets,
      currentExerciseIndex: nextIndex,
    },
    completedExercise,
    advanced,
  };
}
