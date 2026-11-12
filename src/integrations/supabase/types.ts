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
      artist_images: {
        Row: {
          artist_id: string
          created_at: string
          display_order: number
          id: string
          image_url: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_images_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      blade_ai_access_state: {
        Row: {
          id: string
          paused: boolean
          reason: string | null
          status: number | null
          updated_at: string
        }
        Insert: {
          id: string
          paused?: boolean
          reason?: string | null
          status?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          paused?: boolean
          reason?: string | null
          status?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      blade_community_limits: {
        Row: {
          actor_hash: string
          count: number
          scope: string
          window_start: string
        }
        Insert: {
          actor_hash: string
          count?: number
          scope: string
          window_start: string
        }
        Update: {
          actor_hash?: string
          count?: number
          scope?: string
          window_start?: string
        }
        Relationships: []
      }
      blade_message_reads: {
        Row: {
          conversation_id: string
          provider_id: string
          read_at: string
        }
        Insert: {
          conversation_id: string
          provider_id: string
          read_at?: string
        }
        Update: {
          conversation_id?: string
          provider_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blade_message_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "blade_private_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blade_message_reads_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      blade_offer_replies: {
        Row: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          notified_at: string | null
          offer_id: string
        }
        Insert: {
          author_id: string
          author_name: string
          body: string
          created_at?: string
          id?: string
          notified_at?: string | null
          offer_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blade_offer_replies_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "blade_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      blade_offers: {
        Row: {
          author_id: string
          author_name: string
          body: string
          city: string | null
          created_at: string
          id: string
          offer_date: string | null
          price: number | null
          status: string
          title: string
        }
        Insert: {
          author_id: string
          author_name: string
          body: string
          city?: string | null
          created_at?: string
          id?: string
          offer_date?: string | null
          price?: number | null
          status?: string
          title: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          city?: string | null
          created_at?: string
          id?: string
          offer_date?: string | null
          price?: number | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      blade_private_conversations: {
        Row: {
          created_at: string
          id: string
          provider_a: string
          provider_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider_a: string
          provider_b: string
        }
        Update: {
          created_at?: string
          id?: string
          provider_a?: string
          provider_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "blade_private_conversations_provider_a_fkey"
            columns: ["provider_a"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blade_private_conversations_provider_b_fkey"
            columns: ["provider_b"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      blade_private_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          request_id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          request_id: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blade_private_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "blade_private_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blade_private_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      blade_providers: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      blade_public_profiles: {
        Row: {
          active: boolean
          booking_path: string | null
          city: string
          home: boolean
          latitude: number | null
          longitude: number | null
          name: string
          near: boolean
          photo_path: string | null
          provider_id: string
          updated_at: string
          zone: string
        }
        Insert: {
          active?: boolean
          booking_path?: string | null
          city: string
          home?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          near?: boolean
          photo_path?: string | null
          provider_id: string
          updated_at?: string
          zone: string
        }
        Update: {
          active?: boolean
          booking_path?: string | null
          city?: string
          home?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          near?: boolean
          photo_path?: string | null
          provider_id?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "blade_public_profiles_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      blade_publications: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          kind: string
          media_path: string
          mime_type: string
          provider_id: string
          published_at: string | null
          ready: boolean
          service_id: string
          size_bytes: number
          status: string
          thumbnail_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          kind: string
          media_path: string
          mime_type: string
          provider_id: string
          published_at?: string | null
          ready?: boolean
          service_id: string
          size_bytes: number
          status?: string
          thumbnail_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          kind?: string
          media_path?: string
          mime_type?: string
          provider_id?: string
          published_at?: string | null
          ready?: boolean
          service_id?: string
          size_bytes?: number
          status?: string
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blade_publications_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blade_publications_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      blade_work_likes: {
        Row: {
          actor_hash: string
          created_at: string
          publication_id: string
        }
        Insert: {
          actor_hash: string
          created_at?: string
          publication_id: string
        }
        Update: {
          actor_hash?: string
          created_at?: string
          publication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blade_work_likes_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "blade_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string
          id: string
          message: string | null
          mode: string | null
          preferred_date: string | null
          preferred_time: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          id?: string
          message?: string | null
          mode?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          id?: string
          message?: string | null
          mode?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          appointment_date: string
          appointment_time: string
          city_normalized: string | null
          client_address: string | null
          client_email: string
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          deposit_paid: boolean
          id: string
          notes: string | null
          provider_id: string | null
          service_id: string
          status: string
          total_price: number
          travel_fee: number | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          city_normalized?: string | null
          client_address?: string | null
          client_email: string
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          deposit_paid?: boolean
          id?: string
          notes?: string | null
          provider_id?: string | null
          service_id: string
          status?: string
          total_price: number
          travel_fee?: number | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          city_normalized?: string | null
          client_address?: string | null
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          deposit_paid?: boolean
          id?: string
          notes?: string | null
          provider_id?: string | null
          service_id?: string
          status?: string
          total_price?: number
          travel_fee?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_settings: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          mode: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean
          mode?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          mode?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      carnaval_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_merges: {
        Row: {
          created_at: string
          id: string
          merged_email: string
          original_client_name: string
          provider_id: string | null
          target_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          merged_email: string
          original_client_name: string
          provider_id?: string | null
          target_email: string
        }
        Update: {
          created_at?: string
          id?: string
          merged_email?: string
          original_client_name?: string
          provider_id?: string | null
          target_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_merges_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string
          id: string
          is_blacklisted: boolean
          name: string
          phone: string | null
          provider_id: string | null
          unpaid_amount: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          id?: string
          is_blacklisted?: boolean
          name: string
          phone?: string | null
          provider_id?: string | null
          unpaid_amount?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          id?: string
          is_blacklisted?: boolean
          name?: string
          phone?: string | null
          provider_id?: string | null
          unpaid_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      date_overrides: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_available: boolean
          mode: string
          reason: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          mode?: string
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          mode?: string
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string | null
          html_content: string
          id: string
          provider_id: string | null
          subject: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          html_content: string
          id?: string
          provider_id?: string | null
          subject: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          html_content?: string
          id?: string
          provider_id?: string | null
          subject?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          end_hour: string
          excluded_services: string | null
          id: string
          is_active: boolean
          name: string
          prix_barbe: number | null
          prix_contours: number | null
          prix_coupe_barbe: number | null
          prix_coupe_classique: number | null
          start_date: string
          start_hour: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          end_hour?: string
          excluded_services?: string | null
          id?: string
          is_active?: boolean
          name: string
          prix_barbe?: number | null
          prix_contours?: number | null
          prix_coupe_barbe?: number | null
          prix_coupe_classique?: number | null
          start_date: string
          start_hour?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          end_hour?: string
          excluded_services?: string | null
          id?: string
          is_active?: boolean
          name?: string
          prix_barbe?: number | null
          prix_contours?: number | null
          prix_coupe_barbe?: number | null
          prix_coupe_classique?: number | null
          start_date?: string
          start_hour?: string
          updated_at?: string
        }
        Relationships: []
      }
      haircuts: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      odometer_readings: {
        Row: {
          confirmed: boolean
          created_at: string
          id: string
          is_correction: boolean
          is_replacement: boolean
          notes: string | null
          reading_date: string
          source: string
          unit: string
          value: number
          vehicle_id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          id?: string
          is_correction?: boolean
          is_replacement?: boolean
          notes?: string | null
          reading_date?: string
          source?: string
          unit?: string
          value: number
          vehicle_id: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          id?: string
          is_correction?: boolean
          is_replacement?: boolean
          notes?: string | null
          reading_date?: string
          source?: string
          unit?: string
          value?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odometer_readings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_bookings: {
        Row: {
          appointment_date: string
          appointment_time: string
          client_address: string | null
          client_email: string
          client_name: string
          client_phone: string
          created_at: string
          expires_at: string
          id: string
          notes: string | null
          service_id: string
          total_price: number
          travel_fee: number | null
          updated_at: string
          verification_token: string
          verified: boolean
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          client_address?: string | null
          client_email: string
          client_name: string
          client_phone: string
          created_at?: string
          expires_at: string
          id?: string
          notes?: string | null
          service_id: string
          total_price: number
          travel_fee?: number | null
          updated_at?: string
          verification_token: string
          verified?: boolean
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          client_address?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          expires_at?: string
          id?: string
          notes?: string | null
          service_id?: string
          total_price?: number
          travel_fee?: number | null
          updated_at?: string
          verification_token?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pending_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      prestations: {
        Row: {
          amount: number
          booking_id: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          prestation_date: string
          provider_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          prestation_date?: string
          provider_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          prestation_date?: string
          provider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          provider_id: string | null
          setting_key: string
          setting_value: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          provider_id?: string | null
          setting_key: string
          setting_value: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          provider_id?: string | null
          setting_key?: string
          setting_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string
          user_id: string
          welcome_email_sent: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id: string
          welcome_email_sent?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
          welcome_email_sent?: boolean
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string | null
          client_email: string
          client_name: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          client_email: string
          client_name: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          client_email?: string
          client_name?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number
          provider_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          provider_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          provider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "blade_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_requests: {
        Row: {
          client_email: string
          client_name: string
          created_at: string
          email_error: string | null
          email_sent_at: string | null
          id: string
          message: string
          mode: string
          requested_date: string
          requested_time: string
          user_id: string
        }
        Insert: {
          client_email: string
          client_name: string
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          id: string
          message?: string
          mode: string
          requested_date: string
          requested_time: string
          user_id: string
        }
        Update: {
          client_email?: string
          client_name?: string
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          id?: string
          message?: string
          mode?: string
          requested_date?: string
          requested_time?: string
          user_id?: string
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
      vehicle_api_quota: {
        Row: {
          call_count: number
          id: string
          max_calls: number
          period: string
          provider: string
          updated_at: string
        }
        Insert: {
          call_count?: number
          id?: string
          max_calls?: number
          period: string
          provider: string
          updated_at?: string
        }
        Update: {
          call_count?: number
          id?: string
          max_calls?: number
          period?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_documents: {
        Row: {
          created_at: string
          doc_date: string | null
          doc_type: string
          id: string
          mime_type: string | null
          notes: string | null
          size_bytes: number | null
          storage_path: string
          title: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          doc_date?: string | null
          doc_type?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path: string
          title?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          doc_date?: string | null
          doc_type?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          document_path: string | null
          expense_date: string
          id: string
          is_estimate: boolean
          notes: string | null
          quantity: number | null
          quantity_unit: string | null
          trip_id: string | null
          vehicle_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          document_path?: string | null
          expense_date?: string
          id?: string
          is_estimate?: boolean
          notes?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          trip_id?: string | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          document_path?: string | null
          expense_date?: string
          id?: string
          is_estimate?: boolean
          notes?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          trip_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vehicle_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_field_sources: {
        Row: {
          confirmed_by_user: boolean
          created_at: string
          field_name: string
          id: string
          original_value: string | null
          retained_value: string | null
          source: string
          source_date: string | null
          status: string
          vehicle_id: string
        }
        Insert: {
          confirmed_by_user?: boolean
          created_at?: string
          field_name: string
          id?: string
          original_value?: string | null
          retained_value?: string | null
          source: string
          source_date?: string | null
          status?: string
          vehicle_id: string
        }
        Update: {
          confirmed_by_user?: boolean
          created_at?: string
          field_name?: string
          id?: string
          original_value?: string | null
          retained_value?: string | null
          source?: string
          source_date?: string | null
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_field_sources_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance_events: {
        Row: {
          action_type: string
          cost: number | null
          created_at: string
          event_date: string
          id: string
          notes: string | null
          odometer: number | null
          odometer_unit: string
          operation: string
          provider: string | null
          rule_id: string | null
          source: string
          vehicle_id: string
        }
        Insert: {
          action_type?: string
          cost?: number | null
          created_at?: string
          event_date?: string
          id?: string
          notes?: string | null
          odometer?: number | null
          odometer_unit?: string
          operation: string
          provider?: string | null
          rule_id?: string | null
          source?: string
          vehicle_id: string
        }
        Update: {
          action_type?: string
          cost?: number | null
          created_at?: string
          event_date?: string
          id?: string
          notes?: string | null
          odometer?: number | null
          odometer_unit?: string
          operation?: string
          provider?: string | null
          rule_id?: string | null
          source?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "vehicle_maintenance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance_rules: {
        Row: {
          action_type: string
          applicability: string | null
          category: string
          component: string | null
          condition_based: boolean
          created_at: string
          estimated_budget: number | null
          first_interval_km: number | null
          first_interval_months: number | null
          fixed_due_date: string | null
          id: string
          interval_km: number | null
          interval_months: number | null
          is_active: boolean
          notes: string | null
          operation: string
          reference_date: string | null
          reference_odometer: number | null
          source: string
          source_reference: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          action_type?: string
          applicability?: string | null
          category: string
          component?: string | null
          condition_based?: boolean
          created_at?: string
          estimated_budget?: number | null
          first_interval_km?: number | null
          first_interval_months?: number | null
          fixed_due_date?: string | null
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          is_active?: boolean
          notes?: string | null
          operation: string
          reference_date?: string | null
          reference_odometer?: number | null
          source?: string
          source_reference?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          action_type?: string
          applicability?: string | null
          category?: string
          component?: string | null
          condition_based?: boolean
          created_at?: string
          estimated_budget?: number | null
          first_interval_km?: number | null
          first_interval_months?: number | null
          fixed_due_date?: string | null
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          is_active?: boolean
          notes?: string | null
          operation?: string
          reference_date?: string | null
          reference_odometer?: number | null
          source?: string
          source_reference?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_rules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_trip_legs: {
        Row: {
          address: string | null
          arrival_at: string | null
          booking_id: string | null
          created_at: string
          id: string
          label: string | null
          latitude: number | null
          longitude: number | null
          position: number
          trip_id: string
        }
        Insert: {
          address?: string | null
          arrival_at?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          position?: number
          trip_id: string
        }
        Update: {
          address?: string | null
          arrival_at?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          position?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_trip_legs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trip_legs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vehicle_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_trips: {
        Row: {
          booking_id: string | null
          business_share: number
          created_at: string
          declared_distance_km: number | null
          distance_is_estimate: boolean
          ended_at: string | null
          event_id: string | null
          gps_distance_km: number | null
          id: string
          notes: string | null
          odometer_distance_km: number | null
          planned_distance_km: number | null
          retained_distance_km: number | null
          retained_distance_source: string | null
          started_at: string | null
          state: string
          title: string | null
          trip_type: string
          updated_at: string
          usage: string
          vehicle_id: string | null
        }
        Insert: {
          booking_id?: string | null
          business_share?: number
          created_at?: string
          declared_distance_km?: number | null
          distance_is_estimate?: boolean
          ended_at?: string | null
          event_id?: string | null
          gps_distance_km?: number | null
          id?: string
          notes?: string | null
          odometer_distance_km?: number | null
          planned_distance_km?: number | null
          retained_distance_km?: number | null
          retained_distance_source?: string | null
          started_at?: string | null
          state?: string
          title?: string | null
          trip_type?: string
          updated_at?: string
          usage?: string
          vehicle_id?: string | null
        }
        Update: {
          booking_id?: string | null
          business_share?: number
          created_at?: string
          declared_distance_km?: number | null
          distance_is_estimate?: boolean
          ended_at?: string | null
          event_id?: string | null
          gps_distance_km?: number | null
          id?: string
          notes?: string | null
          odometer_distance_km?: number | null
          planned_distance_km?: number | null
          retained_distance_km?: number | null
          retained_distance_source?: string | null
          started_at?: string | null
          state?: string
          title?: string | null
          trip_type?: string
          updated_at?: string
          usage?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_trips_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          ademe_ref: string | null
          archived: boolean
          body_type: string | null
          cnit: string | null
          consumption_kwh_100km: number | null
          consumption_l_100km: number | null
          created_at: string
          displacement_cm3: number | null
          doors: number | null
          drivetrain: string | null
          elec_price_per_kwh: number | null
          electrification: string | null
          engine_code: string | null
          engine_version: string | null
          first_registration: string | null
          fiscal_power: number | null
          fuel: string | null
          fuel_price_per_l: number | null
          gearbox_code: string | null
          gearbox_gears: number | null
          gearbox_type: string | null
          generation: string | null
          hybrid_type: string | null
          id: string
          is_default: boolean
          label: string | null
          make: string | null
          model: string | null
          model_year: number | null
          notes: string | null
          odometer_unit: string
          owner_id: string
          phase: string | null
          plate: string | null
          plate_country: string
          plate_raw: string | null
          power_kw: number | null
          production_end: string | null
          production_start: string | null
          seats: number | null
          segment: string | null
          status: string
          trim_level: string | null
          tvv: string | null
          updated_at: string
          vin: string | null
          visual_meta: Json | null
          visual_source: string | null
        }
        Insert: {
          ademe_ref?: string | null
          archived?: boolean
          body_type?: string | null
          cnit?: string | null
          consumption_kwh_100km?: number | null
          consumption_l_100km?: number | null
          created_at?: string
          displacement_cm3?: number | null
          doors?: number | null
          drivetrain?: string | null
          elec_price_per_kwh?: number | null
          electrification?: string | null
          engine_code?: string | null
          engine_version?: string | null
          first_registration?: string | null
          fiscal_power?: number | null
          fuel?: string | null
          fuel_price_per_l?: number | null
          gearbox_code?: string | null
          gearbox_gears?: number | null
          gearbox_type?: string | null
          generation?: string | null
          hybrid_type?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          make?: string | null
          model?: string | null
          model_year?: number | null
          notes?: string | null
          odometer_unit?: string
          owner_id?: string
          phase?: string | null
          plate?: string | null
          plate_country?: string
          plate_raw?: string | null
          power_kw?: number | null
          production_end?: string | null
          production_start?: string | null
          seats?: number | null
          segment?: string | null
          status?: string
          trim_level?: string | null
          tvv?: string | null
          updated_at?: string
          vin?: string | null
          visual_meta?: Json | null
          visual_source?: string | null
        }
        Update: {
          ademe_ref?: string | null
          archived?: boolean
          body_type?: string | null
          cnit?: string | null
          consumption_kwh_100km?: number | null
          consumption_l_100km?: number | null
          created_at?: string
          displacement_cm3?: number | null
          doors?: number | null
          drivetrain?: string | null
          elec_price_per_kwh?: number | null
          electrification?: string | null
          engine_code?: string | null
          engine_version?: string | null
          first_registration?: string | null
          fiscal_power?: number | null
          fuel?: string | null
          fuel_price_per_l?: number | null
          gearbox_code?: string | null
          gearbox_gears?: number | null
          gearbox_type?: string | null
          generation?: string | null
          hybrid_type?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          make?: string | null
          model?: string | null
          model_year?: number | null
          notes?: string | null
          odometer_unit?: string
          owner_id?: string
          phase?: string | null
          plate?: string | null
          plate_country?: string
          plate_raw?: string | null
          power_kw?: number | null
          production_end?: string | null
          production_start?: string | null
          seats?: number | null
          segment?: string | null
          status?: string
          trim_level?: string | null
          tvv?: string | null
          updated_at?: string
          vin?: string | null
          visual_meta?: Json | null
          visual_source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_reviews: {
        Row: {
          booking_id: string | null
          client_name: string | null
          comment: string | null
          created_at: string | null
          id: string | null
          rating: number | null
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          client_name?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string | null
          rating?: number | null
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          client_name?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string | null
          rating?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      blade_community_limit: {
        Args: {
          p_actor: string
          p_limit: number
          p_scope: string
          p_seconds: number
        }
        Returns: boolean
      }
      blade_conversation_member: {
        Args: { p_conversation: string }
        Returns: boolean
      }
      blade_owns_provider: { Args: { p_provider: string }; Returns: boolean }
      blade_provider_bundle: { Args: never; Returns: Json }
      blade_save_record: {
        Args: {
          p_entity: string
          p_id: string
          p_provider: string
          p_values: Json
        }
        Returns: string
      }
      cleanup_expired_pending_bookings: { Args: never; Returns: undefined }
      consume_vehicle_api_quota: {
        Args: { _max_calls: number; _provider: string }
        Returns: Json
      }
      create_blade_slot_request: {
        Args: {
          p_date: string
          p_email: string
          p_id: string
          p_message: string
          p_mode: string
          p_name: string
          p_time: string
          p_user_id: string
        }
        Returns: string
      }
      create_booking_from_pending: {
        Args: { p_verification_token: string }
        Returns: Json
      }
      get_public_reviews: {
        Args: never
        Returns: {
          client_name: string
          comment: string
          created_at: string
          id: string
          rating: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { user_uuid?: string }; Returns: boolean }
      make_user_admin: { Args: { user_email: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "client" | "superadmin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "client", "superadmin"],
    },
  },
} as const
