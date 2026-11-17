import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { ExerciseMediaGuide } from "@/components/exercise-media-guide";
import { Eyebrow, Screen, COLORS } from "@/components/liftlog-ui";
import { DAY_META } from "@/lib/workout-data";
import { useWorkoutStore } from "@/lib/workout-store";

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { ready, exercises, getExercise, deleteExercise } = useWorkoutStore();
  const exercise = getExercise(id ?? "");
  const isActive = exercises.some((item) => item.id === exercise?.id);

  if (!ready) return <Screen><Text style={{ color: COLORS.muted, fontSize: 14 }}>Loading exercise…</Text></Screen>;
  if (!exercise) return <Screen><Text style={{ color: COLORS.ink, fontSize: 22, fontWeight: "500" }}>Exercise not found</Text><Pressable onPress={() => router.back()} style={{ marginTop: 20, backgroundColor: COLORS.ink, borderRadius: 12, padding: 16, alignItems: "center" }}><Text style={{ color: COLORS.white, fontWeight: "500" }}>Go back</Text></Pressable></Screen>;

  const day = exercise.day;
  const handleDelete = () => {
    const message = `Remove ${exercise.name} from the library and future programs? Saved workout history will be retained.`;
    const remove = async () => {
      await deleteExercise(exercise.id);
      router.back();
    };
    if (Platform.OS === "web") {
      if ((globalThis as { confirm?: (text: string) => boolean }).confirm?.(message)) void remove();
    } else {
      Alert.alert("Delete exercise?", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void remove() },
      ]);
    }
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Ionicons name="arrow-back" size={18} color={COLORS.ink} />
        <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Back</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Eyebrow>{DAY_META[day].short} · Exercise guide</Eyebrow>
        {!isActive ? <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "500" }}>Archived</Text> : null}
      </View>
      <Text style={{ color: COLORS.ink, fontSize: 30, fontWeight: "500", marginTop: 12 }}>{exercise.name}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>{exercise.target} · {exercise.secondary}</Text>
      <ExerciseMediaGuide exercise={exercise} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 12 }}><Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>Equipment</Text><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500", marginTop: 8 }}>{exercise.equipment}</Text></View>
        <View style={{ flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 12 }}><Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>Programmed</Text><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500", marginTop: 8 }}>{exercise.sets} × {exercise.minReps}–{exercise.maxReps}{exercise.unit === "sec" ? " sec" : " reps"}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>RIR {exercise.rirMin ?? 1}–{exercise.rirMax ?? 2} · rest {exercise.restSeconds ?? 90}s</Text></View>
      </View>
      <View style={{ marginTop: 24 }}>
        <Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: "500" }}>How to perform it</Text>
        <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 22, marginTop: 8 }}>{exercise.instructions}</Text>
        <Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: "500", marginTop: 20 }}>Technique cue</Text>
        <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 22, marginTop: 8 }}>{exercise.technique}</Text>
        {exercise.tempo ? <><Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: "500", marginTop: 20 }}>Tempo</Text><Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 22, marginTop: 8 }}>{exercise.tempo}</Text></> : null}
        {exercise.alternative ? <><Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: "500", marginTop: 20 }}>Alternative</Text><Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 22, marginTop: 8 }}>{exercise.alternative}</Text></> : null}
        {exercise.supersetGroup ? <Text style={{ color: COLORS.ink, fontSize: 13, lineHeight: 20, marginTop: 20 }}>Superset · alternate sets with the paired movement and rest {exercise.supersetRestSeconds ?? 75} seconds after each round.</Text> : null}
        {exercise.planNote ? <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 12 }}>{exercise.planNote}</Text> : null}
      </View>
      {isActive ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 24 }}>
          <Pressable onPress={() => router.push({ pathname: "/exercise/editor", params: { id: exercise.id } })} style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 16 }}>
            <Ionicons name="create-outline" size={18} color={COLORS.ink} />
            <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Edit</Text>
          </Pressable>
          <Pressable onPress={handleDelete} style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingVertical: 16 }}>
            <Ionicons name="trash-outline" size={18} color={COLORS.muted} />
            <Text style={{ color: COLORS.muted, fontSize: 13, fontWeight: "500" }}>Delete</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={() => router.push({ pathname: "/workout/[day]", params: { day, exerciseId: exercise.id } })} style={{ backgroundColor: COLORS.ink, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 12 }}>
        <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: "500" }}>Start {exercise.name}</Text>
      </Pressable>
    </Screen>
  );
}
