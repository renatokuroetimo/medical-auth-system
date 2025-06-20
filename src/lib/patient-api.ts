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

  // MÉTODO CORRIGIDO BASEADO NA ESTRUTURA REAL DO BANCO (SEM CAMPO NAME)
  async getPatients(): Promise<{
    patients: Patient[];
    pagination: PaginationData;
  }> {
    await this.delay(200);

    // Verificar se usuário está logado
    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      return {
        patients: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
        },
      };
    }

    const currentUser = JSON.parse(currentUserStr);

    if (!supabase) {
      throw new Error("❌ Supabase não está configurado");
    }

    const allPatients: Patient[] = [];

    try {
      // PRIMEIRO: Buscar pacientes criados pelo próprio médico
      const { data: ownPatients, error: ownError } = await supabase
        .from("patients")
        .select("*")
        .eq("doctor_id", currentUser.id);

      if (!ownError && ownPatients && ownPatients.length > 0) {
        for (const ownPatient of ownPatients) {
          // Buscar observações médicas se existirem
          let notes = ownPatient.notes || "";

          try {
            const { data: observations } = await supabase
              .from("patient_medical_observations")
              .select("observations")
              .eq("patient_id", ownPatient.id)
              .eq("doctor_id", currentUser.id)
              .single();

            if (observations?.observations) {
              notes = observations.observations;
            }
          } catch (error) {
            // Ignorar erro se não houver observações
          }

          const patient: Patient = {
            id: ownPatient.id,
            name: ownPatient.name,
            age: null, // TODO: buscar de patient_personal_data se necessário
            city: "N/A", // TODO: buscar de patient_personal_data se necessário
            state: "N/A", // TODO: buscar de patient_personal_data se necessário
            weight: null, // TODO: buscar de patient_medical_data se necessário
            status: ownPatient.status || "ativo",
            notes: notes,
            createdAt: ownPatient.created_at || new Date().toISOString(),
            doctorId: ownPatient.doctor_id,
            isShared: false,
          };

          allPatients.push(patient);
        }
      }

      // SEGUNDO: Buscar compartilhamentos para este médico
      const { data: shares, error: shareError } = await supabase
        .from("doctor_patient_sharing")
        .select("*")
        .eq("doctor_id", currentUser.id);

      if (shareError) {
        console.error("❌ Erro ao buscar compartilhamentos:", shareError);
        return {
          patients: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
          },
        };
      }

      if (shares && shares.length > 0) {
        // Processar cada compartilhamento
        for (const share of shares) {
          try {
            // 2.1 Buscar dados básicos do paciente na tabela users
            const { data: patientUser, error: patientError } = await supabase
              .from("users")
              .select(
                `
                id,
                email,
                profession,
                full_name,
                crm,
                city,
                state,
                specialty,
                phone,
                created_at
              `,
              )
              .eq("id", share.patient_id)
              .eq("profession", "paciente")
              .single();

            if (patientError) {
              continue;
            }

            if (!patientUser) {
              continue;
            }

            // 2.2 Determinar nome do paciente (prioridade: full_name da tabela users)
            let patientName = "Sem nome definido";

            // PRIMEIRO: tentar usar full_name da tabela users
            if (patientUser.full_name && patientUser.full_name.trim()) {
              patientName = patientUser.full_name.trim();
            } else {
              // SEGUNDO: buscar nome em patient_personal_data como fallback
              try {
                const { data: personalData, error: personalError } =
                  await supabase
                    .from("patient_personal_data")
                    .select("full_name, email")
                    .eq("user_id", share.patient_id)
                    .single();

                if (
                  !personalError &&
                  personalData?.full_name &&
                  personalData.full_name.trim()
                ) {
                  patientName = personalData.full_name.trim();
                } else {
                  // TERCEIRO: fallback para email
                  if (patientUser.email) {
                    patientName = `Paciente ${patientUser.email.split("@")[0]}`;
                  } else {
                    patientName = `Paciente ${share.patient_id.substring(0, 8)}`;
                  }
                }
              } catch (error) {
                // Fallback para email se não conseguir buscar dados pessoais
                if (patientUser.email) {
                  patientName = `Paciente ${patientUser.email.split("@")[0]}`;
                } else {
                  patientName = `Paciente ${share.patient_id.substring(0, 8)}`;
                }
              }
            }

            // 2.3 Buscar dados adicionais (idade, peso, etc.)
            let age = null;
            let weight = null;
            let city = "N/A";
            let state = "N/A";

            // Buscar dados pessoais detalhados
            try {
              const { data: personalData, error: personalError } =
                await supabase
                  .from("patient_personal_data")
                  .select("*")
                  .eq("user_id", share.patient_id)
                  .single();

              if (!personalError && personalData) {
                // Atualizar cidade e estado se disponíveis
                if (personalData.city) city = personalData.city;
                if (personalData.state) state = personalData.state;

                // Calcular idade se data de nascimento disponível
                if (personalData.birth_date) {
                  const today = new Date();
                  const birthDate = new Date(personalData.birth_date);
                  age = today.getFullYear() - birthDate.getFullYear();
                  const monthDiff = today.getMonth() - birthDate.getMonth();
                  if (
                    monthDiff < 0 ||
                    (monthDiff === 0 && today.getDate() < birthDate.getDate())
                  ) {
                    age--;
                  }
                }
              }
            } catch (error) {
              // Silenciosamente ignorar erros de dados pessoais
            }

            // Buscar dados médicos (peso, altura, etc.)
            try {
              const { data: medicalData, error: medicalError } = await supabase
                .from("patient_medical_data")
                .select("*")
                .eq("user_id", share.patient_id)
                .single();

              if (!medicalError && medicalData) {
                if (medicalData.weight) {
                  weight = parseFloat(medicalData.weight.toString());
                }
              }
            } catch (error) {
              // Silenciosamente ignorar erros de dados médicos
            }

            // 2.4 Criar objeto paciente final
            const patient: Patient = {
              id: share.patient_id,
              name: patientName,
              age: age,
              city: city,
              state: state,
              weight: weight,
              status: "compartilhado" as const,
              notes: `Compartilhado em ${new Date(share.shared_at).toLocaleDateString("pt-BR")}`,
              createdAt: share.shared_at || new Date().toISOString(),
              doctorId: null,
              isShared: true,
              sharedId: share.id,
            };

            allPatients.push(patient);
          } catch (error) {
            // Silenciosamente ignorar erros de processamento de pacientes individuais
          }
        }
      }

      return {
        patients: allPatients,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: allPatients.length,
        },
      };
    } catch (error) {
      console.error("💥 Erro crítico ao buscar pacientes:", error);
      throw new Error("Erro interno do servidor. Tente novamente.");
    }
  }

  // Versão simplificada do getPatientById para evitar problemas de autenticação
  async getPatientById(id: string): Promise<Patient | null> {
    await this.delay(200);

    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      return null;
    }

    const currentUser = JSON.parse(currentUserStr);

    if (!supabase) {
      return null;
    }

    try {
      // PRIMEIRO: Verificar se é um paciente compartilhado
      const { data: shareData } = await supabase
        .from("doctor_patient_sharing")
        .select("*")
        .eq("doctor_id", currentUser.id)
        .eq("patient_id", id)
        .single();

      if (shareData) {
        // Buscar dados básicos do paciente
        const { data: patientUser } = await supabase
          .from("users")
          .select("id, email, profession, full_name, city, state")
          .eq("id", id)
          .eq("profession", "paciente")
          .single();

        if (!patientUser) {
          return null;
        }

        // Nome do paciente
        let patientName = "Sem nome definido";
        if (patientUser.full_name && patientUser.full_name.trim()) {
          patientName = patientUser.full_name.trim();
        } else if (patientUser.email) {
          patientName = `Paciente ${patientUser.email.split("@")[0]}`;
        }

        // Buscar observações médicas salvas
        let notes = `Compartilhado em ${new Date(shareData.shared_at).toLocaleDateString("pt-BR")}`;

        try {
          const { data: observations } = await supabase
            .from("patient_medical_observations")
            .select("observations")
            .eq("patient_id", id)
            .eq("doctor_id", currentUser.id)
            .single();

          if (observations?.observations) {
            notes = observations.observations;
          }
        } catch (error) {
          // Ignorar erro se não houver observações
        }

        return {
          id: id,
          name: patientName,
          age: null,
          city: patientUser.city || "N/A",
          state: patientUser.state || "N/A",
          weight: null,
          status: "compartilhado" as const,
          notes: notes,
          createdAt: shareData.shared_at || new Date().toISOString(),
          doctorId: null,
          isShared: true,
          sharedId: shareData.id,
        };
      }

      // SEGUNDO: Se não é compartilhado, verificar se é um paciente próprio
      const { data: ownPatient } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .eq("doctor_id", currentUser.id)
        .single();

      if (ownPatient) {
        // Buscar observações médicas salvas
        let notes = ownPatient.notes || "";

        try {
          const { data: observations } = await supabase
            .from("patient_medical_observations")
            .select("observations")
            .eq("patient_id", id)
            .eq("doctor_id", currentUser.id)
            .single();

          if (observations?.observations) {
            notes = observations.observations;
          }
        } catch (error) {
          // Ignorar erro se não houver observações
        }

        // Buscar dados pessoais para complementar informações
        let age = null;
        let city = "N/A";
        let state = "N/A";
        let weight = null;

        try {
          // Buscar dados pessoais
          const { data: personalData } = await supabase
            .from("patient_personal_data")
            .select("*")
            .eq("user_id", id)
            .single();

          if (personalData) {
            if (personalData.city) city = personalData.city;
            if (personalData.state) state = personalData.state;

            // Calcular idade se data de nascimento disponível
            if (personalData.birth_date) {
              const today = new Date();
              const birthDate = new Date(personalData.birth_date);
              age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (
                monthDiff < 0 ||
                (monthDiff === 0 && today.getDate() < birthDate.getDate())
              ) {
                age--;
              }
            }
          }

          // Buscar dados médicos
          const { data: medicalData } = await supabase
            .from("patient_medical_data")
            .select("*")
            .eq("user_id", id)
            .single();

          if (medicalData && medicalData.weight) {
            weight = parseFloat(medicalData.weight.toString());
          }
        } catch (error) {
          // Silenciosamente ignorar erros na busca de dados complementares
        }

        return {
          id: ownPatient.id,
          name: ownPatient.name,
          age: age,
          city: city,
          state: state,
          weight: weight,
          status: ownPatient.status || "ativo",
          notes: notes,
          createdAt: ownPatient.created_at || new Date().toISOString(),
          doctorId: ownPatient.doctor_id,
          isShared: false,
        };
      }

      return null;
    } catch (error) {
      console.error("Erro ao buscar paciente:", error);
      return null;
    }
  }

  async createPatient(data: PatientFormData): Promise<Patient> {
    await this.delay(300);

    if (!supabase) {
      throw new Error("Sistema de banco de dados não configurado");
    }

    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      throw new Error("Usuário não autenticado");
    }

    const currentUser = JSON.parse(currentUserStr);

    if (currentUser.profession !== "medico") {
      throw new Error("Apenas médicos podem criar pacientes");
    }

    // Gerar ID único para o novo paciente
    const newPatientId = this.generateId();

    // Criar paciente na tabela patients
    const { error: createError } = await supabase.from("patients").insert([
      {
        id: newPatientId,
        doctor_id: currentUser.id,
        name: data.name,
        status: data.status || "ativo",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (createError) {
      throw new Error(`Erro ao criar paciente: ${createError.message}`);
    }

    // Salvar dados pessoais se fornecidos
    if (
      data.birthDate ||
      data.email ||
      data.phone ||
      data.gender ||
      data.healthPlan
    ) {
      const { error: personalError } = await supabase
        .from("patient_personal_data")
        .insert([
          {
            id: this.generateId(),
            user_id: newPatientId,
            full_name: data.name,
            birth_date: data.birthDate || null,
            email: data.email || null,
            phone: data.phone || null,
            gender: data.gender || null,
            health_plan: data.healthPlan || null,
            city: data.city || null,
            state: data.state || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

      if (personalError) {
        console.warn("Aviso: erro ao salvar dados pessoais:", personalError);
      }
    }

    // Salvar dados médicos se fornecidos
    if (
      data.height ||
      data.smoker !== undefined ||
      data.highBloodPressure !== undefined ||
      data.physicalActivity !== undefined
    ) {
      const { error: medicalError } = await supabase
        .from("patient_medical_data")
        .insert([
          {
            id: this.generateId(),
            user_id: newPatientId,
            height: data.height || null,
            weight: data.weight || null,
            smoker: data.smoker || false,
            high_blood_pressure: data.highBloodPressure || false,
            physical_activity: data.physicalActivity || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

      if (medicalError) {
        console.warn("Aviso: erro ao salvar dados médicos:", medicalError);
      }
    }

    // Retornar o paciente criado
    const newPatient: Patient = {
      id: newPatientId,
      name: data.name,
      age: data.age || null,
      city: data.city || "N/A",
      state: data.state || "N/A",
      weight: data.weight || null,
      status: data.status || "ativo",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      doctorId: currentUser.id,
      isShared: false,
    };

    return newPatient;
  }

  async updatePatient(
    id: string,
    data: Partial<PatientFormData>,
  ): Promise<Patient> {
    await this.delay(300);

    if (!supabase) {
      throw new Error("Sistema de banco de dados não configurado");
    }

    // Obter usuário atual do contexto (SEM localStorage)
    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      throw new Error("Usuário não autenticado");
    }
    const currentUser = JSON.parse(currentUserStr);

    // Verificar se é paciente compartilhado
    const { data: shareData, error: shareError } = await supabase
      .from("doctor_patient_sharing")
      .select("*")
      .eq("doctor_id", currentUser.id)
      .eq("patient_id", id)
      .single();

    if (shareError && shareError.code !== "PGRST116") {
      throw new Error(`Erro ao verificar permissões: ${shareError.message}`);
    }

    if (!shareData) {
      throw new Error("Você não tem permissão para editar este paciente");
    }

    // Atualizar dados pessoais se for paciente próprio (não compartilhado)
    if (!shareData) {
      // Verificar se é paciente próprio do médico
      const { data: ownPatient } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .eq("doctor_id", currentUser.id)
        .single();

      if (ownPatient) {
        // Atualizar dados básicos do paciente
        if (data.name || data.status) {
          const { error: updatePatientError } = await supabase
            .from("patients")
            .update({
              name: data.name || ownPatient.name,
              status: data.status || ownPatient.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);

          if (updatePatientError) {
            throw new Error(
              `Erro ao atualizar dados básicos: ${updatePatientError.message}`,
            );
          }
        }

        // Atualizar/inserir dados pessoais
        if (
          data.birthDate ||
          data.email ||
          data.phone ||
          data.gender ||
          data.healthPlan ||
          data.city ||
          data.state
        ) {
          const { data: existingPersonal } = await supabase
            .from("patient_personal_data")
            .select("*")
            .eq("user_id", id)
            .single();

          if (existingPersonal) {
            const { error: updatePersonalError } = await supabase
              .from("patient_personal_data")
              .update({
                full_name: data.name || existingPersonal.full_name,
                birth_date: data.birthDate || existingPersonal.birth_date,
                email: data.email || existingPersonal.email,
                phone: data.phone || existingPersonal.phone,
                gender: data.gender || existingPersonal.gender,
                health_plan: data.healthPlan || existingPersonal.health_plan,
                city: data.city || existingPersonal.city,
                state: data.state || existingPersonal.state,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", id);

            if (updatePersonalError) {
              console.warn(
                "Aviso: erro ao atualizar dados pessoais:",
                updatePersonalError,
              );
            }
          } else {
            const { error: insertPersonalError } = await supabase
              .from("patient_personal_data")
              .insert([
                {
                  id: this.generateId(),
                  user_id: id,
                  full_name: data.name,
                  birth_date: data.birthDate || null,
                  email: data.email || null,
                  phone: data.phone || null,
                  gender: data.gender || null,
                  health_plan: data.healthPlan || null,
                  city: data.city || null,
                  state: data.state || null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ]);

            if (insertPersonalError) {
              console.warn(
                "Aviso: erro ao inserir dados pessoais:",
                insertPersonalError,
              );
            }
          }
        }

        // Atualizar/inserir dados médicos
        if (
          data.height ||
          data.weight ||
          data.smoker !== undefined ||
          data.highBloodPressure !== undefined ||
          data.physicalActivity !== undefined
        ) {
          const { data: existingMedical } = await supabase
            .from("patient_medical_data")
            .select("*")
            .eq("user_id", id)
            .single();

          if (existingMedical) {
            const { error: updateMedicalError } = await supabase
              .from("patient_medical_data")
              .update({
                height: data.height || existingMedical.height,
                weight: data.weight || existingMedical.weight,
                smoker:
                  data.smoker !== undefined
                    ? data.smoker
                    : existingMedical.smoker,
                high_blood_pressure:
                  data.highBloodPressure !== undefined
                    ? data.highBloodPressure
                    : existingMedical.high_blood_pressure,
                physical_activity:
                  data.physicalActivity !== undefined
                    ? data.physicalActivity
                    : existingMedical.physical_activity,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", id);

            if (updateMedicalError) {
              console.warn(
                "Aviso: erro ao atualizar dados médicos:",
                updateMedicalError,
              );
            }
          } else {
            const { error: insertMedicalError } = await supabase
              .from("patient_medical_data")
              .insert([
                {
                  id: this.generateId(),
                  user_id: id,
                  height: data.height || null,
                  weight: data.weight || null,
                  smoker: data.smoker || false,
                  high_blood_pressure: data.highBloodPressure || false,
                  physical_activity: data.physicalActivity || false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ]);

            if (insertMedicalError) {
              console.warn(
                "Aviso: erro ao inserir dados médicos:",
                insertMedicalError,
              );
            }
          }
        }
      }
    }

    // Salvar observações médicas se houver
    if (data.notes && data.notes.trim()) {
      // Verificar se já existe observação
      const { data: existingObs } = await supabase
        .from("patient_medical_observations")
        .select("*")
        .eq("patient_id", id)
        .eq("doctor_id", currentUser.id)
        .single();

      if (existingObs) {
        // Atualizar existente
        const { error: updateError } = await supabase
          .from("patient_medical_observations")
          .update({
            observations: data.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingObs.id);

        if (updateError) {
          throw new Error(
            `Erro ao atualizar observações: ${updateError.message}`,
          );
        }
      } else {
        // Criar nova
        const { error: insertError } = await supabase
          .from("patient_medical_observations")
          .insert([
            {
              id: this.generateId(),
              patient_id: id,
              doctor_id: currentUser.id,
              observations: data.notes,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);

        if (insertError) {
          throw new Error(`Erro ao salvar observações: ${insertError.message}`);
        }
      }
    }

    // Retornar paciente atualizado
    const currentPatient = await this.getPatientById(id);
    if (!currentPatient) {
      throw new Error("Paciente não encontrado");
    }

    return {
      ...currentPatient,
      notes: data.notes || currentPatient.notes,
    };
  }
  async deletePatients(ids: string[]): Promise<void> {
    await this.delay(300);

    if (!supabase) {
      throw new Error("Sistema de banco de dados não configurado");
    }

    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      throw new Error("Usuário não autenticado");
    }

    const currentUser = JSON.parse(currentUserStr);

    try {
      // Deletar apenas pacientes que pertencem ao médico atual
      const { error } = await supabase
        .from("patients")
        .delete()
        .in("id", ids)
        .eq("doctor_id", currentUser.id);

      if (error) {
        throw new Error(`Erro ao deletar pacientes: ${error.message}`);
      }

      // Também remover observações médicas relacionadas
      for (const patientId of ids) {
        await supabase
          .from("patient_medical_observations")
          .delete()
          .eq("patient_id", patientId)
          .eq("doctor_id", currentUser.id);
      }
    } catch (error) {
      console.error("Erro ao deletar pacientes:", error);
      throw error;
    }
  }

  // Função auxiliar para gerar IDs únicos
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async getDiagnoses(patientId: string): Promise<Diagnosis[]> {
    await this.delay(300);

    // Verificar se usuário está logado (médico)
    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      throw new Error("❌ Usuário não autenticado");
    }

    const currentUser = JSON.parse(currentUserStr);

    if (!supabase) {
      throw new Error("❌ Supabase não está configurado");
    }

    try {
      // BUSCAR DIAGNÓSTICOS DO PACIENTE
      const { data: diagnoses, error } = await supabase
        .from("patient_diagnoses")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Erro ao buscar diagnósticos:", error);
        return [];
      }

      if (!diagnoses || diagnoses.length === 0) {
        return [];
      }

      // CONVERTER PARA FORMATO DA APLICAÇÃO
      const convertedDiagnoses: Diagnosis[] = diagnoses.map((d: any) => ({
        id: d.id,
        patientId: d.patient_id,
        date: d.date,
        diagnosis: d.status, // Campo 'status' contém o diagnóstico
        code: d.code,
        status: d.status,
      }));

      return convertedDiagnoses;
    } catch (error) {
      console.error("💥 Erro crítico ao buscar diagnósticos:", error);
      return [];
    }
  }

  async addDiagnosis(
    patientId: string,
    diagnosis: Omit<Diagnosis, "id" | "patientId">,
  ): Promise<Diagnosis> {
    await this.delay(300);

    // Verificar se usuário está logado (médico)
    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      throw new Error("❌ Usuário não autenticado");
    }

    const currentUser = JSON.parse(currentUserStr);

    if (!supabase) {
      throw new Error("❌ Supabase não está configurado");
    }

    try {
      // 1. VERIFICAR SE O PACIENTE ESTÁ COMPARTILHADO COM ESTE MÉDICO
      const { data: shareData, error: shareError } = await supabase
        .from("doctor_patient_sharing")
        .select("*")
        .eq("doctor_id", currentUser.id)
        .eq("patient_id", patientId)
        .single();

      if (shareError && shareError.code !== "PGRST116") {
        console.error("❌ Erro ao verificar compartilhamento:", shareError);
        throw new Error("Erro ao verificar permissões de acesso ao paciente");
      }

      if (!shareData) {
        throw new Error(
          "Você não tem permissão para adicionar diagnósticos a este paciente",
        );
      }

      // 2. CRIAR O DIAGNÓSTICO
      const newDiagnosis: Diagnosis = {
        id: this.generateId(),
        patientId: patientId,
        date: diagnosis.date,
        diagnosis: diagnosis.diagnosis,
        code: diagnosis.code,
        status: diagnosis.status || diagnosis.diagnosis, // Fallback para compatibilidade
      };

      // 3. SALVAR NO BANCO SUPABASE (tabela patient_diagnoses)
      const { data: savedDiagnosis, error: saveError } = await supabase
        .from("patient_diagnoses")
        .insert([
          {
            id: newDiagnosis.id,
            patient_id: newDiagnosis.patientId,
            date: newDiagnosis.date,
            status: newDiagnosis.status,
            code: newDiagnosis.code,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (saveError) {
        console.error("❌ Erro ao salvar diagnóstico:", saveError);
        throw new Error(`Erro ao salvar diagnóstico: ${saveError.message}`);
      }

      return newDiagnosis;
    } catch (error) {
      console.error("💥 Erro crítico ao adicionar diagnóstico:", error);
      throw error;
    }
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
    if (!supabase) {
      throw new Error("❌ Supabase não está configurado");
    }

    // Verificar se usuário está logado (médico)
    const currentUserStr = localStorage.getItem("medical_app_current_user");
    if (!currentUserStr) {
      throw new Error("❌ Usuário não autenticado");
    }

    const currentUser = JSON.parse(currentUserStr);

    try {
      // Deletar o compartilhamento específico usando a estrutura correta
      const { error } = await supabase
        .from("doctor_patient_sharing")
        .delete()
        .eq("doctor_id", currentUser.id)
        .eq("patient_id", patientId);

      if (error) {
        console.error("❌ Erro ao deletar compartilhamento:", error);
        throw new Error(`Erro ao remover compartilhamento: ${error.message}`);
      }
    } catch (error) {
      console.error("💥 Erro crítico ao remover compartilhamento:", error);
      throw error;
    }
  }
}

// Instância singleton
export const patientAPI = new PatientAPI();
