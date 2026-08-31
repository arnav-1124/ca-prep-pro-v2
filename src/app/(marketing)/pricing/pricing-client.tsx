"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, AlertCircle, Loader2, Info } from "lucide-react";
import { createRazorpaySubscriptionAction, verifySubscriptionPaymentAction, syncStudentSubscriptionAction } from "@/app/actions/billing";
import { APP_PLANS } from "@/domains/billing/plans";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";

interface PricingClientProps {
  isAuthenticated: boolean;
  currentPlan: string;
  studentEmail: string;
  studentName: string;
}

interface RazorpaySubscriptionSuccessResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  };
}

export function PricingClient({
  isAuthenticated,
  currentPlan,
  studentEmail,
  studentName,
}: PricingClientProps) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorDialogMsg, setErrorDialogMsg] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<boolean>(false);
  const [pendingNoticeMsg, setPendingNoticeMsg] = useState<string | null>(null);

  const plansList = [APP_PLANS.FREE, APP_PLANS.PLUS, APP_PLANS.PRO];

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && "Razorpay" in window) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async (planId: "PLUS" | "PRO") => {
    if (!isAuthenticated) {
      router.push(`/sign-up?redirect_url=/pricing`);
      return;
    }

    setLoadingPlan(planId);
    setErrorDialogMsg(null);
    setPendingNoticeMsg(null);

    try {
      // 1. Create Subscription on Razorpay via Server Action
      const res = await createRazorpaySubscriptionAction(planId);
      if (!res.success || !res.subscriptionId || !res.keyId) {
        throw new Error(res.error || "We couldn't initialize your subscription right now. Please try again in a moment.");
      }

      // If mock mode is explicitly active in local dev
      if (res.isMock) {
        console.log(`[Dev Mock Checkout] Verifying simulated checkout for plan=${planId}`);
        const mockPaymentId = `pay_mock_${res.subscriptionId}`;
        const verifyRes = await verifySubscriptionPaymentAction({
          razorpayPaymentId: mockPaymentId,
          razorpaySubscriptionId: res.subscriptionId,
          razorpaySignature: "mock_signature",
          plan: planId,
        });

        if (verifyRes.success) {
          router.push("/billing?success=true");
        } else {
          setErrorDialogMsg(verifyRes.error || "Your subscription couldn't be completed. Please try again.");
          setLoadingPlan(null);
        }
        return;
      }

      // 2. Load official Razorpay Checkout SDK
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to load the payment gateway. Please check your internet connection and try again.");
      }

      // 3. Launch Standard Razorpay Subscription Checkout Modal
      const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void; on: (evt: string, cb: (res: RazorpayFailureResponse) => void) => void } }).Razorpay;
      
      const options = {
        key: res.keyId,
        subscription_id: res.subscriptionId,
        name: "CA Prep Pro",
        description: `${planId === "PLUS" ? "Plus Plan" : "Pro Plan"} Subscription`,
        image: "/logo.png",
        handler: async function (response: RazorpaySubscriptionSuccessResponse) {
          setLoadingPlan(planId);
          setPendingConfirmation(true);

          try {
            const verifyRes = await verifySubscriptionPaymentAction({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySubscriptionId: response.razorpay_subscription_id,
              razorpaySignature: response.razorpay_signature,
              plan: planId,
            });

            if (verifyRes.success && verifyRes.status === "active") {
              router.push("/billing?success=true");
              return;
            }

            // If pending, poll sync action up to 8 times (~12 seconds)
            let isSynced = false;
            for (let i = 0; i < 8; i++) {
              await new Promise((r) => setTimeout(r, 1500));
              const syncRes = await syncStudentSubscriptionAction();
              if (syncRes.success && syncRes.status === "active") {
                isSynced = true;
                router.push("/billing?success=true");
                break;
              }
            }

            if (!isSynced) {
              setPendingConfirmation(false);
              setPendingNoticeMsg("Your payment was received. We're finalizing your membership activation and syncing your new daily quotas. Please check your billing dashboard.");
              setLoadingPlan(null);
            }
          } catch {
            setPendingConfirmation(false);
            setPendingNoticeMsg("Your payment was received. We're confirming your subscription and will update your plan shortly.");
            setLoadingPlan(null);
          }
        },
        prefill: {
          name: studentName || undefined,
          email: studentEmail || undefined,
        },
        theme: {
          color: "#0f172a",
        },
        modal: {
          ondismiss: function () {
            setLoadingPlan(null);
          },
        },
      };

      const rzp = new RazorpayConstructor(options);
      rzp.on("payment.failed", function (failResponse: RazorpayFailureResponse) {
        setLoadingPlan(null);
        console.warn("[Razorpay Payment Failed]", failResponse?.error);
        setErrorDialogMsg("Your payment could not be completed. Your plan has not been changed.");
      });

      rzp.open();
    } catch (err: unknown) {
      console.error("[Checkout Initiation Error]", err);
      const msg = err instanceof Error ? err.message : "We couldn't complete your subscription right now. Please try again in a moment.";
      setErrorDialogMsg(msg);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Pending Confirmation Overlay Dialog */}
      <Dialog open={pendingConfirmation} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border rounded-2xl p-6 gap-6 shadow-lg text-center">
          <DialogHeader className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-spin">
              <Loader2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Confirming Your Subscription
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans leading-relaxed">
              Your payment was received. We&apos;re updating your study plan and syncing your new daily limits.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Processing Notice Dialog */}
      <Dialog open={!!pendingNoticeMsg} onOpenChange={(open) => !open && setPendingNoticeMsg(null)}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border rounded-2xl p-6 gap-6 shadow-lg">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Info className="h-6 w-6" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Subscription In Progress
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans leading-relaxed">
              {pendingNoticeMsg}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="w-full">
            <Button
              className="w-full font-bold text-xs h-10 rounded-xl cursor-pointer"
              onClick={() => {
                setPendingNoticeMsg(null);
                router.push("/billing");
              }}
            >
              Go to Billing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Friendly Error Dialog */}
      <Dialog open={!!errorDialogMsg} onOpenChange={(open) => !open && setErrorDialogMsg(null)}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border rounded-2xl p-6 gap-6 shadow-lg">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Subscription Notification
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans leading-relaxed">
              {errorDialogMsg}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="w-full">
            <Button
              className="w-full font-bold text-xs h-10 rounded-xl cursor-pointer"
              onClick={() => setErrorDialogMsg(null)}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
        {plansList.map((plan) => {
          const isFreeUser = currentPlan === "FREE";
          const isPlusUser = currentPlan === "PLUS";
          const isProUser = currentPlan === "PRO" || currentPlan === "PAID";
          const isLoading = loadingPlan === plan.id;

          let buttonLabel = "Select Plan";
          let isActionable = false;
          let isCurrentCard = false;

          if (!isAuthenticated) {
            // Unauthenticated visitors
            if (plan.id === "FREE") {
              buttonLabel = "Get Started";
              isActionable = true;
            } else if (plan.id === "PLUS") {
              buttonLabel = "Upgrade to Plus";
              isActionable = true;
            } else {
              buttonLabel = "Upgrade to Pro";
              isActionable = true;
            }
          } else {
            // Authenticated Students: Exact CTA Matrix
            if (isFreeUser) {
              if (plan.id === "FREE") {
                buttonLabel = "Current Plan";
                isCurrentCard = true;
                isActionable = false;
              } else if (plan.id === "PLUS") {
                buttonLabel = "Upgrade to Plus";
                isActionable = true;
              } else {
                buttonLabel = "Upgrade to Pro";
                isActionable = true;
              }
            } else if (isPlusUser) {
              if (plan.id === "FREE") {
                buttonLabel = "Included";
                isActionable = false;
              } else if (plan.id === "PLUS") {
                buttonLabel = "Current Plan";
                isCurrentCard = true;
                isActionable = false;
              } else {
                buttonLabel = "Upgrade to Pro";
                isActionable = true;
              }
            } else if (isProUser) {
              if (plan.id === "FREE") {
                buttonLabel = "Included";
                isActionable = false;
              } else if (plan.id === "PLUS") {
                buttonLabel = "Included";
                isActionable = false;
              } else {
                buttonLabel = "Current Plan";
                isCurrentCard = true;
                isActionable = false;
              }
            }
          }

          return (
            <div
              key={plan.id}
              className={`flex flex-col justify-between border bg-card rounded-2xl p-8 shadow-xs transition-all relative ${
                isCurrentCard 
                  ? "border-primary ring-2 ring-primary/20 scale-[1.02]" 
                  : plan.id === "PRO" 
                    ? "border-primary/50 hover:border-primary" 
                    : "border-border hover:border-primary/30"
              }`}
            >
              {plan.id === "PRO" && (
                <div className="absolute -top-3.5 right-6 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Most Advanced</span>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="mt-2 text-xs text-muted-foreground/90 font-sans leading-relaxed">{plan.description}</p>
                <div className="mt-6 flex items-baseline text-foreground">
                  <span className="text-4xl font-extrabold tracking-tight">{plan.formattedPrice}</span>
                  <span className="ml-1 text-xs text-muted-foreground font-medium font-sans">{plan.billing}</span>
                </div>

                {/* Features List */}
                <ul className="mt-8 space-y-4 text-xs font-sans">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex gap-3 text-muted-foreground">
                      <Check className="h-4.5 w-4.5 text-primary flex-shrink-0" />
                      <span className="leading-normal">{feat}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feat) => (
                    <li key={feat} className="flex gap-3 text-muted-foreground/40 line-through">
                      <Check className="h-4.5 w-4.5 flex-shrink-0" />
                      <span className="leading-normal">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                {!isAuthenticated ? (
                  plan.id === "FREE" ? (
                    <Button variant="outline" asChild className="w-full font-bold text-xs h-10 rounded-xl cursor-pointer">
                      <Link href="/sign-up">
                        {buttonLabel}
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/95 font-bold text-xs h-10 rounded-xl cursor-pointer">
                      <Link href={`/sign-up?redirect_url=/pricing`}>
                        {buttonLabel}
                      </Link>
                    </Button>
                  )
                ) : isCurrentCard ? (
                  <Button variant="secondary" className="w-full font-bold text-xs h-10 rounded-xl pointer-events-none select-none opacity-80">
                    {buttonLabel}
                  </Button>
                ) : !isActionable ? (
                  <Button variant="ghost" className="w-full font-bold text-xs h-10 rounded-xl pointer-events-none select-none opacity-50 bg-muted/30">
                    {buttonLabel}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleCheckout(plan.id as "PLUS" | "PRO")}
                    disabled={!!loadingPlan}
                    className="w-full font-bold text-xs h-10 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>{buttonLabel}</span>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
