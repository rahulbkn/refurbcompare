"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Smartphone, Tag, BookOpen } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/phones", label: "Phones", icon: Smartphone },
  { href: "/deals", label: "Deals", icon: Tag },
  { href: "/guides", label: "Guides", icon: BookOpen },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--surface)] md:hidden">
      <div className="grid grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active
                  ? "text-[var(--color-brand-600)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
