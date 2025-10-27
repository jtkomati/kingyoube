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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounting_chart_of_accounts: {
        Row: {
          account_subtype: string | null
          account_type: string
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_analytical: boolean | null
          level: number
          name: string
          nature: string | null
          parent_account_id: string | null
          referential_code: string | null
          referential_name: string | null
          sped_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_subtype?: string | null
          account_type: string
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_analytical?: boolean | null
          level?: number
          name: string
          nature?: string | null
          parent_account_id?: string | null
          referential_code?: string | null
          referential_name?: string | null
          sped_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_subtype?: string | null
          account_type?: string
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_analytical?: boolean | null
          level?: number
          name?: string
          nature?: string | null
          parent_account_id?: string | null
          referential_code?: string | null
          referential_name?: string | null
          sped_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_cost_centers: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_cost_center_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_cost_center_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_cost_center_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_cost_centers_parent_cost_center_id_fkey"
            columns: ["parent_cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_entries: {
        Row: {
          created_at: string | null
          created_by: string
          description: string
          document_number: string | null
          document_type: string | null
          entry_date: string
          entry_number: string
          id: string
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description: string
          document_number?: string | null
          document_type?: string | null
          entry_date: string
          entry_number: string
          id?: string
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string
          document_number?: string | null
          document_type?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      accounting_entry_items: {
        Row: {
          account_id: string
          cost_center_id: string | null
          created_at: string | null
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          entry_id: string
          id: string
          profit_center_id: string | null
          project_id: string | null
        }
        Insert: {
          account_id: string
          cost_center_id?: string | null
          created_at?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          entry_id: string
          id?: string
          profit_center_id?: string | null
          project_id?: string | null
        }
        Update: {
          account_id?: string
          cost_center_id?: string | null
          created_at?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          entry_id?: string
          id?: string
          profit_center_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entry_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entry_items_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entry_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entry_items_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entry_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "accounting_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_profit_centers: {
        Row: {
          code: string
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_profit_centers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_projects: {
        Row: {
          budget_amount: number | null
          budget_hours: number | null
          code: string
          created_at: string | null
          customer_id: string | null
          description: string | null
          end_date: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          start_date: string | null
          status: string | null
          total_billed: number | null
          total_hours_logged: number | null
          updated_at: string | null
        }
        Insert: {
          budget_amount?: number | null
          budget_hours?: number | null
          code: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          start_date?: string | null
          status?: string | null
          total_billed?: number | null
          total_hours_logged?: number | null
          updated_at?: string | null
        }
        Update: {
          budget_amount?: number | null
          budget_hours?: number | null
          code?: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string | null
          status?: string | null
          total_billed?: number | null
          total_hours_logged?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback_corrections: {
        Row: {
          alert_id: string | null
          applied: boolean | null
          cfo_partner_id: string
          client_company_id: string | null
          correct_value: string
          created_at: string
          feedback_text: string
          feedback_type: string
          id: string
          original_value: string | null
        }
        Insert: {
          alert_id?: string | null
          applied?: boolean | null
          cfo_partner_id: string
          client_company_id?: string | null
          correct_value: string
          created_at?: string
          feedback_text: string
          feedback_type: string
          id?: string
          original_value?: string | null
        }
        Update: {
          alert_id?: string | null
          applied?: boolean | null
          cfo_partner_id?: string
          client_company_id?: string | null
          correct_value?: string
          created_at?: string
          feedback_text?: string
          feedback_type?: string
          id?: string
          original_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_corrections_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "cfo_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_corrections_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_corrections_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          user_id: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          user_id: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          user_id?: string
          user_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          access_token: string | null
          account_number: string | null
          account_type: string | null
          agency: string | null
          api_environment: string | null
          auto_sync_enabled: boolean | null
          bank_name: string
          certificate_path: string | null
          client_id: string | null
          client_secret: string | null
          company_id: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          api_environment?: string | null
          auto_sync_enabled?: boolean | null
          bank_name: string
          certificate_path?: string | null
          client_id?: string | null
          client_secret?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          api_environment?: string | null
          auto_sync_enabled?: boolean | null
          bank_name?: string
          certificate_path?: string | null
          client_id?: string | null
          client_secret?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          amount: number
          balance: number | null
          bank_account_id: string
          created_at: string
          description: string | null
          id: string
          imported_at: string
          imported_by: string
          reconciliation_status: string | null
          statement_date: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          balance?: number | null
          bank_account_id: string
          created_at?: string
          description?: string | null
          id?: string
          imported_at?: string
          imported_by: string
          reconciliation_status?: string | null
          statement_date: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          balance?: number | null
          bank_account_id?: string
          created_at?: string
          description?: string | null
          id?: string
          imported_at?: string
          imported_by?: string
          reconciliation_status?: string | null
          statement_date?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_targets: {
        Row: {
          account_category: string
          account_name: string
          cfo_partner_id: string
          client_company_id: string
          created_at: string
          created_by: string
          id: string
          month: string
          notes: string | null
          target_amount: number
          updated_at: string
        }
        Insert: {
          account_category: string
          account_name: string
          cfo_partner_id: string
          client_company_id: string
          created_at?: string
          created_by: string
          id?: string
          month: string
          notes?: string | null
          target_amount: number
          updated_at?: string
        }
        Update: {
          account_category?: string
          account_name?: string
          cfo_partner_id?: string
          client_company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          month?: string
          notes?: string | null
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_targets_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_targets_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_variance_analysis: {
        Row: {
          actual_amount: number
          alert_generated: boolean | null
          analysis_date: string
          budget_target_id: string
          cfo_partner_id: string
          client_company_id: string
          created_at: string
          id: string
          severity: string
          target_amount: number
          variance_amount: number
          variance_percent: number
          variance_status: string
        }
        Insert: {
          actual_amount: number
          alert_generated?: boolean | null
          analysis_date: string
          budget_target_id: string
          cfo_partner_id: string
          client_company_id: string
          created_at?: string
          id?: string
          severity: string
          target_amount: number
          variance_amount: number
          variance_percent: number
          variance_status: string
        }
        Update: {
          actual_amount?: number
          alert_generated?: boolean | null
          analysis_date?: string
          budget_target_id?: string
          cfo_partner_id?: string
          client_company_id?: string
          created_at?: string
          id?: string
          severity?: string
          target_amount?: number
          variance_amount?: number
          variance_percent?: number
          variance_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_variance_analysis_budget_target_id_fkey"
            columns: ["budget_target_id"]
            isOneToOne: false
            referencedRelation: "budget_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_variance_analysis_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_variance_analysis_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      cfo_alerts: {
        Row: {
          cfo_partner_id: string
          client_company_id: string | null
          client_name: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          cfo_partner_id: string
          client_company_id?: string | null
          client_name: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
        }
        Update: {
          cfo_partner_id?: string
          client_company_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "cfo_alerts_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfo_alerts_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      cfo_monitoring_config: {
        Row: {
          cfo_partner_id: string
          created_at: string
          critical_cash_days_threshold: number
          id: string
          notification_enabled: boolean
          notification_hour: number
          updated_at: string
          warning_ar_overdue_percentage: number
          warning_uncategorized_threshold: number
        }
        Insert: {
          cfo_partner_id: string
          created_at?: string
          critical_cash_days_threshold?: number
          id?: string
          notification_enabled?: boolean
          notification_hour?: number
          updated_at?: string
          warning_ar_overdue_percentage?: number
          warning_uncategorized_threshold?: number
        }
        Update: {
          cfo_partner_id?: string
          created_at?: string
          critical_cash_days_threshold?: number
          id?: string
          notification_enabled?: boolean
          notification_hour?: number
          updated_at?: string
          warning_ar_overdue_percentage?: number
          warning_uncategorized_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "cfo_monitoring_config_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: true
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      cfo_partner_roi_tracking: {
        Row: {
          cfo_partner_id: string
          client_company_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          time_saved_minutes: number
        }
        Insert: {
          cfo_partner_id: string
          client_company_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          time_saved_minutes?: number
        }
        Update: {
          cfo_partner_id?: string
          client_company_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          time_saved_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "cfo_partner_roi_tracking_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfo_partner_roi_tracking_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      cfo_partner_rulesets: {
        Row: {
          active: boolean | null
          alert_severity: string
          cfo_partner_id: string
          created_at: string
          custom_message_template: string | null
          id: string
          rule_type: string
          threshold_value: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          alert_severity: string
          cfo_partner_id: string
          created_at?: string
          custom_message_template?: string | null
          id?: string
          rule_type: string
          threshold_value: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          alert_severity?: string
          cfo_partner_id?: string
          created_at?: string
          custom_message_template?: string | null
          id?: string
          rule_type?: string
          threshold_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cfo_partner_rulesets_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      cfo_partners: {
        Row: {
          active: boolean
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_sandboxes: {
        Row: {
          cfo_partner_id: string
          client_name: string
          created_at: string
          demo_data: Json | null
          expires_at: string | null
          id: string
          industry: string
          sandbox_url: string
          status: string | null
        }
        Insert: {
          cfo_partner_id: string
          client_name: string
          created_at?: string
          demo_data?: Json | null
          expires_at?: string | null
          id?: string
          industry: string
          sandbox_url: string
          status?: string | null
        }
        Update: {
          cfo_partner_id?: string
          client_name?: string
          created_at?: string
          demo_data?: Json | null
          expires_at?: string | null
          id?: string
          industry?: string
          sandbox_url?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sandboxes_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          cfo_partner_id: string | null
          city_code: string | null
          cnpj: string
          company_name: string
          created_at: string
          id: string
          municipal_inscription: string | null
          nfse_environment: string | null
          nfse_login: string | null
          nfse_password: string | null
          notification_email: string | null
          state_inscription: string | null
          tax_regime: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cfo_partner_id?: string | null
          city_code?: string | null
          cnpj: string
          company_name: string
          created_at?: string
          id?: string
          municipal_inscription?: string | null
          nfse_environment?: string | null
          nfse_login?: string | null
          nfse_password?: string | null
          notification_email?: string | null
          state_inscription?: string | null
          tax_regime?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cfo_partner_id?: string | null
          city_code?: string | null
          cnpj?: string
          company_name?: string
          created_at?: string
          id?: string
          municipal_inscription?: string | null
          nfse_environment?: string | null
          nfse_login?: string | null
          nfse_password?: string | null
          notification_email?: string | null
          state_inscription?: string | null
          tax_regime?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_clauses: {
        Row: {
          ai_explanation: string
          clause_number: string | null
          clause_text: string
          clause_title: string | null
          compliance_status: string
          contract_id: string
          created_at: string
          id: string
          recommendations: string | null
          risk_category: string | null
          risk_level: string | null
        }
        Insert: {
          ai_explanation: string
          clause_number?: string | null
          clause_text: string
          clause_title?: string | null
          compliance_status: string
          contract_id: string
          created_at?: string
          id?: string
          recommendations?: string | null
          risk_category?: string | null
          risk_level?: string | null
        }
        Update: {
          ai_explanation?: string
          clause_number?: string | null
          clause_text?: string
          clause_title?: string | null
          compliance_status?: string
          contract_id?: string
          created_at?: string
          id?: string
          recommendations?: string | null
          risk_category?: string | null
          risk_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_clauses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          ai_analysis: Json | null
          ai_analyzed_at: string | null
          auto_renew: boolean | null
          company_id: string | null
          compliance_score: number | null
          contract_number: string
          created_at: string
          created_by: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          entity_type: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          renewal_alert_days: number | null
          risk_level: string | null
          start_date: string
          status: string | null
          supplier_id: string | null
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          auto_renew?: boolean | null
          company_id?: string | null
          compliance_score?: number | null
          contract_number: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          entity_type: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          renewal_alert_days?: number | null
          risk_level?: string | null
          start_date: string
          status?: string | null
          supplier_id?: string | null
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          auto_renew?: boolean | null
          company_id?: string | null
          compliance_score?: number | null
          contract_number?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          entity_type?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          renewal_alert_days?: number | null
          risk_level?: string | null
          start_date?: string
          status?: string | null
          supplier_id?: string | null
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          cnpj: string | null
          company_id: string | null
          company_name: string | null
          cpf: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_invoices: {
        Row: {
          cnab_generated: boolean | null
          cnab_generated_at: string | null
          cofins_amount: number | null
          company_id: string | null
          created_at: string
          created_by: string
          csll_amount: number | null
          file_name: string
          file_type: string
          file_url: string
          gross_amount: number
          id: string
          inss_amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          irrf_amount: number | null
          iss_amount: number | null
          net_amount: number
          ocr_data: Json | null
          pis_amount: number | null
          processing_status: string | null
          service_code: string | null
          supplier_cnpj: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          cnab_generated?: boolean | null
          cnab_generated_at?: string | null
          cofins_amount?: number | null
          company_id?: string | null
          created_at?: string
          created_by: string
          csll_amount?: number | null
          file_name: string
          file_type: string
          file_url: string
          gross_amount: number
          id?: string
          inss_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          irrf_amount?: number | null
          iss_amount?: number | null
          net_amount: number
          ocr_data?: Json | null
          pis_amount?: number | null
          processing_status?: string | null
          service_code?: string | null
          supplier_cnpj: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          cnab_generated?: boolean | null
          cnab_generated_at?: string | null
          cofins_amount?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          csll_amount?: number | null
          file_name?: string
          file_type?: string
          file_url?: string
          gross_amount?: number
          id?: string
          inss_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          irrf_amount?: number | null
          iss_amount?: number | null
          net_amount?: number
          ocr_data?: Json | null
          pis_amount?: number | null
          processing_status?: string | null
          service_code?: string | null
          supplier_cnpj?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incoming_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_prospect_leads: {
        Row: {
          address: string | null
          cfo_partner_id: string
          company_name: string
          created_at: string
          email: string | null
          id: string
          industry: string | null
          metadata: Json | null
          phone: string | null
          region: string | null
          score: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cfo_partner_id: string
          company_name: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          metadata?: Json | null
          phone?: string | null
          region?: string | null
          score?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cfo_partner_id?: string
          company_name?: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          metadata?: Json | null
          phone?: string | null
          region?: string | null
          score?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_prospect_leads_cfo_partner_id_fkey"
            columns: ["cfo_partner_id"]
            isOneToOne: false
            referencedRelation: "cfo_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_entries: {
        Row: {
          billable: boolean | null
          created_at: string
          date: string
          description: string | null
          hours: number
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean | null
          created_at?: string
          date: string
          description?: string | null
          hours: number
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean | null
          created_at?: string
          date?: string
          description?: string | null
          hours?: number
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "accounting_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_rules: {
        Row: {
          active: boolean | null
          auto_match: boolean | null
          created_at: string
          created_by: string
          id: string
          name: string
          pattern_type: string
          pattern_value: string
          suggested_category_id: string | null
        }
        Insert: {
          active?: boolean | null
          auto_match?: boolean | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          pattern_type: string
          pattern_value: string
          suggested_category_id?: string | null
        }
        Update: {
          active?: boolean | null
          auto_match?: boolean | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          pattern_type?: string
          pattern_value?: string
          suggested_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_rules_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sci_integrations: {
        Row: {
          auto_sync_enabled: boolean | null
          company_id: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          sci_api_url: string | null
          sci_company_code: string
          sci_password: string | null
          sci_username: string | null
          sync_customers: boolean | null
          sync_invoices: boolean | null
          sync_suppliers: boolean | null
          sync_transactions: boolean | null
          updated_at: string
        }
        Insert: {
          auto_sync_enabled?: boolean | null
          company_id?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          sci_api_url?: string | null
          sci_company_code: string
          sci_password?: string | null
          sci_username?: string | null
          sync_customers?: boolean | null
          sync_invoices?: boolean | null
          sync_suppliers?: boolean | null
          sync_transactions?: boolean | null
          updated_at?: string
        }
        Update: {
          auto_sync_enabled?: boolean | null
          company_id?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          sci_api_url?: string | null
          sci_company_code?: string
          sci_password?: string | null
          sci_username?: string | null
          sync_customers?: boolean | null
          sync_invoices?: boolean | null
          sync_suppliers?: boolean | null
          sync_transactions?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sci_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          cnpj: string | null
          company_id: string | null
          company_name: string | null
          cpf: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          person_type: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          person_type: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          company_id?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          person_type?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          error_details: string | null
          finished_at: string | null
          id: string
          integration_id: string | null
          integration_type: string
          records_processed: number | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error_details?: string | null
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          integration_type: string
          records_processed?: number | null
          started_at?: string
          status: string
        }
        Update: {
          created_at?: string
          error_details?: string | null
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          integration_type?: string
          records_processed?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      transaction_taxes: {
        Row: {
          created_at: string
          id: string
          tax_amount: number
          tax_name: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tax_amount: number
          tax_name: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tax_amount?: number
          tax_name?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_taxes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          category_id: string
          cofins_rate: number | null
          company_id: string | null
          created_at: string
          created_by: string
          csll_rate: number | null
          customer_id: string | null
          description: string | null
          discount_amount: number | null
          due_date: string
          gross_amount: number
          id: string
          installment: number | null
          invoice_key: string | null
          invoice_number: string | null
          invoice_pdf_url: string | null
          invoice_status: string | null
          invoice_xml_url: string | null
          irpj_rate: number | null
          is_recurring: boolean | null
          iss_rate: number | null
          net_amount: number
          payment_date: string | null
          pis_rate: number | null
          supplier_id: string | null
          tax_regime: string | null
          total_installments: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          category_id: string
          cofins_rate?: number | null
          company_id?: string | null
          created_at?: string
          created_by: string
          csll_rate?: number | null
          customer_id?: string | null
          description?: string | null
          discount_amount?: number | null
          due_date: string
          gross_amount: number
          id?: string
          installment?: number | null
          invoice_key?: string | null
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          invoice_status?: string | null
          invoice_xml_url?: string | null
          irpj_rate?: number | null
          is_recurring?: boolean | null
          iss_rate?: number | null
          net_amount: number
          payment_date?: string | null
          pis_rate?: number | null
          supplier_id?: string | null
          tax_regime?: string | null
          total_installments?: number | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          category_id?: string
          cofins_rate?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          csll_rate?: number | null
          customer_id?: string | null
          description?: string | null
          discount_amount?: number | null
          due_date?: string
          gross_amount?: number
          id?: string
          installment?: number | null
          invoice_key?: string | null
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          invoice_status?: string | null
          invoice_xml_url?: string | null
          irpj_rate?: number | null
          is_recurring?: boolean | null
          iss_rate?: number | null
          net_amount?: number
          payment_date?: string | null
          pis_rate?: number | null
          supplier_id?: string | null
          tax_regime?: string | null
          total_installments?: number | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role_level: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "SUPERADMIN" | "ADMIN" | "FINANCEIRO" | "FISCAL" | "VIEWER"
      person_type: "PF" | "PJ"
      transaction_type: "RECEIVABLE" | "PAYABLE"
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
      app_role: ["SUPERADMIN", "ADMIN", "FINANCEIRO", "FISCAL", "VIEWER"],
      person_type: ["PF", "PJ"],
      transaction_type: ["RECEIVABLE", "PAYABLE"],
    },
  },
} as const
