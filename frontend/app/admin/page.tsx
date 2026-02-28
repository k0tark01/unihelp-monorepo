"use client";

import { useEffect, useRef, useState } from "react";
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
const ACCEPTED = ".pdf,.txt,.md";

type UploadResult = {
  file: string;
  title?: string;
  file_url?: string | null;
  error?: string;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function FileIcon({ ext }: { ext: string }) {
  const colors: Record<string, string> = { pdf: "text-red-500", txt: "text-blue-500", md: "text-purple-500" };
  return <span className={`text-xs font-bold uppercase ${colors[ext] ?? "text-muted-foreground"}`}>{ext}</span>;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [documents, setDocuments] = useState<UniversityDocument[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (!adminPass) { toast.error(t("admin.missingPass")); return; }
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

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const allowed = Array.from(incoming).filter((f) =>
      /\.(pdf|txt|md)$/i.test(f.name),
    );
    const rejected = Array.from(incoming).length - allowed.length;
    if (rejected > 0) toast.warning(`${rejected} file(s) ignored — only PDF, TXT, MD allowed`);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...allowed.filter((f) => !names.has(f.name))];
    });
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const onUpload = async () => {
    if (files.length === 0) { toast.error(t("admin.pleaseSelectPDF")); return; }
    try {
      setIsUploading(true);
      setUploadResults([]);
      setError(null);
      const raw = await uploadDocuments(files) as {
        uploaded?: UploadResult[];
        errors?: UploadResult[];
      };
      const results: UploadResult[] = [
        ...(raw.uploaded ?? []),
        ...(raw.errors ?? []),
      ];
      setUploadResults(results);
      const ok = (raw.uploaded ?? []).length;
      const fail = (raw.errors ?? []).length;
      if (ok > 0) toast.success(`${ok} file${ok > 1 ? "s" : ""} uploaded successfully`);
      if (fail > 0) toast.error(`${fail} file${fail > 1 ? "s" : ""} failed`);
      setFiles([]);
      await loadAdminData();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("admin.uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
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
          <CardHeader><CardTitle>{t("admin.accessTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder={t("admin.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") unlock(); }}
            />
            <Button onClick={unlock} className="w-full">{t("admin.unlock")}</Button>
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
          {/* ── Upload card ── */}
          <Card>
            <CardHeader><CardTitle>{t("admin.uploadTitle")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">

              {/* Drop zone */}
              <div
                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer
                  ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
              >
                <svg className="mb-2 h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-muted-foreground">
                  Drag &amp; drop files here, or <span className="text-primary underline">browse</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">PDF · TXT · MD</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>

              {/* Selected files list */}
              {files.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {files.length} file{files.length > 1 ? "s" : ""} selected
                  </p>
                  {files.map((f) => {
                    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
                    const sizeMb = (f.size / 1024 / 1024).toFixed(2);
                    return (
                      <div key={f.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 truncate">
                          <FileIcon ext={ext} />
                          <span className="truncate">{f.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{sizeMb} MB</span>
                        </div>
                        <button
                          type="button"
                          className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={onUpload} disabled={isUploading || files.length === 0}>
                  {isUploading ? "Uploading…" : t("admin.uploadBtn")}
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={isLoading}>{t("admin.reindex")}</Button>
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

              {/* Upload results */}
              {uploadResults.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upload results</p>
                  {uploadResults.map((r) => (
                    <div key={r.file} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm
                      ${r.error ? "border-destructive/40 bg-destructive/5" : "border-green-500/40 bg-green-500/5"}`}>
                      <div className="flex items-center gap-2 truncate">
                        <span>{r.error ? "✕" : "✓"}</span>
                        <span className="truncate">{r.file}</span>
                        {r.error && <span className="text-xs text-destructive">{r.error}</span>}
                      </div>
                      {r.file_url && (
                        <a
                          href={r.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 shrink-0 text-xs text-primary underline hover:no-underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View file ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Documents list ── */}
          <Card>
            <CardHeader><CardTitle>{t("admin.indexedDocs")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.noDocs")}</p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{doc.title}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{doc.status}</Badge>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline hover:no-underline"
                            >
                              Download ↗
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("admin.uploaded")} {formatDate(doc.uploaded_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader><CardTitle>{t("admin.apiHealth")}</CardTitle></CardHeader>
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