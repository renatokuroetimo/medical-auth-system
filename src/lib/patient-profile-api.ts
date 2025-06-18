import {
  PatientPersonalData,
  PatientMedicalData,
  Doctor,
  SharedData,
  PatientPersonalFormData,
  PatientMedicalFormData,
} from "./patient-profile-types";
import { supabase } from "./supabase";
import { isFeatureEnabled } from "./feature-flags";

class PatientProfileAPI {
  private readonly STORAGE_KEYS = {
    PERSONAL_DATA: "medical_app_patient_personal",
    MEDICAL_DATA: "medical_app_patient_medical",
    DOCTORS: "medical_app_doctors",
    SHARED_DATA: "medical_app_shared_data",
  };

  // Simula delay de rede
  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Gera ID único
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // === DADOS PESSOAIS ===
  private getStoredPersonalData(): PatientPersonalData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.PERSONAL_DATA);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private savePersonalData(data: PatientPersonalData[]): void {
    localStorage.setItem(this.STORAGE_KEYS.PERSONAL_DATA, JSON.stringify(data));
  }

  async getPatientPersonalData(
    userId: string,
  ): Promise<PatientPersonalData | null> {
    await this.delay(200);

    console.log("🔍 getPatientPersonalData chamado para userId:", userId);

    // Se Supabase estiver ativo, usar Supabase
    if (isFeatureEnabled("useSupabaseProfiles") && supabase) {
      console.log("🚀 Buscando dados pessoais no Supabase");

      try {
        const { data: supabaseData, error } = await supabase
          .from("patient_personal_data")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(); // Use maybeSingle instead of single to avoid PGRST116

        console.log("📊 Dados pessoais do Supabase:", {
          data: supabaseData,
          error,
        });

        if (error) {
          console.error(
            "❌ Erro ao buscar dados pessoais no Supabase:",
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
          // Fallback para localStorage
        } else if (supabaseData) {
          // Converter dados do Supabase para formato local
          const personalData: PatientPersonalData = {
            id: supabaseData.id,
            userId: supabaseData.user_id,
            fullName: supabaseData.full_name,
            birthDate: supabaseData.birth_date,
            gender: supabaseData.gender,
            state: supabaseData.state,
            city: supabaseData.city,
            healthPlan: supabaseData.health_plan,
            profileImage: supabaseData.profile_image,
            createdAt: supabaseData.created_at,
            updatedAt: supabaseData.updated_at,
          };

          console.log("✅ Dados pessoais convertidos:", personalData);
          return personalData;
        } else {
          console.log("📝 Dados pessoais não encontrados no Supabase");
          return null;
        }
      } catch (supabaseError) {
        console.error("💥 Erro no Supabase getPatientPersonalData:", {
          message:
            supabaseError instanceof Error
              ? supabaseError.message
              : "Unknown error",
          name: supabaseError instanceof Error ? supabaseError.name : "Unknown",
          stack:
            supabaseError instanceof Error
              ? supabaseError.stack?.split("\n")[0]
              : undefined,
        });
        // Continuar para fallback localStorage
      }
    }

    console.log("⚠️ Usando localStorage para dados pessoais");
    const data = this.getStoredPersonalData();
    return data.find((item) => item.userId === userId) || null;
  }

  async savePatientPersonalData(
    userId: string,
    formData: PatientPersonalFormData,
  ): Promise<PatientPersonalData> {
    await this.delay(300);

    console.log("🔥 SALVANDO DADOS PESSOAIS:", { userId, formData });

    const allData = this.getStoredPersonalData();
    const existingIndex = allData.findIndex((item) => item.userId === userId);

    let resultData: PatientPersonalData;

    if (existingIndex >= 0) {
      // Atualizar existente
      resultData = {
        ...allData[existingIndex],
        ...formData,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Criar novo
      resultData = {
        id: this.generateId(),
        userId,
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Se Supabase estiver ativo, usar Supabase
    if (isFeatureEnabled("useSupabaseProfiles") && supabase) {
      console.log("🚀 Salvando dados pessoais no Supabase");

      try {
        const insertData = {
          id: resultData.id,
          user_id: resultData.userId,
          full_name: resultData.fullName,
          birth_date: resultData.birthDate,
          gender: resultData.gender,
          state: resultData.state,
          city: resultData.city,
          health_plan: resultData.healthPlan,
          profile_image: resultData.profileImage,
          created_at: resultData.createdAt,
          updated_at: resultData.updatedAt,
        };

        console.log("📝 Dados pessoais para Supabase:", insertData);

        const { data: supabaseData, error } =
          existingIndex >= 0
            ? await supabase
                .from("patient_personal_data")
                .update(insertData)
                .eq("user_id", userId)
            : await supabase.from("patient_personal_data").insert([insertData]);

        console.log("📊 Resposta Supabase dados pessoais:", {
          data: supabaseData,
          error,
        });

        if (error) {
          console.error(
            "❌ Erro ao salvar dados pessoais:",
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
          throw error; // Forçar fallback
        } else {
          console.log("✅ Dados pessoais salvos no Supabase!");
          return resultData;
        }
      } catch (supabaseError) {
        console.error("💥 Erro no Supabase dados pessoais:", {
          message:
            supabaseError instanceof Error
              ? supabaseError.message
              : "Unknown error",
          name: supabaseError instanceof Error ? supabaseError.name : "Unknown",
          stack:
            supabaseError instanceof Error
              ? supabaseError.stack?.split("\n")[0]
              : undefined,
        });
        // Continuar para fallback
      }
    } else {
      console.log("⚠️ Supabase perfis não ativo");
    }

    console.log("📁 Salvando dados pessoais no localStorage");
    if (existingIndex >= 0) {
      allData[existingIndex] = resultData;
    } else {
      allData.push(resultData);
    }
    this.savePersonalData(allData);
    return resultData;
  }

  // === DADOS MÉDICOS ===
  private getStoredMedicalData(): PatientMedicalData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.MEDICAL_DATA);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveMedicalData(data: PatientMedicalData[]): void {
    localStorage.setItem(this.STORAGE_KEYS.MEDICAL_DATA, JSON.stringify(data));
  }

  async getPatientMedicalData(
    userId: string,
  ): Promise<PatientMedicalData | null> {
    await this.delay(200);

    console.log("🔍 getPatientMedicalData chamado para userId:", userId);

    // Se Supabase estiver ativo, usar Supabase
    if (isFeatureEnabled("useSupabaseProfiles") && supabase) {
      console.log("🚀 Buscando dados médicos no Supabase");

      try {
        const { data: supabaseData, error } = await supabase
          .from("patient_medical_data")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(); // Use maybeSingle instead of single to avoid PGRST116

        console.log("📊 Dados médicos do Supabase:", {
          data: supabaseData,
          error,
        });

        if (error) {
          console.error(
            "❌ Erro ao buscar dados médicos no Supabase:",
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
          // Fallback para localStorage
        } else if (supabaseData) {
          // Converter dados do Supabase para formato local
          const medicalData: PatientMedicalData = {
            id: supabaseData.id,
            userId: supabaseData.user_id,
            height: supabaseData.height,
            weight: supabaseData.weight
              ? parseFloat(supabaseData.weight)
              : undefined,
            smoker: supabaseData.smoker || false,
            highBloodPressure: supabaseData.high_blood_pressure || false,
            physicalActivity: supabaseData.physical_activity || false,
            exerciseFrequency: supabaseData.exercise_frequency,
            healthyDiet: supabaseData.healthy_diet || false,
            createdAt: supabaseData.created_at,
            updatedAt: supabaseData.updated_at,
          };

          console.log("✅ Dados médicos convertidos:", medicalData);
          return medicalData;
        } else {
          console.log("📝 Dados médicos não encontrados no Supabase");
          return null;
        }
      } catch (supabaseError) {
        console.error("💥 Erro no Supabase getPatientMedicalData:", {
          message:
            supabaseError instanceof Error
              ? supabaseError.message
              : "Unknown error",
          name: supabaseError instanceof Error ? supabaseError.name : "Unknown",
          stack:
            supabaseError instanceof Error
              ? supabaseError.stack?.split("\n")[0]
              : undefined,
        });
        // Continuar para fallback localStorage
      }
    }

    console.log("⚠️ Usando localStorage para dados médicos");
    const data = this.getStoredMedicalData();
    return data.find((item) => item.userId === userId) || null;
  }

  async savePatientMedicalData(
    userId: string,
    formData: PatientMedicalFormData,
  ): Promise<PatientMedicalData> {
    await this.delay(300);

    console.log("🔥 SALVANDO DADOS MÉDICOS:", { userId, formData });

    const allData = this.getStoredMedicalData();
    const existingIndex = allData.findIndex((item) => item.userId === userId);

    let resultData: PatientMedicalData;

    if (existingIndex >= 0) {
      // Atualizar existente
      resultData = {
        ...allData[existingIndex],
        ...formData,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Criar novo
      resultData = {
        id: this.generateId(),
        userId,
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Se Supabase estiver ativo, usar Supabase
    if (isFeatureEnabled("useSupabaseProfiles") && supabase) {
      console.log("🚀 Salvando dados médicos no Supabase");

      try {
        const insertData = {
          id: resultData.id,
          user_id: resultData.userId,
          height: resultData.height,
          weight: resultData.weight,
          smoker: resultData.smoker,
          high_blood_pressure: resultData.highBloodPressure,
          physical_activity: resultData.physicalActivity,
          exercise_frequency: resultData.exerciseFrequency,
          healthy_diet: resultData.healthyDiet,
          created_at: resultData.createdAt,
          updated_at: resultData.updatedAt,
        };

        console.log("📝 Dados médicos para Supabase:", insertData);

        const { data: supabaseData, error } =
          existingIndex >= 0
            ? await supabase
                .from("patient_medical_data")
                .update(insertData)
                .eq("user_id", userId)
            : await supabase.from("patient_medical_data").insert([insertData]);

        console.log("📊 Resposta Supabase dados médicos:", {
          data: supabaseData,
          error,
        });

        if (error) {
          console.error(
            "❌ Erro ao salvar dados médicos:",
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
          throw error; // Forçar fallback
        } else {
          console.log("✅ Dados médicos salvos no Supabase!");
          return resultData;
        }
      } catch (supabaseError) {
        console.error("💥 Erro no Supabase dados médicos:", {
          message:
            supabaseError instanceof Error
              ? supabaseError.message
              : "Unknown error",
          name: supabaseError instanceof Error ? supabaseError.name : "Unknown",
          stack:
            supabaseError instanceof Error
              ? supabaseError.stack?.split("\n")[0]
              : undefined,
        });
        // Continuar para fallback
      }
    } else {
      console.log("⚠️ Supabase perfis não ativo");
    }

    console.log("📁 Salvando dados médicos no localStorage");
    if (existingIndex >= 0) {
      allData[existingIndex] = resultData;
    } else {
      allData.push(resultData);
    }
    this.saveMedicalData(allData);
    return resultData;
  }

  // === MÉDICOS ===
  private getStoredDoctors(): Doctor[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.DOCTORS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveDoctors(doctors: Doctor[]): void {
    localStorage.setItem(this.STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
  }

  // Get doctors from registered users instead of mock data
  private async getRegisteredDoctors(): Promise<Doctor[]> {
    console.log("🔍 Buscando médicos registrados...");

    // Try Supabase first if feature is enabled
    if (isFeatureEnabled("useSupabaseProfiles") && supabase) {
      console.log("🚀 Buscando médicos no Supabase");

      try {
        const { data: supabaseUsers, error } = await supabase
          .from("users")
          .select("*")
          .eq("profession", "medico");

        console.log("📊 Médicos do Supabase:", { data: supabaseUsers, error });

        if (error) {
          console.error(
            "❌ Erro ao buscar médicos no Supabase:",
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
          // Continue to localStorage fallback
        } else {
          const doctors = (supabaseUsers || []).map((user: any) =>
            this.mapUserToDoctor(user, "supabase"),
          );
          console.log("✅ Médicos convertidos do Supabase:", doctors);
          return doctors;
        }
      } catch (supabaseError) {
        console.error("💥 Erro no Supabase getRegisteredDoctors:", {
          message:
            supabaseError instanceof Error
              ? supabaseError.message
              : "Unknown error",
          name: supabaseError instanceof Error ? supabaseError.name : "Unknown",
        });
        // Continue to localStorage fallback
      }
    }

    console.log("⚠️ Usando localStorage fallback para médicos");

    try {
      const users = localStorage.getItem("medical_app_users");
      const parsedUsers = users ? JSON.parse(users) : [];

      console.log(
        "📋 Todos os usuários registrados (localStorage):",
        parsedUsers,
      );

      // Filter only users with profession "medico" and convert to Doctor format
      const doctorUsers = parsedUsers.filter(
        (user: any) => user.profession === "medico",
      );

      console.log(
        "👨‍⚕️ Usuários médicos encontrados (localStorage):",
        doctorUsers,
      );

      return doctorUsers.map((user: any) =>
        this.mapUserToDoctor(user, "localStorage"),
      );
    } catch (error) {
      console.error("❌ Erro ao buscar médicos registrados:", error);
      return [];
    }
  }

  // Helper function to map user data to doctor format
  private mapUserToDoctor(user: any, source: "supabase" | "localStorage"): any {
    // Use existing name or show "Sem nome cadastrado"
    // Support both fullName and full_name (localStorage vs Supabase format)
    let doctorName = user.fullName || user.full_name || user.name;

    if (!doctorName || doctorName.trim() === "") {
      doctorName = "Sem nome cadastrado";
    }

    console.log(`🔍 Dados originais do usuário médico (${source}):`, {
      id: user.id,
      name: user.name,
      fullName: user.fullName || user.full_name,
      crm: user.crm,
      state: user.state,
      email: user.email,
      city: user.city,
      specialty: user.specialty,
    });

    const doctor = {
      id: user.id,
      name: doctorName,
      crm: user.crm || "123456",
      state: user.state || "",
      specialty: user.specialty || "",
      email: user.email,
      city: user.city || "",
      createdAt: user.createdAt || user.created_at || new Date().toISOString(),
    };

    console.log(`👨‍⚕️ Médico mapeado (${source}):`, doctor);
    return doctor;
  }

  async loadRegisteredDoctors(): Promise<void> {
    // Get only doctors from registered users - no mocks
    const registeredDoctors = await this.getRegisteredDoctors();

    // Always update with latest registered doctors
    this.saveDoctors(registeredDoctors);

    console.log("Loaded registered doctors:", registeredDoctors);
  }

  async searchDoctors(query: string): Promise<Doctor[]> {
    await this.delay(300);
    // Always refresh with latest registered users only
    await this.loadRegisteredDoctors();

    const doctors = this.getStoredDoctors();
    console.log("Available registered doctors:", doctors);

    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) return doctors;

    const filteredDoctors = doctors.filter((doctor) => {
      const nameMatch = doctor.name.toLowerCase().includes(searchTerm);
      const crmMatch = doctor.crm.includes(searchTerm);
      const crmStateMatch = `${doctor.crm}-${doctor.state}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const specialtyMatch = doctor.specialty
        .toLowerCase()
        .includes(searchTerm);
      const stateMatch = doctor.state
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const cityMatch = doctor.city?.toLowerCase().includes(searchTerm);

      // Split search term by spaces to match individual words
      const searchWords = searchTerm.split(" ");
      const nameWordsMatch = searchWords.every((word) =>
        doctor.name.toLowerCase().includes(word),
      );

      return (
        nameMatch ||
        crmMatch ||
        crmStateMatch ||
        specialtyMatch ||
        stateMatch ||
        cityMatch ||
        nameWordsMatch
      );
    });

    console.log(`Search for "${query}" returned:`, filteredDoctors);
    return filteredDoctors;
  }

  // === COMPARTILHAMENTO ===
  private getStoredSharedData(): SharedData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.SHARED_DATA);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveSharedData(data: SharedData[]): void {
    localStorage.setItem(this.STORAGE_KEYS.SHARED_DATA, JSON.stringify(data));
  }

  async shareDataWithDoctor(
    patientId: string,
    doctorId: string,
  ): Promise<SharedData> {
    await this.delay(300);

    const allShares = this.getStoredSharedData();

    // Verificar se já existe compartilhamento ativo
    const existingShare = allShares.find(
      (share) =>
        share.patientId === patientId &&
        share.doctorId === doctorId &&
        share.isActive,
    );

    if (existingShare) {
      return existingShare;
    }

    const newShare: SharedData = {
      id: this.generateId(),
      patientId,
      doctorId,
      sharedAt: new Date().toISOString(),
      isActive: true,
    };

    allShares.push(newShare);
    this.saveSharedData(allShares);
    return newShare;
  }

  async stopSharingWithDoctor(
    patientId: string,
    doctorId: string,
  ): Promise<void> {
    await this.delay(300);

    const allShares = this.getStoredSharedData();
    const updatedShares = allShares.map((share) =>
      share.patientId === patientId && share.doctorId === doctorId
        ? { ...share, isActive: false }
        : share,
    );

    this.saveSharedData(updatedShares);
  }

  async getSharedDoctors(patientId: string): Promise<Doctor[]> {
    await this.delay(200);

    const shares = this.getStoredSharedData();
    const doctors = this.getStoredDoctors();

    const activeShares = shares.filter(
      (share) => share.patientId === patientId && share.isActive,
    );

    return doctors.filter((doctor) =>
      activeShares.some((share) => share.doctorId === doctor.id),
    );
  }

  // Limpar dados dos médicos
  clearDoctorsData(): void {
    localStorage.removeItem(this.STORAGE_KEYS.DOCTORS);
  }

  // Limpar todos os dados
  clearAllData(): void {
    localStorage.removeItem(this.STORAGE_KEYS.PERSONAL_DATA);
    localStorage.removeItem(this.STORAGE_KEYS.MEDICAL_DATA);
    localStorage.removeItem(this.STORAGE_KEYS.DOCTORS);
    localStorage.removeItem(this.STORAGE_KEYS.SHARED_DATA);
  }
}

export const patientProfileAPI = new PatientProfileAPI();
