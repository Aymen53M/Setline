import { describe, expect, it } from "vitest";
import type { Exercise, WorkoutDraft, WorkoutRecord, WorkoutSet } from "./workout-data";
import {
  completeWorkoutSet,
  createWorkoutDraft,
  getRestRemainingSeconds,
  getWorkoutElapsedSeconds,
  includeAndFocusWorkoutExercise,
  latestSetsForExercise,
  normalizeWorkoutDraft,
  setWorkoutExerciseIds,
} from "./workout-session";

const makeExercise = (id: string, name: string, sets: number): Exercise => ({
  id,
  name,
  day: "Push",
  target: "Chest",
  secondary: "Triceps",
  equipment: "Machine",
  instructions: "Press the handles forward.",
  technique: "Keep the movement controlled.",
  sets,
  minReps: 8,
  maxReps: 12,
  startingWeight: 40,
  unit: "kg",
  family: "push",
});

const first = makeExercise("exercise-first", "First press", 3);
const second = makeExercise("exercise-second", "Second press", 2);
const lookup = (id: string) => [first, second].find((exercise) => exercise.id === id);

function completeAllSets(draft: WorkoutDraft, exerciseId: string) {
  let next = draft;
  for (const set of next.sets.filter((item) => item.exerciseId === exerciseId)) {
    next = completeWorkoutSet(next, set.id).draft;
  }
  return next;
}

describe("workout session progression", () => {
  it("advances only after every planned set in the active exercise is complete", () => {
    let draft = createWorkoutDraft("Push", [first, second], () => 0);
    const sets = draft.sets.filter((set) => set.exerciseId === first.id);

    const firstResult = completeWorkoutSet(draft, sets[0].id);
    expect(firstResult.advanced).toBe(false);
    expect(firstResult.draft.currentExerciseIndex).toBe(0);

    draft = firstResult.draft;
    const secondResult = completeWorkoutSet(draft, sets[1].id);
    expect(secondResult.advanced).toBe(false);

    const finalResult = completeWorkoutSet(secondResult.draft, sets[2].id);
    expect(finalResult.completedExercise).toBe(true);
    expect(finalResult.advanced).toBe(true);
    expect(finalResult.draft.currentExerciseIndex).toBe(1);
  });

  it("prefills the next session with prior set-by-set weight, reps, RIR and notes but leaves sets unchecked", () => {
    const previousSets: WorkoutSet[] = [
      { id: "old-1", exerciseId: first.id, setNumber: 1, weight: 52.5, reps: 11, rir: 2, completed: true, notes: "Seat 3" },
      { id: "old-2", exerciseId: first.id, setNumber: 2, weight: 52.5, reps: 10, rir: 1, completed: true },
    ];
    const draft = createWorkoutDraft("Push", [first], () => 60, () => previousSets);
    const sets = draft.sets.filter((set) => set.exerciseId === first.id);

    expect(sets).toMatchObject([
      { setNumber: 1, weight: 52.5, reps: 11, rir: 2, completed: false, notes: "Seat 3" },
      { setNumber: 2, weight: 52.5, reps: 10, rir: 1, completed: false },
      { setNumber: 3, weight: 52.5, reps: 10, rir: 1, completed: false },
    ]);
    expect(sets.every((set, index) => set.id !== previousSets[index]?.id)).toBe(true);
  });

  it("gets the latest completed workout's sets in set order, ignoring unfinished rows", () => {
    const record = (id: string, date: string, sets: WorkoutSet[]): WorkoutRecord => ({
      id,
      day: "Push",
      date,
      durationMinutes: 30,
      sets,
    });
    const oldSet = { id: "old", exerciseId: first.id, setNumber: 1, weight: 40, reps: 10, rir: 2, completed: true };
    const latestSecond = { id: "latest-2", exerciseId: first.id, setNumber: 2, weight: 45, reps: 9, rir: 1, completed: true };
    const latestFirst = { ...latestSecond, id: "latest-1", setNumber: 1, reps: 10 };
    const unfinishedNewer = { ...latestFirst, id: "unfinished", completed: false, date: undefined };
    const workouts = [
      record("newer", "2026-02-02T10:00:00.000Z", [unfinishedNewer]),
      record("latest", "2026-02-01T10:00:00.000Z", [latestSecond, latestFirst]),
      record("older", "2026-01-01T10:00:00.000Z", [oldSet]),
    ];

    expect(latestSetsForExercise(workouts, first.id)).toEqual([latestFirst, latestSecond]);
    expect(latestSetsForExercise(workouts, second.id)).toEqual([]);
  });

  it("alternates planned superset rounds and continues an unmatched final set before advancing", () => {
    const third = makeExercise("exercise-third", "Final movement", 1);
    const pairedFirst = { ...first, supersetGroup: "pair-a", supersetRestSeconds: 75, rirMax: 1 };
    const pairedSecond = { ...second, supersetGroup: "pair-a", supersetRestSeconds: 75 };
    const draft = createWorkoutDraft("Push", [pairedFirst, pairedSecond, third], () => 0);

    expect(draft.sets[0].rir).toBe(1);
    let current = completeWorkoutSet(draft, draft.sets.find((set) => set.exerciseId === pairedFirst.id)!.id).draft;
    expect(current.currentExerciseIndex).toBe(1);
    current = completeWorkoutSet(current, current.sets.find((set) => set.exerciseId === pairedSecond.id && !set.completed)!.id).draft;
    expect(current.currentExerciseIndex).toBe(0);
    current = completeWorkoutSet(current, current.sets.find((set) => set.exerciseId === pairedFirst.id && !set.completed)!.id).draft;
    expect(current.currentExerciseIndex).toBe(1);
    current = completeWorkoutSet(current, current.sets.find((set) => set.exerciseId === pairedSecond.id && !set.completed)!.id).draft;
    expect(current.currentExerciseIndex).toBe(0);

    const finalPairSet = current.sets.find((set) => set.exerciseId === pairedFirst.id && !set.completed)!;
    const completedPair = completeWorkoutSet(current, finalPairSet.id);
    expect(completedPair.completedExercise).toBe(true);
    expect(completedPair.advanced).toBe(true);
    expect(completedPair.draft.currentExerciseIndex).toBe(2);
  });

  it("does not auto-advance when a completed set is unchecked", () => {
    const draft = createWorkoutDraft("Push", [first, second], () => 0);
    const completed = completeAllSets(draft, first.id);
    const backOnFirst = { ...completed, currentExerciseIndex: 0 };
    const firstSet = backOnFirst.sets.find((set) => set.exerciseId === first.id)!;
    const result = completeWorkoutSet(backOnFirst, firstSet.id);

    expect(result.completedExercise).toBe(false);
    expect(result.advanced).toBe(false);
    expect(result.draft.currentExerciseIndex).toBe(0);
  });

  it("keeps completed set rows when an exercise is removed from the live sequence", () => {
    const draft = createWorkoutDraft("Push", [first, second], () => 0);
    const completed = completeWorkoutSet(draft, draft.sets[0].id).draft;
    const reduced = setWorkoutExerciseIds(completed, [first.id], lookup, () => 0);

    expect(reduced.exerciseIds).toEqual([first.id]);
    expect(reduced.sets).toHaveLength(completed.sets.length);
    expect(reduced.sets[0].completed).toBe(true);
  });

  it("reorders the live sequence without losing the active exercise or its sets, then auto-advances across the new end", () => {
    let draft = createWorkoutDraft("Push", [first, second], () => 0);
    const firstSet = draft.sets.find((set) => set.exerciseId === first.id)!;
    draft = {
      ...draft,
      sets: draft.sets.map((set) => set.id === firstSet.id
        ? { ...set, weight: 47, reps: 10, rir: 1, completed: true }
        : set),
    };
    const reordered = setWorkoutExerciseIds(draft, [second.id, first.id], lookup, () => 0);

    expect(reordered.exerciseIds).toEqual([second.id, first.id]);
    expect(reordered.currentExerciseIndex).toBe(1);
    expect(reordered.sets.find((set) => set.id === firstSet.id)).toMatchObject({ weight: 47, reps: 10, rir: 1, completed: true });

    let current = reordered;
    for (const set of current.sets.filter((item) => item.exerciseId === first.id && !item.completed)) {
      current = completeWorkoutSet(current, set.id).draft;
    }
    expect(current.currentExerciseIndex).toBe(0);
    expect(current.exerciseIds[current.currentExerciseIndex]).toBe(second.id);
  });

  it("adds a new exercise with its planned set rows and keeps the requested order", () => {
    const custom = makeExercise("custom-test", "Custom row", 2);
    const draft = createWorkoutDraft("Push", [first], () => 0);
    const priorSet: WorkoutSet = {
      id: "custom-prior",
      exerciseId: custom.id,
      setNumber: 1,
      weight: 22,
      reps: 12,
      rir: 1,
      completed: true,
    };
    const updated = setWorkoutExerciseIds(
      draft,
      [first.id, custom.id],
      (id) => id === custom.id ? custom : lookup(id),
      () => 5,
      (id) => id === custom.id ? [priorSet] : [],
    );

    expect(updated.exerciseIds).toEqual([first.id, custom.id]);
    expect(updated.sets.filter((set) => set.exerciseId === custom.id)).toHaveLength(2);
    expect(updated.sets.filter((set) => set.exerciseId === custom.id)).toMatchObject([
      { setNumber: 1, weight: 22, reps: 12, rir: 1, completed: false },
      { setNumber: 2, weight: 22, reps: 12, rir: 1, completed: false },
    ]);
    expect(updated.exerciseSnapshots[custom.id].name).toBe("Custom row");
  });

  it("focuses a requested single exercise without dropping another draft or duplicating sets", () => {
    const custom = makeExercise("custom-focus", "Focused row", 2);
    const draft = createWorkoutDraft("Push", [first, second], () => 0);
    const edited = {
      ...draft,
      sets: draft.sets.map((set) => set.id === draft.sets[0].id ? { ...set, weight: 47, reps: 9, completed: true } : set),
    };
    const focused = includeAndFocusWorkoutExercise(
      edited,
      custom.id,
      (id) => id === custom.id ? custom : lookup(id),
      () => 0,
    );

    expect(focused.exerciseIds).toEqual([first.id, second.id, custom.id]);
    expect(focused.currentExerciseIndex).toBe(2);
    expect(focused.sets.find((set) => set.id === draft.sets[0].id)).toMatchObject({ weight: 47, reps: 9, completed: true });
    expect(focused.sets.filter((set) => set.exerciseId === first.id)).toHaveLength(first.sets);
    expect(focused.sets.filter((set) => set.exerciseId === custom.id)).toHaveLength(custom.sets);
  });

  it("restores an absolute recovery deadline and reports elapsed rest as complete", () => {
    const now = 100_000;
    const draft = createWorkoutDraft("Push", [first], () => 0);
    const { exerciseIds: _ids, currentExerciseIndex: _index, exerciseSnapshots: _snapshots, ...legacy } = draft;
    const restored = normalizeWorkoutDraft({
      ...legacy,
      exerciseIds: [first.id],
      currentExerciseIndex: 0,
      exerciseSnapshots: { [first.id]: first },
      restDeadlineAt: now + 60_000,
      restMode: "set",
    }, "Push", [first], lookup);

    expect(restored.restMode).toBe("set");
    expect(getRestRemainingSeconds(restored.restDeadlineAt, now + 12_000)).toBe(48);
    expect(getRestRemainingSeconds(restored.restDeadlineAt, now + 61_000)).toBe(0);
    expect(getRestRemainingSeconds(null, now)).toBe(0);
  });

  it("restores elapsed workout time from the original start time after relaunch", () => {
    const original = {
      ...createWorkoutDraft("Push", [first], () => 0),
      startedAt: new Date(1_000).toISOString(),
    };
    const relaunched = normalizeWorkoutDraft(
      JSON.parse(JSON.stringify(original)) as Partial<WorkoutDraft>,
      "Push",
      [first],
      lookup,
    );

    expect(getWorkoutElapsedSeconds(relaunched, 31_000)).toBe(30);
  });

  it("migrates older drafts by deriving exercise order from their set rows", () => {
    const legacy = createWorkoutDraft("Push", [first, second], () => 0);
    const {
      exerciseIds: _ids,
      currentExerciseIndex: _index,
      exerciseSnapshots: _snapshots,
      restDeadlineAt: _deadline,
      restMode: _mode,
      ...oldShape
    } = legacy;
    const migrated = normalizeWorkoutDraft(oldShape, "Push", [first, second], lookup);

    expect(migrated.exerciseIds).toEqual([first.id, second.id]);
    expect(migrated.exerciseSnapshots[first.id].name).toBe(first.name);
    expect(migrated.sets[0].exerciseNameSnapshot).toBe(first.name);
    expect(migrated.restDeadlineAt).toBeNull();
    expect(migrated.restMode).toBeNull();
  });
});
