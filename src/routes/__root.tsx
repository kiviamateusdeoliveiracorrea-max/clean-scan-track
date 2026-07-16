import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertTriangle,
  MapPin,
  UserCog,
  History,
  Menu,
  X,
  Boxes,
  Users,
  LogOut,
} from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/intralog-logo.png.asset.json";
import { getMyRoles, type AppRole } from "@/lib/users.functions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Erro ao carregar a página</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AuditLog 5S — Auditoria de Housekeeping Logístico" },
      {
        name: "description",
        content:
          "Plataforma de auditoria 5S e processos para operações logísticas: não conformidades, planos de ação, fotos e indicadores.",
      },
      { property: "og:title", content: "AuditLog 5S — Auditoria de Housekeeping Logístico" },
      {
        property: "og:description",
        content: "Plataforma de auditoria 5S e processos para operações logísticas: não conformidades, planos de ação, fotos e indicadores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AuditLog 5S — Auditoria de Housekeeping Logístico" },
      { name: "twitter:description", content: "Plataforma de auditoria 5S e processos para operações logísticas: não conformidades, planos de ação, fotos e indicadores." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/05c37092-f008-48fe-a140-079199af8231/id-preview-b2dfa49e--e5f87ba2-a049-45ed-aa3e-e9188999c1f2.lovable.app-1784209071403.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/05c37092-f008-48fe-a140-079199af8231/id-preview-b2dfa49e--e5f87ba2-a049-45ed-aa3e-e9188999c1f2.lovable.app-1784209071403.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
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

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/auditorias", label: "Auditorias", icon: ClipboardCheck },
  { to: "/nao-conformidades", label: "Não Conformidades", icon: AlertTriangle },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/areas", label: "Áreas", icon: MapPin },
  { to: "/auditores", label: "Auditores", icon: UserCog },
  { to: "/usuarios", label: "Usuários", icon: Users },
];

function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const navigate = useNavigate();

  // Página de login: renderiza sem shell
  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/auth/");

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUserEmail(session?.user?.email ?? null);
      router.invalidate();
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const { data: rolesData } = useQuery({
    queryKey: ["my-roles", userEmail],
    queryFn: () => getMyRoles(),
    enabled: !!userEmail && !isAuthRoute,
  });
  const roles = (rolesData?.roles ?? []) as AppRole[];
  const isAdmin = roles.includes("administrador");

  const visibleNav = navItems.filter((it) => !it.adminOnly || isAdmin);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  if (!hydrated) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (isAuthRoute) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">AuditLog 5S</p>
            <p className="text-[11px] text-sidebar-foreground/60">Logística</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
          {userEmail && (
            <div className="px-2">
              <p className="text-xs text-sidebar-foreground/60">Conectado</p>
              <p className="text-xs font-medium truncate">{userEmail}</p>
              {roles.length > 0 && (
                <p className="text-[10px] text-sidebar-foreground/60 uppercase mt-0.5">
                  {roles.join(", ")}
                </p>
              )}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar text-sidebar-foreground flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Boxes className="h-5 w-5" />
                </div>
                <span className="font-bold">AuditLog 5S</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded hover:bg-sidebar-accent"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to, item.exact);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
              {userEmail && (
                <div className="px-2 text-xs">
                  <p className="text-sidebar-foreground/60">Conectado</p>
                  <p className="font-medium truncate">{userEmail}</p>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b bg-primary text-primary-foreground px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="p-1.5 rounded hover:bg-white/10"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded bg-accent text-accent-foreground">
                <Boxes className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm">AuditLog 5S</span>
            </div>
          </div>
          {userEmail && (
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded hover:bg-white/10"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </header>
        <div className="w-full bg-white border-b border-border">
          <img
            src={logoAsset.url}
            alt="Grupo JSL — Intralog, JSL Digital, Fadel, Trans Moreno, TPC Rodomeu, Marvel, Truckpad, IC Transportes, FSJ"
            className="mx-auto h-8 md:h-10 w-auto max-w-full object-contain py-2 px-4"
          />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
