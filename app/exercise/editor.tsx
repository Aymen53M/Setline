import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { DAY_META, WORKOUT_DAYS, type Exercise, type WorkoutDay } from "@/lib/workout-data";
import { useWorkoutStore } from "@/lib/workout-store";
import { COLORS } from "@/components/liftlog-ui";

const families: Exercise["family"][] = ["push", "pull", "legs", "core"];

type ExerciseForm = {
  name: string;
  target: string;
  secondary: string;
  equipment: string;
  instructions: string;
  technique: string;
  sets: string;
  minReps: string;
  maxReps: string;
  rirMin: string;
  rirMax: string;
  restSeconds: string;
  alternative: string;
  supersetGroup: string;
  supersetRestSeconds: string;
  tempo: string;
  planNote: string;
  startingWeight: string;
  day: WorkoutDay;
  family: Exercise["family"];
  unit: "kg" | "sec";
};

const blankForm: ExerciseForm = {
  name: "",
  target: "",
  secondary: "",
  equipment: "",
  instructions: "",
  technique: "",
  sets: "3",
  minReps: "8",
  maxReps: "12",
  rirMin: "1",
  rirMax: "2",
  restSeconds: "90",
  alternative: "",
  supersetGroup: "",
  supersetRestSeconds: "",
  tempo: "",
  planNote: "",
  startingWeight: "",
  day: "Push",
  family: "push",
  unit: "kg",
};

const toForm = (exercise: Exercise): ExerciseForm => ({
  name: exercise.name,
  target: exercise.target,
  secondary: exercise.secondary,
  equipment: exercise.equipment,
  instructions: exercise.instructions,
  technique: exercise.technique,
  sets: String(exercise.sets),
  minReps: String(exercise.minReps),
  maxReps: String(exercise.maxReps),
  rirMin: String(exercise.rirMin ?? 1),
  rirMax: String(exercise.rirMax ?? 2),
  restSeconds: String(exercise.restSeconds ?? 90),
  alternative: exercise.alternative ?? "",
  supersetGroup: exercise.supersetGroup ?? "",
  supersetRestSeconds: exercise.supersetRestSeconds == null ? "" : String(exercise.supersetRestSeconds),
  tempo: exercise.tempo ?? "",
  planNote: exercise.planNote ?? "",
  startingWeight: exercise.startingWeight == null ? "" : String(exercise.startingWeight),
  day: exercise.day,
  family: exercise.family,
  unit: exercise.unit ?? "kg",
});

export default function ExerciseEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { ready, getExercise } = useWorkoutStore();
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" }}><Text style={{ color: COLORS.muted, fontSize: 14 }}>Loading exercise…</Text></View>;
  }

  const existing = id ? getExercise(id) : undefined;
  if (id && !existing) {
    return <View style={{ flex: 1, backgroundColor: COLORS.white, padding: 24, justifyContent: "center" }}><Text style={{ color: COLORS.ink, fontSize: 22, fontWeight: "500" }}>Exercise not found</Text><Pressable onPress={() => router.back()} style={{ marginTop: 20, backgroundColor: COLORS.ink, borderRadius: 12, padding: 16, alignItems: "center" }}><Text style={{ color: COLORS.white, fontWeight: "500" }}>Go back</Text></Pressable></View>;
  }

  return <ExerciseEditorForm key={id ?? "new"} id={id} initial={existing} />;
}

function ExerciseEditorForm({ id, initial }: { id?: string; initial?: Exercise }) {
  const { addExercise, updateExercise } = useWorkoutStore();
  const [form, setForm] = useState<ExerciseForm>(() => initial ? toForm(initial) : { ...blankForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = <K extends keyof ExerciseForm>(key: K, value: ExerciseForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const handleSave = async () => {
    const sets = Number(form.sets);
    const minReps = Number(form.minReps);
    const maxReps = Number(form.maxReps);
    const rirMin = Number(form.rirMin);
    const rirMax = Number(form.rirMax);
    const restSeconds = Number(form.restSeconds);
    const supersetRestSeconds = form.supersetRestSeconds.trim() ? Number(form.supersetRestSeconds) : undefined;
    const startingWeight = form.startingWeight.trim() ? Number(form.startingWeight.replace(",", ".")) : null;

    if (!form.name.trim() || !form.target.trim() || !form.equipment.trim()) {
      setError("Add an exercise name, target muscle and equipment.");
      return;
    }
    if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
      setError("Sets must be a whole number from 1 to 20.");
      return;
    }
    if (!Number.isInteger(minReps) || !Number.isInteger(maxReps) || minReps < 1 || maxReps < minReps) {
      setError("Enter a valid rep or hold-time range.");
      return;
    }
    if (!Number.isInteger(rirMin) || !Number.isInteger(rirMax) || rirMin < 0 || rirMax < rirMin || rirMax > 5) {
      setError("RIR targets must be whole numbers from 0 to 5, with the minimum no higher than the maximum.");
      return;
    }
    if (!Number.isInteger(restSeconds) || restSeconds < 30 || restSeconds > 600) {
      setError("Set rest must be a whole number from 30 to 600 seconds.");
      return;
    }
    if (supersetRestSeconds !== undefined && (!Number.isInteger(supersetRestSeconds) || supersetRestSeconds < 30 || supersetRestSeconds > 600)) {
      setError("Superset rest must be a whole number from 30 to 600 seconds.");
      return;
    }
    if (startingWeight !== null && (!Number.isFinite(startingWeight) || startingWeight < 0)) {
      setError("Starting weight must be zero or a positive number.");
      return;
    }

    const definition: Omit<Exercise, "id"> = {
      name: form.name.trim(),
      target: form.target.trim(),
      secondary: form.secondary.trim() || "General support",
      equipment: form.equipment.trim(),
      instructions: form.instructions.trim() || "Move through a controlled, comfortable range of motion.",
      technique: form.technique.trim() || "Keep the movement smooth and stop if your form changes.",
      sets,
      minReps,
      maxReps,
      rirMin,
      rirMax,
      restSeconds,
      alternative: form.alternative.trim() || undefined,
      supersetGroup: form.supersetGroup.trim() || undefined,
      supersetRestSeconds,
      tempo: form.tempo.trim() || undefined,
      planNote: form.planNote.trim() || undefined,
      startingWeight,
      day: form.day,
      family: form.family,
      unit: form.unit,
    };

    setSaving(true);
    try {
      if (id) await updateExercise(id, definition);
      else await addExercise(definition);
      router.back();
    } catch {
      setError("Could not save this exercise. Please try again.");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.white }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 44 }}>
        <Pressable onPress={() => router.back()} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <Ionicons name="arrow-back" size={18} color={COLORS.ink} />
          <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Back</Text>
        </Pressable>
        <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>{id ? "Exercise editor" : "New movement"}</Text>
        <Text style={{ color: COLORS.ink, fontSize: 30, fontWeight: "500", marginTop: 8 }}>{id ? "Edit exercise" : "Add exercise"}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8 }}>Set up a movement for your routines and live sessions</Text>

        <FormField label="Exercise name *" value={form.name} onChangeText={(value) => setField("name", value)} placeholder="e.g. Single-arm cable row" />
        <FormField label="Primary target *" value={form.target} onChangeText={(value) => setField("target", value)} placeholder="e.g. Upper back" />
        <FormField label="Secondary muscles" value={form.secondary} onChangeText={(value) => setField("secondary", value)} placeholder="e.g. Lats · Biceps" />
        <FormField label="Equipment *" value={form.equipment} onChangeText={(value) => setField("equipment", value)} placeholder="e.g. Cable stack" />
        <FormField label="How to perform it" value={form.instructions} onChangeText={(value) => setField("instructions", value)} placeholder="Short exercise instructions" multiline />
        <FormField label="Technique cue" value={form.technique} onChangeText={(value) => setField("technique", value)} placeholder="One cue to keep the movement clean" multiline />

        <Text style={sectionLabel}>Programming</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <FormField label="Sets" value={form.sets} onChangeText={(value) => setField("sets", value)} keyboardType="number-pad" compact />
          <FormField label={form.unit === "sec" ? "Min hold" : "Min reps"} value={form.minReps} onChangeText={(value) => setField("minReps", value)} keyboardType="number-pad" compact />
          <FormField label={form.unit === "sec" ? "Max hold" : "Max reps"} value={form.maxReps} onChangeText={(value) => setField("maxReps", value)} keyboardType="number-pad" compact />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <FormField label="Starting load" value={form.startingWeight} onChangeText={(value) => setField("startingWeight", value)} placeholder="Optional" keyboardType="decimal-pad" compact />
          <View style={{ flex: 1 }}>
            <Text style={sectionLabel}>Unit</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {(["kg", "sec"] as const).map((unit) => <Choice key={unit} label={unit === "kg" ? "kg" : "seconds"} selected={form.unit === unit} onPress={() => setField("unit", unit)} />)}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <FormField label="Target RIR min" value={form.rirMin} onChangeText={(value) => setField("rirMin", value)} keyboardType="number-pad" compact />
          <FormField label="Target RIR max" value={form.rirMax} onChangeText={(value) => setField("rirMax", value)} keyboardType="number-pad" compact />
          <FormField label="Rest (sec)" value={form.restSeconds} onChangeText={(value) => setField("restSeconds", value)} keyboardType="number-pad" compact />
        </View>
        <FormField label="Alternative movement" value={form.alternative} onChangeText={(value) => setField("alternative", value)} placeholder="Optional substitute" />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <FormField label="Superset pair ID" value={form.supersetGroup} onChangeText={(value) => setField("supersetGroup", value)} placeholder="Optional" compact />
          <FormField label="Pair rest (sec)" value={form.supersetRestSeconds} onChangeText={(value) => setField("supersetRestSeconds", value)} placeholder="Optional" keyboardType="number-pad" compact />
        </View>
        <FormField label="Tempo" value={form.tempo} onChangeText={(value) => setField("tempo", value)} placeholder="Optional, e.g. 3-second lowering" />
        <FormField label="Plan-specific note" value={form.planNote} onChangeText={(value) => setField("planNote", value)} placeholder="Optional safety or programming note" multiline />

        <Text style={[sectionLabel, { marginTop: 24 }]}>Suggested program day</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {WORKOUT_DAYS.map((day) => <Choice key={day} label={DAY_META[day].short} selected={form.day === day} onPress={() => setForm((current) => ({ ...current, day, family: DAY_META[day].family }))} />)}
        </View>
        <Text style={[sectionLabel, { marginTop: 24 }]}>Library filter</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {families.map((family) => <Choice key={family} label={family} selected={form.family === family} onPress={() => setField("family", family)} />)}
        </View>

        {error ? <Text accessibilityRole="alert" style={{ color: COLORS.danger, fontSize: 13, fontWeight: "500", marginTop: 16 }}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void handleSave()} style={{ backgroundColor: COLORS.ink, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 24, opacity: saving ? 0.65 : 1 }}>
          <Text style={{ color: COLORS.white, fontSize: 15, fontWeight: "500" }}>{saving ? "Saving…" : id ? "Save changes" : "Add to exercise library"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const sectionLabel = { color: COLORS.muted, fontSize: 13, fontWeight: "400" as const };

function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline, compact }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  multiline?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={{ flex: compact ? 1 : undefined, marginTop: compact ? 0 : 20 }}>
      <Text style={sectionLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={{ minHeight: multiline ? 88 : 48, backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, paddingVertical: multiline ? 12 : 8, marginTop: 8, color: COLORS.ink, fontSize: 14, fontWeight: "400" }}
      />
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ minHeight: 44, justifyContent: "center", backgroundColor: selected ? COLORS.ink : COLORS.white, borderWidth: 1, borderColor: selected ? COLORS.ink : COLORS.line, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 12 }}>
      <Text style={{ color: selected ? COLORS.white : COLORS.muted, fontSize: 12, fontWeight: "500", textTransform: "capitalize" }}>{label}</Text>
    </Pressable>
  );
}
