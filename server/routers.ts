import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSessionCookieName, getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { workouts, workoutSets, exercises } from "../drizzle/schema";

const workoutSetInput = z.object({
  exerciseId: z.number(),
  setNumber: z.number().int().positive(),
  weight: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  rir: z.number().int().min(0).max(10),
  completed: z.boolean(),
  notes: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(getSessionCookieName(ctx.req), { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  training: router({
    history: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { workouts: [], sets: [] };
      const ownedWorkouts = await db.select().from(workouts).where(eq(workouts.userId, ctx.user.id)).orderBy(desc(workouts.startedAt));
      const ids = ownedWorkouts.map((workout) => workout.id);
      const ownedSets = ids.length ? await db.select().from(workoutSets).where(inArray(workoutSets.workoutId, ids)) : [];
      return { workouts: ownedWorkouts, sets: ownedSets };
    }),
    exercises: publicProcedure.query(async () => {
      const db = await getDb();
      return db ? db.select().from(exercises).orderBy(exercises.name) : [];
    }),
    saveWorkout: protectedProcedure.input(z.object({
      clientKey: z.string().min(1),
      trainingDay: z.string().min(1),
      startedAt: z.string(),
      completedAt: z.string(),
      duration: z.number().int().nonnegative(),
      notes: z.string().optional(),
      sets: z.array(workoutSetInput),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { saved: false, reason: "database-unavailable" as const };
      const existing = await db.select({ id: workouts.id }).from(workouts).where(and(eq(workouts.userId, ctx.user.id), eq(workouts.clientKey, input.clientKey))).limit(1);
      if (existing[0]) return { saved: true, workoutId: existing[0].id, duplicate: true } as const;
      const [record] = await db.insert(workouts).values({ userId: ctx.user.id, clientKey: input.clientKey, trainingDay: input.trainingDay, startedAt: new Date(input.startedAt), completedAt: new Date(input.completedAt), duration: input.duration, notes: input.notes }).$returningId();
      if (input.sets.length) await db.insert(workoutSets).values(input.sets.map((set) => ({ ...set, workoutId: record.id, weight: String(set.weight) })));
      return { saved: true, workoutId: record.id };
    }),
    deleteWorkout: protectedProcedure.input(z.object({ workoutId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { deleted: false, reason: "database-unavailable" as const };
      await db.delete(workouts).where(and(eq(workouts.id, input.workoutId), eq(workouts.userId, ctx.user.id)));
      return { deleted: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
