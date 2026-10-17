import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16+ uses proxy convention instead of middleware.
// Clerk now recommends resource-based auth checks rather than route matchers.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
