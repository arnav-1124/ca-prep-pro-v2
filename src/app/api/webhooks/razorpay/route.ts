import { db } from "@/db";
import { subscriptions, billingEvents, studentProfiles } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createHmac } from "crypto";
import { APP_PLANS, getRazorpayCredentials } from "@/domains/billing/plans";

interface RazorpayWebhookBody {
  event: string;
  id?: string;
  payload: {
    subscription?: {
      entity?: {
        id: string;
        plan_id?: string;
        customer_id?: string;
        plan_amount?: number;
        current_start?: number;
        current_end?: number;
        payment_id?: string;
        status?: string;
        notes?: Record<string, string>;
      };
    };
    payment?: {
      entity?: {
        id: string;
        order_id?: string;
        subscription_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        notes?: Record<string, string>;
      };
    };
    invoice?: {
      entity?: {
        id: string;
        subscription_id?: string;
        order_id?: string;
        payment_id?: string;
        amount?: number;
        status?: string;
      };
    };
    order?: {
      entity?: {
        id: string;
        amount?: number;
        status?: string;
        notes?: Record<string, string>;
      };
    };
  };
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";

    if (!webhookSecret) {
      console.error("[Razorpay Webhook Error] RAZORPAY_WEBHOOK_SECRET is not configured on server.");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // 1. Raw-body HMAC-SHA256 signature verification
    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.warn("[Razorpay Webhook Warning] Rejected webhook due to invalid HMAC signature.");
      return new Response("Invalid signature", { status: 400 });
    }

    let body: RazorpayWebhookBody;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[Razorpay Webhook Error] Failed to parse valid webhook body JSON:", parseErr);
      return new Response("Invalid payload", { status: 400 });
    }

    const eventType = body.event;
    const eventId = body.id || `evt_${Date.now()}`;

    console.log(`[Razorpay Webhook Received] eventType=${eventType} eventId=${eventId}`);

    // 2. Database-level Idempotency: Ignore duplicate webhook deliveries
    const [existingEvent] = await db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.razorpayEventId, eventId))
      .limit(1);

    if (existingEvent) {
      console.log(`[Razorpay Webhook Idempotency] Event ${eventId} was already processed. Skipping duplicate.`);
      return new Response("OK", { status: 200 });
    }

    const payload = body.payload;
    const subscriptionEntity = payload.subscription?.entity;
    const paymentEntity = payload.payment?.entity;
    const invoiceEntity = payload.invoice?.entity;
    const orderEntity = payload.order?.entity;

    const rzpSubscriptionId = subscriptionEntity?.id || paymentEntity?.subscription_id || invoiceEntity?.subscription_id;
    const paymentId = paymentEntity?.id || subscriptionEntity?.payment_id || invoiceEntity?.payment_id;

    const notes = subscriptionEntity?.notes || paymentEntity?.notes || orderEntity?.notes || {};
    let targetPlan = ((notes.plan as string) || "PLUS").toUpperCase() as "PLUS" | "PRO";
    const studentProfileId = notes.studentProfileId as string | undefined;

    // 3. Robust Student Identification
    const resolveProfileId = async (): Promise<string | null> => {
      if (studentProfileId) return studentProfileId;

      // Check existing database subscriptions
      if (rzpSubscriptionId) {
        const [existing] = await db
          .select({ studentProfileId: subscriptions.studentProfileId, plan: subscriptions.plan })
          .from(subscriptions)
          .where(eq(subscriptions.razorpaySubscriptionId, rzpSubscriptionId))
          .limit(1);
        if (existing) {
          targetPlan = (existing.plan as "PLUS" | "PRO") || targetPlan;
          return existing.studentProfileId;
        }
      }

      if (paymentId) {
        const [existing] = await db
          .select({ studentProfileId: subscriptions.studentProfileId, plan: subscriptions.plan })
          .from(subscriptions)
          .where(eq(subscriptions.razorpayPaymentId, paymentId))
          .limit(1);
        if (existing) {
          targetPlan = (existing.plan as "PLUS" | "PRO") || targetPlan;
          return existing.studentProfileId;
        }
      }

      // Query Razorpay API directly if subscription ID exists
      if (rzpSubscriptionId) {
        try {
          const { keyId, keySecret } = getRazorpayCredentials();
          if (keyId && keySecret) {
            const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
            const rzpRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${rzpSubscriptionId}`, {
              headers: { Authorization: `Basic ${auth}` },
            });
            if (rzpRes.ok) {
              const rzpData = await rzpRes.json();
              if (rzpData.notes?.studentProfileId) {
                targetPlan = ((rzpData.notes?.plan as string) || targetPlan).toUpperCase() as "PLUS" | "PRO";
                return rzpData.notes.studentProfileId;
              }
            }
          }
        } catch (apiErr) {
          console.warn("[Razorpay Webhook Resolver Exception]", apiErr);
        }
      }

      return null;
    };

    const resolvedProfileId = await resolveProfileId();
    const now = new Date();
    const defaultPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    console.log(`[Razorpay Webhook Context] resolvedProfileId=${resolvedProfileId}, subId=${rzpSubscriptionId}, targetPlan=${targetPlan}`);

    // 4. Process Subscription Lifecycle Events
    if (resolvedProfileId && rzpSubscriptionId) {
      const periodStart = subscriptionEntity?.current_start 
        ? new Date(subscriptionEntity.current_start * 1000) 
        : now;
      const periodEnd = subscriptionEntity?.current_end 
        ? new Date(subscriptionEntity.current_end * 1000) 
        : defaultPeriodEnd;
      const amount = subscriptionEntity?.plan_amount || paymentEntity?.amount || invoiceEntity?.amount || APP_PLANS[targetPlan]?.price || 19900;

      const isActivationEvent = 
        eventType === "subscription.activated" || 
        eventType === "subscription.charged" || 
        eventType === "payment.captured" || 
        eventType === "invoice.paid";

      if (isActivationEvent) {
        console.log(`[Razorpay Webhook Activation] Event=${eventType} for sub=${rzpSubscriptionId}, granting plan=${targetPlan}`);

        // Invariant: Mark previous active subscriptions for this student as superseded
        await db
          .update(subscriptions)
          .set({ status: "superseded", updatedAt: now })
          .where(
            and(
              eq(subscriptions.studentProfileId, resolvedProfileId),
              eq(subscriptions.status, "active"),
              sql`${subscriptions.razorpaySubscriptionId} != ${rzpSubscriptionId}`
            )
          );

        // Upsert subscription as active & captured
        await db
          .insert(subscriptions)
          .values({
            studentProfileId: resolvedProfileId,
            razorpaySubscriptionId: rzpSubscriptionId,
            razorpayPaymentId: paymentId || null,
            razorpayPlanId: subscriptionEntity?.plan_id || null,
            razorpayCustomerId: subscriptionEntity?.customer_id || null,
            plan: targetPlan,
            status: "active",
            paymentStatus: "captured",
            amount,
            currency: "INR",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: subscriptions.razorpaySubscriptionId,
            set: {
              razorpayPaymentId: paymentId || null,
              razorpayPlanId: subscriptionEntity?.plan_id || null,
              razorpayCustomerId: subscriptionEntity?.customer_id || null,
              plan: targetPlan,
              status: "active",
              paymentStatus: "captured",
              amount,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              updatedAt: now,
            },
          });

        // Update student profile plan
        await db
          .update(studentProfiles)
          .set({ plan: targetPlan, updatedAt: now })
          .where(eq(studentProfiles.id, resolvedProfileId));

      } else if (eventType === "subscription.authenticated") {
        console.log(`[Razorpay Webhook] subscription.authenticated for sub=${rzpSubscriptionId}`);
        await db
          .insert(subscriptions)
          .values({
            studentProfileId: resolvedProfileId,
            razorpaySubscriptionId: rzpSubscriptionId,
            razorpayPlanId: subscriptionEntity?.plan_id || null,
            razorpayCustomerId: subscriptionEntity?.customer_id || null,
            plan: targetPlan,
            status: "authenticated",
            paymentStatus: "authenticated",
            amount,
            currency: "INR",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: subscriptions.razorpaySubscriptionId,
            set: {
              status: "authenticated",
              paymentStatus: "authenticated",
              updatedAt: now,
            },
          });

      } else if (eventType === "subscription.pending") {
        console.log(`[Razorpay Webhook] subscription.pending for sub=${rzpSubscriptionId}`);
        await db
          .update(subscriptions)
          .set({
            status: "pending",
            paymentStatus: "pending",
            updatedAt: now,
          })
          .where(eq(subscriptions.razorpaySubscriptionId, rzpSubscriptionId));

      } else if (eventType === "subscription.halted" || eventType === "subscription.cancelled" || eventType === "subscription.completed") {
        console.log(`[Razorpay Webhook] Subscription ended (${eventType}) for sub=${rzpSubscriptionId}, reverting student to FREE`);
        await db
          .update(subscriptions)
          .set({
            status: eventType === "subscription.completed" ? "completed" : "cancelled",
            cancelledAt: now,
            updatedAt: now,
          })
          .where(eq(subscriptions.razorpaySubscriptionId, rzpSubscriptionId));

        await db
          .update(studentProfiles)
          .set({ plan: "FREE", updatedAt: now })
          .where(eq(studentProfiles.id, resolvedProfileId));

      } else if (eventType === "payment.failed") {
        console.warn(`[Razorpay Webhook] payment.failed for sub=${rzpSubscriptionId}`);
        await db
          .update(subscriptions)
          .set({
            paymentStatus: "failed",
            updatedAt: now,
          })
          .where(eq(subscriptions.razorpaySubscriptionId, rzpSubscriptionId));
      }
    }

    // 5. Record the processed event for audit trail and idempotency
    await db.insert(billingEvents).values({
      studentProfileId: resolvedProfileId,
      razorpayEventId: eventId,
      eventType: eventType,
      payload: body,
      processedAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    return new Response("OK", { status: 200 });
  } catch (err: unknown) {
    console.error("[Razorpay Webhook Exception]", err);
    return new Response("Internal Error", { status: 500 });
  }
}
