export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appearance_settings: {
        Row: {
          compact_mode: boolean | null
          created_at: string
          font_size: string | null
          high_contrast: boolean | null
          id: string
          primary_color: string | null
          reduced_motion: boolean | null
          show_animations: boolean | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compact_mode?: boolean | null
          created_at?: string
          font_size?: string | null
          high_contrast?: boolean | null
          id?: string
          primary_color?: string | null
          reduced_motion?: boolean | null
          show_animations?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compact_mode?: boolean | null
          created_at?: string
          font_size?: string | null
          high_contrast?: boolean | null
          id?: string
          primary_color?: string | null
          reduced_motion?: boolean | null
          show_animations?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_personnel: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          status: string
          updated_at: string
          user_id: string
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          status: string
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      delivery_settings: {
        Row: {
          created_at: string
          delivery_areas: Json | null
          google_maps_api_key: string | null
          id: string
          maps_integration_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_areas?: Json | null
          google_maps_api_key?: string | null
          id?: string
          maps_integration_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_areas?: Json | null
          google_maps_api_key?: string | null
          id?: string
          maps_integration_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_settings: {
        Row: {
          banner_images: Json | null
          created_at: string
          facebook_pixel_id: string | null
          google_tag_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          banner_images?: Json | null
          created_at?: string
          facebook_pixel_id?: string | null
          google_tag_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          banner_images?: Json | null
          created_at?: string
          facebook_pixel_id?: string | null
          google_tag_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          daily_reports: boolean | null
          email_notifications: boolean | null
          id: string
          low_stock: boolean | null
          new_orders: boolean | null
          order_sound: string | null
          order_updates: boolean | null
          push_notifications: boolean | null
          sms_notifications: boolean | null
          sound_enabled: boolean | null
          updated_at: string
          user_id: string
          volume: string | null
        }
        Insert: {
          created_at?: string
          daily_reports?: boolean | null
          email_notifications?: boolean | null
          id?: string
          low_stock?: boolean | null
          new_orders?: boolean | null
          order_sound?: string | null
          order_updates?: boolean | null
          push_notifications?: boolean | null
          sms_notifications?: boolean | null
          sound_enabled?: boolean | null
          updated_at?: string
          user_id: string
          volume?: string | null
        }
        Update: {
          created_at?: string
          daily_reports?: boolean | null
          email_notifications?: boolean | null
          id?: string
          low_stock?: boolean | null
          new_orders?: boolean | null
          order_sound?: string | null
          order_updates?: boolean | null
          push_notifications?: boolean | null
          sms_notifications?: boolean | null
          sound_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          volume?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          change_amount: number | null
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json
          payment_method: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          change_amount?: number | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items: Json
          payment_method: string
          status: string
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          change_amount?: number | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          payment_method?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          available: boolean | null
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          updated_at: string
          user_id: string
          weight_based: boolean | null
        }
        Insert: {
          available?: boolean | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          updated_at?: string
          user_id: string
          weight_based?: boolean | null
        }
        Update: {
          available?: boolean | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          updated_at?: string
          user_id?: string
          weight_based?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          delivery_fee: number | null
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          minimum_order: number | null
          opening_hours: string | null
          phone: string | null
          restaurant_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          delivery_fee?: number | null
          description?: string | null
          email?: string | null
          id: string
          logo_url?: string | null
          minimum_order?: number | null
          opening_hours?: string | null
          phone?: string | null
          restaurant_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          delivery_fee?: number | null
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          minimum_order?: number | null
          opening_hours?: string | null
          phone?: string | null
          restaurant_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      scale_settings: {
        Row: {
          auto_tare: boolean | null
          connected: boolean | null
          connection_type: string | null
          created_at: string
          device_name: string | null
          enabled: boolean | null
          id: string
          precision: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_tare?: boolean | null
          connected?: boolean | null
          connection_type?: string | null
          created_at?: string
          device_name?: string | null
          enabled?: boolean | null
          id?: string
          precision?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_tare?: boolean | null
          connected?: boolean | null
          connection_type?: string | null
          created_at?: string
          device_name?: string | null
          enabled?: boolean | null
          id?: string
          precision?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          description: string
          features: Json
          id: number
          name: string
          price: number
        }
        Insert: {
          description: string
          features: Json
          id?: number
          name: string
          price: number
        }
        Update: {
          description?: string
          features?: Json
          id?: number
          name?: string
          price?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: number | null
          status: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: number | null
          status: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: number | null
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          created_at: string
          default_message: string
          enabled: boolean | null
          id: string
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_message: string
          enabled?: boolean | null
          id?: string
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_message?: string
          enabled?: boolean | null
          id?: string
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
