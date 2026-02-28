"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { register as apiRegister, ApiError } from "@/lib/api";
import { registerSchema, type RegisterFormValues } from "@/lib/schemas";
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

const DEPARTMENTS: { value: string; labelKey: string }[] = [
  { value: "Computer Science",       labelKey: "departments.cs" },
  { value: "Electronic Systems",     labelKey: "departments.es" },
  { value: "Telecommunications",     labelKey: "departments.tc" },
  { value: "Industrial Maintenance", labelKey: "departments.im" },
  { value: "Automation",             labelKey: "departments.aut" },
  { value: "Industrial Computing",   labelKey: "departments.ic" },
  { value: "Electromechanics",       labelKey: "departments.em" },
];

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterFormValues) {
    setLoading(true);
    try {
      await apiRegister({
        email: values.email,
        password: values.password,
        full_name: values.fullName,
        role: "student",
        student_id: values.studentId,
        department: values.department,
      });

      toast.success(t("register.successMsg"), { duration: 6000 });
      router.push("/login");
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t("register.errorGeneric");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
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
          {t("register.pageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("register.pageSubtitle")}
        </p>
      </div>

      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl">{t("register.cardTitle")}</CardTitle>
          <CardDescription>{t("register.cardDesc")}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            {/* Full name */}
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-medium">
                {t("register.fullName")}
              </label>
              <Input
                id="fullName"
                placeholder={t("register.fullNamePlaceholder")}
                autoComplete="name"
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-xs text-destructive">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Student ID */}
            <div className="space-y-1.5">
              <label htmlFor="studentId" className="text-sm font-medium">
                {t("register.studentId")}
              </label>
              <Input
                id="studentId"
                placeholder={t("register.studentIdPlaceholder")}
                autoComplete="off"
                {...register("studentId")}
              />
              {errors.studentId && (
                <p className="text-xs text-destructive">
                  {errors.studentId.message}
                </p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <label htmlFor="department" className="text-sm font-medium">
                {t("register.department")}
              </label>
              <select
                id="department"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue=""
                {...register("department")}
              >
                <option value="" disabled>{t("register.selectDept")}</option>
                {DEPARTMENTS.map(({ value, labelKey }) => (
                  <option key={value} value={value}>{t(labelKey)}</option>
                ))}
              </select>
              {errors.department && (
                <p className="text-xs text-destructive">
                  {errors.department.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                {t("register.email")}
              </label>
              <Input
                id="email"
                type="email"
                placeholder={t("register.emailPlaceholder")}
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                {t("register.password")}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("register.passwordPlaceholder")}
                  autoComplete="new-password"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? t("register.hidePassword") : t("register.showPassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                {t("register.confirmPassword")}
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder={t("register.repeatPassword")}
                  autoComplete="new-password"
                  className="pr-10"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? t("register.hidePassword") : t("register.showPassword")}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? t("register.submitting") : t("register.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("register.hasAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("register.signIn")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
