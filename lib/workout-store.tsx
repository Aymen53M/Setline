import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Pressable, Text, View } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  DEFAULT_PROGRAM_IDS,
  EXERCISES,
  LEGACY_DEFAULT_PROGRAM_IDS,
  LEGACY_DEFAULT_EXERCISES,
  WORKOUT_DAYS,
  normalizeWorkoutDay,
  type BodyWeightEntry,
  type Exercise,
  type WorkoutSet,
  type WorkoutDay,
  type WorkoutDraft,
  type WorkoutRecord,
  latestSetForExercise,
} from "@/lib/workout-data";
import { migratePrograms, preserveEditedBuiltInExercises, removeUserDeletedBuiltIns } from "@/lib/program-migration";
import { createWorkoutDraft, latestSetsForExercise, normalizeWorkoutDraft } from "@/lib/workout-session";

const HISTORY_KEY = "liftlog.history.v1";
const DRAFT_KEY = "liftlog.draft.v1";
const BODY_WEIGHT_KEY = "liftlog.body-weight.v1";
const EXERCISES_KEY = "liftlog.exercises.v1";
const ARCHIVED_EXERCISES_KEY = "liftlog.archived-exercises.v1";
const PROGRAMS_KEY = "liftlog.programs.v1";

let storageQueue: Promise<void> = Promise.resolve();

function enqueueStorageWrite(write: () => Promise<void>) {
  const operation = storageQueue.then(write, write);
  storageQueue = operation.catch(() => undefined);
  return operation;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeExerciseList(value: unknown, fallback: Exercise[]) {
  if (!Array.isArray(value)) return fallback;
  const unique = new Map<string, Exercise>();
  for (const item of value) {
    if (!isExercise(item)) continue;
    const exercise = item as Exercise;
    const day = normalizeWorkoutDay(exercise.day);
    if (day && !unique.has(exercise.id)) unique.set(exercise.id, { ...exercise, day });
  }
  if (unique.size > 0 || value.length === 0) return Array.from(unique.values());
  return fallback;
}

function isExercise(value: unknown): value is Exercise {
  if (!value || typeof value !== "object") return false;
  const exercise = value as Partial<Exercise>;
  return (
    typeof exercise.id === "string" &&
    typeof exercise.name === "string" &&
    normalizeWorkoutDay(exercise.day) !== undefined &&
    typeof exercise.target === "string" &&
    typeof exercise.secondary === "string" &&
    typeof exercise.equipment === "string" &&
    typeof exercise.instructions === "string" &&
    typeof exercise.technique === "string" &&
    typeof exercise.sets === "number" &&
    typeof exercise.minReps === "number" &&
    typeof exercise.maxReps === "number" &&
    (exercise.startingWeight === null || typeof exercise.startingWeight === "number") &&
    (exercise.unit === undefined || exercise.unit === "kg" || exercise.unit === "sec") &&
    (exercise.userEdited === undefined || typeof exercise.userEdited === "boolean") &&
    (exercise.userDeleted === undefined || typeof exercise.userDeleted === "boolean") &&
    ["push", "pull", "legs", "core"].includes(exercise.family ?? "")
  );
}

export type WorkoutStoreValue = {
  history: WorkoutRecord[];
  bodyWeights: BodyWeightEntry[];
  draft: WorkoutDraft | null;
  exercises: Exercise[];
  archivedExercises: Exercise[];
  programs: Record<WorkoutDay, string[]>;
  ready: boolean;
  storageError: string | null;
  retryStorage: () => Promise<void>;
  saveDraft: (draft: WorkoutDraft | null) => Promise<void>;
  clearDraft: () => Promise<void>;
  completeWorkout: (record: WorkoutRecord) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  addBodyWeight: (weight: number, unit?: "kg" | "lb", note?: string) => Promise<void>;
  deleteBodyWeight: (id: string) => Promise<void>;
  addExercise: (exercise: Omit<Exercise, "id">) => Promise<Exercise>;
  updateExercise: (id: string, exercise: Omit<Exercise, "id">) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  updateProgram: (day: WorkoutDay, exerciseIds: string[]) => Promise<void>;
  getExercise: (id: string) => Exercise | undefined;
  latestWeight: (exerciseId: string) => number;
  latestPerformance: (exerciseId: string) => WorkoutSet[];
  resetDemoData: () => Promise<void>;
};

const WorkoutStoreContext = createContext<WorkoutStoreValue | null>(null);

export function WorkoutStoreProvider({ children }: PropsWithChildren) {
  const [history, setHistory] = useState<WorkoutRecord[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightEntry[]>([]);
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const draftRef = useRef<WorkoutDraft | null>(null);
  const completingRef = useRef(false);
  const [exercises, setExercises] = useState<Exercise[]>(EXERCISES);
  const [archivedExercises, setArchivedExercises] = useState<Exercise[]>([]);
  const [programs, setPrograms] = useState<Record<WorkoutDay, string[]>>(DEFAULT_PROGRAM_IDS);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const pendingRetryRef = useRef<(() => Promise<void>) | null>(null);
  const pendingRetryKindRef = useRef<"draft" | "mutation" | null>(null);

  const persistWithCommit = async (write: () => Promise<void>, commit: () => void) => {
    if (pendingRetryRef.current) {
      setStorageError("Retry the pending local change before saving another change.");
      throw new Error("A local storage write is awaiting retry");
    }
    const attempt = async () => {
      await enqueueStorageWrite(write);
      commit();
      pendingRetryRef.current = null;
      pendingRetryKindRef.current = null;
      setStorageError(null);
    };
    try {
      await attempt();
    } catch (error) {
      pendingRetryRef.current = attempt;
      pendingRetryKindRef.current = "mutation";
      setStorageError("A local change could not be saved. Tap Retry to try again.");
      throw error;
    }
  };

  const retryStorage = useCallback(async () => {
    const pending = pendingRetryRef.current;
    if (pending) {
      try {
        await pending();
      } catch {
        // The persistent banner keeps the retry action available.
      }
      return;
    }
    setReady(false);
    setStorageError(null);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let loadedSuccessfully = false;

    const load = async () => {
      try {
        const [savedHistory, savedDraft, savedWeights, savedExercises, savedArchive, savedPrograms] =
          await Promise.all([
            AsyncStorage.getItem(HISTORY_KEY),
            AsyncStorage.getItem(DRAFT_KEY),
            AsyncStorage.getItem(BODY_WEIGHT_KEY),
            AsyncStorage.getItem(EXERCISES_KEY),
            AsyncStorage.getItem(ARCHIVED_EXERCISES_KEY),
            AsyncStorage.getItem(PROGRAMS_KEY),
          ]);

        const storedExercises = normalizeExerciseList(
          parseJson<unknown>(savedExercises, EXERCISES),
          EXERCISES,
        );
        const storedArchive = normalizeExerciseList(parseJson<unknown>(savedArchive, []), []);
        const userDeletedIds = new Set(storedArchive.filter((exercise) => exercise.userDeleted === true).map((exercise) => exercise.id));
        const activeDefaults = removeUserDeletedBuiltIns(EXERCISES, storedArchive);
        const rawDraft = parseJson<(Partial<WorkoutDraft> & { day?: unknown }) | null>(savedDraft, null);
        const rawProgramValue = parseJson<unknown>(savedPrograms, null);
        const availableIds = new Set([
          ...activeDefaults.map((exercise) => exercise.id),
          ...storedExercises.map((exercise) => exercise.id),
          ...LEGACY_DEFAULT_EXERCISES.map((exercise) => exercise.id),
        ]);
        for (const id of userDeletedIds) availableIds.delete(id);
        const loadedPrograms = migratePrograms(rawProgramValue, availableIds);
        const programExerciseIds = new Set(Object.values(loadedPrograms).flat());
        const draftExerciseIds = new Set([
          ...(Array.isArray(rawDraft?.exerciseIds) ? rawDraft.exerciseIds.filter((id): id is string => typeof id === "string") : []),
          ...(Array.isArray(rawDraft?.sets) ? rawDraft.sets.map((set) => set?.exerciseId).filter((id): id is string => typeof id === "string") : []),
        ]);
        const defaultIds = new Set(EXERCISES.map((exercise) => exercise.id));
        const legacyIds = new Set(Object.values(LEGACY_DEFAULT_PROGRAM_IDS).flat());
        const customExercises = storedExercises.filter((exercise) =>
          !userDeletedIds.has(exercise.id) && (exercise.id.startsWith("custom-") || (!defaultIds.has(exercise.id) && !legacyIds.has(exercise.id))),
        );
        const editedBuiltInExercises = preserveEditedBuiltInExercises(
          storedExercises.filter((exercise) => defaultIds.has(exercise.id) && !userDeletedIds.has(exercise.id)),
          EXERCISES,
          LEGACY_DEFAULT_EXERCISES,
        );
        const userExercises = [...customExercises, ...editedBuiltInExercises];
        const retainedOldRoutineExercises = [
          ...storedExercises,
          ...LEGACY_DEFAULT_EXERCISES,
        ].filter((exercise) =>
          !userDeletedIds.has(exercise.id)
          && !defaultIds.has(exercise.id)
          && (programExerciseIds.has(exercise.id) || draftExerciseIds.has(exercise.id)),
        );
        const activeExerciseMap = new Map<string, Exercise>();
        for (const exercise of activeDefaults) activeExerciseMap.set(exercise.id, exercise);
        for (const exercise of userExercises) activeExerciseMap.set(exercise.id, exercise);
        for (const exercise of retainedOldRoutineExercises) {
          if (!activeExerciseMap.has(exercise.id)) activeExerciseMap.set(exercise.id, exercise);
        }
        const loadedExercises = Array.from(activeExerciseMap.values());
        const archiveMap = new Map<string, Exercise>();
        for (const exercise of storedArchive) archiveMap.set(exercise.id, exercise);
        for (const exercise of storedExercises) {
          if (!activeExerciseMap.has(exercise.id)) archiveMap.set(exercise.id, exercise);
        }
        for (const exercise of LEGACY_DEFAULT_EXERCISES) {
          if (!activeExerciseMap.has(exercise.id) && !archiveMap.has(exercise.id)) archiveMap.set(exercise.id, exercise);
        }
        const loadedArchive = Array.from(archiveMap.values()).filter((exercise) => !activeExerciseMap.has(exercise.id));
        const lookup = (id: string) =>
          loadedExercises.find((exercise) => exercise.id === id) ??
          loadedArchive.find((exercise) => exercise.id === id) ??
          LEGACY_DEFAULT_EXERCISES.find((exercise) => exercise.id === id) ??
          EXERCISES.find((exercise) => exercise.id === id);
        const historyValue = parseJson<WorkoutRecord[]>(savedHistory, []);
        const loadedHistory = Array.isArray(historyValue)
          ? historyValue.filter((record) => record && typeof record.id === "string" && !record.id.startsWith("seed-workout-")).map((record) => ({
              ...record,
              sets: Array.isArray(record.sets)
                ? record.sets.map((set) => {
                    const exercise = lookup(set.exerciseId);
                    return {
                      ...set,
                      exerciseNameSnapshot:
                        set.exerciseNameSnapshot ?? exercise?.name ?? `Archived exercise (${set.exerciseId})`,
                      exerciseTargetSnapshot: set.exerciseTargetSnapshot ?? exercise?.target ?? "Exercise",
                      exerciseSecondarySnapshot: set.exerciseSecondarySnapshot ?? exercise?.secondary ?? "",
                    };
                  })
                : [],
            }))
          : [];
        const bodyWeightsValue = parseJson<BodyWeightEntry[]>(savedWeights, []);
        let loadedDraft: WorkoutDraft | null = null;

        const normalizedDraftDay = rawDraft ? normalizeWorkoutDay(rawDraft.day) : undefined;
        if (rawDraft && normalizedDraftDay) {
          const fallbackExercises = loadedPrograms[normalizedDraftDay]
            .map((id) => lookup(id))
            .filter((exercise): exercise is Exercise => Boolean(exercise));
          loadedDraft = normalizeWorkoutDraft({ ...rawDraft, day: normalizedDraftDay }, normalizedDraftDay, fallbackExercises, lookup);
        }

        if (!active) return;
        if (savedHistory) {
          await enqueueStorageWrite(() => AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(loadedHistory)));
        }
        if (savedPrograms && JSON.stringify(loadedPrograms) !== savedPrograms) {
          await enqueueStorageWrite(() => AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(loadedPrograms)));
        }
        if (savedExercises && JSON.stringify(loadedExercises) !== JSON.stringify(storedExercises)) {
          await enqueueStorageWrite(() => AsyncStorage.setItem(EXERCISES_KEY, JSON.stringify(loadedExercises)));
        }
        if (savedArchive && JSON.stringify(loadedArchive) !== JSON.stringify(storedArchive)) {
          await enqueueStorageWrite(() => AsyncStorage.setItem(ARCHIVED_EXERCISES_KEY, JSON.stringify(loadedArchive)));
        }
        setExercises(loadedExercises);
        setArchivedExercises(loadedArchive);
        setPrograms(loadedPrograms);
        setHistory(loadedHistory);
        setBodyWeights(Array.isArray(bodyWeightsValue) ? bodyWeightsValue : []);
        draftRef.current = loadedDraft;
        setDraft(loadedDraft);
        loadedSuccessfully = true;
        pendingRetryRef.current = null;
        pendingRetryKindRef.current = null;
        setStorageError(null);
      } catch {
        setStorageError("Saved data could not be loaded. Your local data has not been intentionally cleared. Tap Retry to try again.");
      } finally {
        if (active && loadedSuccessfully) setReady(true);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const allExerciseDefinitions = useMemo(() => {
    const byId = new Map<string, Exercise>();
    for (const exercise of EXERCISES) byId.set(exercise.id, exercise);
    for (const exercise of archivedExercises) byId.set(exercise.id, exercise);
    for (const exercise of exercises) byId.set(exercise.id, exercise);
    return Array.from(byId.values());
  }, [archivedExercises, exercises]);

  const getExercise = (id: string) => allExerciseDefinitions.find((exercise) => exercise.id === id);

  const latestWeight = (exerciseId: string) =>
    latestSetForExercise(history, exerciseId)?.weight ?? getExercise(exerciseId)?.startingWeight ?? 0;
  const latestPerformance = (exerciseId: string) => latestSetsForExercise(history, exerciseId);

  const persistDraft = useCallback(async (nextDraft: WorkoutDraft | null) => {
    if (pendingRetryRef.current && pendingRetryKindRef.current === "mutation") {
      setStorageError("Retry the pending local change before saving more workout edits.");
      throw new Error("A local storage write is awaiting retry");
    }
    const write = async () => {
      if (nextDraft) await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
      else await AsyncStorage.removeItem(DRAFT_KEY);
    };
    const attempt = async () => {
      await enqueueStorageWrite(write);
      pendingRetryRef.current = null;
      pendingRetryKindRef.current = null;
      setStorageError(null);
    };
    try {
      await attempt();
    } catch (error) {
      pendingRetryRef.current = attempt;
      pendingRetryKindRef.current = "draft";
      setStorageError("A local change could not be saved. Tap Retry to try again.");
      throw error;
    }
  }, []);

  const saveDraft = useCallback(async (nextDraft: WorkoutDraft | null) => {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    await persistDraft(nextDraft);
  }, [persistDraft]);

  const clearDraft = useCallback(async () => {
    await persistDraft(null);
    draftRef.current = null;
    setDraft(null);
  }, [persistDraft]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const currentDraft = draftRef.current;
      if (nextState !== "active" && currentDraft && !completingRef.current) {
        void persistDraft(currentDraft).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [persistDraft]);

  const completeWorkout = async (record: WorkoutRecord) => {
    completingRef.current = true;
    try {
      const withSnapshots: WorkoutRecord = {
        ...record,
        sets: record.sets.map((set) => {
          const exercise = getExercise(set.exerciseId);
          return {
            ...set,
            exerciseNameSnapshot:
              set.exerciseNameSnapshot ?? exercise?.name ?? `Archived exercise (${set.exerciseId})`,
            exerciseTargetSnapshot: set.exerciseTargetSnapshot ?? exercise?.target ?? "Exercise",
            exerciseSecondarySnapshot: set.exerciseSecondarySnapshot ?? exercise?.secondary ?? "",
          };
        }),
      };
      const nextHistory = [withSnapshots, ...history.filter((item) => item.id !== withSnapshots.id)];
      await persistWithCommit(
        async () => {
          await AsyncStorage.multiSet([[HISTORY_KEY, JSON.stringify(nextHistory)]]);
          await AsyncStorage.removeItem(DRAFT_KEY);
        },
        () => {
          setHistory(nextHistory);
          draftRef.current = null;
          setDraft(null);
        },
      );
    } finally {
      completingRef.current = false;
    }
  };

  const deleteWorkout = async (id: string) => {
    const nextHistory = history.filter((workout) => workout.id !== id);
    await persistWithCommit(
      () => AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory)),
      () => setHistory(nextHistory),
    );
  };

  const addBodyWeight = async (weight: number, unit: "kg" | "lb" = "kg", note?: string) => {
    if (!Number.isFinite(weight) || weight <= 0) return;
    const next = [
      { id: `body-weight-${Date.now()}`, date: new Date().toISOString(), weight, unit, note },
      ...bodyWeights,
    ].sort((a, b) => b.date.localeCompare(a.date));
    await persistWithCommit(
      () => AsyncStorage.setItem(BODY_WEIGHT_KEY, JSON.stringify(next)),
      () => setBodyWeights(next),
    );
  };

  const deleteBodyWeight = async (id: string) => {
    const next = bodyWeights.filter((entry) => entry.id !== id);
    await persistWithCommit(
      () => AsyncStorage.setItem(BODY_WEIGHT_KEY, JSON.stringify(next)),
      () => setBodyWeights(next),
    );
  };

  const addExercise = async (definition: Omit<Exercise, "id">) => {
    const exercise: Exercise = {
      ...definition,
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      userEdited: true,
    };
    const next = [...exercises, exercise];
    await persistWithCommit(
      () => AsyncStorage.setItem(EXERCISES_KEY, JSON.stringify(next)),
      () => setExercises(next),
    );
    return exercise;
  };

  const updateExercise = async (id: string, definition: Omit<Exercise, "id">) => {
    const next = exercises.map((exercise) =>
      exercise.id === id ? { ...definition, id, userEdited: true } : exercise,
    );
    await persistWithCommit(
      () => AsyncStorage.setItem(EXERCISES_KEY, JSON.stringify(next)),
      () => setExercises(next),
    );
  };

  const deleteExercise = async (id: string) => {
    const removed = exercises.find((exercise) => exercise.id === id);
    if (!removed) return;
    const nextExercises = exercises.filter((exercise) => exercise.id !== id);
    const nextArchive = [{ ...removed, userDeleted: true }, ...archivedExercises.filter((exercise) => exercise.id !== id)];
    const nextPrograms = Object.fromEntries(
      WORKOUT_DAYS.map((day) => [day, programs[day].filter((exerciseId) => exerciseId !== id)]),
    ) as Record<WorkoutDay, string[]>;
    await persistWithCommit(
      () => AsyncStorage.multiSet([
        [EXERCISES_KEY, JSON.stringify(nextExercises)],
        [ARCHIVED_EXERCISES_KEY, JSON.stringify(nextArchive)],
        [PROGRAMS_KEY, JSON.stringify(nextPrograms)],
      ]),
      () => {
        setExercises(nextExercises);
        setArchivedExercises(nextArchive);
        setPrograms(nextPrograms);
      },
    );
  };

  const updateProgram = async (day: WorkoutDay, requestedIds: string[]) => {
    const availableIds = new Set(exercises.map((exercise) => exercise.id));
    const nextDay = Array.from(
      new Set(requestedIds.filter((id) => availableIds.has(id))),
    );
    const nextPrograms = { ...programs, [day]: nextDay };
    await persistWithCommit(
      () => AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(nextPrograms)),
      () => setPrograms(nextPrograms),
    );
  };

  const resetDemoData = async () => {
    await persistWithCommit(
      async () => {
        await AsyncStorage.multiSet([[HISTORY_KEY, JSON.stringify([])]]);
        await AsyncStorage.removeItem(DRAFT_KEY);
      },
      () => {
        setHistory([]);
        draftRef.current = null;
        setDraft(null);
      },
    );
  };

  const value = useMemo<WorkoutStoreValue>(
    () => ({
      history,
      bodyWeights,
      draft,
      exercises,
      archivedExercises,
      programs,
      ready,
      storageError,
      retryStorage,
      saveDraft,
      clearDraft,
      completeWorkout,
      deleteWorkout,
      addBodyWeight,
      deleteBodyWeight,
      addExercise,
      updateExercise,
      deleteExercise,
      updateProgram,
      getExercise,
      latestWeight,
      latestPerformance,
      resetDemoData,
    }),
    [history, bodyWeights, draft, exercises, archivedExercises, programs, ready, storageError, retryStorage, saveDraft, clearDraft],
  );

  return (
    <WorkoutStoreContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {storageError ? (
          <View accessibilityRole="alert" style={{ position: "absolute", top: 48, left: 16, right: 16, zIndex: 1000, borderRadius: 12, backgroundColor: "#111111", padding: 12, flexDirection: "row", alignItems: "center", gap: 12, elevation: 8 }}>
            <Text style={{ flex: 1, color: "#FFFFFF", fontSize: 12, lineHeight: 18 }}>{storageError}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry local data operation" onPress={() => void retryStorage()} style={{ minHeight: 44, justifyContent: "center", borderRadius: 8, backgroundColor: "#FFFFFF", paddingHorizontal: 12 }}>
              <Text style={{ color: "#111111", fontSize: 12, fontWeight: "500" }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </WorkoutStoreContext.Provider>
  );
}

export function useWorkoutStore() {
  const value = useContext(WorkoutStoreContext);
  if (!value) throw new Error("useWorkoutStore must be used inside WorkoutStoreProvider");
  return value;
}

export { createWorkoutDraft };
