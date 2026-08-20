"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell } from "lucide-react";
import { useState } from "react";
import { createPriceAlertSchema, type CreatePriceAlert } from "@/lib/validation";

// No email provider is wired up yet, so alerts are stored but not delivered.
// Flip to true only when a real notification provider (email/SMS/push) is
// configured and tested end-to-end.
const NOTIFICATIONS_ENABLED = false;

export default function PriceAlertForm({
  productId,
  currentBestPrice,
}: {
  productId: string;
  currentBestPrice?: number;
}) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePriceAlert>({
    resolver: zodResolver(createPriceAlertSchema),
    defaultValues: {
      productId,
      targetPrice: currentBestPrice ? Math.round(currentBestPrice * 0.95) : undefined,
    },
  });

  async function onSubmit(data: CreatePriceAlert) {
    setStatus("idle");
    try {
      const response = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (body?.error && response.status === 409) {
          setStatus("error");
          return;
        }
        throw new Error(body?.error ?? "Request failed");
      }
      setStatus("success");
      reset({ productId, targetPrice: data.targetPrice });
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <h3 className="flex items-center gap-2 font-semibold">
        <Bell size={16} className="text-[var(--color-brand-600)]" />
        Price drop alert
      </h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        We&apos;ll email you when any seller matches your target price.
      </p>

      <input type="hidden" {...register("productId")} />

      <div className="mt-3 space-y-2">
        <input
          type="email"
          placeholder="you@example.com"
          aria-label="Email address"
          {...register("email")}
          className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            type="number"
            placeholder="Target price (₹)"
            aria-label="Target price in rupees"
            {...register("targetPrice")}
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-700)] disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
        {(errors.email || errors.targetPrice) && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.email?.message ?? errors.targetPrice?.message ?? "Please check your inputs."}
          </p>
        )}
        {status === "success" && (
          <p className="text-xs font-medium text-[var(--color-brand-700)] dark:text-brand-300">
            {NOTIFICATIONS_ENABLED
              ? "Price alert saved. We&apos;ll notify you when the price matches."
              : "Price alert is saved; notifications are not currently enabled."}
          </p>
        )}
        {status === "error" && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            That alert already exists for this email. You&apos;ll still hear from us when the price matches.
          </p>
        )}
      </div>
    </form>
  );
}