import { pgTable, uuid, varchar, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { studentProfiles, planEnum } from "./auth";

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentProfileId: uuid("student_profile_id")
    .references(() => studentProfiles.id)
    .notNull(),
  razorpaySubscriptionId: varchar("razorpay_subscription_id", { length: 255 }).unique(),
  razorpayOrderId: varchar("razorpay_order_id", { length: 255 }).unique(),
  razorpayCustomerId: varchar("razorpay_customer_id", { length: 255 }),
  razorpayPaymentId: varchar("razorpay_payment_id", { length: 255 }),
  razorpayPlanId: varchar("razorpay_plan_id", { length: 255 }),
  plan: planEnum("plan").default("FREE").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // 'active', 'pending', 'cancelled', 'halted', etc.
  paymentStatus: varchar("payment_status", { length: 50 }), // 'captured', 'failed', 'refunded', 'pending'
  amount: integer("amount"), // in paise
  currency: varchar("currency", { length: 10 }).default("INR"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const billingEvents = pgTable("billing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentProfileId: uuid("student_profile_id").references(() => studentProfiles.id),
  razorpayEventId: varchar("razorpay_event_id", { length: 255 }).notNull().unique(),
  eventType: varchar("event_type", { length: 255 }).notNull(), // e.g. 'subscription.activated'
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
