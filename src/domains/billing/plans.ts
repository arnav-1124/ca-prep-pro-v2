export type PlanType = "FREE" | "PLUS" | "PRO" | "PAID";

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PlanDefinition {
  id: "FREE" | "PLUS" | "PRO";
  name: string;
  price: number; // in paise (e.g. 19900 = ₹199)
  formattedPrice: string;
  billing: string;
  description: string;
  features: string[];
  notIncluded: string[];
}

export const APP_PLANS: Record<"FREE" | "PLUS" | "PRO", PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free Tier",
    price: 0,
    formattedPrice: "₹0",
    billing: "Free forever",
    description: "Essential MCQ practice assessments and basic metrics.",
    features: [
      "5 AI explanations per day",
      "2 custom test attempts per chapter",
      "Syllabus completion logs",
      "Basic progress statistics",
      "Attempt context setup",
    ],
    notIncluded: [
      "AI Study Tutor chat modules",
      "Predictive question insights",
    ],
  },
  PLUS: {
    id: "PLUS",
    name: "Plus Plan",
    price: 19900, // ₹199
    formattedPrice: "₹199",
    billing: "/ month",
    description: "Generous AI tutoring access and active practice limits.",
    features: [
      "50 AI explanations per day",
      "10 custom test attempts per chapter",
      "20 AI Study Tutor queries per day",
      "Everything in Free Tier",
    ],
    notIncluded: [
      "Predictive question insights",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro Plan",
    price: 59900, // ₹599
    formattedPrice: "₹599",
    billing: "/ month",
    description: "Unlimited practice, prediction engine, and high AI query limits.",
    features: [
      "500 AI explanations per day",
      "Unlimited custom tests",
      "500 AI Study Tutor queries per day",
      "Full predictive learning access",
      "Everything in Plus Plan",
    ],
    notIncluded: [],
  },
};

/**
 * Helper to resolve Razorpay API credentials safely.
 * Prefers RAZORPAY_LIVE_API_KEY/RAZORPAY_LIVE_KEY_SECRET if configured,
 * otherwise falls back to RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.
 */
export function getRazorpayCredentials(): { keyId: string; keySecret: string } {
  const liveKeyId = process.env.RAZORPAY_LIVE_API_KEY?.trim();
  const liveKeySecret = process.env.RAZORPAY_LIVE_KEY_SECRET?.trim();
  if (liveKeyId && liveKeySecret) {
    return { keyId: liveKeyId, keySecret: liveKeySecret };
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  return { keyId, keySecret };
}
