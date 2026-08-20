import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this page right now. Please try again shortly.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-14 text-center dark:border-red-900 dark:bg-red-950/40"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300">
        <ShieldAlert size={24} />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-[var(--text-muted)]">{message}</p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-700)]"
      >
        Back to home
      </Link>
    </div>
  );
}