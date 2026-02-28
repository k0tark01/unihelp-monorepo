"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDocuments, getHealth, reindexDocuments, uploadDocuments } from "@/lib/api";
import { HealthResponse, UniversityDocument } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";

const ADMIN_UNLOCK_KEY = "unihelp-admin-unlocked";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [documents, setDocuments] = useState<UniversityDocument[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const { t } = useI18n();

  const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASS;

  const loadAdminData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [docsResponse, healthResponse] = await Promise.all([getDocuments(), getHealth()]);
      setDocuments(docsResponse.documents);
      setHealth(healthResponse);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("admin.loadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unlocked = sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "true";
    if (unlocked) {
      setIsUnlocked(true);
      void loadAdminData();
    }
  }, []);

  const unlock = () => {
    if (!adminPass) {
      toast.error(t("admin.missingPass"));
      return;
    }

    if (password === adminPass) {
      sessionStorage.setItem(ADMIN_UNLOCK_KEY, "true");
      setIsUnlocked(true);
      setPassword("");
      toast.success(t("admin.unlocked"));
      void loadAdminData();
      return;
    }

    toast.error(t("admin.invalidPass"));
  };

  const onUpload = async () => {
    if (files.length === 0) {
      toast.error(t("admin.pleaseSelectPDF"));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await uploadDocuments(files);
      setFiles([]);
      toast.success(t("admin.uploadSuccess"));
      await loadAdminData();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("admin.uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onReindex = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await reindexDocuments();
      toast.success(t("admin.reindexStarted"));
      await loadAdminData();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("admin.reindexFailed");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.accessTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder={t("admin.passwordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button onClick={unlock} className="w-full">
              {t("admin.unlock")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {error ? <ApiErrorAlert message={error} /> : null}

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">{t("admin.documents")}</TabsTrigger>
          <TabsTrigger value="health">{t("admin.health")}</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.uploadTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="file"
                multiple
                accept="application/pdf"
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={onUpload} disabled={isLoading}>
                  {t("admin.uploadBtn")}
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={isLoading}>
                      {t("admin.reindex")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("admin.reindexTitle")}</DialogTitle>
                      <DialogDescription>{t("admin.reindexDesc")}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button onClick={onReindex}>{t("admin.confirm")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="secondary" onClick={() => void loadAdminData()} disabled={isLoading}>
                  {t("admin.refresh")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.indexedDocs")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.noDocs")}</p>
                ) : (
                  documents.map((document) => (
                    <div key={document.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{document.title}</p>
                        <Badge variant="secondary">{document.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t("admin.uploaded")} {formatDate(document.uploaded_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.apiHealth")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t("admin.status")}</span>
                <Badge variant={health?.status === "ok" ? "default" : "destructive"}>
                  {health?.status ?? t("admin.unknown")}
                </Badge>
              </div>
              {health?.message ? <p className="text-sm text-muted-foreground">{health.message}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}