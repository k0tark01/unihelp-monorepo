"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  Languages,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ApiErrorAlert } from "@/components/api-error-alert";
import { ChatMessage } from "@/components/chat-message";
import { LanguageSelect } from "@/components/language-select";
import { LoadingSkeletons } from "@/components/loading-skeleton";
import { SourceList } from "@/components/source-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { chat } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { ChatMessageItem, Language } from "@/lib/types";

const SESSION_KEY = "unihelp-session-id";
const MESSAGES_KEY = "unihelp-chat-messages";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AssistantPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const [sessionId, setSessionId] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const FEATURES = [
    { icon: BookOpen,      titleKey: "features.docs.title",         descKey: "features.docs.desc" },
    { icon: MessageSquare, titleKey: "features.answers.title",      descKey: "features.answers.desc" },
    { icon: FileText,      titleKey: "features.email.title",        descKey: "features.email.desc" },
    { icon: Languages,     titleKey: "features.multilingual.title", descKey: "features.multilingual.desc" },
  ];

  const SUGGESTIONS = [
    t("suggestions.s0"),
    t("suggestions.s1"),
    t("suggestions.s2"),
    t("suggestions.s3"),
  ];

  useEffect(() => {
    const existingSession = localStorage.getItem(SESSION_KEY);
    const existingMessages = localStorage.getItem(MESSAGES_KEY);
    if (existingSession) {
      setSessionId(existingSession);
    } else {
      const newSession = generateSessionId();
      localStorage.setItem(SESSION_KEY, newSession);
      setSessionId(newSession);
    }
    if (existingMessages) {
      try {
        const parsed = JSON.parse(existingMessages) as ChatMessageItem[];
        setMessages(parsed);
      } catch {
        localStorage.removeItem(MESSAGES_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const canSend = useMemo(
    () => !isLoading && question.trim().length > 0 && sessionId.length > 0,
    [isLoading, question, sessionId]
  );

  const handleClear = () => {
    setMessages([]);
    setError(null);
    localStorage.removeItem(MESSAGES_KEY);
    toast.success(t("chat.cleared"));
  };

  const handleCopyAnswer = async (answer: string) => {
    try {
      await navigator.clipboard.writeText(answer);
      toast.success(t("chat.copied"));
    } catch {
      toast.error(t("chat.copyFailed"));
    }
  };

  const handleSend = async (overrideQuestion?: string) => {
    const prompt = (overrideQuestion ?? question).trim();
    if (!prompt || isLoading || !sessionId) return;

    setQuestion("");
    setError(null);
    setIsLoading(true);

    const userMessage: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await chat({ sessionId, question: prompt, language });
      const assistantMessage: ChatMessageItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        actions: response.actions,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toast.chatError");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Hero */}
      {!hasMessages && (
        <section className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-primary shadow-sm">
            <Sparkles className="h-4 w-4" />
            {t("hero.badge")}
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {t("hero.title")}
            <span className="block text-primary">{t("hero.titleSpan")}</span>
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mb-1 text-sm font-semibold">{t(titleKey)}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t("hero.trust")}
          </div>
        </section>
      )}

      {/* Chat area */}
      {hasMessages && (
        <Card className="mb-4">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">
                {messages.length}{" "}{messages.length === 1 ? t("chat.messages_one") : t("chat.messages_other")}
              </p>
              <Button variant="ghost" size="sm" onClick={handleClear} disabled={isLoading}>
                {t("chat.clear")}
              </Button>
            </div>
            <ScrollArea className="h-[55vh] p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-3">
                    <ChatMessage role={message.role} content={message.content} />
                    {message.role === "assistant" && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => handleCopyAnswer(message.content)}>
                          {t("chat.copyAnswer")}
                        </Button>
                        {message.actions?.map((action, index) => {
                          if (action.type !== "EMAIL_TEMPLATE") return null;
                          return (
                            <Button key={`${action.templateKey}-${index}`} variant="outline" size="sm"
                              onClick={() => router.push(`/email?templateKey=${encodeURIComponent(action.templateKey)}`)}
                            >
                              {t("chat.generateEmail")}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                    {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}
                    <Separator />
                  </div>
                ))}
                {isLoading && <LoadingSkeletons />}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Input — auth gated */}
      {!authLoading && !user ? (
        <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="mb-2 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <h3 className="mb-1 font-semibold">{t("authGate.title")}</h3>
          <p className="mb-4 text-sm text-muted-foreground">{t("authGate.desc")}</p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => router.push("/login")} className="gap-1.5">{t("authGate.signIn")}</Button>
            <Button variant="outline" onClick={() => router.push("/register")}>{t("authGate.createAccount")}</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          {error && <ApiErrorAlert message={error} />}
          {!hasMessages && (
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => handleSend(s)} disabled={isLoading}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-3">
            <Textarea
              placeholder={t("chat.placeholder")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              disabled={isLoading}
              className="resize-none flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <div className="flex flex-col items-end gap-2">
              <LanguageSelect value={language} onValueChange={setLanguage} />
              <Button onClick={() => handleSend()} disabled={!canSend} className="gap-1.5">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("chat.send")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
