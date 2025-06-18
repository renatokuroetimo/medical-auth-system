import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContextHybrid";
import { patientAPI } from "@/lib/patient-api";
import { patientProfileAPI } from "@/lib/patient-profile-api";
import { toast } from "@/hooks/use-toast";

const DebugSharing = () => {
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [results, setResults] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);

  const testGetPatients = async () => {
    if (!doctorId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Digite o ID do médico",
      });
      return;
    }

    try {
      console.log("🧪 Testando getPatients para doctorId:", doctorId);
      const result = await patientAPI.getPatients(doctorId, 1, 10);
      setResults(result);
      console.log("🧪 Resultado completo:", result);

      toast({
        title: "Teste concluído",
        description: `Encontrados ${result.patients.length} pacientes. Veja o console para detalhes.`,
      });
    } catch (error) {
      console.error("🧪 Erro no teste:", error);
      toast({
        variant: "destructive",
        title: "Erro no teste",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const { supabase } = await import("@/lib/supabase");

      if (!supabase) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Supabase não disponível",
        });
        return;
      }

      const { data: users, error } = await supabase
        .from("users")
        .select("id, email, profession, full_name, crm")
        .order("profession", { ascending: true });

      if (error) {
        console.error("Erro ao buscar usuários:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Erro ao buscar usuários do Supabase",
        });
        return;
      }

      setUsersList(users || []);
      console.log("👥 Usuários encontrados:", users);

      toast({
        title: "Usuários carregados",
        description: `Encontrados ${users?.length || 0} usuários`,
      });
    } catch (error) {
      console.error("Erro:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao conectar com Supabase",
      });
    }
  };

  const testSharingQuery = async () => {
    if (!doctorId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Digite o ID do médico",
      });
      return;
    }

    try {
      const { supabase } = await import("@/lib/supabase");

      if (!supabase) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Supabase não disponível",
        });
        return;
      }

      console.log(
        "🧪 Testando query de compartilhamentos para doctorId:",
        doctorId,
      );

      const { data, error } = await supabase
        .from("doctor_patient_sharing")
        .select("patient_id, shared_at")
        .eq("doctor_id", doctorId);

      console.log("🧪 Resultado da query:", { data, error });

      if (error) {
        console.error(
          "🧪 Erro detalhado:",
          JSON.stringify(
            {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
            },
            null,
            2,
          ),
        );
      }

      toast({
        title: "Query testada",
        description: `${data?.length || 0} compartilhamentos encontrados. Veja o console.`,
      });
    } catch (error) {
      console.error("🧪 Erro no teste:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  const testCreateSharing = async () => {
    if (!doctorId || !patientId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Digite o ID do médico e do paciente",
      });
      return;
    }

    try {
      console.log("🧪 Criando compartilhamento:", { doctorId, patientId });
      const result = await patientProfileAPI.shareDataWithDoctor(
        patientId,
        doctorId,
      );
      console.log("🧪 Compartilhamento criado:", result);

      toast({
        title: "Compartilhamento criado",
        description: "Verifique o console para detalhes",
      });
    } catch (error) {
      console.error("🧪 Erro ao criar compartilhamento:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        🧪 Debug - Sistema de Compartilhamento
      </h1>

      <div className="space-y-6">
        <div className="border p-4 rounded-lg">
          <h2 className="font-semibold mb-4">Informações do Usuário Atual</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        <div className="border p-4 rounded-lg">
          <h2 className="font-semibold mb-4">Buscar Todos os Usuários</h2>
          <Button onClick={fetchUsers} className="mb-4">
            Carregar Usuários do Supabase
          </Button>

          {usersList.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">👥 Usuários Encontrados:</h3>
              {usersList.map((user) => (
                <div
                  key={user.id}
                  className={`p-2 rounded border ${
                    user.profession === "medico" ? "bg-blue-50" : "bg-green-50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <strong>{user.profession.toUpperCase()}</strong> -{" "}
                      {user.full_name || user.email}
                      {user.crm && ` (CRM: ${user.crm})`}
                    </div>
                    <div className="flex gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">
                        ID: {user.id}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (user.profession === "medico") {
                            setDoctorId(user.id);
                          } else {
                            setPatientId(user.id);
                          }
                        }}
                      >
                        Usar ID
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border p-4 rounded-lg">
          <h2 className="font-semibold mb-4">Teste 1: Buscar Pacientes</h2>
          <div className="flex gap-3 mb-3">
            <Input
              placeholder="ID do médico"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            />
            <Button onClick={testGetPatients}>Buscar Pacientes</Button>
            <Button onClick={testSharingQuery} variant="outline">
              Testar Query
            </Button>
          </div>

          {results && (
            <div>
              <h3 className="font-medium mt-4 mb-2">Resultado:</h3>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-40">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="border p-4 rounded-lg">
          <h2 className="font-semibold mb-4">
            Teste 2: Criar Compartilhamento
          </h2>
          <div className="flex gap-3 mb-3">
            <Input
              placeholder="ID do médico"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            />
            <Input
              placeholder="ID do paciente"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            />
            <Button onClick={testCreateSharing}>Criar Compartilhamento</Button>
          </div>
        </div>

        <div className="border p-4 rounded-lg bg-yellow-50">
          <h2 className="font-semibold mb-2">📝 Instruções:</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Execute primeiro o script SQL de diagnóstico no Supabase</li>
            <li>Use os IDs dos usuários criados pelo script</li>
            <li>
              Teste a busca de pacientes para ver se aparecem compartilhados
            </li>
            <li>Abra o DevTools Console para ver logs detalhados</li>
            <li>Se necessário, crie compartilhamentos manualmente</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DebugSharing;
