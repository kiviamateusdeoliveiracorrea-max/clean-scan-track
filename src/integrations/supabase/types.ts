export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alertas_processo: {
        Row: {
          area_id: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          descricao: string | null
          foto_urls: string[]
          id: string
          procedimento: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          descricao?: string | null
          foto_urls?: string[]
          id?: string
          procedimento?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          descricao?: string | null
          foto_urls?: string[]
          id?: string
          procedimento?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_processo_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          setor: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          setor?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          setor?: string | null
        }
        Relationships: []
      }
      auditores: {
        Row: {
          created_at: string
          email: string | null
          id: string
          matricula: string | null
          nome: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          matricula?: string | null
          nome: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          matricula?: string | null
          nome?: string
        }
        Relationships: []
      }
      auditorias: {
        Row: {
          area_id: string | null
          auditor_id: string | null
          cancelada_em: string | null
          cancelada_por: string | null
          created_at: string
          data_auditoria: string
          fotos: string[]
          id: string
          justificativa_cancelamento: string | null
          nota_ambiente: number | null
          nota_pessoas: number | null
          nota_processo: number | null
          observacoes: string | null
          percentual: number
          pontuacao_total: number
          seiketsu: number
          seiri: number
          seiso: number
          seiton: number
          shitsuke: number
          status: string
        }
        Insert: {
          area_id?: string | null
          auditor_id?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          created_at?: string
          data_auditoria?: string
          fotos?: string[]
          id?: string
          justificativa_cancelamento?: string | null
          nota_ambiente?: number | null
          nota_pessoas?: number | null
          nota_processo?: number | null
          observacoes?: string | null
          percentual?: number
          pontuacao_total?: number
          seiketsu?: number
          seiri?: number
          seiso?: number
          seiton?: number
          shitsuke?: number
          status?: string
        }
        Update: {
          area_id?: string | null
          auditor_id?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          created_at?: string
          data_auditoria?: string
          fotos?: string[]
          id?: string
          justificativa_cancelamento?: string | null
          nota_ambiente?: number | null
          nota_pessoas?: number | null
          nota_processo?: number | null
          observacoes?: string | null
          percentual?: number
          pontuacao_total?: number
          seiketsu?: number
          seiri?: number
          seiso?: number
          seiton?: number
          shitsuke?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditorias_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditorias_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "auditores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditorias_cancelada_por_fkey"
            columns: ["cancelada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auditorias_log: {
        Row: {
          acao: string
          area_id: string | null
          area_nome: string | null
          auditoria_id: string | null
          created_at: string
          data_auditoria: string | null
          executado_por: string | null
          executado_por_nome: string | null
          id: string
          justificativa: string | null
        }
        Insert: {
          acao: string
          area_id?: string | null
          area_nome?: string | null
          auditoria_id?: string | null
          created_at?: string
          data_auditoria?: string | null
          executado_por?: string | null
          executado_por_nome?: string | null
          id?: string
          justificativa?: string | null
        }
        Update: {
          acao?: string
          area_id?: string | null
          area_nome?: string | null
          auditoria_id?: string | null
          created_at?: string
          data_auditoria?: string | null
          executado_por?: string | null
          executado_por_nome?: string | null
          id?: string
          justificativa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditorias_log_executado_por_fkey"
            columns: ["executado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gemba_visitas: {
        Row: {
          acao_definida: string | null
          area_id: string | null
          created_at: string
          created_by: string | null
          data_visita: string
          foto_antes_urls: string[]
          foto_depois_urls: string[]
          id: string
          oportunidade: string | null
          participantes: string | null
          ponto_positivo: string | null
          prazo: string | null
          responsavel_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acao_definida?: string | null
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          data_visita?: string
          foto_antes_urls?: string[]
          foto_depois_urls?: string[]
          id?: string
          oportunidade?: string | null
          participantes?: string | null
          ponto_positivo?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acao_definida?: string | null
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          data_visita?: string
          foto_antes_urls?: string[]
          foto_depois_urls?: string[]
          id?: string
          oportunidade?: string | null
          participantes?: string | null
          ponto_positivo?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gemba_visitas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gemba_visitas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      melhorias: {
        Row: {
          area_id: string | null
          categoria: string
          comentarios: string | null
          created_at: string
          created_by: string | null
          data_identificacao: string
          descricao: string
          foto_urls: string[]
          id: string
          prazo: string | null
          processo: string | null
          responsavel_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          categoria?: string
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data_identificacao?: string
          descricao: string
          foto_urls?: string[]
          id?: string
          prazo?: string | null
          processo?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          categoria?: string
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data_identificacao?: string
          descricao?: string
          foto_urls?: string[]
          id?: string
          prazo?: string | null
          processo?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "melhorias_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "melhorias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nao_conformidades: {
        Row: {
          acao_corretiva: string | null
          acao_preventiva: string | null
          aprovado_por: string | null
          aprovador_id: string | null
          area_id: string | null
          auditoria_id: string | null
          causa_raiz: string | null
          created_at: string
          criterio: string
          data_aprovacao: string | null
          data_conclusao: string | null
          descricao: string
          documento_urls: string[]
          excluida: boolean
          excluida_em: string | null
          excluida_por: string | null
          foto_url: string | null
          foto_urls: string[]
          id: string
          justificativa_exclusao: string | null
          parecer_aprovador: string | null
          plano_acao: string | null
          prazo: string | null
          responsavel: string | null
          responsavel_acao_id: string | null
          responsavel_nc_id: string | null
          severidade: string
          status: string
          status_anterior: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acao_corretiva?: string | null
          acao_preventiva?: string | null
          aprovado_por?: string | null
          aprovador_id?: string | null
          area_id?: string | null
          auditoria_id?: string | null
          causa_raiz?: string | null
          created_at?: string
          criterio: string
          data_aprovacao?: string | null
          data_conclusao?: string | null
          descricao: string
          documento_urls?: string[]
          excluida?: boolean
          excluida_em?: string | null
          excluida_por?: string | null
          foto_url?: string | null
          foto_urls?: string[]
          id?: string
          justificativa_exclusao?: string | null
          parecer_aprovador?: string | null
          plano_acao?: string | null
          prazo?: string | null
          responsavel?: string | null
          responsavel_acao_id?: string | null
          responsavel_nc_id?: string | null
          severidade?: string
          status?: string
          status_anterior?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acao_corretiva?: string | null
          acao_preventiva?: string | null
          aprovado_por?: string | null
          aprovador_id?: string | null
          area_id?: string | null
          auditoria_id?: string | null
          causa_raiz?: string | null
          created_at?: string
          criterio?: string
          data_aprovacao?: string | null
          data_conclusao?: string | null
          descricao?: string
          documento_urls?: string[]
          excluida?: boolean
          excluida_em?: string | null
          excluida_por?: string | null
          foto_url?: string | null
          foto_urls?: string[]
          id?: string
          justificativa_exclusao?: string | null
          parecer_aprovador?: string | null
          plano_acao?: string | null
          prazo?: string | null
          responsavel?: string | null
          responsavel_acao_id?: string | null
          responsavel_nc_id?: string | null
          severidade?: string
          status?: string
          status_anterior?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nao_conformidades_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_responsavel_acao_id_fkey"
            columns: ["responsavel_acao_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_responsavel_nc_id_fkey"
            columns: ["responsavel_nc_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_historico: {
        Row: {
          acao: string
          comentario: string | null
          created_at: string
          id: string
          nc_id: string
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          comentario?: string | null
          created_at?: string
          id?: string
          nc_id: string
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          comentario?: string | null
          created_at?: string
          id?: string
          nc_id?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_historico_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id"]
          },
        ]
      }
      perguntas_auditoria: {
        Row: {
          area_nome: string
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          pergunta: string
          peso: number
          updated_at: string
        }
        Insert: {
          area_nome: string
          ativo?: boolean
          categoria: string
          created_at?: string
          id?: string
          pergunta: string
          peso?: number
          updated_at?: string
        }
        Update: {
          area_nome?: string
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          pergunta?: string
          peso?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          area_id: string | null
          ativo: boolean
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_auditoria: {
        Row: {
          auditoria_id: string
          created_at: string
          foto_url: string | null
          id: string
          observacao: string | null
          pergunta_id: string
          resposta: string
        }
        Insert: {
          auditoria_id: string
          created_at?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          pergunta_id: string
          resposta: string
        }
        Update: {
          auditoria_id?: string
          created_at?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          pergunta_id?: string
          resposta?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_auditoria_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_auditoria_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas_auditoria"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "administrador" | "auditor" | "gestor" | "consulta"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["administrador", "auditor", "gestor", "consulta"],
    },
  },
} as const
