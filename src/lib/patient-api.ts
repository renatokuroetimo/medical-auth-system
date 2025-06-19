import {
  Patient,
  Diagnosis,
  PatientFormData,
  PaginationData,
} from "./patient-types";
import { supabase } from "./supabase";

class PatientAPI {
  // Delay para simular operação real
  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // MÉTODO ULTRA-SIMPLES PARA TESTE DE COMPARTILHAMENTO
  async getPatients(): Promise<{
    patients: Patient[];
    pagination: PaginationData;
  }> {
    console.log("🚀🚀🚀 MÉTODO GETPATIENTS LIMPO E SIMPLES");

    await this.delay(200);

    // Verificar se usuário está logado
    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      console.error("❌ Usuário não autenticado");
      return {
        patients: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: 10,
        },
      };
    }

    const currentUser = JSON.parse(currentUserStr);
    console.log(
      "👤 USUÁRIO LOGADO:",
      currentUser.email,
      currentUser.profession,
    );

    if (!supabase) {
      console.warn("⚠️ Supabase não configurado - retornando lista vazia");
      return {
        patients: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: 10,
        },
      };
    }

    try {
      console.log("🔍 Buscando compartilhamentos reais no banco...");
      console.log("👤 ID do médico logado:", currentUser.id);

      const { data: shares, error: sharesError } = await supabase
        .from("doctor_patient_sharing")
        .select("*")
        .eq("doctor_id", currentUser.id);

      console.log("📊 RESULTADO DETALHADO:");
      console.log("- Total de compartilhamentos:", shares?.length || 0);
      console.log("- Erro:", sharesError?.message || "nenhum");
      console.log(
        "- Query executada: doctor_patient_sharing WHERE doctor_id =",
        currentUser.id,
      );
      console.log("- Dados completos:", shares);

      // Buscar TODOS os compartilhamentos para comparar
      const { data: allShares } = await supabase
        .from("doctor_patient_sharing")
        .select("*")
        .order("created_at", { ascending: false });

      console.log(
        "🗂️ TODOS OS COMPARTILHAMENTOS NO BANCO:",
        allShares?.length || 0,
      );
      allShares?.forEach((share, index) => {
        console.log(
          `  ${index + 1}. Doctor: ${share.doctor_id}, Patient: ${share.patient_id}, Data: ${share.shared_at}`,
        );
      });

      let allPatients: Patient[] = [];

      if (sharesError) {
        console.error("❌ ERRO ao buscar compartilhamentos:", sharesError);
      } else if (shares && shares.length > 0) {
        console.log(`✅ ${shares.length} compartilhamentos encontrados`);

        // Adicionar um paciente real para cada compartilhamento
        allPatients = shares.map((share, index) => ({
          id: share.patient_id,
          name: `Paciente Real ${index + 1}`,
          age: 30 + index,
          city: "Cidade Real",
          state: "PR",
          weight: 65 + index * 5,
          status: "compartilhado" as const,
          notes: `Compartilhado em ${new Date(share.shared_at).toLocaleDateString()}`,
          createdAt: share.shared_at || new Date().toISOString(),
          doctorId: null,
          isShared: true,
          sharedId: share.id,
        }));

        console.log(`🎯 TOTAL: ${allPatients.length} pacientes compartilhados`);
      } else {
        console.log("📝 Nenhum compartilhamento encontrado");
      }

      return {
        patients: allPatients,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: allPatients.length,
          itemsPerPage: allPatients.length,
        },
      };
    } catch (error) {
      console.error("💥 ERRO CRÍTICO:", error);
      console.log("🔄 Retornando lista vazia devido ao erro");

      return {
        patients: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: 10,
        },
      };
    }
  }

  // Gera ID único
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Outros métodos necessários (implementação básica)
  async getPatientById(id: string): Promise<Patient | null> {
    console.log("🔍 Buscando paciente por ID:", id);
    return null; // Implementar se necessário
  }

  async createPatient(data: PatientFormData): Promise<Patient> {
    throw new Error("Método não implementado para teste");
  }

  async updatePatient(
    id: string,
    data: Partial<PatientFormData>,
  ): Promise<Patient> {
    throw new Error("Método não implementado para teste");
  }

  async deletePatient(id: string): Promise<void> {
    throw new Error("Método não implementado para teste");
  }

  async deletePatients(ids: string[]): Promise<void> {
    throw new Error("Método não implementado para teste");
  }

  async getDiagnoses(patientId: string): Promise<Diagnosis[]> {
    return [];
  }

  async addDiagnosis(
    patientId: string,
    diagnosis: Omit<Diagnosis, "id" | "patientId">,
  ): Promise<Diagnosis> {
    throw new Error("Método não implementado para teste");
  }

  async updateDiagnosis(
    id: string,
    diagnosis: Partial<Diagnosis>,
  ): Promise<Diagnosis> {
    throw new Error("Método não implementado para teste");
  }

  async deleteDiagnosis(id: string): Promise<void> {
    throw new Error("Método não implementado para teste");
  }

  async removePatientSharing(patientId: string): Promise<void> {
    console.log(
      "🗑️ removePatientSharing - Removendo compartilhamento do paciente:",
      patientId,
    );

    if (!supabase) {
      throw new Error("❌ Supabase não está configurado");
    }

    // Verificar se usuário está logado (médico)
    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      throw new Error("❌ Usuário não autenticado");
    }

    const currentUser = JSON.parse(currentUserStr);
    console.log("👤 Médico removendo compartilhamento:", currentUser.id);

    try {
      // Deletar o compartilhamento específico
      const { error } = await supabase
        .from("doctor_patient_sharing")
        .delete()
        .eq("doctor_id", currentUser.id)
        .eq("patient_id", patientId);

      if (error) {
        console.error("❌ Erro ao deletar compartilhamento:", error);
        throw new Error(`Erro ao remover compartilhamento: ${error.message}`);
      }

      console.log("✅ Compartilhamento removido com sucesso do banco");
    } catch (error) {
      console.error("💥 Erro crítico ao remover compartilhamento:", error);
      throw error;
    }
  }
}

// Instância singleton
export const patientAPI = new PatientAPI();
