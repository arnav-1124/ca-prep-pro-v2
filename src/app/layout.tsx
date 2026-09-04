import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | CA Prep Pro",
    default: "CA Prep Pro - Premium CA Preparation Platform",
  },
  description: "The serious preparation platform for CA exams. Access MCQ practice, case studies, tests, analytics, and attempt-aware progress tracking across CA Foundation, Intermediate, and Final levels.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "CA Prep Pro - Premium CA Preparation Platform",
    description: "Prepare for CA Foundation, Intermediate, and Final exams with MCQs, case-studies, advanced progress tracking, and AI prediction.",
    url: "/",
    siteName: "CA Prep Pro",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CA Prep Pro",
    description: "Prepare for CA Foundation, Intermediate, and Final exams with MCQs, case-studies, advanced progress tracking, and AI prediction.",
  },
};

import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistMono.variable, geistSans.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}