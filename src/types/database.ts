// Auto-generated types for Supabase schema
// Regenerate with: npx supabase gen types typescript --project-id mzjzwffpqubpruyaaxew > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'todo' | 'en_cours' | 'done'
          priority: 'haute' | 'normale' | 'basse'
          due_date: string | null
          assigned_to: 'naoufel' | 'emir' | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'todo' | 'en_cours' | 'done'
          priority?: 'haute' | 'normale' | 'basse'
          due_date?: string | null
          assigned_to?: 'naoufel' | 'emir' | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'todo' | 'en_cours' | 'done'
          priority?: 'haute' | 'normale' | 'basse'
          due_date?: string | null
          assigned_to?: 'naoufel' | 'emir' | null
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      dashboard_profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin_full' | 'admin_bizdev'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'admin_full' | 'admin_bizdev'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin_full' | 'admin_bizdev'
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_settings: {
        Row: {
          key: string
          value: string
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_documents: {
        Row: {
          id: string
          contract_id: string
          file_name: string
          file_path: string
          file_size: number
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          file_name: string
          file_path: string
          file_size?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          id: string
          organization_name: string
          organization_type: 'ecole' | 'cfa' | 'entreprise' | 'autre'
          status: 'prospect' | 'negotiation' | 'signe' | 'actif' | 'resilie'
          license_count: number
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          mrr_eur: number | null
          renewal_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          organization_name: string
          organization_type: 'ecole' | 'cfa' | 'entreprise' | 'autre'
          status?: 'prospect' | 'negotiation' | 'signe' | 'actif' | 'resilie'
          license_count?: number
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          mrr_eur?: number | null
          renewal_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          organization_name?: string
          organization_type?: 'ecole' | 'cfa' | 'entreprise' | 'autre'
          status?: 'prospect' | 'negotiation' | 'signe' | 'actif' | 'resilie'
          license_count?: number
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          mrr_eur?: number | null
          renewal_date?: string | null
          notes?: string | null
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      feedback_items: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'backlog' | 'planifie' | 'en_dev' | 'livre'
          category: 'fonctionnalite' | 'bug' | 'amelioration'
          author_name: string | null
          author_email: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'backlog' | 'planifie' | 'en_dev' | 'livre'
          category?: 'fonctionnalite' | 'bug' | 'amelioration'
          author_name?: string | null
          author_email?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'backlog' | 'planifie' | 'en_dev' | 'livre'
          category?: 'fonctionnalite' | 'bug' | 'amelioration'
          author_name?: string | null
          author_email?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feedback_votes: {
        Row: {
          id: string
          item_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          name: string
          type: 'ecole' | 'cfa' | 'entreprise' | 'autre'
          canal: 'linkedin' | 'email' | 'referral' | 'appel' | 'autre'
          status: 'nouveau' | 'contacte' | 'en_discussion' | 'proposition' | 'gagne' | 'perdu'
          next_action: string | null
          follow_up_date: string | null
          assigned_to: 'naoufel' | 'emir' | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          type: 'ecole' | 'cfa' | 'entreprise' | 'autre'
          canal: 'linkedin' | 'email' | 'referral' | 'appel' | 'autre'
          status?: 'nouveau' | 'contacte' | 'en_discussion' | 'proposition' | 'gagne' | 'perdu'
          next_action?: string | null
          follow_up_date?: string | null
          assigned_to?: 'naoufel' | 'emir' | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: 'ecole' | 'cfa' | 'entreprise' | 'autre'
          canal?: 'linkedin' | 'email' | 'referral' | 'appel' | 'autre'
          status?: 'nouveau' | 'contacte' | 'en_discussion' | 'proposition' | 'gagne' | 'perdu'
          next_action?: string | null
          follow_up_date?: string | null
          assigned_to?: 'naoufel' | 'emir' | null
          notes?: string | null
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      dashboard_notifications: {
        Row: {
          id: string
          user_id: string
          type: 'lead_stale' | 'email_critical' | 'new_lead' | 'stripe_cancel'
          title: string
          message: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'lead_stale' | 'email_critical' | 'new_lead' | 'stripe_cancel'
          title: string
          message: string
          read?: boolean
          created_at?: string
        }
        Update: {
          read?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      // ── Vue lecture seule — Module 9 Utilisateurs MEMOVIA ──────────────────
      // Joint profiles + auth.users + organizations. Aucune écriture.
      v_dashboard_users: {
        Row: {
          id: string                          // profiles.user_id
          email: string                       // auth.users.email
          first_name: string
          last_name: string | null
          plan: string | null                 // 'free' | 'pro' | 'b2b' | null
          account_type: string                // 'b2c' | 'b2b'
          subscription_status: string | null  // 'active' | 'canceled' | null
          subscription_price_family: string | null
          organization_id: string | null
          organization_name: string | null
          created_at: string
          last_sign_in_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      custom_access_token_hook: {
        Args: { event: Json }
        Returns: Json
      }
    }
    Enums: Record<string, never>
  }
}
