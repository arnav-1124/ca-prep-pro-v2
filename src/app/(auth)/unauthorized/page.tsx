import type { Metadata } from "next";
import UnauthorizedPage from "@/app/unauthorized";

export const metadata: Metadata = {
  title: "Authentication Required | CA Prep Pro",
  description: "Sign in to access your CA exam preparation dashboard, practice questions, and mock tests.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <UnauthorizedPage />;
}
