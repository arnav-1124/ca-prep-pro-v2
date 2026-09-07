import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function testDatabase() {
  try {
    const res = await db.execute(sql`SELECT 1 as connected;`);
    return { success: true, message: "Database connected successfully (Neon PostgreSQL)." };
  } catch (err: any) {
    return { success: false, message: `Database error: ${err.message}` };
  }
}

async function testClerk() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { success: false, message: "CLERK_SECRET_KEY is not set." };

  try {
    const res = await fetch("https://api.clerk.com/v1/users?limit=1", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    if (res.ok) {
      return { success: true, message: "Clerk Secret Key is valid and authenticated." };
    } else {
      const body = await res.text();
      return { success: false, message: `Clerk authentication failed (Status ${res.status}): ${body}` };
    }
  } catch (err: any) {
    return { success: false, message: `Clerk network error: ${err.message}` };
  }
}

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, message: "GEMINI_API_KEY is not set." };

  try {
    // Test using standard Gemini Generative Language API endpoint
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: `Gemini API key is valid. Accessible models: ${data.models?.length || 0}` };
    } else {
      const body = await res.text();
      return { success: false, message: `Gemini API key failed (Status ${res.status}): ${body}` };
    }
  } catch (err: any) {
    return { success: false, message: `Gemini network error: ${err.message}` };
  }
}

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { success: false, message: "OPENROUTER_API_KEY is not set." };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message: `OpenRouter API key is valid. Label: ${data.data?.label || "active"}, Usage: $${data.data?.usage || 0}, Limit: ${data.data?.limit === null ? "unlimited" : data.data?.limit}`,
      };
    } else {
      const body = await res.text();
      return { success: false, message: `OpenRouter API failed (Status ${res.status}): ${body}` };
    }
  } catch (err: any) {
    return { success: false, message: `OpenRouter network error: ${err.message}` };
  }
}

async function testRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return { success: false, message: "Razorpay credentials not set." };

  try {
    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/plans?count=1", {
      headers: {
        Authorization: authHeader,
      },
    });
    if (res.ok) {
      return { success: true, message: "Razorpay API credentials are valid and active." };
    } else {
      const body = await res.text();
      return { success: false, message: `Razorpay authentication failed (Status ${res.status}): ${body}` };
    }
  } catch (err: any) {
    return { success: false, message: `Razorpay network error: ${err.message}` };
  }
}

async function main() {
  console.log("=== VERIFYING API KEYS & SERVICES FROM .env.local ===\n");

  const dbRes = await testDatabase();
  console.log(`[Database]:   ${dbRes.success ? "✅ VALID" : "❌ FAILED"} - ${dbRes.message}`);

  const clerkRes = await testClerk();
  console.log(`[Clerk Auth]: ${clerkRes.success ? "✅ VALID" : "❌ FAILED"} - ${clerkRes.message}`);

  const orRes = await testOpenRouter();
  console.log(`[OpenRouter]: ${orRes.success ? "✅ VALID" : "❌ FAILED"} - ${orRes.message}`);

  const geminiRes = await testGemini();
  console.log(`[Gemini AI]:  ${geminiRes.success ? "✅ VALID" : "❌ FAILED"} - ${geminiRes.message}`);

  const rpRes = await testRazorpay();
  console.log(`[Razorpay]:   ${rpRes.success ? "✅ VALID" : "❌ FAILED"} - ${rpRes.message}`);

  console.log("\n=====================================================");
}

main().catch(console.error);
