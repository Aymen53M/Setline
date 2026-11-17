import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { Linking, Pressable, Text, View } from "react-native";
import { COLORS } from "@/components/liftlog-ui";
import { getExerciseMediaSelection, getTargetMuscleArt, type ExerciseMediaSelection } from "@/lib/exercise-art";
import type { Exercise } from "@/lib/workout-data";

const CHEST_PRESS_VIDEO = {
  uri: "https://upload.wikimedia.org/wikipedia/commons/7/70/Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm",
  source: "https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm",
};

export function ExerciseMediaGuide({ exercise }: { exercise: Exercise }) {
  const selection = getExerciseMediaSelection(exercise);
  const video = exercise.id === "machine-chest-press" ? CHEST_PRESS_VIDEO : undefined;
  const muscles = getTargetMuscleArt(exercise);

  return (
    <View style={{ gap: 16, marginTop: 20 }}>
      <View style={mediaStyles.card}>
        <View style={mediaStyles.sectionHeader}>
          <View style={mediaStyles.headerIcon}><Ionicons name="play-outline" size={17} color={COLORS.ink} /></View>
          <View style={{ flex: 1 }}>
            <Text style={mediaStyles.title}>Movement demonstration</Text>
            <Text style={mediaStyles.subtitle}>{video ? "Video demonstration" : selection?.isExact ? "Start → finish" : `Closest reference · ${selection?.referenceName ?? "movement pattern"}`}</Text>
          </View>
        </View>

        {video ? <ExerciseVideo uri={video.uri} /> : selection ? <MovementSteps selection={selection} /> : (
          <View style={mediaStyles.noArt}>
            <Ionicons name="barbell-outline" size={22} color={COLORS.muted} />
            <Text style={mediaStyles.noArtText}>Follow the written instructions below, or search for a video demonstration.</Text>
          </View>
        )}

        {video ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(video.source)} style={mediaStyles.creditRow}>
            <Ionicons name="open-outline" size={14} color={COLORS.muted} />
            <Text style={mediaStyles.credit}>CDC video · public domain · source</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="link"
          onPress={() => {
            const query = encodeURIComponent(`${exercise.name} exercise form demonstration`);
            void Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
          }}
          style={mediaStyles.videoSearchButton}
        >
          <Ionicons name="logo-youtube" size={16} color={COLORS.ink} />
          <Text style={mediaStyles.videoSearchText}>Find a video demo</Text>
          <Ionicons name="open-outline" size={15} color={COLORS.muted} />
        </Pressable>
      </View>

      <View style={mediaStyles.card}>
        <View style={mediaStyles.sectionHeader}>
          <View style={mediaStyles.headerIcon}><Ionicons name="body-outline" size={17} color={COLORS.ink} /></View>
          <View style={{ flex: 1 }}>
            <Text style={mediaStyles.title}>Target muscles</Text>
            <Text style={mediaStyles.subtitle}>Highlighted anatomy · main and assisting</Text>
          </View>
        </View>
        <MuscleRow title="Main targets" muscles={muscles.primary} emptyText={exercise.target} />
        <MuscleRow title="Also involved" muscles={muscles.assisting} emptyText={exercise.secondary} subdued />
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://repdb.co")} style={mediaStyles.creditRow}>
          <Ionicons name="open-outline" size={14} color={COLORS.muted} />
          <Text style={mediaStyles.credit}>Exercise illustrations and muscle maps by RepDB</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ExerciseVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  return <VideoView player={player} nativeControls contentFit="contain" style={mediaStyles.video} />;
}

function MovementSteps({ selection }: { selection: ExerciseMediaSelection }) {
  return (
    <View>
      {!selection.isExact ? <Text style={mediaStyles.referenceNote}>This is a similar movement reference. Use the video search or your written cues for the exact variation.</Text> : null}
      <View style={mediaStyles.stepsRow}>
        <MovementFrame source={selection.art.start} label="Start" />
        <View style={mediaStyles.stepArrow}><Ionicons name="arrow-forward" size={17} color={COLORS.muted} /></View>
        <MovementFrame source={selection.art.finish} label="Finish" />
      </View>
    </View>
  );
}

function MovementFrame({ source, label }: { source: number; label: string }) {
  return (
    <View style={mediaStyles.frameColumn}>
      <View style={mediaStyles.poseFrame}><Image source={source} contentFit="contain" style={mediaStyles.poseImage} /></View>
      <Text style={mediaStyles.poseLabel}>{label}</Text>
    </View>
  );
}

function MuscleRow({ title, muscles, emptyText, subdued = false }: { title: string; muscles: Array<{ id: string; label: string; image: number }>; emptyText: string; subdued?: boolean }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={mediaStyles.muscleHeading}>{title}</Text>
      {muscles.length ? (
        <View style={mediaStyles.muscleGrid}>
          {muscles.map((muscle) => (
            <View key={muscle.id} style={[mediaStyles.muscleTile, subdued && mediaStyles.muscleTileSubdued]}>
              <Image source={muscle.image} contentFit="contain" style={mediaStyles.muscleImage} />
              <Text style={mediaStyles.muscleLabel}>{muscle.label}</Text>
            </View>
          ))}
        </View>
      ) : <Text style={mediaStyles.muscleFallback}>{emptyText || "No assisting muscles specified"}</Text>}
    </View>
  );
}

const mediaStyles = {
  card: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 14, backgroundColor: COLORS.white } as const,
  sectionHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 12 },
  headerIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.soft, alignItems: "center" as const, justifyContent: "center" as const },
  title: { color: COLORS.ink, fontSize: 15, fontWeight: "500" as const },
  subtitle: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  stepsRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  frameColumn: { flex: 1, alignItems: "center" as const },
  poseFrame: { width: "100%" as const, aspectRatio: 1, borderRadius: 10, backgroundColor: COLORS.soft, overflow: "hidden" as const },
  poseImage: { width: "100%" as const, height: "100%" as const },
  poseLabel: { color: COLORS.muted, fontSize: 11, marginTop: 6 },
  stepArrow: { width: 24, alignItems: "center" as const },
  referenceNote: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  video: { width: "100%" as const, aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: COLORS.soft, overflow: "hidden" as const },
  noArt: { minHeight: 140, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 24, borderRadius: 10, backgroundColor: COLORS.soft, gap: 10 },
  noArtText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: "center" as const },
  videoSearchButton: { minHeight: 42, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, borderRadius: 9, backgroundColor: COLORS.soft, marginTop: 12, paddingHorizontal: 12 },
  videoSearchText: { color: COLORS.ink, fontSize: 12, fontWeight: "500" as const },
  creditRow: { minHeight: 28, flexDirection: "row" as const, alignItems: "center" as const, gap: 5, marginTop: 8 },
  credit: { color: COLORS.muted, fontSize: 10, flexShrink: 1 },
  muscleHeading: { color: COLORS.muted, fontSize: 11, fontWeight: "500" as const, marginBottom: 7 },
  muscleGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  muscleTile: { width: "31%" as const, minWidth: 78, flexGrow: 1, alignItems: "center" as const, borderRadius: 10, backgroundColor: COLORS.soft, paddingHorizontal: 5, paddingTop: 5, paddingBottom: 7 },
  muscleTileSubdued: { backgroundColor: "#FAFAFA" },
  muscleImage: { width: 76, height: 76 },
  muscleLabel: { color: COLORS.ink, fontSize: 10, lineHeight: 13, fontWeight: "400" as const, textAlign: "center" as const },
  muscleFallback: { color: COLORS.muted, fontSize: 12, lineHeight: 17 },
};
