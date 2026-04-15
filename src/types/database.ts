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
      }
    }
    Views: Record<string, never>
    Functions: {
      custom_access_token_hook: {
        Args: { event: Json }
        Returns: Json
      }
    }
    Enums: Record<string, never>
  }
}
