"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, CreditCard, Calendar, ShieldAlert } from "lucide-react";
import Link from "next/link";

interface BillingClientProps {
  currentPlan: string;
  planName: string;
  price: string;
  status: string;
  currentPeriodEnd: string | null;
  hasActiveSubscription?: boolean;
  history: Array<{
    id: string;
    eventId: string;
    eventType: string;
    createdAt: string;
  }>;
  quotaExplanations: { used: number; limit: number };
  quotaChat: { used: number; limit: number };
}

export function BillingClient({
  currentPlan,
  planName,
  price,
  status,
  currentPeriodEnd,
  history,
  quotaExplanations,
  quotaChat,
}: BillingClientProps) {
  return (
    <div className="space-y-8 font-sans">
      {/* Main Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Plan Detail Card */}
        <div className="lg:col-span-2 border border-border bg-card rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <CreditCard className="h-5 w-5" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider">Subscription Plan</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-foreground">{planName}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentPlan === "FREE" 
                    ? "Basic study features with daily usage quotas." 
                    : `Active subscription billing at ${price}/month.`}
                </p>
              </div>
              <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-2 flex items-baseline">
                <span className="text-2xl font-extrabold">{price}</span>
                <span className="text-[10px] text-muted-foreground ml-1">/ month</span>
              </div>
            </div>

            {currentPlan !== "FREE" && currentPeriodEnd && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border p-3 rounded-xl">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <span>
                  {status === "active" 
                    ? `Your plan will automatically renew on ${currentPeriodEnd}.` 
                    : `Your subscription access is active through ${currentPeriodEnd}.`}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-border gap-4">
            {currentPlan === "FREE" ? (
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs h-10 px-6 rounded-xl cursor-pointer">
                <Link href="/pricing" className="flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5" />
                  <span>Explore Upgrade Options</span>
                </Link>
              </Button>
            ) : currentPlan === "PLUS" ? (
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs h-10 px-6 rounded-xl cursor-pointer">
                <Link href="/pricing" className="flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5" />
                  <span>Upgrade to Pro</span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="font-bold text-xs h-10 px-6 rounded-xl cursor-pointer">
                <Link href="/pricing">View Plan Details</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Feature Usage Tracker Card */}
        <div className="border border-border bg-card rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <ShieldAlert className="h-5 w-5" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider">Usage Quotas</h2>
          </div>

          <div className="space-y-5">
            {/* AI Explanations */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-foreground">AI Explanations</span>
                <span className="text-muted-foreground">
                  {quotaExplanations.used} / {quotaExplanations.limit === 9999 ? "∞" : quotaExplanations.limit}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, (quotaExplanations.used / (quotaExplanations.limit || 1)) * 100)}%` 
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground/80 block">Resets daily at midnight</span>
            </div>

            {/* AI Chat Tutor */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-foreground">AI Chat Tutor Queries</span>
                <span className="text-muted-foreground">
                  {quotaChat.used} / {quotaChat.limit === 9999 ? "∞" : quotaChat.limit}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, (quotaChat.used / (quotaChat.limit || 1)) * 100)}%` 
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground/80 block">Resets daily at midnight</span>
            </div>

            {/* Custom Mock Tests */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-foreground">Mock Test Attempts</span>
                <span className="text-muted-foreground">
                  {currentPlan === "FREE" ? "2 per Chapter" : currentPlan === "PLUS" ? "10 per Chapter" : "Unlimited"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/80 block">Chapter specific practice limit</span>
            </div>
          </div>
        </div>

      </div>

      {/* Transaction billing History */}
      <div className="border border-border bg-card rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 text-primary">
          <CreditCard className="h-5 w-5" />
          <h2 className="text-sm font-extrabold uppercase tracking-wider">Billing History</h2>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground font-sans bg-muted/10 border border-dashed border-border rounded-xl">
            No transaction records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 px-4 font-semibold">Transaction ID</th>
                  <th className="py-3 px-4 font-semibold">Event Description</th>
                  <th className="py-3 px-4 font-semibold">Processed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10">
                    <td className="py-3 px-4 text-foreground font-medium">{item.eventId}</td>
                    <td className="py-3 px-4 text-muted-foreground font-sans">
                      {item.eventType === "subscription.activated" 
                        ? "Subscription Activated / Upgrade" 
                        : item.eventType === "subscription.charged"
                          ? "Recurring Subscription Charge"
                          : item.eventType === "subscription.cancelled" 
                            ? "Subscription Cancelled"
                            : item.eventType}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{item.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
