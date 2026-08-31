import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define paths requiring authenticated access
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/practice(.*)",
  "/tests(.*)",
  "/progress(.*)",
  "/ai(.*)",
  "/profile(.*)",
  "/admin(.*)",
]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpeg|jpg|png|gif|svg|ico|csv|docx|pdf|xlsx|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk auto-proxy path for *.vercel.app production domain
    "/__clerk/:path*",
  ],
};
