import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ArrowLeft, Shield, Library, FilePlus, Upload, ClipboardList, Users, UserCog, MessageSquare, ShoppingBag, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { BulkImport } from "@/components/admin/BulkImport";
import { ManageAdmins } from "@/components/admin/ManageAdmins";
import { ManageUsers } from "@/components/admin/ManageUsers";
import { ManageQuestions } from "@/components/admin/ManageQuestions";
import { ManageSimulados } from "@/components/admin/ManageSimulados";
import { SupportMessages } from "@/components/admin/SupportMessages";
import { AccessRequests } from "@/components/admin/AccessRequests";
import { HotmartPurchases } from "@/components/admin/HotmartPurchases";
import { HotmartProducts } from "@/components/admin/HotmartProducts";
import { ManageExams } from "@/components/admin/ManageExams";

type Subject = { id: string; name: string; slug: string };
type Section = "editais" | "questions" | "bulk" | "simulados" | "users" | "admins" | "support" | "hotmart";

const sectionLabels: Record<Section, string> = {
  editais: "Editais",
  questions: "Questões",
  bulk: "Importar em Lote",
  simulados: "Simulados",
  users: "Usuários",
  admins: "Administradores",
  support: "Mensagens de Suporte",
  hotmart: "Compras Hotmart",
};

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, isDidacticAdmin, loading } = useProfile();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [active, setActive] = useState<Section>("questions");
  const [pendingSupport, setPendingSupport] = useState(0);

  useEffect(() => {
    if (!loading && !isAdmin && !isDidacticAdmin) navigate("/");
  }, [isAdmin, isDidacticAdmin, loading, navigate]);

  const reload = async () => {
    const { data: subs } = await supabase
      .from("subjects")
      .select("id, name, slug")
      .order("display_order");
    setSubjects((subs ?? []) as Subject[]);
  };

  const reloadPending = async () => {
    if (!isAdmin) return;
    const { count } = await (supabase as any)
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    setPendingSupport(count ?? 0);
  };

  useEffect(() => { reload(); }, []);
  useEffect(() => { reloadPending(); }, [isAdmin, active]);

  const renderContent = () => {
    switch (active) {
      case "editais": return <ManageExams />;
      case "questions": return <ManageQuestions />;
      case "bulk": return <BulkImport />;
      case "simulados": return <ManageSimulados />;
      case "users": return <ManageUsers />;
      case "hotmart": return (
        <div className="space-y-8">
          <HotmartProducts />
          <div className="border-t border-border pt-6">
            <HotmartPurchases />
          </div>
        </div>
      );
      case "admins": return <ManageAdmins />;
      case "support": return (
        <div className="space-y-8">
          <AccessRequests />
          <div className="border-t border-border pt-6">
            <SupportMessages />
          </div>
        </div>
      );
      default: return null;
    }
  };

  const handleNav = (section: Section) => {
    setActive(section);
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        {/* Desktop Sidebar */}
        <Sidebar collapsible="icon" className="hidden md:flex border-r border-border bg-card">
          <SidebarContent>
            <div className="px-4 pt-6 pb-2">
              <p className="stencil text-[10px] text-primary flex items-center gap-1">
                <Shield className="w-3 h-3" /> Admin
              </p>
              <h1 className="font-display text-sm font-bold mt-0.5">Painel</h1>
            </div>

            {/* Banco de Questões Group */}
            <SidebarGroup>
              <SidebarGroupLabel>Banco de Questões</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={active === "editais"} onClick={() => handleNav("editais")}>
                      <button className={cn("flex items-center gap-2", active === "editais" && "bg-primary/10 text-primary")}>
                        <GraduationCap className="h-4 w-4" />
                        <span>Editais</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={active === "questions"} onClick={() => handleNav("questions")}>
                      <button className={cn("flex items-center gap-2", active === "questions" && "bg-primary/10 text-primary")}>
                        <FilePlus className="h-4 w-4" />
                        <span>Cadastrar</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={active === "bulk"} onClick={() => handleNav("bulk")}>
                      <button className={cn("flex items-center gap-2", active === "bulk" && "bg-primary/10 text-primary")}>
                        <Upload className="h-4 w-4" />
                        <span>Importar Lote</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Simulados Group */}
            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Simulados</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={active === "simulados"} onClick={() => handleNav("simulados")}>
                        <button className={cn("flex items-center gap-2", active === "simulados" && "bg-primary/10 text-primary")}>
                          <ClipboardList className="h-4 w-4" />
                          <span>Gerenciar</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Gestão de Acesso Group */}
            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Gestão de Acesso</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={active === "users"} onClick={() => handleNav("users")}>
                        <button className={cn("flex items-center gap-2", active === "users" && "bg-primary/10 text-primary")}>
                          <Users className="h-4 w-4" />
                          <span>Usuários</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={active === "hotmart"} onClick={() => handleNav("hotmart")}>
                        <button className={cn("flex items-center gap-2", active === "hotmart" && "bg-primary/10 text-primary")}>
                          <ShoppingBag className="h-4 w-4" />
                          <span>Hotmart</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={active === "admins"} onClick={() => handleNav("admins")}>
                        <button className={cn("flex items-center gap-2", active === "admins" && "bg-primary/10 text-primary")}>
                          <UserCog className="h-4 w-4" />
                          <span>Admins</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={active === "support"} onClick={() => handleNav("support")}>
                        <button className={cn("flex items-center gap-2 w-full", active === "support" && "bg-primary/10 text-primary")}>
                          <MessageSquare className="h-4 w-4" />
                          <span className="flex-1 text-left">Suporte</span>
                          {pendingSupport > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                              {pendingSupport}
                            </span>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex items-center gap-3 px-4 pt-12 md:pt-4 pb-3 bg-gradient-night text-white">
            <SidebarTrigger className="hidden md:flex -ml-1 text-white hover:bg-white/10" />
            <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 md:ml-0 flex items-center justify-center rounded-full hover:bg-white/10 md:hidden">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <Library className="w-5 h-5 text-primary hidden md:block" />
              <div>
                <p className="stencil text-xs text-primary flex items-center gap-1 md:hidden"><Shield className="w-3 h-3" /> Admin</p>
                <h1 className="font-display text-xl font-bold truncate">Painel Administrativo</h1>
              </div>
            </div>
            <span className="ml-auto stencil text-[10px] text-white/60 hidden md:block">{sectionLabels[active]}</span>
          </header>

          {/* Mobile Horizontal Nav */}
          <nav className="md:hidden px-4 py-2 border-b border-border bg-card overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              <button
                onClick={() => handleNav("editais")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  active === "editais" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}
              >
                Editais
              </button>
              <button
                onClick={() => handleNav("questions")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  active === "questions" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}
              >
                Questões
              </button>
              <button
                onClick={() => handleNav("bulk")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  active === "bulk" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}
              >
                Em lote
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleNav("simulados")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    active === "simulados" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  Simulados
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleNav("users")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    active === "users" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  Usuários
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleNav("hotmart")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    active === "hotmart" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  Hotmart
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleNav("admins")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    active === "admins" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  Admins
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleNav("support")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1.5",
                    active === "support" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  Suporte
                  {pendingSupport > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                      {pendingSupport}
                    </span>
                  )}
                </button>
              )}
            </div>
          </nav>

          {/* Content Area */}
          <main className="flex-1 px-4 md:px-6 py-5 overflow-y-auto">
            <div className="max-w-4xl">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Admin;