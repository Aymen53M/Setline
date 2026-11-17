import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const exercises = mysqlTable("exercises", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  muscleGroup: varchar("muscleGroup", { length: 80 }).notNull(),
  secondaryMuscles: text("secondaryMuscles"),
  equipment: varchar("equipment", { length: 120 }).notNull(),
  instructions: text("instructions").notNull(),
  technique: text("technique").notNull(),
  repRange: varchar("repRange", { length: 32 }).notNull(),
  mediaPath: varchar("mediaPath", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ muscleIdx: index("exercises_muscle_idx").on(table.muscleGroup) }));

export const trainingPrograms = mysqlTable("trainingPrograms", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("programs_user_idx").on(table.userId) }));

export const programExercises = mysqlTable("programExercises", {
  id: int("id").autoincrement().primaryKey(),
  programId: int("programId").notNull().references(() => trainingPrograms.id, { onDelete: "cascade" }),
  exerciseId: int("exerciseId").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  trainingDay: varchar("trainingDay", { length: 40 }).notNull(),
  prescribedSets: int("prescribedSets").notNull(),
  minReps: int("minReps").notNull(),
  maxReps: int("maxReps").notNull(),
  startingWeight: decimal("startingWeight", { precision: 8, scale: 2 }),
  exerciseOrder: int("exerciseOrder").notNull(),
}, (table) => ({ programDayIdx: index("program_exercises_day_idx").on(table.programId, table.trainingDay), uniqueExercise: uniqueIndex("program_exercises_unique_idx").on(table.programId, table.exerciseId, table.trainingDay) }));

export const workouts = mysqlTable("workouts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  trainingDay: varchar("trainingDay", { length: 40 }).notNull(),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
  notes: text("notes"),
  clientKey: varchar("clientKey", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userDateIdx: index("workouts_user_date_idx").on(table.userId, table.startedAt), clientKeyIdx: uniqueIndex("workouts_client_key_idx").on(table.userId, table.clientKey) }));

export const workoutSets = mysqlTable("workoutSets", {
  id: int("id").autoincrement().primaryKey(),
  workoutId: int("workoutId").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: int("exerciseId").notNull().references(() => exercises.id, { onDelete: "restrict" }),
  setNumber: int("setNumber").notNull(),
  weight: decimal("weight", { precision: 8, scale: 2 }).notNull().default("0"),
  reps: int("reps").notNull(),
  rir: int("rir").notNull().default(2),
  completed: boolean("completed").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ workoutIdx: index("workout_sets_workout_idx").on(table.workoutId), exerciseDateIdx: index("workout_sets_exercise_idx").on(table.exerciseId, table.createdAt) }));

export const bodyMetrics = mysqlTable("bodyMetrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  measuredAt: timestamp("measuredAt").notNull(),
  bodyWeight: decimal("bodyWeight", { precision: 8, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userDateIdx: index("body_metrics_user_date_idx").on(table.userId, table.measuredAt) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ExerciseRow = typeof exercises.$inferSelect;
export type WorkoutRow = typeof workouts.$inferSelect;
export type WorkoutSetRow = typeof workoutSets.$inferSelect;
