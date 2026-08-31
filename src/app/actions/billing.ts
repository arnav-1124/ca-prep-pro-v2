"use server";

import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { db } from "@/db";
import { subscriptions, billingEvents, studentProfiles } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { createHmac } from "crypto";
import { APP_PLANS, getRazorpayCredentials } from "@/domains/billing/plans";
import { revalidatePath } from "next/cache";

async function getAuthProfile() {
  const user = await currentUser();
  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }
  const email = user.emailAddresses[0]?.emailAddress || "";
  return getOrCreateStudentProfile(user.id, email);
}

/**
 * Checks if mock billing is explicitly enabled in a local development environment.
 * NEVER enabled in production.
 */
function isMockBillingAllowed(): boolean {
  return process.env.NODE_ENV === "development" && process.env.ENABLE_MOCK_BILLING === "true";
}

/**
 * Helper to resolve the configured Razorpay Plan ID for PLUS or PRO.
 * Normalizes prefixes (e.g. lan_... -> plan_...).
 */
async function getRazorpayPlanId(planName: "PLUS" | "PRO"): Promise<string> {
  const { keyId, keySecret } = getRazorpayCredentials();

  if (!keyId || !keySecret) {
    throw new Error("Payment gateway credentials are not configured.");
  }

  // 1. Resolve from environment variables
  let rawPlanId = planName === "PLUS" 
    ? (process.env.RAZORPAY_PLAN_PLUS_ID || process.env.RAZORPAY_PLUS_PLAN_ID)?.trim()
    : (process.env.RAZORPAY_PLAN_PRO_ID || process.env.RAZORPAY_PRO_PLAN_ID)?.trim();

  // If in Live mode and specific env var is unset, use verified Live plan IDs
  if (!rawPlanId && keyId.startsWith("rzp_live_")) {
    rawPlanId = planName === "PLUS" ? "plan_TVW1mWqYqPOWdM" : "plan_TVVzkkkg00szBV";
  }

  if (rawPlanId) {
    if (rawPlanId.startsWith("lan_")) {
      rawPlanId = `p${rawPlanId}`;
    }
    return rawPlanId;
  }

  // 2. Dynamic creation fallback if plan ID is not preset
  const planSpec = APP_PLANS[planName];
  console.log(`[Razorpay] Creating dynamic plan on gateway for ${planName}...`);
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  
  try {
    const res = await fetch("https://api.razorpay.com/v1/plans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify({
        period: "monthly",
        interval: 1,
        item: {
          name: planSpec.name,
          amount: planSpec.price,
          currency: "INR",
          description: `${planSpec.name} monthly subscription`,
        },
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[Razorpay Plan Error] status=${res.status} error=${errorBody}`);
      throw new Error("Sorry, we couldn't initialize your plan with the payment gateway. Please ensure Subscriptions are active in your dashboard.");
    }

    const data = await res.json();
    console.log(`[Razorpay] Created dynamic plan id=${data.id} for ${planName}`);
    return data.id;
  } catch (err: unknown) {
    console.error("[Razorpay Plan API Exception]", err);
    throw new Error("Sorry, we couldn't start your subscription right now. Please try again in a moment.");
  }
}

/**
 * Action to initiate a Razorpay Subscription for a target plan.
 * Strictly enforces valid transitions:
 * - FREE -> PLUS
 * - FREE -> PRO
 * - PLUS -> PRO
 */
export async function createRazorpaySubscriptionAction(targetPlan: "PLUS" | "PRO") {
  try {
    const profile = await getAuthProfile();
    const currentPlan = profile.plan;

    // Strict Transition Enforcement:
    // PRO users cannot purchase again or downgrade
    if (currentPlan === "PRO" || currentPlan === "PAID") {
      console.warn(`[Billing Transition Blocked] Student ${profile.id} is already PRO, blocked re-purchase.`);
      return { success: false, error: "You already have active Pro access." };
    }

    // PLUS users cannot re-purchase PLUS
    if (currentPlan === "PLUS" && targetPlan === "PLUS") {
      console.warn(`[Billing Transition Blocked] Student ${profile.id} is already PLUS, blocked duplicate PLUS purchase.`);
      return { success: false, error: "You are already enrolled in the Plus plan." };
    }

    // Only valid upgrade path is PLUS -> PRO
    const isUpgrade = currentPlan === "PLUS" && targetPlan === "PRO";

    const { keyId, keySecret } = getRazorpayCredentials();

    if (!keyId || !keySecret) {
      throw new Error("Payment gateway credentials are not configured.");
    }

    // Double-click / rapid creation protection: check if a subscription was created in the last 5 seconds
    const tenSecondsAgo = new Date(Date.now() - 5000);
    const [recentSub] = await db
      .select({ id: subscriptions.id, rzpSubId: subscriptions.razorpaySubscriptionId, createdAt: subscriptions.createdAt })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.studentProfileId, profile.id),
          sql`${subscriptions.createdAt} >= ${tenSecondsAgo}`
        )
      )
      .limit(1);

    if (recentSub && recentSub.rzpSubId) {
      console.log(`[Rate Limit] Returning existing in-flight subscription for student=${profile.id}`);
      return {
        success: true,
        subscriptionId: recentSub.rzpSubId,
        keyId,
        isMock: false,
        isUpgrade,
      };
    }

    // Handle Mock billing in local development only if explicitly enabled
    if (isMockBillingAllowed()) {
      console.log(`[Mock Billing] Generating mock subscription for plan=${targetPlan}`);
      return {
        success: true,
        subscriptionId: `sub_mock_${Date.now()}`,
        keyId,
        isMock: true,
        isUpgrade,
      };
    }

    const planId = await getRazorpayPlanId(targetPlan);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    // Check if user has an existing active subscription for upgrade handling
    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.studentProfileId, profile.id),
          eq(subscriptions.status, "active")
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    // If upgrading an existing PLUS subscription, perform in-place upgrade on Razorpay
    if (isUpgrade && existingSub?.razorpaySubscriptionId) {
      console.log(`[Razorpay Subscription Upgrade] Upgrading sub=${existingSub.razorpaySubscriptionId} from PLUS to PRO (planId=${planId})`);
      try {
        const updateRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${existingSub.razorpaySubscriptionId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${auth}`,
          },
          body: JSON.stringify({
            plan_id: planId,
            schedule_change_at: "now",
          }),
        });

        if (updateRes.ok) {
          const updatedSub = await updateRes.json();
          console.log(`[Razorpay Subscription Upgrade Success] Updated subscription id=${updatedSub.id}`);
          return {
            success: true,
            subscriptionId: updatedSub.id,
            keyId,
            isMock: false,
            isUpgrade: true,
          };
        } else {
          const errText = await updateRes.text();
          console.warn(`[Razorpay In-Place Upgrade Warning] In-place patch returned ${updateRes.status}: ${errText}. Falling back to new subscription creation.`);
        }
      } catch (upgradeErr) {
        console.warn("[Razorpay Upgrade Exception] In-place update failed, creating new subscription cycle:", upgradeErr);
      }
    }

    // Standard Subscription creation on Razorpay
    console.log(`[Razorpay Subscription Create] studentProfileId=${profile.id}, targetPlan=${targetPlan}, planId=${planId}`);
    const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify({
        plan_id: planId,
        total_count: 60, // 5 years monthly recurring subscription
        quantity: 1,
        customer_notify: 1,
        notes: {
          studentProfileId: profile.id,
          plan: targetPlan,
          isUpgrade: isUpgrade ? "true" : "false",
        },
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[Razorpay Subscription Creation Error] status=${res.status} error=${errorBody}`);
      throw new Error("We couldn't initialize your subscription right now. Please try again in a moment.");
    }

    const subscription = await res.json();
    console.log(`[Razorpay Subscription Created] subscriptionId=${subscription.id}, plan=${targetPlan}`);

    return {
      success: true,
      subscriptionId: subscription.id,
      keyId,
      isMock: false,
      isUpgrade,
    };
  } catch (err: unknown) {
    console.error("[createRazorpaySubscriptionAction Error]", err);
    const msg = err instanceof Error ? err.message : "We couldn't complete your subscription right now. Please try again in a moment.";
    return { success: false, error: msg };
  }
}

/**
 * Action to verify Razorpay Subscription payment signature and synchronize state with Razorpay API.
 * Ensures that entitlements are granted when either the subscription is active/authenticated or 
 * a captured initial payment is verified.
 */
export async function verifySubscriptionPaymentAction(params: {
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpaySignature: string;
  plan: "PLUS" | "PRO";
}) {
  try {
    const profile = await getAuthProfile();
    const { keyId, keySecret } = getRazorpayCredentials();

    if (!keyId || !keySecret) {
      throw new Error("Payment gateway credentials are not configured.");
    }

    console.log(`[Razorpay Verification Started] subId=${params.razorpaySubscriptionId}, paymentId=${params.razorpayPaymentId}, student=${profile.id}, plan=${params.plan}`);

    const isMock = params.razorpaySignature === "mock_signature" || params.razorpayPaymentId.startsWith("pay_mock_");

    if (isMock) {
      if (!isMockBillingAllowed()) {
        console.error("[Security Alert] Attempted mock signature verification in unauthorized environment.");
        return { success: false, error: "Payment verification failed. Invalid signature." };
      }
      console.warn(`[Mock Verification] Simulating subscription verification in local dev for profile=${profile.id}`);
    } else {
      // 1. Cryptographic HMAC SHA256 Signature Verification: payment_id|subscription_id
      const expectedSignature = createHmac("sha256", keySecret)
        .update(`${params.razorpayPaymentId}|${params.razorpaySubscriptionId}`)
        .digest("hex");

      if (expectedSignature !== params.razorpaySignature) {
        console.warn(`[Payment Verification Failed] Signature mismatch for sub=${params.razorpaySubscriptionId}`);
        return { success: false, error: "Your payment verification failed. No changes were made to your plan." };
      }

      console.log(`[Razorpay Signature Verified] HMAC SHA256 matches.`);

      // 2. Live Razorpay API Subscription Query
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const subRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${params.razorpaySubscriptionId}`, {
        headers: { "Authorization": `Basic ${auth}` },
      });

      if (!subRes.ok) {
        console.error(`[Razorpay Verification Error] Failed to fetch subscription ${params.razorpaySubscriptionId} from Razorpay: ${subRes.statusText}`);
        return { success: false, error: "We couldn't confirm your subscription with Razorpay. Please check again shortly." };
      }

      const liveSub = await subRes.json();
      console.log(`[Razorpay Live State] id=${liveSub.id}, status=${liveSub.status}, paid_count=${liveSub.paid_count}, plan_id=${liveSub.plan_id}`);

      // Verify that this subscription belongs to this student
      if (liveSub.notes?.studentProfileId && liveSub.notes.studentProfileId !== profile.id) {
        console.error(`[Security Alert] Subscription ${params.razorpaySubscriptionId} studentProfileId mismatch: expected=${profile.id}, actual=${liveSub.notes.studentProfileId}`);
        return { success: false, error: "Subscription validation failed. Please try again." };
      }

      // Verify that the Razorpay subscription plan matches the requested server-side plan
      const expectedPlanId = await getRazorpayPlanId(params.plan);
      if (liveSub.plan_id && liveSub.plan_id !== expectedPlanId) {
        console.error(`[Security Alert] Subscription ${params.razorpaySubscriptionId} plan mismatch: expected=${expectedPlanId}, actual=${liveSub.plan_id}`);
        return { success: false, error: "Subscription plan validation failed. Please try again." };
      }

      // Check payment status from Razorpay and verify binding to subscription/student
      let isPaymentCaptured = false;
      if (params.razorpayPaymentId && !params.razorpayPaymentId.startsWith("pay_mock_")) {
        try {
          const payRes = await fetch(`https://api.razorpay.com/v1/payments/${params.razorpayPaymentId}`, {
            headers: { "Authorization": `Basic ${auth}` },
          });
          if (payRes.ok) {
            const payData = await payRes.json();
            console.log(`[Razorpay Payment State] id=${payData.id}, status=${payData.status}, captured=${payData.captured}, subId=${payData.subscription_id}`);
            
            const isCaptured = payData.status === "captured" || payData.captured === true;
            const belongsToSub = !payData.subscription_id || payData.subscription_id === params.razorpaySubscriptionId;
            const belongsToStudent = !payData.notes?.studentProfileId || payData.notes.studentProfileId === profile.id;

            if (isCaptured && belongsToSub && belongsToStudent) {
              isPaymentCaptured = true;
            }
          }
        } catch (payErr) {
          console.warn("[Razorpay Payment Fetch Warning]", payErr);
        }
      }

      // Eligible for immediate activation only when verified for this student & plan AND:
      // - subscription status is 'active' or 'authenticated'
      // - OR paid_count >= 1
      // - OR payment is confirmed captured and bound to this subscription
      const isEligibleForActivation = 
        liveSub.status === "active" || 
        liveSub.status === "authenticated" || 
        (liveSub.paid_count && liveSub.paid_count >= 1) || 
        isPaymentCaptured;

      if (!isEligibleForActivation) {
        console.log(`[Subscription Pending] Subscription status is '${liveSub.status}', awaiting webhook or payment capture confirmation.`);
        
        await db
          .insert(subscriptions)
          .values({
            studentProfileId: profile.id,
            razorpaySubscriptionId: params.razorpaySubscriptionId,
            razorpayPaymentId: params.razorpayPaymentId,
            razorpayPlanId: liveSub.plan_id || null,
            razorpayCustomerId: liveSub.customer_id || null,
            plan: params.plan,
            status: liveSub.status || "pending",
            paymentStatus: "pending",
            amount: APP_PLANS[params.plan].price,
            currency: "INR",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: subscriptions.razorpaySubscriptionId,
            set: {
              status: liveSub.status || "pending",
              paymentStatus: "pending",
              updatedAt: new Date(),
            },
          });

        return {
          success: true,
          status: "pending",
          message: "Your payment is being processed. We'll update your membership once Razorpay confirms the subscription.",
        };
      }
    }

    console.log(`[Razorpay Subscription Activated] Granting plan=${params.plan} to student=${profile.id}`);

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const amount = APP_PLANS[params.plan].price;

    // Invariant: Ensure at most ONE active subscription per student by superseding prior active subscriptions
    await db
      .update(subscriptions)
      .set({ status: "superseded", updatedAt: now })
      .where(
        and(
          eq(subscriptions.studentProfileId, profile.id),
          eq(subscriptions.status, "active"),
          sql`${subscriptions.razorpaySubscriptionId} != ${params.razorpaySubscriptionId}`
        )
      );

    // 1. Idempotently Insert or Update Subscription record
    await db
      .insert(subscriptions)
      .values({
        studentProfileId: profile.id,
        razorpaySubscriptionId: params.razorpaySubscriptionId,
        razorpayPaymentId: params.razorpayPaymentId,
        plan: params.plan,
        status: "active",
        paymentStatus: "captured",
        amount,
        currency: "INR",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: subscriptions.razorpaySubscriptionId,
        set: {
          razorpayPaymentId: params.razorpayPaymentId,
          plan: params.plan,
          status: "active",
          paymentStatus: "captured",
          amount,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        },
      });

    // 2. Update Student Profile plan
    await db
      .update(studentProfiles)
      .set({ plan: params.plan, updatedAt: now })
      .where(eq(studentProfiles.id, profile.id));

    // 3. Log Billing Audit Event
    await db.insert(billingEvents).values({
      studentProfileId: profile.id,
      razorpayEventId: params.razorpayPaymentId || `pay_evt_${Date.now()}`,
      eventType: "subscription.activated",
      payload: {
        paymentId: params.razorpayPaymentId,
        subscriptionId: params.razorpaySubscriptionId,
        plan: params.plan,
        verifiedAt: now.toISOString(),
      },
      processedAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    revalidatePath("/billing");
    revalidatePath("/pricing");

    return { success: true, status: "active" };
  } catch (err: unknown) {
    console.error("[verifySubscriptionPaymentAction Error]", err);
    return {
      success: false,
      error: "Something went wrong while confirming your subscription. Please contact support if your account was charged.",
    };
  }
}

/**
 * Self-healing sync action to check Razorpay API and reconcile the student's latest subscription state.
 * Called automatically by /billing and during post-checkout polling.
 */
export async function syncStudentSubscriptionAction() {
  try {
    const profile = await getAuthProfile();
    const { keyId, keySecret } = getRazorpayCredentials();

    if (!keyId || !keySecret) {
      return { success: false, error: "Payment credentials not configured." };
    }

    // Find the student's most recent subscription
    const [latestSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.studentProfileId, profile.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!latestSub || !latestSub.razorpaySubscriptionId) {
      return { success: true, status: "none", plan: profile.plan };
    }

    // Query Razorpay API for live state
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const subRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${latestSub.razorpaySubscriptionId}`, {
      headers: { "Authorization": `Basic ${auth}` },
    });

    if (!subRes.ok) {
      console.warn(`[Subscription Sync Warning] Could not fetch ${latestSub.razorpaySubscriptionId} from Razorpay: ${subRes.statusText}`);
      return { success: true, status: latestSub.status, plan: profile.plan };
    }

    const liveSub = await subRes.json();
    console.log(`[Subscription Sync] profile=${profile.id}, subId=${liveSub.id}, status=${liveSub.status}, paid_count=${liveSub.paid_count}`);

    // Check if subscription has captured payments or is active
    const isPaidAndActive = 
      liveSub.status === "active" || 
      liveSub.status === "authenticated" || 
      (liveSub.paid_count && liveSub.paid_count >= 1);

    if (isPaidAndActive) {
      const targetPlan = ((liveSub.notes?.plan as string) || (latestSub.plan) || "PLUS").toUpperCase() as "PLUS" | "PRO";
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
            sql`${subscriptions.razorpaySubscriptionId} != ${latestSub.razorpaySubscriptionId}`
          )
        );

      // Update subscription record
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
        .where(eq(subscriptions.razorpaySubscriptionId, latestSub.razorpaySubscriptionId));

      // Update student profile plan
      await db
        .update(studentProfiles)
        .set({ plan: targetPlan, updatedAt: now })
        .where(eq(studentProfiles.id, profile.id));

      // Record sync audit event
      await db.insert(billingEvents).values({
        studentProfileId: profile.id,
        razorpayEventId: `sync_${latestSub.razorpaySubscriptionId}_${Date.now()}`,
        eventType: "subscription.activated",
        payload: {
          syncedFrom: "razorpay_api",
          subscriptionId: latestSub.razorpaySubscriptionId,
          plan: targetPlan,
          paidCount: liveSub.paid_count,
        },
        processedAt: now,
        updatedAt: now,
      }).onConflictDoNothing();

      revalidatePath("/billing");
      revalidatePath("/pricing");

      return { success: true, status: "active", plan: targetPlan };
    }

    return { success: true, status: liveSub.status, plan: profile.plan };
  } catch (err: unknown) {
    console.error("[syncStudentSubscriptionAction Error]", err);
    return { success: false, error: "Failed to synchronize subscription state." };
  }
}
