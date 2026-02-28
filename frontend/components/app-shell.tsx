"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, LogIn, LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { t } = useI18n();

  const displayName: string =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    toast.success(t("nav.signOut"));
    router.push("/");
    router.refresh();
  }

  // Auth pages render bare (no shell)
  const isAuthPage = ["/login", "/register", "/reset-password"].includes(pathname);
  if (isAuthPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">ISITCOM UniHelp</span>
            <span className="sm:hidden">UniHelp</span>
          </Link>

          {/* Right side: locale switcher + theme + auth */}
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />

            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                      title={user.email ?? ""}
                    >
                      {initials || "?"}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("nav.signOut")}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/login" className="gap-1.5">
                        <LogIn className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("nav.signIn")}</span>
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href="/register" className="gap-1.5">
                        <UserPlus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("nav.register")}</span>
                      </Link>
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</main>

      <footer className="border-t bg-card px-4 py-3 text-center text-sm text-muted-foreground">
        {t("footer.text")} &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
