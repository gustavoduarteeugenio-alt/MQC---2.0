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
      attempts: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          time_seconds: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          time_seconds?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string
          time_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage: {
        Row: {
          id: string
          questions_count: number
          usage_date: string
          user_id: string
        }
        Insert: {
          id?: string
          questions_count?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          id?: string
          questions_count?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      diagnostic_sessions: {
        Row: {
          answers: Json
          client_token: string
          completed_at: string | null
          correct: number
          created_at: string
          id: string
          instagram_handle: string | null
          lead_name: string | null
          results: Json | null
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answers?: Json
          client_token: string
          completed_at?: string | null
          correct?: number
          created_at?: string
          id?: string
          instagram_handle?: string | null
          lead_name?: string | null
          results?: Json | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answers?: Json
          client_token?: string
          completed_at?: string | null
          correct?: number
          created_at?: string
          id?: string
          instagram_handle?: string | null
          lead_name?: string | null
          results?: Json | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      landing_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          instagram_handle: string | null
          name: string
          phone: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          instagram_handle?: string | null
          name: string
          phone?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          instagram_handle?: string | null
          name?: string
          phone?: string | null
          source?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          diagnostic_completed_at: string | null
          diagnostic_results: Json | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed_at: string | null
          origem: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          premium_since: string | null
          premium_until: string | null
          ranking_name: string | null
          show_in_ranking: boolean
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          diagnostic_completed_at?: string | null
          diagnostic_results?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          origem?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          premium_since?: string | null
          premium_until?: string | null
          ranking_name?: string | null
          show_in_ranking?: boolean
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          diagnostic_completed_at?: string | null
          diagnostic_results?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          origem?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          premium_since?: string | null
          premium_until?: string | null
          ranking_name?: string | null
          show_in_ranking?: boolean
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          banca: string
          comment_image_url: string | null
          correct_answer: string
          created_at: string
          difficulty: string
          explanation: string
          id: string
          image_url: string | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          option_e: string | null
          statement: string
          subject_id: string
          subtopic: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          banca?: string
          comment_image_url?: string | null
          correct_answer: string
          created_at?: string
          difficulty?: string
          explanation: string
          id?: string
          image_url?: string | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          option_e?: string | null
          statement: string
          subject_id: string
          subtopic?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          banca?: string
          comment_image_url?: string | null
          correct_answer?: string
          created_at?: string
          difficulty?: string
          explanation?: string
          id?: string
          image_url?: string | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          option_e?: string | null
          statement?: string
          subject_id?: string
          subtopic?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_attempts: {
        Row: {
          answers: Json
          by_subject: Json
          correct: number
          duration_seconds: number | null
          finished_at: string | null
          id: string
          mode: string
          simulado_id: string | null
          started_at: string
          title: string | null
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          by_subject?: Json
          correct?: number
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          mode: string
          simulado_id?: string | null
          started_at?: string
          title?: string | null
          total?: number
          user_id: string
        }
        Update: {
          answers?: Json
          by_subject?: Json
          correct?: number
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          mode?: string
          simulado_id?: string | null
          started_at?: string
          title?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_attempts_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_questions: {
        Row: {
          id: string
          position: number
          question_id: string
          simulado_id: string
        }
        Insert: {
          id?: string
          position?: number
          question_id: string
          simulado_id: string
        }
        Update: {
          id?: string
          position?: number
          question_id?: string
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulado_questions_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      simulados: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          type: string
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          type: string
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          type?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_replies: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          message_id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          id?: string
          message_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_suporte: {
        Row: {
          created_at: string
          email_usuario: string
          id: string
          mensagem: string
          resolved_at: string | null
          resolved_by: string | null
          status_resolvido: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_usuario: string
          id?: string
          mensagem: string
          resolved_at?: string | null
          resolved_by?: string | null
          status_resolvido?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_usuario?: string
          id?: string
          mensagem?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status_resolvido?: boolean
          user_id?: string | null
        }
        Relationships: []
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
      admin_list_questions: {
        Args: never
        Returns: {
          banca: string
          comment_image_url: string | null
          correct_answer: string
          created_at: string
          difficulty: string
          explanation: string
          id: string
          image_url: string | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          option_e: string | null
          statement: string
          subject_id: string
          subtopic: string | null
          updated_at: string
          year: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "questions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      check_account_approved: {
        Args: { email_input: string }
        Returns: boolean
      }
      claim_diagnostic_session: {
        Args: { _client_token: string }
        Returns: Json
      }
      create_diagnostic_session: {
        Args: { _client_token: string; _total: number }
        Returns: string
      }
      expire_premium_users: { Args: never; Returns: undefined }
      get_diagnostic_overview: { Args: never; Returns: Json }
      get_diagnostic_questions: {
        Args: { _per_subject?: number }
        Returns: Json
      }
      get_my_training_rank: {
        Args: never
        Returns: {
          correct_count: number
          rank_position: number
          total_users: number
        }[]
      }
      get_training_ranking: {
        Args: { _limit?: number }
        Returns: {
          correct_count: number
          display_name: string
          is_anonymous: boolean
          rank_position: number
          user_id: string
        }[]
      }
      grant_admin_by_email: { Args: { _email: string }; Returns: Json }
      grant_role_by_email: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_admins: {
        Args: never
        Returns: {
          email: string
          full_name: string
          granted_at: string
          user_id: string
        }[]
      }
      list_diagnostic_sessions: {
        Args: { _filter?: string; _limit?: number; _offset?: number }
        Returns: {
          completed_at: string
          correct: number
          created_at: string
          id: string
          instagram_handle: string
          lead_name: string
          profile_email: string
          profile_name: string
          total: number
          total_count: number
          user_id: string
        }[]
      }
      list_staff: {
        Args: never
        Returns: {
          email: string
          full_name: string
          granted_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      reveal_question_answer: { Args: { _qid: string }; Returns: Json }
      reveal_questions_answers: { Args: { _ids: string[] }; Returns: Json }
      revoke_admin: { Args: { _user_id: string }; Returns: Json }
      revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: Json
      }
      set_diagnostic_lead: {
        Args: {
          _client_token: string
          _instagram_handle: string
          _lead_name: string
          _session_id: string
        }
        Returns: undefined
      }
      submit_diagnostic_answers: {
        Args: { _answers: Json; _client_token: string; _session_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "admin_didatico"
      plan_type: "basic" | "premium" | "monthly" | "quarterly"
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
      app_role: ["admin", "user", "admin_didatico"],
      plan_type: ["basic", "premium", "monthly", "quarterly"],
    },
  },
} as const
