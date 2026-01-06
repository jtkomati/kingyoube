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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "accounting_chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "accounting_chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "accounting_chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "accounting_cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "accounting_cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "accounting_cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "accounting_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "accounting_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "accounting_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_entry_items: {
        Row: {
          account_id: string
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "accounting_entry_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "accounting_entry_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entry_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "accounting_entry_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "accounting_profit_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "accounting_profit_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_profit_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "accounting_profit_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "accounting_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "accounting_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "accounting_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_execution_logs: {
        Row: {
          action_type: string
          agent_id: string
          approval_queue_id: string | null
          company_id: string
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          status: string
          user_id: string | null
          workflow_instance_id: string | null
        }
        Insert: {
          action_type: string
          agent_id: string
          approval_queue_id?: string | null
          company_id: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          status?: string
          user_id?: string | null
          workflow_instance_id?: string | null
        }
        Update: {
          action_type?: string
          agent_id?: string
          approval_queue_id?: string | null
          company_id?: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          status?: string
          user_id?: string | null
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_execution_logs_approval_queue_id_fkey"
            columns: ["approval_queue_id"]
            isOneToOne: false
            referencedRelation: "approval_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_execution_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "agent_execution_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_execution_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agent_execution_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_execution_logs_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          created_at: string
          feedback_tags: string[] | null
          feedback_type: string
          id: string
          message_content: string
          message_index: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feedback_tags?: string[] | null
          feedback_type: string
          id?: string
          message_content: string
          message_index: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feedback_tags?: string[] | null
          feedback_type?: string
          id?: string
          message_content?: string
          message_index?: number
          user_id?: string | null
        }
        Relationships: []
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "ai_feedback_corrections_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_corrections_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_feedback_corrections_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          cost_estimated_cents: number
          created_at: string
          endpoint: string | null
          error_message: string | null
          fallback_used: boolean | null
          id: string
          intent: string | null
          latency_ms: number | null
          model_used: string
          original_provider: string | null
          provider_used: string
          request_metadata: Json | null
          success: boolean
          tenant_id: string
          tokens_input: number
          tokens_output: number
          user_id: string
        }
        Insert: {
          cost_estimated_cents?: number
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          fallback_used?: boolean | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          model_used: string
          original_provider?: string | null
          provider_used: string
          request_metadata?: Json | null
          success?: boolean
          tenant_id: string
          tokens_input?: number
          tokens_output?: number
          user_id: string
        }
        Update: {
          cost_estimated_cents?: number
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          fallback_used?: boolean | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          model_used?: string
          original_provider?: string | null
          provider_used?: string
          request_metadata?: Json | null
          success?: boolean
          tenant_id?: string
          tokens_input?: number
          tokens_output?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_usage_logs_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "fk_ai_usage_logs_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ai_usage_logs_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_ai_usage_logs_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_logs: {
        Row: {
          context: Json | null
          created_at: string
          duration_ms: number | null
          error_stack: string | null
          function_name: string | null
          id: string
          level: string
          message: string
          organization_id: string | null
          page_url: string | null
          request_id: string | null
          source: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_stack?: string | null
          function_name?: string | null
          id?: string
          level: string
          message: string
          organization_id?: string | null
          page_url?: string | null
          request_id?: string | null
          source: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_stack?: string | null
          function_name?: string | null
          id?: string
          level?: string
          message?: string
          organization_id?: string | null
          page_url?: string | null
          request_id?: string | null
          source?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      approval_queue: {
        Row: {
          action_type: string
          agent_id: string
          auto_approved: boolean | null
          company_id: string
          created_at: string | null
          id: string
          priority: number | null
          request_data: Json
          requested_at: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          workflow_instance_id: string | null
        }
        Insert: {
          action_type: string
          agent_id: string
          auto_approved?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          priority?: number | null
          request_data?: Json
          requested_at?: string | null
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          workflow_instance_id?: string | null
        }
        Update: {
          action_type?: string
          agent_id?: string
          auto_approved?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          priority?: number | null
          request_data?: Json
          requested_at?: string | null
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "approval_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "approval_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_queue_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
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
          organization_id: string | null
          user_id: string | null
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          organization_id?: string | null
          user_id?: string | null
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          organization_id?: string | null
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_communications: {
        Row: {
          attachments: Json | null
          channel: string
          company_id: string
          content: string
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          max_retries: number | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          channel: string
          company_id: string
          content: string
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          channel?: string
          company_id?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automated_communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "automated_communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automated_communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json | null
          agent_id: string
          approval_threshold: number | null
          auto_approve_below: number | null
          company_id: string
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          requires_approval: boolean | null
          rule_name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          agent_id: string
          approval_threshold?: number | null
          auto_approve_below?: number | null
          company_id: string
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          requires_approval?: boolean | null
          rule_name: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          agent_id?: string
          approval_threshold?: number | null
          auto_approve_below?: number | null
          company_id?: string
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          requires_approval?: boolean | null
          rule_name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          access_token: string | null
          account_hash: string | null
          account_number: string | null
          account_type: string | null
          agency: string | null
          api_environment: string | null
          auto_sync_enabled: boolean | null
          balance: number | null
          bank_code: string | null
          bank_name: string
          certificate_path: string | null
          client_id: string | null
          client_secret: string | null
          company_id: string | null
          consent_expires_at: string | null
          consent_link: string | null
          created_at: string
          currency: string | null
          dda_activated: boolean | null
          id: string
          last_sync_at: string | null
          open_finance_consent_id: string | null
          open_finance_status: string | null
          permissions_granted: string[] | null
          plugbank_account_id: string | null
          pluggy_account_id: string | null
          pluggy_item_id: string | null
          refresh_token: string | null
          tecnospeed_item_id: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_hash?: string | null
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          api_environment?: string | null
          auto_sync_enabled?: boolean | null
          balance?: number | null
          bank_code?: string | null
          bank_name: string
          certificate_path?: string | null
          client_id?: string | null
          client_secret?: string | null
          company_id?: string | null
          consent_expires_at?: string | null
          consent_link?: string | null
          created_at?: string
          currency?: string | null
          dda_activated?: boolean | null
          id?: string
          last_sync_at?: string | null
          open_finance_consent_id?: string | null
          open_finance_status?: string | null
          permissions_granted?: string[] | null
          plugbank_account_id?: string | null
          pluggy_account_id?: string | null
          pluggy_item_id?: string | null
          refresh_token?: string | null
          tecnospeed_item_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_hash?: string | null
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          api_environment?: string | null
          auto_sync_enabled?: boolean | null
          balance?: number | null
          bank_code?: string | null
          bank_name?: string
          certificate_path?: string | null
          client_id?: string | null
          client_secret?: string | null
          company_id?: string | null
          consent_expires_at?: string | null
          consent_link?: string | null
          created_at?: string
          currency?: string | null
          dda_activated?: boolean | null
          id?: string
          last_sync_at?: string | null
          open_finance_consent_id?: string | null
          open_finance_status?: string | null
          permissions_granted?: string[] | null
          plugbank_account_id?: string | null
          pluggy_account_id?: string | null
          pluggy_item_id?: string | null
          refresh_token?: string | null
          tecnospeed_item_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_payments: {
        Row: {
          account_hash: string
          amount: number
          barcode: string | null
          beneficiary_account: string | null
          beneficiary_agency: string | null
          beneficiary_bank_code: string | null
          beneficiary_cpf_cnpj: string | null
          beneficiary_name: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          discount_amount: number | null
          due_date: string | null
          effective_date: string | null
          fee_amount: number | null
          fine_amount: number | null
          id: string
          interest_amount: number | null
          metadata: Json | null
          nominal_amount: number | null
          occurrences: Json | null
          payment_date: string | null
          payment_form: string
          payment_type: string
          pix_key: string | null
          pix_txid: string | null
          pix_type: string | null
          reconciliation_linked: Json | null
          remittance_linked: Json | null
          status: string | null
          tags: string[] | null
          transaction_id: string | null
          unique_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_hash: string
          amount: number
          barcode?: string | null
          beneficiary_account?: string | null
          beneficiary_agency?: string | null
          beneficiary_bank_code?: string | null
          beneficiary_cpf_cnpj?: string | null
          beneficiary_name?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          due_date?: string | null
          effective_date?: string | null
          fee_amount?: number | null
          fine_amount?: number | null
          id?: string
          interest_amount?: number | null
          metadata?: Json | null
          nominal_amount?: number | null
          occurrences?: Json | null
          payment_date?: string | null
          payment_form: string
          payment_type: string
          pix_key?: string | null
          pix_txid?: string | null
          pix_type?: string | null
          reconciliation_linked?: Json | null
          remittance_linked?: Json | null
          status?: string | null
          tags?: string[] | null
          transaction_id?: string | null
          unique_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_hash?: string
          amount?: number
          barcode?: string | null
          beneficiary_account?: string | null
          beneficiary_agency?: string | null
          beneficiary_bank_code?: string | null
          beneficiary_cpf_cnpj?: string | null
          beneficiary_name?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          due_date?: string | null
          effective_date?: string | null
          fee_amount?: number | null
          fine_amount?: number | null
          id?: string
          interest_amount?: number | null
          metadata?: Json | null
          nominal_amount?: number | null
          occurrences?: Json | null
          payment_date?: string | null
          payment_form?: string
          payment_type?: string
          pix_key?: string | null
          pix_txid?: string | null
          pix_type?: string | null
          reconciliation_linked?: Json | null
          remittance_linked?: Json | null
          status?: string | null
          tags?: string[] | null
          transaction_id?: string | null
          unique_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "bank_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          amount: number
          balance: number | null
          bank_account_id: string
          category: string | null
          category_confidence: number | null
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          imported_at: string
          imported_by: string
          linked_transaction_id: string | null
          reconciliation_status: string | null
          statement_date: string
          transaction_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          balance?: number | null
          bank_account_id: string
          category?: string | null
          category_confidence?: number | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          imported_at?: string
          imported_by: string
          linked_transaction_id?: string | null
          reconciliation_status?: string | null
          statement_date: string
          transaction_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          balance?: number | null
          bank_account_id?: string
          category?: string | null
          category_confidence?: number | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string
          linked_transaction_id?: string | null
          reconciliation_status?: string | null
          statement_date?: string
          transaction_id?: string | null
          type?: string | null
          updated_at?: string | null
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
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "budget_targets_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_targets_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "budget_targets_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "budget_variance_analysis_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_variance_analysis_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "budget_variance_analysis_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_rules: {
        Row: {
          context: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          logic: Json
          rule_name: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          context: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_active?: boolean
          logic?: Json
          rule_name: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          context?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          logic?: Json
          rule_name?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_categories_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "fk_categories_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_categories_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_categories_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados_digitais: {
        Row: {
          ativo: boolean | null
          certificado_id: string | null
          cnpj: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          file_url: string | null
          id: string
          nome: string | null
          updated_at: string | null
          vencimento: string | null
        }
        Insert: {
          ativo?: boolean | null
          certificado_id?: string | null
          cnpj?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          nome?: string | null
          updated_at?: string | null
          vencimento?: string | null
        }
        Update: {
          ativo?: boolean | null
          certificado_id?: string | null
          cnpj?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          nome?: string | null
          updated_at?: string | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_certificado_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "fk_certificado_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_certificado_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_certificado_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "cfo_alerts_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfo_alerts_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cfo_alerts_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "cfo_partner_roi_tracking_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfo_partner_roi_tracking_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cfo_partner_roi_tracking_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          accountant_crc: string | null
          accountant_email: string | null
          accountant_firm_name: string | null
          accountant_linked_at: string | null
          accountant_user_id: string | null
          address: string | null
          address_number: string | null
          cfo_partner_id: string | null
          city: string | null
          city_code: string | null
          cnpj: string
          company_name: string
          company_number: number | null
          created_at: string
          id: string
          municipal_inscription: string | null
          neighborhood: string | null
          nfse_environment: string | null
          nfse_login: string | null
          nfse_password: string | null
          nome_fantasia: string | null
          notification_email: string | null
          plugbank_payer_id: string | null
          plugbank_status: string | null
          state: string | null
          state_inscription: string | null
          status: string | null
          tax_regime: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          accountant_crc?: string | null
          accountant_email?: string | null
          accountant_firm_name?: string | null
          accountant_linked_at?: string | null
          accountant_user_id?: string | null
          address?: string | null
          address_number?: string | null
          cfo_partner_id?: string | null
          city?: string | null
          city_code?: string | null
          cnpj: string
          company_name: string
          company_number?: number | null
          created_at?: string
          id?: string
          municipal_inscription?: string | null
          neighborhood?: string | null
          nfse_environment?: string | null
          nfse_login?: string | null
          nfse_password?: string | null
          nome_fantasia?: string | null
          notification_email?: string | null
          plugbank_payer_id?: string | null
          plugbank_status?: string | null
          state?: string | null
          state_inscription?: string | null
          status?: string | null
          tax_regime?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          accountant_crc?: string | null
          accountant_email?: string | null
          accountant_firm_name?: string | null
          accountant_linked_at?: string | null
          accountant_user_id?: string | null
          address?: string | null
          address_number?: string | null
          cfo_partner_id?: string | null
          city?: string | null
          city_code?: string | null
          cnpj?: string
          company_name?: string
          company_number?: number | null
          created_at?: string
          id?: string
          municipal_inscription?: string | null
          neighborhood?: string | null
          nfse_environment?: string | null
          nfse_login?: string | null
          nfse_password?: string | null
          nome_fantasia?: string | null
          notification_email?: string | null
          plugbank_payer_id?: string | null
          plugbank_status?: string | null
          state?: string | null
          state_inscription?: string | null
          status?: string | null
          tax_regime?: string | null
          updated_at?: string
          zip_code?: string | null
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
      config_fiscal: {
        Row: {
          api_status: string | null
          client_id: string
          client_secret: string
          company_id: string | null
          created_at: string
          id: string
          last_connection_test: string | null
          plugnotas_environment: string | null
          plugnotas_last_test: string | null
          plugnotas_status: string | null
          plugnotas_token: string | null
          prefeitura_inscricao_municipal: string | null
          prefeitura_login: string | null
          tecnospeed_tomadas_ativo: boolean | null
          tecnospeed_tomadas_last_sync: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_status?: string | null
          client_id: string
          client_secret: string
          company_id?: string | null
          created_at?: string
          id?: string
          last_connection_test?: string | null
          plugnotas_environment?: string | null
          plugnotas_last_test?: string | null
          plugnotas_status?: string | null
          plugnotas_token?: string | null
          prefeitura_inscricao_municipal?: string | null
          prefeitura_login?: string | null
          tecnospeed_tomadas_ativo?: boolean | null
          tecnospeed_tomadas_last_sync?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_status?: string | null
          client_id?: string
          client_secret?: string
          company_id?: string | null
          created_at?: string
          id?: string
          last_connection_test?: string | null
          plugnotas_environment?: string | null
          plugnotas_last_test?: string | null
          plugnotas_status?: string | null
          plugnotas_token?: string | null
          prefeitura_inscricao_municipal?: string | null
          prefeitura_login?: string | null
          tecnospeed_tomadas_ativo?: boolean | null
          tecnospeed_tomadas_last_sync?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_fiscal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "config_fiscal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_fiscal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "config_fiscal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
          {
            foreignKeyName: "fk_contract_clauses_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "fk_contract_clauses_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contract_clauses_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_contract_clauses_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      dda_boletos: {
        Row: {
          account_hash: string
          barcode: string | null
          beneficiary_bank_code: string | null
          beneficiary_bank_name: string | null
          beneficiary_cpf_cnpj: string | null
          beneficiary_name: string | null
          company_id: string | null
          created_at: string | null
          dda_file_id: string | null
          description: string | null
          digitable_line: string | null
          discount_amount: number | null
          document_number: string | null
          due_date: string | null
          final_amount: number | null
          fine_amount: number | null
          id: string
          interest_amount: number | null
          issue_date: string | null
          nominal_amount: number | null
          our_number: string | null
          paid_at: string | null
          payment_id: string | null
          processed_at: string | null
          raw_data: Json | null
          status: string | null
          unique_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_hash: string
          barcode?: string | null
          beneficiary_bank_code?: string | null
          beneficiary_bank_name?: string | null
          beneficiary_cpf_cnpj?: string | null
          beneficiary_name?: string | null
          company_id?: string | null
          created_at?: string | null
          dda_file_id?: string | null
          description?: string | null
          digitable_line?: string | null
          discount_amount?: number | null
          document_number?: string | null
          due_date?: string | null
          final_amount?: number | null
          fine_amount?: number | null
          id?: string
          interest_amount?: number | null
          issue_date?: string | null
          nominal_amount?: number | null
          our_number?: string | null
          paid_at?: string | null
          payment_id?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          status?: string | null
          unique_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_hash?: string
          barcode?: string | null
          beneficiary_bank_code?: string | null
          beneficiary_bank_name?: string | null
          beneficiary_cpf_cnpj?: string | null
          beneficiary_name?: string | null
          company_id?: string | null
          created_at?: string | null
          dda_file_id?: string | null
          description?: string | null
          digitable_line?: string | null
          discount_amount?: number | null
          document_number?: string | null
          due_date?: string | null
          final_amount?: number | null
          fine_amount?: number | null
          id?: string
          interest_amount?: number | null
          issue_date?: string | null
          nominal_amount?: number | null
          our_number?: string | null
          paid_at?: string | null
          payment_id?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          status?: string | null
          unique_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dda_boletos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "dda_boletos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dda_boletos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "dda_boletos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dda_boletos_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "bank_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      dda_sync_logs: {
        Row: {
          account_hash: string
          boletos_found: number | null
          boletos_new: number | null
          company_id: string | null
          completed_at: string | null
          error_message: string | null
          id: string
          started_at: string | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          account_hash: string
          boletos_found?: number | null
          boletos_new?: number | null
          company_id?: string | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          account_hash?: string
          boletos_found?: number | null
          boletos_new?: number | null
          company_id?: string | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dda_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "dda_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dda_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "dda_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          company_id: string
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string
          source_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id: string
          source_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "document_embeddings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_embeddings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "document_embeddings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_analytics: {
        Row: {
          created_at: string | null
          event_type: string
          field_name: string | null
          form_name: string
          id: string
          metadata: Json | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          field_name?: string | null
          form_name: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          field_name?: string | null
          form_name?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "incoming_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "incoming_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          crc: string | null
          created_at: string
          email: string
          expires_at: string
          firm_name: string | null
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          crc?: string | null
          created_at?: string
          email: string
          expires_at?: string
          firm_name?: string | null
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          crc?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          firm_name?: string | null
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_requests: {
        Row: {
          completed_at: string | null
          id: string
          notes: string | null
          processed_by: string | null
          request_type: string
          requested_at: string | null
          result_url: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          processed_by?: string | null
          request_type: string
          requested_at?: string | null
          result_url?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          processed_by?: string | null
          request_type?: string
          requested_at?: string | null
          result_url?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      open_finance_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          metadata: Json | null
          status: string | null
          transaction_date: string
          transaction_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          status?: string | null
          transaction_date: string
          transaction_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          status?: string | null
          transaction_date?: string
          transaction_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_finance_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_finance_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts_safe"
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
      payment_certificates: {
        Row: {
          account_hash: string
          active: boolean | null
          common_name: string | null
          company_id: string | null
          created_at: string | null
          expiration_date: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          account_hash: string
          active?: boolean | null
          common_name?: string | null
          company_id?: string | null
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          account_hash?: string
          active?: boolean | null
          common_name?: string | null
          company_id?: string | null
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "payment_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payment_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_remessas: {
        Row: {
          account_hash: string
          company_id: string | null
          created_at: string | null
          file_content: string | null
          id: string
          processed_at: string | null
          protocol: string | null
          remessa_type: string | null
          status: string | null
          unique_ids: string[] | null
        }
        Insert: {
          account_hash: string
          company_id?: string | null
          created_at?: string | null
          file_content?: string | null
          id?: string
          processed_at?: string | null
          protocol?: string | null
          remessa_type?: string | null
          status?: string | null
          unique_ids?: string[] | null
        }
        Update: {
          account_hash?: string
          company_id?: string | null
          created_at?: string | null
          file_content?: string | null
          id?: string
          processed_at?: string | null
          protocol?: string | null
          remessa_type?: string | null
          status?: string | null
          unique_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_remessas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "payment_remessas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_remessas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payment_remessas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_retornos: {
        Row: {
          account_hash: string
          company_id: string | null
          created_at: string | null
          file_content: string | null
          id: string
          processed_payments: Json | null
          status: string | null
          unique_id: string | null
        }
        Insert: {
          account_hash: string
          company_id?: string | null
          created_at?: string | null
          file_content?: string | null
          id?: string
          processed_payments?: Json | null
          status?: string | null
          unique_id?: string | null
        }
        Update: {
          account_hash?: string
          company_id?: string | null
          created_at?: string | null
          file_content?: string | null
          id?: string
          processed_payments?: Json | null
          status?: string | null
          unique_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_retornos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "payment_retornos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_retornos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payment_retornos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          unique_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          unique_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          unique_id?: string | null
        }
        Relationships: []
      }
      pluggy_connections: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          pluggy_item_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          pluggy_item_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          pluggy_item_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
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
          whatsapp_enabled: boolean | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone_number?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "sci_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sci_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sci_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_references: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          secret_type: string
          updated_at: string | null
          vault_secret_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          secret_type: string
          updated_at?: string | null
          vault_secret_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          secret_type?: string
          updated_at?: string | null
          vault_secret_id?: string
        }
        Relationships: []
      }
      solicitacoes_apuracao: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          periodo_apuracao: string
          resultado_url: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          periodo_apuracao: string
          resultado_url?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          periodo_apuracao?: string
          resultado_url?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_apuracao_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "solicitacoes_apuracao_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_apuracao_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "solicitacoes_apuracao_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      sync_protocols: {
        Row: {
          balance_difference: number | null
          balance_validated: boolean | null
          bank_account_id: string | null
          closing_balance: number | null
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          error_message: string | null
          id: string
          opening_balance: number | null
          plugbank_unique_id: string | null
          protocol_number: string | null
          records_imported: number | null
          start_date: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          balance_difference?: number | null
          balance_validated?: boolean | null
          bank_account_id?: string | null
          closing_balance?: number | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          error_message?: string | null
          id?: string
          opening_balance?: number | null
          plugbank_unique_id?: string | null
          protocol_number?: string | null
          records_imported?: number | null
          start_date?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          balance_difference?: number | null
          balance_validated?: boolean | null
          bank_account_id?: string | null
          closing_balance?: number | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          error_message?: string | null
          id?: string
          opening_balance?: number | null
          plugbank_unique_id?: string | null
          protocol_number?: string | null
          records_imported?: number | null
          start_date?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_protocols_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_protocols_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_payments: {
        Row: {
          active_debit: string | null
          bank_payment_id: string | null
          calculation_year: string | null
          company_id: string | null
          contributor_document: string
          contributor_name: string | null
          created_at: string | null
          crvl_withdrawal_option: number | null
          fgts_identifier: string | null
          honorary_amount: number | null
          id: string
          increase_amount: number | null
          installment: string | null
          metadata: Json | null
          monetary_adjustment: number | null
          municipal_code: string | null
          other_amount: number | null
          payment_option: number | null
          reference_number: string | null
          reference_period: string | null
          reporting_period: string | null
          revenue_code: string | null
          seal_social_connectivity: number | null
          seal_social_connectivity_digit: number | null
          state: string | null
          state_registration: string | null
          tax_amount: number | null
          tax_type: string
          vehicle_plates: string | null
          vehicle_renavam: string | null
        }
        Insert: {
          active_debit?: string | null
          bank_payment_id?: string | null
          calculation_year?: string | null
          company_id?: string | null
          contributor_document: string
          contributor_name?: string | null
          created_at?: string | null
          crvl_withdrawal_option?: number | null
          fgts_identifier?: string | null
          honorary_amount?: number | null
          id?: string
          increase_amount?: number | null
          installment?: string | null
          metadata?: Json | null
          monetary_adjustment?: number | null
          municipal_code?: string | null
          other_amount?: number | null
          payment_option?: number | null
          reference_number?: string | null
          reference_period?: string | null
          reporting_period?: string | null
          revenue_code?: string | null
          seal_social_connectivity?: number | null
          seal_social_connectivity_digit?: number | null
          state?: string | null
          state_registration?: string | null
          tax_amount?: number | null
          tax_type: string
          vehicle_plates?: string | null
          vehicle_renavam?: string | null
        }
        Update: {
          active_debit?: string | null
          bank_payment_id?: string | null
          calculation_year?: string | null
          company_id?: string | null
          contributor_document?: string
          contributor_name?: string | null
          created_at?: string | null
          crvl_withdrawal_option?: number | null
          fgts_identifier?: string | null
          honorary_amount?: number | null
          id?: string
          increase_amount?: number | null
          installment?: string | null
          metadata?: Json | null
          monetary_adjustment?: number | null
          municipal_code?: string | null
          other_amount?: number | null
          payment_option?: number | null
          reference_number?: string | null
          reference_period?: string | null
          reporting_period?: string | null
          revenue_code?: string | null
          seal_social_connectivity?: number | null
          seal_social_connectivity_digit?: number | null
          state?: string | null
          state_registration?: string | null
          tax_amount?: number | null
          tax_type?: string
          vehicle_plates?: string | null
          vehicle_renavam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_payments_bank_payment_id_fkey"
            columns: ["bank_payment_id"]
            isOneToOne: false
            referencedRelation: "bank_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "tax_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tax_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tomadas_consultas: {
        Row: {
          codigo_cidade: string
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          mensagem_erro: string | null
          nome_cidade: string | null
          notas_importadas: number | null
          periodo_final: string
          periodo_inicial: string
          protocolo: string
          situacao: string | null
          total_notas: number | null
          updated_at: string | null
        }
        Insert: {
          codigo_cidade: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          mensagem_erro?: string | null
          nome_cidade?: string | null
          notas_importadas?: number | null
          periodo_final: string
          periodo_inicial: string
          protocolo: string
          situacao?: string | null
          total_notas?: number | null
          updated_at?: string | null
        }
        Update: {
          codigo_cidade?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          mensagem_erro?: string | null
          nome_cidade?: string | null
          notas_importadas?: number | null
          periodo_final?: string
          periodo_inicial?: string
          protocolo?: string
          situacao?: string | null
          total_notas?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tomadas_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "fk_tomadas_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tomadas_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_tomadas_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_events: {
        Row: {
          company_id: string | null
          created_at: string
          event_data: Json
          event_type: string
          id: string
          previous_state: Json | null
          transaction_id: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          previous_state?: Json | null
          transaction_id: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          previous_state?: Json | null
          transaction_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "transaction_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transaction_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
          invoice_environment: string | null
          invoice_integration_id: string | null
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
          updated_by: string | null
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
          invoice_environment?: string | null
          invoice_integration_id?: string | null
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
          updated_by?: string | null
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
          invoice_environment?: string | null
          invoice_integration_id?: string | null
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
          updated_by?: string | null
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
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      user_consents: {
        Row: {
          consent_type: string
          consented: boolean
          consented_at: string | null
          id: string
          ip_address: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          consent_type: string
          consented?: boolean
          consented_at?: string | null
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
          version?: string
        }
        Update: {
          consent_type?: string
          consented?: boolean
          consented_at?: string | null
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_organizations: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      waitlist_leads: {
        Row: {
          city: string
          company: string
          company_name: string | null
          consent_timestamp: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          ip_address: string | null
          job_title: string
          marketing_accepted: boolean | null
          phone: string | null
          privacy_accepted: boolean
          role: string | null
          selected_plan: string
          source: string | null
          state: string
          synced_to_sheets: boolean | null
          terms_accepted: boolean
        }
        Insert: {
          city: string
          company: string
          company_name?: string | null
          consent_timestamp?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          ip_address?: string | null
          job_title: string
          marketing_accepted?: boolean | null
          phone?: string | null
          privacy_accepted?: boolean
          role?: string | null
          selected_plan: string
          source?: string | null
          state: string
          synced_to_sheets?: boolean | null
          terms_accepted?: boolean
        }
        Update: {
          city?: string
          company?: string
          company_name?: string | null
          consent_timestamp?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          ip_address?: string | null
          job_title?: string
          marketing_accepted?: boolean | null
          phone?: string | null
          privacy_accepted?: boolean
          role?: string | null
          selected_plan?: string
          source?: string | null
          state?: string
          synced_to_sheets?: boolean | null
          terms_accepted?: boolean
        }
        Relationships: []
      }
      workflow_definitions: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entity_type: string
          id: string
          is_active: boolean | null
          name: string
          states: Json
          transitions: Json
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean | null
          name: string
          states?: Json
          transitions?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          states?: Json
          transitions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "workflow_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "workflow_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_history: {
        Row: {
          action: string
          created_at: string
          from_state: string | null
          id: string
          instance_id: string
          metadata: Json | null
          notes: string | null
          to_state: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_state?: string | null
          id?: string
          instance_id: string
          metadata?: Json | null
          notes?: string | null
          to_state: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_state?: string | null
          id?: string
          instance_id?: string
          metadata?: Json | null
          notes?: string | null
          to_state?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_history_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string
          current_state: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          started_at: string
          started_by: string | null
          updated_at: string
          workflow_id: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_state: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          started_at?: string
          started_by?: string | null
          updated_at?: string
          workflow_id: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_state?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          started_at?: string
          started_by?: string | null
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "workflow_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "workflow_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      accountant_client_dashboard: {
        Row: {
          cfo_partner_id: string | null
          client_company_id: string | null
          client_name: string | null
          health_status: string | null
          last_transaction_date: string | null
          net_balance: number | null
          overdue_transactions: number | null
          pending_transactions: number | null
          total_payables: number | null
          total_receivables: number | null
          total_transactions: number | null
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
      bank_accounts_safe: {
        Row: {
          account_number: string | null
          account_type: string | null
          agency: string | null
          api_environment: string | null
          auto_sync_enabled: boolean | null
          balance: number | null
          bank_code: string | null
          bank_name: string | null
          company_id: string | null
          consent_expires_at: string | null
          created_at: string | null
          currency: string | null
          dda_activated: boolean | null
          id: string | null
          last_sync_at: string | null
          open_finance_consent_id: string | null
          open_finance_status: string | null
          plugbank_account_id: string | null
          pluggy_account_id: string | null
          pluggy_item_id: string | null
          tecnospeed_item_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          api_environment?: string | null
          auto_sync_enabled?: boolean | null
          balance?: number | null
          bank_code?: string | null
          bank_name?: string | null
          company_id?: string | null
          consent_expires_at?: string | null
          created_at?: string | null
          currency?: string | null
          dda_activated?: boolean | null
          id?: string | null
          last_sync_at?: string | null
          open_finance_consent_id?: string | null
          open_finance_status?: string | null
          plugbank_account_id?: string | null
          pluggy_account_id?: string | null
          pluggy_item_id?: string | null
          tecnospeed_item_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          api_environment?: string | null
          auto_sync_enabled?: boolean | null
          balance?: number | null
          bank_code?: string | null
          bank_name?: string | null
          company_id?: string | null
          consent_expires_at?: string | null
          created_at?: string | null
          currency?: string | null
          dda_activated?: boolean | null
          id?: string | null
          last_sync_at?: string | null
          open_finance_consent_id?: string | null
          open_finance_status?: string | null
          plugbank_account_id?: string | null
          pluggy_account_id?: string | null
          pluggy_item_id?: string | null
          tecnospeed_item_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "accountant_client_dashboard"
            referencedColumns: ["client_company_id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_cfo_client_summary"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_cfo_client_summary: {
        Row: {
          cfo_partner_id: string | null
          company_id: string | null
          company_name: string | null
          health_status: string | null
          last_transaction_date: string | null
          net_balance: number | null
          overdue_transactions: number | null
          pending_transactions: number | null
          total_payables: number | null
          total_receivables: number | null
          total_transactions: number | null
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
      organizations: {
        Row: {
          address: string | null
          cfo_partner_id: string | null
          city_code: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string | null
          id: string | null
          municipal_inscription: string | null
          nome_fantasia: string | null
          notification_email: string | null
          state_inscription: string | null
          status: string | null
          tax_regime: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cfo_partner_id?: string | null
          city_code?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string | null
          municipal_inscription?: string | null
          nome_fantasia?: string | null
          notification_email?: string | null
          state_inscription?: string | null
          status?: string | null
          tax_regime?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cfo_partner_id?: string | null
          city_code?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string | null
          municipal_inscription?: string | null
          nome_fantasia?: string | null
          notification_email?: string | null
          state_inscription?: string | null
          status?: string | null
          tax_regime?: string | null
          updated_at?: string | null
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
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      check_error_threshold: { Args: never; Returns: undefined }
      delete_secret: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_secret_type: string
        }
        Returns: boolean
      }
      get_accountant_dashboard: {
        Args: never
        Returns: {
          cfo_partner_id: string
          client_company_id: string
          client_name: string
          health_status: string
          last_transaction_date: string
          net_balance: number
          overdue_transactions: number
          pending_transactions: number
          total_payables: number
          total_receivables: number
          total_transactions: number
        }[]
      }
      get_ai_usage_summary: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          avg_latency_ms: number
          provider: string
          total_calls: number
          total_cost_cents: number
          total_tokens_input: number
          total_tokens_output: number
        }[]
      }
      get_cfo_client_summary: {
        Args: { _cfo_partner_id: string }
        Returns: {
          cfo_partner_id: string
          company_id: string
          company_name: string
          health_status: string
          last_transaction_date: string
          net_balance: number
          overdue_transactions: number
          pending_transactions: number
          total_payables: number
          total_receivables: number
          total_transactions: number
        }[]
      }
      get_current_organization_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_error_metrics: {
        Args: { p_hours?: number }
        Returns: {
          error_rate_per_hour: Json
          errors_by_function: Json
          errors_by_source: Json
          top_error_messages: Json
          total_errors: number
        }[]
      }
      get_pending_approvals_count: {
        Args: { _company_id: string }
        Returns: {
          agent_id: string
          pending_count: number
          urgent_count: number
        }[]
      }
      get_secret: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_secret_type: string
        }
        Returns: string
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_organization_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_role_level: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_approval: {
        Args: { p_action: string; p_approval_id: string; p_notes?: string }
        Returns: Json
      }
      refresh_cfo_summary: { Args: never; Returns: undefined }
      search_embeddings: {
        Args: {
          p_company_id: string
          p_limit?: number
          p_query_embedding: string
          p_source_type?: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
      store_secret: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_secret_type: string
          p_secret_value: string
        }
        Returns: string
      }
      workflow_transition: {
        Args: {
          p_action: string
          p_instance_id: string
          p_notes?: string
          p_to_state: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "SUPERADMIN"
        | "ADMIN"
        | "FINANCEIRO"
        | "FISCAL"
        | "VIEWER"
        | "CONTADOR"
        | "USUARIO"
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
      app_role: [
        "SUPERADMIN",
        "ADMIN",
        "FINANCEIRO",
        "FISCAL",
        "VIEWER",
        "CONTADOR",
        "USUARIO",
      ],
      person_type: ["PF", "PJ"],
      transaction_type: ["RECEIVABLE", "PAYABLE"],
    },
  },
} as const
