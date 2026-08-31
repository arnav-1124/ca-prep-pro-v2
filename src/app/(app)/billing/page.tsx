import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { AppShell } from "@/components/app/app-shell";
import { BillingClient } from "./billing-client";
import { db } from "@/db";
import { subscriptions, billingEvents, studentProfiles } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { PLAN_DETAILS, checkFeatureAllowance } from "@/domains/billing/entitlements";
import { format } from "date-fns";
import { APP_PLANS, getRazorpayCredentials } from "@/domains/billing/plans";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Billing & Subscriptions - CA Prep Pro",
  description: "Manage your CA Prep Pro subscription and track daily usage limits.",
};

export default async function BillingPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress || "";
  let profile = await getOrCreateStudentProfile(user.id, email);

  // 1. Fetch the student's latest subscription
  let [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.studentProfileId, profile.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  // 2. Self-Healing Re-Sync: If profile is FREE or status != active, verify with Razorpay
  if (activeSub?.razorpaySubscriptionId && (profile.plan === "FREE" || activeSub.status !== "active")) {
    try {
      const { keyId, keySecret } = getRazorpayCredentials();
      if (keyId && keySecret) {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
        const subRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${activeSub.razorpaySubscriptionId}`, {
          headers: { Authorization: `Basic ${auth}` },
        });

        if (subRes.ok) {
          const liveSub = await subRes.json();
          const isPaidAndActive = 
            liveSub.status === "active" || 
            liveSub.status === "authenticated" || 
            (liveSub.paid_count && liveSub.paid_count >= 1);

          if (isPaidAndActive) {
            const targetPlan = ((liveSub.notes?.plan as string) || activeSub.plan || "PLUS").toUpperCase() as "PLUS" | "PRO";
            const now = new Date();
            const periodStart = liveSub.current_start ? new Date(liveSub.current_start * 1000) : now;
            const periodEnd = liveSub.current_end ? new Date(liveSub.current_end * 1000) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const amount = APP_PLANS[targetPlan]?.price || 19900;

            // Invariant: Mark prior subscriptions as superseded
            await db
              .update(subscriptions)
              .set({ status: "superseded", updatedAt: now })
              .where(
                and(
                  eq(subscriptions.studentProfileId, profile.id),
                  eq(subscriptions.status, "active"),
                  sql`${subscriptions.razorpaySubscriptionId} != ${activeSub.razorpaySubscriptionId}`
                )
              );

            // Update subscription
            await db
              .update(subscriptions)
              .set({
                plan: targetPlan,
                status: "active",
                paymentStatus: "captured",
                amount,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                updatedAt: now,
              })
              .where(eq(subscriptions.razorpaySubscriptionId, activeSub.razorpaySubscriptionId));

            // Update profile
            await db
              .update(studentProfiles)
              .set({ plan: targetPlan, updatedAt: now })
              .where(eq(studentProfiles.id, profile.id));

            // Reload fresh state
            profile = { ...profile, plan: targetPlan };
            activeSub = {
              ...activeSub,
              plan: targetPlan,
              status: "active",
              paymentStatus: "captured",
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            };
          }
        }
      }
    } catch (syncErr) {
      console.warn("[Billing Self-Healing Exception]", syncErr);
    }
  }

  // 3. Fetch billing transaction history
  const historyEvents = await db
    .select({
      id: billingEvents.id,
      eventId: billingEvents.razorpayEventId,
      eventType: billingEvents.eventType,
      createdAt: billingEvents.processedAt,
    })
    .from(billingEvents)
    .where(eq(billingEvents.studentProfileId, profile.id))
    .orderBy(desc(billingEvents.processedAt));

  // 4. Resolve quota limits usage metrics
  const quotaExplanations = await checkFeatureAllowance(profile.id, "EXPLANATION");
  const quotaChat = await checkFeatureAllowance(profile.id, "AI_CHAT");

  // Map database details
  const planKey = profile.plan as keyof typeof PLAN_DETAILS;
  const currentPlanDetails = PLAN_DETAILS[planKey] || PLAN_DETAILS.FREE;

  const formattedHistory = historyEvents.map((item) => ({
    id: item.id,
    eventId: item.eventId,
    eventType: item.eventType,
    createdAt: format(new Date(item.createdAt), "dd MMM yyyy, hh:mm a"),
  }));

  const formattedPeriodEnd = activeSub?.currentPeriodEnd
    ? format(new Date(activeSub.currentPeriodEnd), "dd MMMM yyyy")
    : null;

  return (
    <AppShell>
      <div className="space-y-8 font-sans">
        {/* Welcome Section */}
        <div className="border border-border bg-card text-card-foreground rounded-2xl p-6 shadow-xs flex justify-between items-center transition-colors">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Billing & Quotas
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 font-sans">
              Manage your CA Prep Pro membership and track your daily usage allowance.
            </p>
          </div>
        </div>

        <BillingClient
          currentPlan={profile.plan}
          planName={currentPlanDetails.name}
          price={currentPlanDetails.price}
          status={activeSub?.status || "inactive"}
          currentPeriodEnd={formattedPeriodEnd}
          hasActiveSubscription={!!activeSub?.razorpaySubscriptionId}
          history={formattedHistory}
          quotaExplanations={{
            used: quotaExplanations.used,
            limit: quotaExplanations.limit,
          }}
          quotaChat={{
            used: quotaChat.used,
            limit: quotaChat.limit,
          }}
        />
      </div>
    </AppShell>
  );
}
