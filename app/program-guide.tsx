import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { COLORS, Eyebrow, Screen } from "@/components/liftlog-ui";
import { TRAINING_DAYS, TRAINING_EXERCISES, TRAINING_GUIDE, type GuideTable, type TrainingExercise, type TrainingGuideSection } from "@/lib/training-plan";

export default function ProgramGuideScreen() {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const navigationItems = [
    ...TRAINING_GUIDE.map((section) => ({ id: section.id, label: section.title })),
    { id: "prescriptions", label: "Exercise prescriptions" },
  ];
  const rememberSection = (id: string, y: number) => {
    sectionOffsets.current[id] = Math.max(0, y + 24 - 12);
  };

  return (
    <Screen scrollRef={scrollRef} style={{ paddingBottom: 32 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="book-outline" size={18} color={COLORS.ink} />
          <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Program guide</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close program guide" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.soft }}>
          <Ionicons name="close" size={18} color={COLORS.ink} />
        </Pressable>
      </View>

      <Eyebrow>Setline · Push / Pull / Lower / Upper</Eyebrow>
      <Text style={{ color: COLORS.ink, fontSize: 30, lineHeight: 36, fontWeight: "500", marginTop: 8 }}>Your training plan</Text>
      <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8 }}>
        The full program you supplied, including its prescriptions, progression rules, schedule and evidence notes.
      </Text>

      <View style={{ backgroundColor: COLORS.soft, borderRadius: 12, padding: 16, marginTop: 20 }}>
        <Text style={{ color: COLORS.ink, fontSize: 13, lineHeight: 20, fontWeight: "400" }}>
          Profile figures, nutrition targets and dated sample rows are plan references—not saved measurements, intake logs or workout records. This guide is not medical advice; the knee guidance is load management, not a diagnosis.
        </Text>
      </View>

      <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500", marginTop: 22 }}>Jump to a section</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
        {navigationItems.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Jump to ${item.label}`} onPress={() => {
            const y = sectionOffsets.current[item.id];
            if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true });
          }} style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }}>
            <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ marginTop: 24 }}>
        {TRAINING_GUIDE.map((section, index) => (
          <GuideSection key={section.id} section={section} initiallyExpanded={index === 0} onLayout={(y) => rememberSection(section.id, y)} />
        ))}
      </View>
      <ExercisePrescriptionGuide onLayout={(y) => rememberSection("prescriptions", y)} />
    </Screen>
  );
}

function GuideSection({ section, initiallyExpanded, onLayout }: { section: TrainingGuideSection; initiallyExpanded: boolean; onLayout: (y: number) => void }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return (
    <View onLayout={(event) => onLayout(event.nativeEvent.layout.y)} style={{ borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 20, marginTop: 20 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ flex: 1, color: COLORS.ink, fontSize: 19, lineHeight: 25, fontWeight: "500" }}>{section.title}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={COLORS.muted} />
      </Pressable>

      {expanded ? section.paragraphs?.map((paragraph, index) => (
        <Text key={`${section.id}-paragraph-${index}`} style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }}>{paragraph}</Text>
      )) : null}

      {expanded ? section.items?.map((item, index) => (
        <View key={`${section.id}-item-${index}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 12 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.ink, marginTop: 8 }} />
          <Text style={{ flex: 1, color: COLORS.ink, fontSize: 14, lineHeight: 21 }}>{item}</Text>
        </View>
      )) : null}

      {expanded && section.table ? <GuideTableView table={section.table} /> : null}
    </View>
  );
}

function ExercisePrescriptionGuide({ onLayout }: { onLayout: (y: number) => void }) {
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  return (
    <View onLayout={(event) => onLayout(event.nativeEvent.layout.y)} style={{ borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 20, marginTop: 24 }}>
      <Text style={{ color: COLORS.ink, fontSize: 19, lineHeight: 25, fontWeight: "500" }}>Exercise-by-exercise prescriptions</Text>
      <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }}>
        Ordered details for all {TRAINING_EXERCISES.length} exercises, including their set and rep targets, RIR, rest, equipment, cues, alternatives and pairing notes. No starting loads were specified in the source, so none are invented.
      </Text>

      {TRAINING_DAYS.map((day) => {
        const exercises = TRAINING_EXERCISES.filter((exercise) => exercise.day === day);
        const workingSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
        const expanded = expandedDays[day] ?? false;
        return (
          <View key={day} style={{ marginTop: 24 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedDays((current) => ({ ...current, [day]: !expanded }))} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View><Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: "500" }}>{day}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>{exercises.length} exercises · {workingSets} working sets</Text></View>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={COLORS.muted} />
            </Pressable>
            {expanded ? exercises.map((exercise, index) => {
              const partner = exercise.supersetGroup
                ? exercises.find((candidate) => candidate.id !== exercise.id && candidate.supersetGroup === exercise.supersetGroup)
                : undefined;
              return <ExercisePrescriptionCard key={exercise.id} exercise={exercise} order={index + 1} partner={partner} />;
            }) : null}
          </View>
        );
      })}
    </View>
  );
}

function ExercisePrescriptionCard({
  exercise,
  order,
  partner,
}: {
  exercise: TrainingExercise;
  order: number;
  partner?: TrainingExercise;
}) {
  const rir = exercise.rirMin === exercise.rirMax
    ? `${exercise.rirMin}`
    : `${exercise.rirMin}–${exercise.rirMax}`;
  const rest = partner
    ? `${exercise.restSeconds} sec between sets · ${exercise.supersetRestSeconds ?? exercise.restSeconds} sec after each pair`
    : `${exercise.restSeconds} sec between sets`;

  return (
    <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 14, marginTop: 10, backgroundColor: COLORS.white }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "500", letterSpacing: 0.3 }}>EXERCISE {String(order).padStart(2, "0")}</Text>
        {partner ? <Text style={{ color: COLORS.ink, fontSize: 11, fontWeight: "500" }}>SUPERSET</Text> : null}
      </View>
      <Text style={{ color: COLORS.ink, fontSize: 16, lineHeight: 22, fontWeight: "500", marginTop: 6 }}>{exercise.name}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>Target: {exercise.target} · Assisting: {exercise.secondary}</Text>
      <Text style={{ color: COLORS.ink, fontSize: 13, lineHeight: 19, fontWeight: "500", marginTop: 10 }}>
        {exercise.sets} sets · {exercise.minReps}–{exercise.maxReps} reps · RIR {rir}
      </Text>
      <PrescriptionRow label="Equipment" value={exercise.equipment} />
      <PrescriptionRow label="Instructions" value={exercise.instructions} />
      <PrescriptionRow label="Technique" value={exercise.technique} />
      <PrescriptionRow label="Rest" value={rest} />
      {partner ? <PrescriptionRow label="Superset partner" value={partner.name} /> : null}
      <PrescriptionRow label="Alternative" value={exercise.alternative} />
      {exercise.tempo ? <PrescriptionRow label="Tempo" value={exercise.tempo} /> : null}
      {exercise.planNote ? <PrescriptionRow label="Plan note" value={exercise.planNote} /> : null}
    </View>
  );
}

function PrescriptionRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: COLORS.ink, fontSize: 11, lineHeight: 16, fontWeight: "500" }}>{label}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function GuideTableView({ table }: { table: GuideTable }) {
  const cellWidth = table.columns.length >= 6 ? 156 : table.columns.length >= 4 ? 168 : 188;
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      style={{ marginTop: 14 }}
      contentContainerStyle={{ paddingBottom: 4 }}
    >
      <View style={{ overflow: "hidden", borderWidth: 1, borderColor: COLORS.line, borderRadius: 10 }}>
        <View style={{ flexDirection: "row", backgroundColor: COLORS.ink }}>
          {table.columns.map((column, index) => (
            <View key={`${column}-${index}`} style={{ width: cellWidth, minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10, borderRightWidth: index < table.columns.length - 1 ? 1 : 0, borderRightColor: "#444444" }}>
              <Text style={{ color: COLORS.white, fontSize: 12, lineHeight: 17, fontWeight: "500" }}>{column}</Text>
            </View>
          ))}
        </View>
        {table.rows.map((row, rowIndex) => (
          <View key={`${rowIndex}-${row[0] ?? "row"}`} style={{ flexDirection: "row", backgroundColor: rowIndex % 2 === 0 ? COLORS.white : COLORS.soft, borderTopWidth: 1, borderTopColor: COLORS.line }}>
            {table.columns.map((_, columnIndex) => (
              <View key={`${rowIndex}-${columnIndex}`} style={{ width: cellWidth, minHeight: 40, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10, borderRightWidth: columnIndex < table.columns.length - 1 ? 1 : 0, borderRightColor: COLORS.line }}>
                <Text style={{ color: columnIndex === 0 ? COLORS.ink : COLORS.muted, fontSize: 12, lineHeight: 18, fontWeight: columnIndex === 0 ? "500" : "400" }}>{row[columnIndex] ?? ""}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
