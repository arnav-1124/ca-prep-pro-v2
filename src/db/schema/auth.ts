import { pgTable, uuid, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";

// Define the plan enum
export const planEnum = pgEnum("plan_enum", ["FREE", "PLUS", "PRO", "PAID"]);

export const studentProfiles = pgTable("student_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  plan: planEnum("plan").default("FREE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
