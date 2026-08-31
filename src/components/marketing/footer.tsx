import { GraduationCap } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg tracking-tight text-foreground">
                CA Prep Pro
              </span>
            </div>
            <p className="text-xs leading-relaxed">
              The serious study companion for CA Foundation, Intermediate, and Final preparation.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground mb-4">Product</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground mb-4">Syllabus</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/syllabus" className="hover:text-foreground transition-colors">CA Foundation</Link>
              </li>
              <li>
                <Link href="/syllabus" className="hover:text-foreground transition-colors">CA Intermediate</Link>
              </li>
              <li>
                <Link href="/syllabus" className="hover:text-foreground transition-colors">CA Final</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-muted-foreground/60">Privacy Policy</span>
              </li>
              <li>
                <span className="text-muted-foreground/60">Terms of Service</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6 text-center text-xs">
          <p>&copy; {new Date().getFullYear()} CA Prep Pro. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
