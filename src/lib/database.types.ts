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
      contacts: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          job_title: string | null
          company_id: string | null
          status: string
          source: string
          score: number
          tags: string[]
          notes: string | null
          assigned_to: string | null
          created_by: string | null
          last_contacted_at: string | null
          custom_fields: Json
          organization_id: string
        }
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      companies: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          industry: string | null
          size: string | null
          country: string | null
          city: string | null
          website: string | null
          revenue: number | null
          status: string
          tags: string[]
          notes: string | null
          created_by: string | null
          custom_fields: Json
          organization_id: string
        }
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      deals: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          value: number
          stage: string
          probability: number
          expected_close_date: string | null
          contact_id: string | null
          company_id: string | null
          assigned_to: string | null
          priority: string
          source: string | null
          notes: string | null
          quote_items: Json
          created_by: string | null
          custom_fields: Json
          organization_id: string
        }
        Insert: Omit<Database['public']['Tables']['deals']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['deals']['Insert']>
      }
      activities: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          type: string
          subject: string
          description: string | null
          status: string
          deal_id: string | null
          contact_id: string | null
          company_id: string | null
          due_date: string | null
          completed_at: string | null
          created_by: string | null
          assigned_to: string | null
          outcome: string | null
          organization_id: string
        }
        Insert: Omit<Database['public']['Tables']['activities']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['activities']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          created_at: string
          type: string
          title: string
          message: string
          entity_type: string | null
          entity_id: string | null
          user_id: string | null
          is_read: boolean
          organization_id: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      organizations: {
        Row: {
          id: string
          created_at: string
          name: string
          domain: string | null
          logo_url: string | null
          plan: string
          max_users: number
          settings: Json
        }
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          job_title: string | null
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          invited_by: string | null
          joined_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['organization_members']['Row'], 'joined_at' | 'created_at'> & {
          joined_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['organization_members']['Insert']>
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: string
          token: string
          invited_by: string
          status: string
          expires_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['invitations']['Row'], 'token' | 'created_at'> & {
          token?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>
      }
      gmail_tokens: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          access_token: string | null
          refresh_token: string
          token_type: string
          scope: string
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['gmail_tokens']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['gmail_tokens']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
