import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app/app-sidebar";
import { TopBar } from "@/components/app/top-bar";
import { DemoBanner } from "@/components/app/demo-banner";
import { AppActionsProvider } from "@/components/app/app-actions";
import { DataSourceProvider } from "@/lib/data-source-provider";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { api } from "@/lib/api";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ExamFlow — Exam scheduling & operations" },
      {
        name: "description",
        content: "Intelligent examination scheduling and operations platform.",
      },
      { property: "og:title", content: "ExamFlow" },
      {
        property: "og:description",
        content: "Intelligent examination scheduling and operations platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:site_name", content: "ExamFlow" },
      { name: "application-name", content: "ExamFlow" },
      { name: "theme-color", content: "#0f1424" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [authState, setAuthState] = useState<"loading" | "disabled" | "login" | "authenticated">("loading");
  const [authUser, setAuthUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api.authConfig().then(async (config) => {
      if (!active) return;
      if (!config.enabled) { setAuthState("disabled"); return; }
      try {
        const user = await api.me();
        if (active) { setAuthUser(user); setAuthState("authenticated"); }
      } catch {
        if (active) setAuthState("login");
      }
    }).catch(() => {
      if (active) setAuthState("login");
    });
    return () => { active = false; };
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setAuthError("");
    try {
      const user = await api.login(email, password);
      setAuthUser(user);
      setAuthState("authenticated");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authState === "loading") return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading ExamFlow…</div>;
  if (authState === "login") return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submitLogin} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">ExamFlow secure access</p><h1 className="mt-2 text-3xl font-bold text-foreground">Sign in</h1><p className="mt-2 text-sm text-muted-foreground">Use your university operations account.</p></div>
        <label className="block space-y-2 text-sm font-medium text-foreground">Email<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
        <label className="block space-y-2 text-sm font-medium text-foreground">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
        {authError && <p role="alert" className="text-sm text-destructive">{authError}</p>}
        <button disabled={submitting} className="w-full rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">{submitting ? "Signing in…" : "Sign in securely"}</button>
      </form>
    </div>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        <TooltipProvider delayDuration={200}>
          <AppActionsProvider>
            <SidebarProvider>
              <div className="flex min-h-screen w-full">
                <AppSidebar />
                <SidebarInset className="min-w-0 bg-transparent">
                  <div className="flex items-center justify-end gap-3 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
                    {authUser && <span>{authUser.email} · {authUser.role}</span>}
                    {authState === "authenticated" && <button onClick={() => { api.logout(); setAuthUser(null); setAuthState("login"); }} className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent">Sign out</button>}
                  </div>
                  <TopBar />
                  <DemoBanner />
                  <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 md:px-6 lg:px-8">
                    <Outlet />
                  </main>
                </SidebarInset>
              </div>
            </SidebarProvider>
          </AppActionsProvider>
        </TooltipProvider>
        <Toaster richColors position="bottom-right" />
      </DataSourceProvider>
    </QueryClientProvider>
  );
}