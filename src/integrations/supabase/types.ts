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
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      combos: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          discount_percentage: number
          id: string
          image_url: string | null
          name: string
          original_price: number
          price: number
          products: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          discount_percentage?: number
          id?: string
          image_url?: string | null
          name: string
          original_price?: number
          price?: number
          products?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          discount_percentage?: number
          id?: string
          image_url?: string | null
          name?: string
          original_price?: number
          price?: number
          products?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          neighborhood: string | null
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          neighborhood?: string | null
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          neighborhood?: string | null
          phone?: string
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
      delivery_zones: {
        Row: {
          active: boolean | null
          coverage_area: Json | null
          created_at: string
          delivery_fee: number
          delivery_time: string | null
          id: string
          minimum_order: number | null
          name: string
          postal_codes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          coverage_area?: Json | null
          created_at?: string
          delivery_fee?: number
          delivery_time?: string | null
          id?: string
          minimum_order?: number | null
          name: string
          postal_codes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          coverage_area?: Json | null
          created_at?: string
          delivery_fee?: number
          delivery_time?: string | null
          id?: string
          minimum_order?: number | null
          name?: string
          postal_codes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fiscal_settings: {
        Row: {
          ambiente: string
          ativo: boolean | null
          certificado_a1_base64: string | null
          certificado_senha: string | null
          cnpj: string
          codigo_municipio: string
          created_at: string
          csc_id: string | null
          csc_token: string | null
          endereco_bairro: string
          endereco_cep: string
          endereco_complemento: string | null
          endereco_logradouro: string
          endereco_municipio: string
          endereco_numero: string
          endereco_uf: string
          id: string
          inscricao_estadual: string | null
          nfce_numero_atual: number
          nfce_serie: string
          nome_fantasia: string | null
          razao_social: string
          regime_tributario: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ambiente?: string
          ativo?: boolean | null
          certificado_a1_base64?: string | null
          certificado_senha?: string | null
          cnpj: string
          codigo_municipio: string
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          endereco_bairro: string
          endereco_cep: string
          endereco_complemento?: string | null
          endereco_logradouro: string
          endereco_municipio: string
          endereco_numero: string
          endereco_uf: string
          id?: string
          inscricao_estadual?: string | null
          nfce_numero_atual?: number
          nfce_serie?: string
          nome_fantasia?: string | null
          razao_social: string
          regime_tributario?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ambiente?: string
          ativo?: boolean | null
          certificado_a1_base64?: string | null
          certificado_senha?: string | null
          cnpj?: string
          codigo_municipio?: string
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          endereco_bairro?: string
          endereco_cep?: string
          endereco_complemento?: string | null
          endereco_logradouro?: string
          endereco_municipio?: string
          endereco_numero?: string
          endereco_uf?: string
          id?: string
          inscricao_estadual?: string | null
          nfce_numero_atual?: number
          nfce_serie?: string
          nome_fantasia?: string | null
          razao_social?: string
          regime_tributario?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      global_variations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_selections: number
          name: string
          options: Json
          required: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_selections?: number
          name: string
          options?: Json
          required?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_selections?: number
          name?: string
          options?: Json
          required?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kitchen_orders: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string | null
          id: string
          items: Json
          order_number: string
          priority: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          items?: Json
          order_number: string
          priority?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          items?: Json
          order_number?: string
          priority?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_customers: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          points: number | null
          total_spent: number | null
          updated_at: string
          user_id: string
          visits_count: number | null
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          points?: number | null
          total_spent?: number | null
          updated_at?: string
          user_id: string
          visits_count?: number | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          points?: number | null
          total_spent?: number | null
          updated_at?: string
          user_id?: string
          visits_count?: number | null
        }
        Relationships: []
      }
      loyalty_redemptions: {
        Row: {
          customer_id: string
          id: string
          points_used: number
          redeemed_at: string
          reward_id: string
          used: boolean | null
        }
        Insert: {
          customer_id: string
          id?: string
          points_used: number
          redeemed_at?: string
          reward_id: string
          used?: boolean | null
        }
        Update: {
          customer_id?: string
          id?: string
          points_used?: number
          redeemed_at?: string
          reward_id?: string
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "loyalty_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          id: string
          name: string
          points_required: number
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          points_required: number
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          points_required?: number
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
      nfce_contingency: {
        Row: {
          cupom_id: string
          data_hora_contingencia: string
          data_hora_transmissao: string | null
          id: string
          motivo_contingencia: string
          transmitido: boolean | null
          user_id: string
        }
        Insert: {
          cupom_id: string
          data_hora_contingencia?: string
          data_hora_transmissao?: string | null
          id?: string
          motivo_contingencia: string
          transmitido?: boolean | null
          user_id: string
        }
        Update: {
          cupom_id?: string
          data_hora_contingencia?: string
          data_hora_transmissao?: string | null
          id?: string
          motivo_contingencia?: string
          transmitido?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfce_contingency_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "nfce_cupons"
            referencedColumns: ["id"]
          },
        ]
      }
      nfce_cupons: {
        Row: {
          chave_acesso: string | null
          consumidor_cpf_cnpj: string | null
          consumidor_nome: string | null
          contingencia: boolean | null
          created_at: string
          data_hora_autorizacao: string | null
          data_hora_emissao: string
          id: string
          motivo_rejeicao: string | null
          numero: number
          order_id: string | null
          protocolo_autorizacao: string | null
          qr_code_url: string | null
          serie: string
          status: string
          updated_at: string
          user_id: string
          valor_desconto: number | null
          valor_total: number
          valor_tributos: number | null
          xml_autorizado: string | null
          xml_content: string | null
        }
        Insert: {
          chave_acesso?: string | null
          consumidor_cpf_cnpj?: string | null
          consumidor_nome?: string | null
          contingencia?: boolean | null
          created_at?: string
          data_hora_autorizacao?: string | null
          data_hora_emissao?: string
          id?: string
          motivo_rejeicao?: string | null
          numero: number
          order_id?: string | null
          protocolo_autorizacao?: string | null
          qr_code_url?: string | null
          serie: string
          status?: string
          updated_at?: string
          user_id: string
          valor_desconto?: number | null
          valor_total: number
          valor_tributos?: number | null
          xml_autorizado?: string | null
          xml_content?: string | null
        }
        Update: {
          chave_acesso?: string | null
          consumidor_cpf_cnpj?: string | null
          consumidor_nome?: string | null
          contingencia?: boolean | null
          created_at?: string
          data_hora_autorizacao?: string | null
          data_hora_emissao?: string
          id?: string
          motivo_rejeicao?: string | null
          numero?: number
          order_id?: string | null
          protocolo_autorizacao?: string | null
          qr_code_url?: string | null
          serie?: string
          status?: string
          updated_at?: string
          user_id?: string
          valor_desconto?: number | null
          valor_total?: number
          valor_tributos?: number | null
          xml_autorizado?: string | null
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfce_cupons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfce_cupons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pending_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      nfce_items: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_pis: number | null
          cfop: string | null
          codigo_produto: string
          created_at: string
          cst_cofins: string | null
          cst_icms: string | null
          cst_pis: string | null
          cupom_id: string
          descricao: string
          id: string
          informacoes_adicionais: string | null
          ncm: string | null
          product_id: string | null
          quantidade: number
          unidade: string | null
          valor_cofins: number | null
          valor_desconto: number | null
          valor_icms: number | null
          valor_pis: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          cfop?: string | null
          codigo_produto: string
          created_at?: string
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          cupom_id: string
          descricao: string
          id?: string
          informacoes_adicionais?: string | null
          ncm?: string | null
          product_id?: string | null
          quantidade: number
          unidade?: string | null
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_icms?: number | null
          valor_pis?: number | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          cfop?: string | null
          codigo_produto?: string
          created_at?: string
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          cupom_id?: string
          descricao?: string
          id?: string
          informacoes_adicionais?: string | null
          ncm?: string | null
          product_id?: string | null
          quantidade?: number
          unidade?: string | null
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_icms?: number | null
          valor_pis?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfce_items_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "nfce_cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfce_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      nfce_transmissions: {
        Row: {
          codigo_status: string | null
          cupom_id: string
          data_hora: string
          id: string
          motivo: string | null
          protocolo: string | null
          sucesso: boolean
          tipo_operacao: string
          xml_enviado: string | null
          xml_retorno: string | null
        }
        Insert: {
          codigo_status?: string | null
          cupom_id: string
          data_hora?: string
          id?: string
          motivo?: string | null
          protocolo?: string | null
          sucesso?: boolean
          tipo_operacao: string
          xml_enviado?: string | null
          xml_retorno?: string | null
        }
        Update: {
          codigo_status?: string | null
          cupom_id?: string
          data_hora?: string
          id?: string
          motivo?: string | null
          protocolo?: string | null
          sucesso?: boolean
          tipo_operacao?: string
          xml_enviado?: string | null
          xml_retorno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfce_transmissions_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "nfce_cupons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          custom_bell_url: string | null
          custom_chime_url: string | null
          custom_ding_url: string | null
          custom_notification_url: string | null
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
          custom_bell_url?: string | null
          custom_chime_url?: string | null
          custom_ding_url?: string | null
          custom_notification_url?: string | null
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
          custom_bell_url?: string | null
          custom_chime_url?: string | null
          custom_ding_url?: string | null
          custom_notification_url?: string | null
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
          acceptance_status: string | null
          change_amount: number | null
          created_at: string
          customer_address: string | null
          customer_id: string | null
          customer_latitude: number | null
          customer_location_accuracy: number | null
          customer_longitude: number | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          delivery_instructions: string | null
          delivery_zone_id: string | null
          estimated_delivery_time: string | null
          estimated_time: string | null
          google_maps_link: string | null
          id: string
          items: Json
          order_number: string | null
          order_type: string | null
          payment_method: string
          status: string
          table_id: string | null
          total: number
          updated_at: string
          user_id: string
          variations: Json | null
        }
        Insert: {
          acceptance_status?: string | null
          change_amount?: number | null
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_latitude?: number | null
          customer_location_accuracy?: number | null
          customer_longitude?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_instructions?: string | null
          delivery_zone_id?: string | null
          estimated_delivery_time?: string | null
          estimated_time?: string | null
          google_maps_link?: string | null
          id?: string
          items: Json
          order_number?: string | null
          order_type?: string | null
          payment_method: string
          status: string
          table_id?: string | null
          total: number
          updated_at?: string
          user_id: string
          variations?: Json | null
        }
        Update: {
          acceptance_status?: string | null
          change_amount?: number | null
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_latitude?: number | null
          customer_location_accuracy?: number | null
          customer_longitude?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_instructions?: string | null
          delivery_zone_id?: string | null
          estimated_delivery_time?: string | null
          estimated_time?: string | null
          google_maps_link?: string | null
          id?: string
          items?: Json
          order_number?: string | null
          order_type?: string | null
          payment_method?: string
          status?: string
          table_id?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          variations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_global_variation_links: {
        Row: {
          created_at: string
          global_variation_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          global_variation_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          global_variation_id?: string
          id?: string
          product_id?: string
        }
        Relationships: []
      }
      product_variation_links: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          variation_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          variation_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variation_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variation_links_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_selections: number | null
          name: string
          options: Json | null
          price: number
          product_id: string
          required: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_selections?: number | null
          name: string
          options?: Json | null
          price?: number
          product_id: string
          required?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_selections?: number | null
          name?: string
          options?: Json | null
          price?: number
          product_id?: string
          required?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean | null
          available_delivery: boolean | null
          available_pdv: boolean | null
          category: string
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          send_to_kds: boolean | null
          show_in_delivery: boolean | null
          show_in_pdv: boolean | null
          updated_at: string
          user_id: string
          weight_based: boolean | null
        }
        Insert: {
          available?: boolean | null
          available_delivery?: boolean | null
          available_pdv?: boolean | null
          category: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          send_to_kds?: boolean | null
          show_in_delivery?: boolean | null
          show_in_pdv?: boolean | null
          updated_at?: string
          user_id: string
          weight_based?: boolean | null
        }
        Update: {
          available?: boolean | null
          available_delivery?: boolean | null
          available_pdv?: boolean | null
          category?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          send_to_kds?: boolean | null
          show_in_delivery?: boolean | null
          show_in_pdv?: boolean | null
          updated_at?: string
          user_id?: string
          weight_based?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
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
          onboarding_completed: boolean | null
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
          onboarding_completed?: boolean | null
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
          onboarding_completed?: boolean | null
          opening_hours?: string | null
          phone?: string | null
          restaurant_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      promotional_banners: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          display_order: number | null
          end_date: string | null
          id: string
          image_url: string | null
          link_url: string | null
          start_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
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
      security_logs: {
        Row: {
          created_at: string | null
          description: string
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          event_type: string
          id?: string
          ip_address?: string | null
          severity: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
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
      support_messages: {
        Row: {
          created_at: string | null
          id: string
          is_staff: boolean | null
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_staff?: boolean | null
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_staff?: boolean | null
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          id: string
          message: string
          priority: string
          status: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      table_accounts: {
        Row: {
          created_at: string
          id: string
          items: Json
          status: string
          table_id: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          status?: string
          table_id: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          status?: string
          table_id?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_accounts_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          location: string | null
          status: string | null
          table_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          location?: string | null
          status?: string | null
          table_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          location?: string | null
          status?: string | null
          table_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string
          conversation_id: string
          delivered: boolean | null
          id: string
          message_type: string
          sender: string
          sent_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          delivered?: boolean | null
          id?: string
          message_type?: string
          sender: string
          sent_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          delivered?: boolean | null
          id?: string
          message_type?: string
          sender?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          ai_enabled: boolean | null
          auto_responses: Json | null
          created_at: string
          default_message: string
          enabled: boolean | null
          id: string
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_enabled?: boolean | null
          auto_responses?: Json | null
          created_at?: string
          default_message: string
          enabled?: boolean | null
          id?: string
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_enabled?: boolean | null
          auto_responses?: Json | null
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
      pending_orders: {
        Row: {
          acceptance_status: string | null
          change_amount: number | null
          created_at: string | null
          customer_address: string | null
          customer_id: string | null
          customer_latitude: number | null
          customer_location_accuracy: number | null
          customer_longitude: number | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          delivery_instructions: string | null
          delivery_zone_id: string | null
          estimated_delivery_time: string | null
          estimated_time: string | null
          google_maps_link: string | null
          id: string | null
          items: Json | null
          order_number: string | null
          order_type: string | null
          payment_method: string | null
          status: string | null
          table_id: string | null
          total: number | null
          updated_at: string | null
          user_id: string | null
          variations: Json | null
        }
        Insert: {
          acceptance_status?: string | null
          change_amount?: number | null
          created_at?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_latitude?: number | null
          customer_location_accuracy?: number | null
          customer_longitude?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_instructions?: string | null
          delivery_zone_id?: string | null
          estimated_delivery_time?: string | null
          estimated_time?: string | null
          google_maps_link?: string | null
          id?: string | null
          items?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          status?: string | null
          table_id?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
          variations?: Json | null
        }
        Update: {
          acceptance_status?: string | null
          change_amount?: number | null
          created_at?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_latitude?: number | null
          customer_location_accuracy?: number | null
          customer_longitude?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_instructions?: string | null
          delivery_zone_id?: string | null
          estimated_delivery_time?: string | null
          estimated_time?: string | null
          google_maps_link?: string | null
          id?: string | null
          items?: Json | null
          order_number?: string | null
          order_type?: string | null
          payment_method?: string | null
          status?: string | null
          table_id?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
          variations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_dv_mod11: {
        Args: { p_numero: string }
        Returns: number
      }
      generate_nfce_access_key: {
        Args: {
          p_uf: string
          p_aamm: string
          p_cnpj: string
          p_modelo: string
          p_serie: string
          p_numero: string
          p_tipo_emissao: string
          p_codigo_numerico: string
        }
        Returns: string
      }
      get_next_nfce_number: {
        Args: { p_user_id: string; p_serie: string }
        Returns: number
      }
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
