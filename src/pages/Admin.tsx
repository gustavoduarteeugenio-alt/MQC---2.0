import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield } from "lucide-react";
import { BulkImport } from "@/components/admin/BulkImport";
import { ManageAdmins } from "@/components/admin/ManageAdmins";
import { ManageUsers } from "@/components/admin/ManageUsers";
import { ManageQuestions } from "@/components/admin/ManageQuestions";
import { ManageSimulados } from "@/components/admin/ManageSimulados";

type Subject = { id: string; name: string; slug: string };

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useProfile();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => { if (!loading && !isAdmin) navigate("/"); }, [isAdmin, loading, navigate]);

  const reload = async () => {
    const { data: subs } = await supabase
      .from("subjects")
      .select("id, name, slug")
      .order("display_order");
    setSubjects((subs ?? []) as Subject[]);
  };
  useEffect(() => { reload(); }, []);

  return (
    <div className="app-shell pb-10">
      <header className="flex items-center gap-2 px-4 pt-12 pb-3 bg-gradient-night text-white">
        <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="stencil text-xs text-primary flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</p>
          <h1 className="font-display text-xl font-bold">Painel administrativo</h1>
        </div>
      </header>

      <main className="px-5 py-5 space-y-5">
        <Tabs defaultValue="questions" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="questions">Questões</TabsTrigger>
            <TabsTrigger value="bulk">Em lote</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="mt-4">
            <ManageQuestions subjects={subjects} />
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <BulkImport subjects={subjects} onImported={() => { /* noop */ }} />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <ManageUsers />
          </TabsContent>

          <TabsContent value="admins" className="mt-4">
            <ManageAdmins />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
