import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { ProductPreview } from "./product-preview";

interface HeroProps {
  isAuthenticated: boolean;
}

export function Hero({ isAuthenticated }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero text */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground leading-none">
              Prepare smarter for your <span className="text-primary">CA exams</span>.
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Practice questions, understand difficult concepts, track your preparation, and stay focused on your CA attempt — all in one place.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row justify-center lg:justify-start items-center gap-4">
              <Link href={isAuthenticated ? "/dashboard" : "/sign-up"}>
                <Button size="lg" className="w-full sm:w-auto gap-2 cursor-pointer text-base">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto cursor-pointer text-base">
                  Explore Features
                </Button>
              </a>
            </div>
          </div>

          {/* Product Preview */}
          <div className="lg:col-span-5">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl -z-10" />
              <ProductPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
