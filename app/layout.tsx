import type { Metadata, Viewport } from "next";
import SiteHeader from "@/components/site-header";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import { DEMO_MODE } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RefurbCompare — Compare Refurbished Smartphone Prices in India",
    template: "%s · RefurbCompare",
  },
  description:
    "RefurbCompare compares refurbished smartphone offers from third-party sellers across India so you can find the best price. Independent comparison — we never sell devices ourselves.",
  keywords: [
    "refurbished phones",
    "refurbished smartphone",
    "iPhone refurbished price",
    "Samsung refurbished",
    "compare refurbished phone prices India",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1512" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="pb-16 md:pb-0">
        <SiteHeader />
        <main>{children}</main>
        <Footer />
        <MobileBottomNav />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t bg-[var(--surface)]">
      <div className="container grid gap-8 py-10 md:grid-cols-4">
        <div>
          <p className="text-lg font-bold text-[var(--color-brand-700)] dark:text-brand-300">
            RefurbCompare
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Refurbished smartphone price comparison for India.
          </p>
        </div>

        <FooterLinks
          title="Compare"
          links={[
            ["All Phones", "/phones"],
            ["Best Deals", "/deals"],
            ["Price History", "/price-history"],
            ["Guides", "/guides"],
          ]}
        />

        <FooterLinks
          title="Company"
          links={[
            ["About", "/about"],
            ["How it Works", "/how-it-works"],
            ["Contact", "/about#contact"],
          ]}
        />

        <FooterLinks
          title="Legal"
          links={[
            ["Privacy Policy", "/privacy"],
            ["Terms of Use", "/terms"],
            ["Disclaimers", "/disclaimer"],
          ]}
        />
      </div>

      <div className="border-t border-[var(--border)] py-6">
        <div className="container space-y-3 text-xs text-[var(--text-muted)]">
          <p>
            RefurbCompare is an independent comparison platform and is not
            affiliated with any seller unless explicitly stated.
          </p>
          <p>
            {DEMO_MODE
              ? "Demo mode: listings shown are sample data. Live availability and pricing are not claimed."
              : "Prices and availability are supplied by third-party sellers and may change at any time."}
          </p>
          <p>© {new Date().getFullYear()} RefurbCompare</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
        {links.map(([label, href]) => (
          <li key={href}>
            <a className="hover:underline" href={href}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}