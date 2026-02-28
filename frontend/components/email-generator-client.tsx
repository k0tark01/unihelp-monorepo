"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { LanguageSelect } from "@/components/language-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { generateEmail } from "@/lib/api";
import { emailFormSchema } from "@/lib/schemas";
import { EmailFormValues, EmailType, GeneratedEmail, Language } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";

const emailTypeOptions: EmailType[] = [
  "attestation_request",
  "grade_complaint",
  "internship_request",
  "absence_justification",
  "scholarship_request",
];

const isEmailType = (value: string): value is EmailType =>
  emailTypeOptions.includes(value as EmailType);

type EmailGeneratorClientProps = {
  templateKey?: string;
};

export function EmailGeneratorClient({ templateKey }: EmailGeneratorClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [language, setLanguage] = useState<Language>("fr");
  const [emailType, setEmailType] = useState<EmailType>("attestation_request");
  const [generated, setGenerated] = useState<GeneratedEmail | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  // Auth guard — redirect to /login if not signed in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      fullName: "",
      studentId: "",
      department: "",
      level: "",
      reason: "",
      recipientOffice: "",
    },
  });

  useEffect(() => {
    if (templateKey && isEmailType(templateKey)) {
      setEmailType(templateKey);
    }
  }, [templateKey]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await generateEmail({
        type: emailType,
        language,
        data: values,
      });

      setGenerated(response);
      toast.success(t("emailGen.generated"));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("emailGen.error");
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  });

  const downloadContent = useMemo(() => {
    if (!generated) {
      return "";
    }

    return `Subject: ${generated.subject}\n\n${generated.body}`;
  }, [generated]);

  const handleCopy = async (value: string, labelKey: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${t(labelKey)} ${t("emailGen.copiedLabel")}`);
    } catch {
      toast.error(t("emailGen.copyFailed"));
    }
  };

  const handleDownload = () => {
    if (!downloadContent) {
      return;
    }

    const blob = new Blob([downloadContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `email-${emailType}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Don't render form until auth is confirmed
  if (authLoading || !user) return null;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t("emailGen.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {error ? <ApiErrorAlert message={error} /> : null}

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("emailGen.emailType")}</label>
              <Select value={emailType} onValueChange={(value) => isEmailType(value) && setEmailType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("emailGen.selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {emailTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`emailTypes.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("emailGen.language")}</label>
              <LanguageSelect value={language} onValueChange={setLanguage} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("emailGen.fullName")}</label>
              <Input {...register("fullName")} />
              {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("emailGen.studentId")}</label>
              <Input {...register("studentId")} />
              {errors.studentId ? <p className="text-xs text-destructive">{errors.studentId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("emailGen.department")}</label>
              <Input {...register("department")} />
              {errors.department ? <p className="text-xs text-destructive">{errors.department.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("emailGen.level")}</label>
              <Input {...register("level")} />
              {errors.level ? <p className="text-xs text-destructive">{errors.level.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("emailGen.recipientOffice")}</label>
              <Input {...register("recipientOffice")} />
              {errors.recipientOffice ? <p className="text-xs text-destructive">{errors.recipientOffice.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("emailGen.reason")}</label>
              <Textarea rows={4} {...register("reason")} />
              {errors.reason ? <p className="text-xs text-destructive">{errors.reason.message}</p> : null}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("emailGen.generating") : t("emailGen.generate")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("emailGen.previewTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!generated ? (
            <p className="text-sm text-muted-foreground">{t("emailGen.previewEmpty")}</p>
          ) : (
            <>
              <div className="rounded-md border p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("emailGen.subject")}</p>
                <p className="text-sm">{generated.subject}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("emailGen.body")}</p>
                <p className="whitespace-pre-wrap text-sm">{generated.body}</p>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleCopy(generated.subject, "emailGen.subject")}>
                  {t("emailGen.copySubject")}
                </Button>
                <Button variant="outline" onClick={() => handleCopy(generated.body, "emailGen.body")}>
                  {t("emailGen.copyBody")}
                </Button>
                <Button onClick={handleDownload}>{t("emailGen.download")}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}