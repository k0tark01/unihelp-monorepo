"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/lib/i18n-context";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t("resetPassword.emailSent"));
    setSent(true);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Controls top-right */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold leading-tight">
          {t("resetPassword.pageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("resetPassword.pageSubtitle")}
        </p>
      </div>

      <Card className="w-full max-w-sm shadow-lg">
        {!sent ? (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl">
                {t("resetPassword.cardTitle")}
              </CardTitle>
              <CardDescription>{t("resetPassword.cardDesc")}</CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit} noValidate>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium leading-none"
                  >
                    {t("resetPassword.email")}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("resetPassword.emailPlaceholder")}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {loading
                    ? t("resetPassword.submitting")
                    : t("resetPassword.submit")}
                </Button>
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("resetPassword.backToLogin")}
                </Link>
              </CardFooter>
            </form>
          </>
        ) : (
          <>
            <CardHeader className="space-y-1 pb-4">
              <div className="mb-2 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MailCheck className="h-6 w-6" />
                </div>
              </div>
              <CardTitle className="text-center text-xl">
                {t("resetPassword.successTitle")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("resetPassword.successDesc")}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  {t("resetPassword.backToLogin")}
                </Button>
              </Link>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
