"use client";

import { cn } from "@/lib/utils";
import { type Locale, useI18n } from "@/lib/i18n-context";

const LOCALES: { code: Locale; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "ar", label: "ع" },
];

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className={cn(
        "flex items-center rounded-md border bg-background p-0.5",
        className
      )}
    >
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          className={cn(
            "rounded px-2 py-1 text-xs font-semibold transition-colors leading-none",
            locale === code
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={locale === code}
          aria-label={code.toUpperCase()}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
