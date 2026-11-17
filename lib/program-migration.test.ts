import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROGRAM_IDS,
  LEGACY_DEFAULT_EXERCISES,
  LEGACY_DEFAULT_PROGRAM_IDS,
  WORKOUT_DAYS,
  type Exercise,
} from "./workout-data";
import { migratePrograms, preserveEditedBuiltInExercises, removeUserDeletedBuiltIns } from "./program-migration";

vi.mock("./workout-media", () => ({ MEDIA: {} }));

const availableIds = new Set([
  ...Object.values(DEFAULT_PROGRAM_IDS).flat(),
  ...Object.values(LEGACY_DEFAULT_PROGRAM_IDS).flat(),
  "custom-row",
]);

const builtInPress = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: "machine-chest-press",
  name: "Machine Chest Press",
  day: "Push",
  target: "Chest",
  secondary: "Front delts · Triceps",
  equipment: "Chest press machine",
  instructions: "Set the seat so handles sit at mid-chest.",
  technique: "Keep shoulder blades pinned.",
  sets: 3,
  minReps: 5,
  maxReps: 8,
  startingWeight: 40,
  family: "push",
  ...overrides,
});

describe("built-in exercise migration", () => {
  it("drops untouched prior/current defaults but preserves and marks an edited definition", () => {
    const previousDefault = builtInPress();
    const currentDefault = builtInPress({ name: "Program chest press", minReps: 6, maxReps: 10 });
    const userEdit = builtInPress({ name: "My preferred press", startingWeight: 52 });

    expect(preserveEditedBuiltInExercises(
      [previousDefault, currentDefault, userEdit],
      [currentDefault],
      [previousDefault],
    )).toEqual([{ ...userEdit, userEdited: true }]);
  });

  it("continues to preserve marked edits when a later default changes", () => {
    const userEdit = builtInPress({ name: "My preferred press", userEdited: true });
    const previousDefault = builtInPress({ name: "Program chest press" });
    const currentDefault = builtInPress({ name: "Updated program press" });

    expect(preserveEditedBuiltInExercises([userEdit], [currentDefault], [previousDefault]))
      .toEqual([userEdit]);
  });

  it("keeps a deliberately deleted built-in out of the next active default catalog", () => {
    const deleted = builtInPress();
    const active = builtInPress({ id: "lat-pulldown", name: "Lat Pulldown" });

    expect(removeUserDeletedBuiltIns([deleted, active], [{ ...deleted, userDeleted: true }]))
      .toEqual([active]);
  });

  it("retains a baseline definition for every prior starter-program exercise ID", () => {
    const baselineIds = new Set(LEGACY_DEFAULT_EXERCISES.map((exercise) => exercise.id));
    const previousProgramIds = new Set(Object.values(LEGACY_DEFAULT_PROGRAM_IDS).flat());

    expect([...previousProgramIds].filter((id) => !baselineIds.has(id))).toEqual([]);
  });
});

describe("saved program migration", () => {
  it("upgrades untouched starter routines to the supplied four-day defaults", () => {
    const migrated = migratePrograms(LEGACY_DEFAULT_PROGRAM_IDS, availableIds);
    expect(migrated).toEqual(DEFAULT_PROGRAM_IDS);
    expect(Object.keys(migrated)).toEqual([...WORKOUT_DAYS]);
  });

  it("preserves a customized routine's order, additions, and removals", () => {
    const customized = {
      ...LEGACY_DEFAULT_PROGRAM_IDS,
      Push: ["custom-row", "incline-chest-press", "machine-chest-press"],
    };
    const migrated = migratePrograms(customized, availableIds);

    expect(migrated.Push).toEqual(customized.Push);
    expect(migrated.Pull).toEqual(DEFAULT_PROGRAM_IDS.Pull);
    expect(migrated.Lower).toEqual(DEFAULT_PROGRAM_IDS.Lower);
    expect(migrated.Upper).toEqual(DEFAULT_PROGRAM_IDS.Upper);
  });

  it("keeps deliberately empty or partially customized legacy routines", () => {
    const customized = {
      Push: [],
      Pull: ["lat-pulldown", "custom-row", "chest-supported-row"],
      "Legs & Abs": ["leg-press"],
      "Full Body": [],
    };
    const migrated = migratePrograms(customized, availableIds);

    expect(migrated.Push).toEqual([]);
    expect(migrated.Pull).toEqual(customized.Pull);
    expect(migrated.Lower).toEqual(["leg-press"]);
    expect(migrated.Upper).toEqual([]);
  });

  it("falls back to the new defaults when a day is missing and filters unavailable IDs", () => {
    const migrated = migratePrograms({ Push: ["custom-row", "deleted-exercise"] }, availableIds);
    expect(migrated.Push).toEqual(["custom-row"]);
    expect(migrated.Pull).toEqual(DEFAULT_PROGRAM_IDS.Pull);
    expect(migrated.Lower).toEqual(DEFAULT_PROGRAM_IDS.Lower);
    expect(migrated.Upper).toEqual(DEFAULT_PROGRAM_IDS.Upper);
  });
});
