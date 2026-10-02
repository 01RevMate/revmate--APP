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
      account_consents: {
        Row: {
          birth_date: string | null
          created_at: string
          marketing_opt_in: boolean
          marketing_updated_at: string | null
          privacy_version: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          marketing_opt_in?: boolean
          marketing_updated_at?: string | null
          privacy_version?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          marketing_opt_in?: boolean
          marketing_updated_at?: string | null
          privacy_version?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_campaigns: {
        Row: {
          active: boolean
          body: string
          business_id: string | null
          clicks: number
          created_at: string
          created_by: string | null
          cta_label: string
          cta_url: string
          ends_at: string | null
          headline: string
          id: string
          image_url: string | null
          impressions: number
          name: string
          placement: string
          starts_at: string
          target_areas: string[]
          target_fuel: string | null
          target_segment: string | null
        }
        Insert: {
          active?: boolean
          body?: string
          business_id?: string | null
          clicks?: number
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_url: string
          ends_at?: string | null
          headline: string
          id?: string
          image_url?: string | null
          impressions?: number
          name: string
          placement?: string
          starts_at?: string
          target_areas?: string[]
          target_fuel?: string | null
          target_segment?: string | null
        }
        Update: {
          active?: boolean
          body?: string
          business_id?: string | null
          clicks?: number
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_url?: string
          ends_at?: string | null
          headline?: string
          id?: string
          image_url?: string | null
          impressions?: number
          name?: string
          placement?: string
          starts_at?: string
          target_areas?: string[]
          target_fuel?: string | null
          target_segment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      announcement_views: {
        Row: {
          announcement_id: string
          clicked: boolean
          seen_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          clicked?: boolean
          seen_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          clicked?: boolean
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_views_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      announcements: {
        Row: {
          active: boolean
          audience: string
          body: string
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          kind: string
          release_version: string | null
          starts_at: string
          title: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          release_version?: string | null
          starts_at?: string
          title: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          release_version?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      answers: {
        Row: {
          body: string
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      approved_vehicle_make_aliases: {
        Row: {
          alias_key: string
          make_name: string
        }
        Insert: {
          alias_key: string
          make_name: string
        }
        Update: {
          alias_key?: string
          make_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "approved_vehicle_make_aliases_make_name_fkey"
            columns: ["make_name"]
            isOneToOne: false
            referencedRelation: "approved_vehicle_makes"
            referencedColumns: ["name"]
          },
        ]
      }
      approved_vehicle_makes: {
        Row: {
          name: string
          sort_order: number
        }
        Insert: {
          name: string
          sort_order: number
        }
        Update: {
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      business_reports: {
        Row: {
          business_id: string
          created_at: string
          details: string
          id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          details?: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          details?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      business_reviews: {
        Row: {
          body: string
          business_id: string
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          business_id: string
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      businesses: {
        Row: {
          category: string
          covers_areas: string[]
          created_at: string
          description: string
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string | null
          phone: string | null
          postcode_district: string | null
          rating_avg: number
          reports_count: number
          reviews_count: number
          status: string
          town: string | null
          verified: boolean
          website: string | null
        }
        Insert: {
          category: string
          covers_areas?: string[]
          created_at?: string
          description?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          phone?: string | null
          postcode_district?: string | null
          rating_avg?: number
          reports_count?: number
          reviews_count?: number
          status?: string
          town?: string | null
          verified?: boolean
          website?: string | null
        }
        Update: {
          category?: string
          covers_areas?: string[]
          created_at?: string
          description?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          phone?: string | null
          postcode_district?: string | null
          rating_avg?: number
          reports_count?: number
          reviews_count?: number
          status?: string
          town?: string | null
          verified?: boolean
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      car_battle_votes: {
        Row: {
          created_at: string
          id: string
          loser_car_id: string
          voted_on: string
          voter_id: string
          winner_car_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loser_car_id: string
          voted_on?: string
          voter_id: string
          winner_car_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loser_car_id?: string
          voted_on?: string
          voter_id?: string
          winner_car_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_battle_votes_loser_car_id_fkey"
            columns: ["loser_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_battle_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "car_battle_votes_winner_car_id_fkey"
            columns: ["winner_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
        ]
      }
      car_catalog_links: {
        Row: {
          car_id: string
          created_at: string
          derivative_id: string | null
          id: string
          model_id: string
        }
        Insert: {
          car_id: string
          created_at?: string
          derivative_id?: string | null
          id?: string
          model_id: string
        }
        Update: {
          car_id?: string
          created_at?: string
          derivative_id?: string | null
          id?: string
          model_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_catalog_links_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_catalog_links_derivative_id_fkey"
            columns: ["derivative_id"]
            isOneToOne: false
            referencedRelation: "vehicle_derivatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_catalog_links_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      car_faults: {
        Row: {
          car_id: string
          created_at: string
          description: string | null
          id: string
          source: Database["public"]["Enums"]["fault_source"]
          source_url: string | null
          title: string
          typical_cost_high: number | null
          typical_cost_low: number | null
          upvotes: number
        }
        Insert: {
          car_id: string
          created_at?: string
          description?: string | null
          id?: string
          source?: Database["public"]["Enums"]["fault_source"]
          source_url?: string | null
          title: string
          typical_cost_high?: number | null
          typical_cost_low?: number | null
          upvotes?: number
        }
        Update: {
          car_id?: string
          created_at?: string
          description?: string | null
          id?: string
          source?: Database["public"]["Enums"]["fault_source"]
          source_url?: string | null
          title?: string
          typical_cost_high?: number | null
          typical_cost_low?: number | null
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "car_faults_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      car_meets: {
        Row: {
          address: string | null
          cancelled_at: string | null
          cover_url: string | null
          created_at: string
          description: string
          ends_at: string | null
          going_count: number
          id: string
          interested_count: number
          latitude: number | null
          location_name: string
          longitude: number | null
          organizer_id: string
          reminder_sent_at: string | null
          starts_at: string
          title: string
        }
        Insert: {
          address?: string | null
          cancelled_at?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          ends_at?: string | null
          going_count?: number
          id?: string
          interested_count?: number
          latitude?: number | null
          location_name: string
          longitude?: number | null
          organizer_id: string
          reminder_sent_at?: string | null
          starts_at: string
          title: string
        }
        Update: {
          address?: string | null
          cancelled_at?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          ends_at?: string | null
          going_count?: number
          id?: string
          interested_count?: number
          latitude?: number | null
          location_name?: string
          longitude?: number | null
          organizer_id?: string
          reminder_sent_at?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_meets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      car_of_the_week: {
        Row: {
          crowned_at: string
          garage_car_id: string
          week_start: string
          wins: number
        }
        Insert: {
          crowned_at?: string
          garage_car_id: string
          week_start: string
          wins: number
        }
        Update: {
          crowned_at?: string
          garage_car_id?: string
          week_start?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "car_of_the_week_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
        ]
      }
      car_reminders_sent: {
        Row: {
          due_date: string
          garage_car_id: string
          kind: string
          sent_at: string
          stage: string
        }
        Insert: {
          due_date: string
          garage_car_id: string
          kind: string
          sent_at?: string
          stage: string
        }
        Update: {
          due_date?: string
          garage_car_id?: string
          kind?: string
          sent_at?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_reminders_sent_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
        ]
      }
      cars: {
        Row: {
          body_type: string | null
          created_at: string
          engine_options: Json
          generation: string
          generation_slug: string | null
          id: string
          make: string
          make_slug: string | null
          model: string
          model_slug: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["car_status"]
          summary: string | null
          year_end: number | null
          year_start: number | null
        }
        Insert: {
          body_type?: string | null
          created_at?: string
          engine_options?: Json
          generation: string
          generation_slug?: string | null
          id?: string
          make: string
          make_slug?: string | null
          model: string
          model_slug?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["car_status"]
          summary?: string | null
          year_end?: number | null
          year_start?: number | null
        }
        Update: {
          body_type?: string | null
          created_at?: string
          engine_options?: Json
          generation?: string
          generation_slug?: string | null
          id?: string
          make?: string
          make_slug?: string | null
          model?: string
          model_slug?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["car_status"]
          summary?: string | null
          year_end?: number | null
          year_start?: number | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          ends_on: string
          id: string
          starts_on: string
          tag: string
          title: string
          winner_post_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          ends_on: string
          id?: string
          starts_on: string
          tag: string
          title: string
          winner_post_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          ends_on?: string
          id?: string
          starts_on?: string
          tag?: string
          title?: string
          winner_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "challenges_winner_post_id_fkey"
            columns: ["winner_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_groups: {
        Row: {
          allow_sales: boolean
          cover_url: string | null
          created_at: string
          description: string
          entry_rule: string
          id: string
          join_policy: string
          make_name: string | null
          member_count: number
          model_name: string | null
          name: string
          owner_id: string
          post_policy: string
          require_rules_agreement: boolean
          rules: string
          slug: string
          visibility: string
        }
        Insert: {
          allow_sales?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string
          entry_rule?: string
          id?: string
          join_policy?: string
          make_name?: string | null
          member_count?: number
          model_name?: string | null
          name: string
          owner_id: string
          post_policy?: string
          require_rules_agreement?: boolean
          rules?: string
          slug: string
          visibility?: string
        }
        Update: {
          allow_sales?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string
          entry_rule?: string
          id?: string
          join_policy?: string
          make_name?: string | null
          member_count?: number
          model_name?: string | null
          name?: string
          owner_id?: string
          post_policy?: string
          require_rules_agreement?: boolean
          rules?: string
          slug?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friendships_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      garage_car_dislikes: {
        Row: {
          created_at: string
          garage_car_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          garage_car_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          garage_car_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_car_dislikes_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_car_dislikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      garage_car_follows: {
        Row: {
          created_at: string
          garage_car_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          garage_car_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          garage_car_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_car_follows_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_car_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      garage_car_likes: {
        Row: {
          created_at: string
          garage_car_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          garage_car_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          garage_car_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_car_likes_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_car_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      garage_car_photos: {
        Row: {
          created_at: string
          garage_car_id: string
          id: string
          photo_url: string
        }
        Insert: {
          created_at?: string
          garage_car_id: string
          id?: string
          photo_url: string
        }
        Update: {
          created_at?: string
          garage_car_id?: string
          id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_car_photos_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_cars: {
        Row: {
          battle_losses: number
          battle_wins: number
          bio: string | null
          car_id: string | null
          catalog_derivative_id: string | null
          catalog_make_id: string | null
          catalog_model_id: string | null
          catalog_powertrain_id: string | null
          color: string | null
          created_at: string
          dislikes_count: number
          engine: string | null
          followers_count: number
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          generation: string | null
          horsepower: number | null
          id: string
          last_rank: number | null
          likes_count: number
          make: string
          mileage: number | null
          model: string
          mot_due: string | null
          nickname: string
          ownership_end_reason: string | null
          ownership_status: Database["public"]["Enums"]["garage_car_ownership_status"]
          photo_url: string | null
          reminders_enabled: boolean
          spec: string | null
          tax_due: string | null
          transmission: Database["public"]["Enums"]["transmission_type"] | null
          trim: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          battle_losses?: number
          battle_wins?: number
          bio?: string | null
          car_id?: string | null
          catalog_derivative_id?: string | null
          catalog_make_id?: string | null
          catalog_model_id?: string | null
          catalog_powertrain_id?: string | null
          color?: string | null
          created_at?: string
          dislikes_count?: number
          engine?: string | null
          followers_count?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          generation?: string | null
          horsepower?: number | null
          id?: string
          last_rank?: number | null
          likes_count?: number
          make: string
          mileage?: number | null
          model: string
          mot_due?: string | null
          nickname: string
          ownership_end_reason?: string | null
          ownership_status?: Database["public"]["Enums"]["garage_car_ownership_status"]
          photo_url?: string | null
          reminders_enabled?: boolean
          spec?: string | null
          tax_due?: string | null
          transmission?: Database["public"]["Enums"]["transmission_type"] | null
          trim?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          battle_losses?: number
          battle_wins?: number
          bio?: string | null
          car_id?: string | null
          catalog_derivative_id?: string | null
          catalog_make_id?: string | null
          catalog_model_id?: string | null
          catalog_powertrain_id?: string | null
          color?: string | null
          created_at?: string
          dislikes_count?: number
          engine?: string | null
          followers_count?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          generation?: string | null
          horsepower?: number | null
          id?: string
          last_rank?: number | null
          likes_count?: number
          make?: string
          mileage?: number | null
          model?: string
          mot_due?: string | null
          nickname?: string
          ownership_end_reason?: string | null
          ownership_status?: Database["public"]["Enums"]["garage_car_ownership_status"]
          photo_url?: string | null
          reminders_enabled?: boolean
          spec?: string | null
          tax_due?: string | null
          transmission?: Database["public"]["Enums"]["transmission_type"] | null
          trim?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_cars_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_cars_catalog_derivative_id_fkey"
            columns: ["catalog_derivative_id"]
            isOneToOne: false
            referencedRelation: "vehicle_derivatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_cars_catalog_make_id_fkey"
            columns: ["catalog_make_id"]
            isOneToOne: false
            referencedRelation: "vehicle_makes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_cars_catalog_model_id_fkey"
            columns: ["catalog_model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_cars_catalog_powertrain_id_fkey"
            columns: ["catalog_powertrain_id"]
            isOneToOne: false
            referencedRelation: "vehicle_powertrains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_cars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      garage_mods: {
        Row: {
          category: Database["public"]["Enums"]["mod_category"] | null
          created_at: string
          description: string | null
          garage_car_id: string
          id: string
          title: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["mod_category"] | null
          created_at?: string
          description?: string | null
          garage_car_id: string
          id?: string
          title: string
        }
        Update: {
          category?: Database["public"]["Enums"]["mod_category"] | null
          created_at?: string
          description?: string | null
          garage_car_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_mods_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_answers: {
        Row: {
          agreed_rules: boolean
          answers: Json
          created_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          agreed_rules?: boolean
          answers?: Json
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          agreed_rules?: boolean
          answers?: Json
          created_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_answers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          requested_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          requested_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          requested_at?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      group_questions: {
        Row: {
          created_at: string
          group_id: string
          id: string
          kind: string
          position: number
          prompt: string
          required_answer: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          kind: string
          position?: number
          prompt: string
          required_answer?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          kind?: string
          position?: number
          prompt?: string
          required_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_questions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_offers: {
        Row: {
          amount: number
          buyer_id: string
          counter_amount: number | null
          created_at: string
          final_amount: number | null
          id: string
          listing_id: string
          message: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          counter_amount?: number | null
          created_at?: string
          final_amount?: number | null
          id?: string
          listing_id: string
          message?: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          counter_amount?: number | null
          created_at?: string
          final_amount?: number | null
          id?: string
          listing_id?: string
          message?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_offers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "listing_offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_offers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      listing_views: {
        Row: {
          listing_id: string
          viewed_on: string
          viewer_id: string
        }
        Insert: {
          listing_id: string
          viewed_on?: string
          viewer_id: string
        }
        Update: {
          listing_id?: string
          viewed_on?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      listings: {
        Row: {
          body_type: string | null
          business_id: string | null
          buyer_id: string | null
          car_id: string | null
          co2_gkm: number | null
          collection_available: boolean
          colour: string | null
          created_at: string
          description: string | null
          doors: number | null
          engine_size_cc: number | null
          featured_until: string | null
          fuel_type: string | null
          garage_car_id: string | null
          headline: string | null
          id: string
          insurance_group: number | null
          item_condition: string | null
          location_area: string | null
          location_district: string | null
          location_lat: number | null
          location_lng: number | null
          make: string | null
          mileage: number | null
          model: string | null
          modified: boolean | null
          mot_expiry: string | null
          mpg: number | null
          open_to_offers: boolean
          part_category: string | null
          photos: string[]
          postage_available: boolean
          postage_price: number | null
          power_bhp: number | null
          previous_owners: number | null
          previous_price: number | null
          price: number | null
          price_changed_at: string | null
          saves_count: number
          seats: number | null
          seller_type: string
          service_history: string | null
          show_car_stats: boolean
          status: string
          title: string
          transmission: string | null
          type: Database["public"]["Enums"]["listing_type"]
          ulez_compliant: boolean | null
          user_id: string
          v5c_present: boolean | null
          views_count: number
          year: number | null
        }
        Insert: {
          body_type?: string | null
          business_id?: string | null
          buyer_id?: string | null
          car_id?: string | null
          co2_gkm?: number | null
          collection_available?: boolean
          colour?: string | null
          created_at?: string
          description?: string | null
          doors?: number | null
          engine_size_cc?: number | null
          featured_until?: string | null
          fuel_type?: string | null
          garage_car_id?: string | null
          headline?: string | null
          id?: string
          insurance_group?: number | null
          item_condition?: string | null
          location_area?: string | null
          location_district?: string | null
          location_lat?: number | null
          location_lng?: number | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          modified?: boolean | null
          mot_expiry?: string | null
          mpg?: number | null
          open_to_offers?: boolean
          part_category?: string | null
          photos?: string[]
          postage_available?: boolean
          postage_price?: number | null
          power_bhp?: number | null
          previous_owners?: number | null
          previous_price?: number | null
          price?: number | null
          price_changed_at?: string | null
          saves_count?: number
          seats?: number | null
          seller_type?: string
          service_history?: string | null
          show_car_stats?: boolean
          status?: string
          title: string
          transmission?: string | null
          type?: Database["public"]["Enums"]["listing_type"]
          ulez_compliant?: boolean | null
          user_id: string
          v5c_present?: boolean | null
          views_count?: number
          year?: number | null
        }
        Update: {
          body_type?: string | null
          business_id?: string | null
          buyer_id?: string | null
          car_id?: string | null
          co2_gkm?: number | null
          collection_available?: boolean
          colour?: string | null
          created_at?: string
          description?: string | null
          doors?: number | null
          engine_size_cc?: number | null
          featured_until?: string | null
          fuel_type?: string | null
          garage_car_id?: string | null
          headline?: string | null
          id?: string
          insurance_group?: number | null
          item_condition?: string | null
          location_area?: string | null
          location_district?: string | null
          location_lat?: number | null
          location_lng?: number | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          modified?: boolean | null
          mot_expiry?: string | null
          mpg?: number | null
          open_to_offers?: boolean
          part_category?: string | null
          photos?: string[]
          postage_available?: boolean
          postage_price?: number | null
          power_bhp?: number | null
          previous_owners?: number | null
          previous_price?: number | null
          price?: number | null
          price_changed_at?: string | null
          saves_count?: number
          seats?: number | null
          seller_type?: string
          service_history?: string | null
          show_car_stats?: boolean
          status?: string
          title?: string
          transmission?: string | null
          type?: Database["public"]["Enums"]["listing_type"]
          ulez_compliant?: boolean | null
          user_id?: string
          v5c_present?: boolean | null
          views_count?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "listings_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_partners: {
        Row: {
          active: boolean
          clicks_count: number
          created_at: string
          cta: string
          id: string
          image_url: string | null
          name: string
          placement: string
          sort_order: number
          tagline: string
          url: string
        }
        Insert: {
          active?: boolean
          clicks_count?: number
          created_at?: string
          cta?: string
          id?: string
          image_url?: string | null
          name: string
          placement?: string
          sort_order?: number
          tagline?: string
          url: string
        }
        Update: {
          active?: boolean
          clicks_count?: number
          created_at?: string
          cta?: string
          id?: string
          image_url?: string | null
          name?: string
          placement?: string
          sort_order?: number
          tagline?: string
          url?: string
        }
        Relationships: []
      }
      meet_attendees: {
        Row: {
          created_at: string
          meet_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          meet_id: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          meet_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meet_attendees_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "car_meets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meet_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      member_areas: {
        Row: {
          home_area: string
          updated_at: string
          user_id: string
        }
        Insert: {
          home_area: string
          updated_at?: string
          user_id: string
        }
        Update: {
          home_area?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          image_path: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          image_path?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_path?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      news_likes: {
        Row: {
          created_at: string
          news_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          news_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          news_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_likes_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      news_posts: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          likes_count: number
          media: string[]
          published_at: string
          sponsored: boolean
          topic: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          likes_count?: number
          media?: string[]
          published_at?: string
          sponsored?: boolean
          topic: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          likes_count?: number
          media?: string[]
          published_at?: string
          sponsored?: boolean
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          muted_kinds: string[]
          quiet_hours: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          muted_kinds?: string[]
          quiet_hours?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          muted_kinds?: string[]
          quiet_hours?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          actor_id: string
          created_at: string
          garage_car_id: string | null
          group_id: string | null
          id: string
          kind: string
          message: string | null
          post_id: string | null
          question_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          actor_id: string
          created_at?: string
          garage_car_id?: string | null
          group_id?: string | null
          id?: string
          kind: string
          message?: string | null
          post_id?: string | null
          question_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          actor_id?: string
          created_at?: string
          garage_car_id?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          message?: string | null
          post_id?: string | null
          question_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_garage_car_id_fkey"
            columns: ["garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          likes_count: number
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      post_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          position: number
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          position?: number
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      post_poll_options: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          label: string
          position: number
          post_id: string
          votes_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          label: string
          position: number
          post_id: string
          votes_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          position?: number
          post_id?: string
          votes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_options_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "post_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          post_id: string | null
          reason: Database["public"]["Enums"]["post_report_reason"]
          reported_user_id: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["post_report_status"]
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          post_id?: string | null
          reason: Database["public"]["Enums"]["post_report_reason"]
          reported_user_id: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["post_report_status"]
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          post_id?: string | null
          reason?: Database["public"]["Enums"]["post_report_reason"]
          reported_user_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["post_report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "post_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      posts: {
        Row: {
          audience: Database["public"]["Enums"]["post_audience"]
          body: string
          car_id: string | null
          category: Database["public"]["Enums"]["post_category"]
          comments_count: number
          created_at: string
          group_id: string | null
          has_poll: boolean
          id: string
          image_url: string | null
          issue_fix: string | null
          issue_status: string | null
          issue_system: string | null
          last_resolve_prompt_at: string | null
          latitude: number | null
          likes_count: number
          listing_id: string | null
          longitude: number | null
          moderation_status: string
          posted_as_garage_car_id: string | null
          reaction_counts: Json
          repost_of_id: string | null
          reposts_count: number
          resolve_prompts: number
          resolved_at: string | null
          spotted_garage_car_id: string | null
          tagged_engine: string | null
          tagged_make: string | null
          tagged_model: string | null
          tagged_year: number | null
          user_id: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["post_audience"]
          body: string
          car_id?: string | null
          category?: Database["public"]["Enums"]["post_category"]
          comments_count?: number
          created_at?: string
          group_id?: string | null
          has_poll?: boolean
          id?: string
          image_url?: string | null
          issue_fix?: string | null
          issue_status?: string | null
          issue_system?: string | null
          last_resolve_prompt_at?: string | null
          latitude?: number | null
          likes_count?: number
          listing_id?: string | null
          longitude?: number | null
          moderation_status?: string
          posted_as_garage_car_id?: string | null
          reaction_counts?: Json
          repost_of_id?: string | null
          reposts_count?: number
          resolve_prompts?: number
          resolved_at?: string | null
          spotted_garage_car_id?: string | null
          tagged_engine?: string | null
          tagged_make?: string | null
          tagged_model?: string | null
          tagged_year?: number | null
          user_id: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["post_audience"]
          body?: string
          car_id?: string | null
          category?: Database["public"]["Enums"]["post_category"]
          comments_count?: number
          created_at?: string
          group_id?: string | null
          has_poll?: boolean
          id?: string
          image_url?: string | null
          issue_fix?: string | null
          issue_status?: string | null
          issue_system?: string | null
          last_resolve_prompt_at?: string | null
          latitude?: number | null
          likes_count?: number
          listing_id?: string | null
          longitude?: number | null
          moderation_status?: string
          posted_as_garage_car_id?: string | null
          reaction_counts?: Json
          repost_of_id?: string | null
          reposts_count?: number
          resolve_prompts?: number
          resolved_at?: string | null
          spotted_garage_car_id?: string | null
          tagged_engine?: string | null
          tagged_make?: string | null
          tagged_model?: string | null
          tagged_year?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_posted_as_garage_car_id_fkey"
            columns: ["posted_as_garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_repost_of_id_fkey"
            columns: ["repost_of_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_spotted_garage_car_id_fkey"
            columns: ["spotted_garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profile_follows: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profile_views: {
        Row: {
          created_at: string
          viewed_on: string
          viewed_user_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          viewed_on?: string
          viewed_user_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          viewed_on?: string
          viewed_user_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_viewed_user_id_fkey"
            columns: ["viewed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          active_garage_car_id: string | null
          avatar_url: string | null
          bio: string | null
          cover_photo_url: string | null
          created_at: string
          current_streak: number
          favourite_makes: string[]
          id: string
          last_active_on: string | null
          longest_streak: number
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          onboarded_at: string | null
          persona: Database["public"]["Enums"]["profile_persona"]
          role: Database["public"]["Enums"]["profile_role"]
          social_facebook: string | null
          social_instagram: string | null
          social_snapchat: string | null
          social_tiktok: string | null
          social_x: string | null
          social_youtube: string | null
          user_id: string
          username: string
          verified_type: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          active_garage_car_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_photo_url?: string | null
          created_at?: string
          current_streak?: number
          favourite_makes?: string[]
          id?: string
          last_active_on?: string | null
          longest_streak?: number
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          onboarded_at?: string | null
          persona?: Database["public"]["Enums"]["profile_persona"]
          role?: Database["public"]["Enums"]["profile_role"]
          social_facebook?: string | null
          social_instagram?: string | null
          social_snapchat?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          social_youtube?: string | null
          user_id: string
          username: string
          verified_type?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          active_garage_car_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_photo_url?: string | null
          created_at?: string
          current_streak?: number
          favourite_makes?: string[]
          id?: string
          last_active_on?: string | null
          longest_streak?: number
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          onboarded_at?: string | null
          persona?: Database["public"]["Enums"]["profile_persona"]
          role?: Database["public"]["Enums"]["profile_role"]
          social_facebook?: string | null
          social_instagram?: string | null
          social_snapchat?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          social_youtube?: string | null
          user_id?: string
          username?: string
          verified_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_garage_car_id_fkey"
            columns: ["active_garage_car_id"]
            isOneToOne: false
            referencedRelation: "garage_cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      protected_post_terms: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          match_type: Database["public"]["Enums"]["protected_term_match"]
          term: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          match_type?: Database["public"]["Enums"]["protected_term_match"]
          term: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          match_type?: Database["public"]["Enums"]["protected_term_match"]
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "protected_post_terms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      questions: {
        Row: {
          body: string | null
          car_id: string
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          car_id: string
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          car_id?: string
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_cars: {
        Row: {
          car_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          car_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          car_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_cars_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      saved_search_hits: {
        Row: {
          created_at: string
          listing_id: string
          search_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          search_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_search_hits_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_search_hits_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alerts: boolean
          created_at: string
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          alerts?: boolean
          created_at?: string
          filters?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          alerts?: boolean
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      seller_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          listing_id: string | null
          reason: string
          reporter_id: string
          seller_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          listing_id?: string | null
          reason: string
          reporter_id: string
          seller_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          listing_id?: string | null
          reason?: string
          reporter_id?: string
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "seller_reports_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      seller_reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          listing_id: string
          rating: number
          reviewer_id: string
          seller_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          listing_id: string
          rating: number
          reviewer_id: string
          seller_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          listing_id?: string
          rating?: number
          reviewer_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "seller_reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          user_id: string
          views_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type: string
          media_url: string
          user_id: string
          views_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vehicle_derivatives: {
        Row: {
          created_at: string
          id: string
          model_id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id: string
          model_id: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_derivatives_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_make_segments: {
        Row: {
          make: string
          segment: string
        }
        Insert: {
          make: string
          segment: string
        }
        Update: {
          make?: string
          segment?: string
        }
        Relationships: []
      }
      vehicle_makes: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      vehicle_models: {
        Row: {
          created_at: string
          id: string
          make_id: string
          name: string
          slug: string
          source_generic_model: string
        }
        Insert: {
          created_at?: string
          id: string
          make_id: string
          name: string
          slug: string
          source_generic_model: string
        }
        Update: {
          created_at?: string
          id?: string
          make_id?: string
          name?: string
          slug?: string
          source_generic_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_models_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "vehicle_makes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_powertrains: {
        Row: {
          created_at: string
          current_vehicle_count: number
          derivative_id: string
          engine_size_bands: string[]
          engine_sizes_cc: number[]
          fuel_type: string
          fuel_type_code: string
          id: string
          licensed_count: number
          sorn_count: number
          source_period: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_vehicle_count?: number
          derivative_id: string
          engine_size_bands?: string[]
          engine_sizes_cc?: number[]
          fuel_type: string
          fuel_type_code: string
          id: string
          licensed_count?: number
          sorn_count?: number
          source_period: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_vehicle_count?: number
          derivative_id?: string
          engine_size_bands?: string[]
          engine_sizes_cc?: number[]
          fuel_type?: string
          fuel_type_code?: string
          id?: string
          licensed_count?: number
          sorn_count?: number
          source_period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_powertrains_derivative_id_fkey"
            columns: ["derivative_id"]
            isOneToOne: false
            referencedRelation: "vehicle_derivatives"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_recaps: {
        Row: {
          created_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_recaps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_analytics: {
        Args: never
        Returns: {
          comments_received_30d: number
          followers_total: number
          following_total: number
          likes_received_30d: number
          new_followers_30d: number
          posts_total: number
          profile_views_30d: number
          profile_views_7d: number
        }[]
      }
      ads_for_me: {
        Args: { for_placement?: string; result_limit?: number }
        Returns: {
          body: string
          business_id: string
          business_name: string
          business_rating: number
          business_reviews: number
          business_verified: boolean
          cta_label: string
          cta_url: string
          headline: string
          id: string
          image_url: string
        }[]
      }
      announcement_stats: {
        Args: never
        Returns: {
          announcement_id: string
          clicked: number
          seen: number
        }[]
      }
      check_my_rank_changes: { Args: never; Returns: number }
      common_issues: {
        Args: { for_make: string; for_model?: string }
        Returns: {
          issue_system: string
          latest_post_id: string
          reports: number
          resolved: number
        }[]
      }
      community_feed: {
        Args: {
          filter_car?: string
          filter_category?: string
          filter_scope?: string
          page_offset?: number
        }
        Returns: {
          audience: Database["public"]["Enums"]["post_audience"]
          body: string
          car_id: string | null
          category: Database["public"]["Enums"]["post_category"]
          comments_count: number
          created_at: string
          group_id: string | null
          has_poll: boolean
          id: string
          image_url: string | null
          issue_fix: string | null
          issue_status: string | null
          issue_system: string | null
          last_resolve_prompt_at: string | null
          latitude: number | null
          likes_count: number
          listing_id: string | null
          longitude: number | null
          moderation_status: string
          posted_as_garage_car_id: string | null
          reaction_counts: Json
          repost_of_id: string | null
          reposts_count: number
          resolve_prompts: number
          resolved_at: string | null
          spotted_garage_car_id: string | null
          tagged_engine: string | null
          tagged_make: string | null
          tagged_model: string | null
          tagged_year: number | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      crown_car_of_the_week: { Args: never; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      for_you_feed: {
        Args: { filter_category?: string; page_offset?: number }
        Returns: {
          audience: Database["public"]["Enums"]["post_audience"]
          body: string
          car_id: string | null
          category: Database["public"]["Enums"]["post_category"]
          comments_count: number
          created_at: string
          group_id: string | null
          has_poll: boolean
          id: string
          image_url: string | null
          issue_fix: string | null
          issue_status: string | null
          issue_system: string | null
          last_resolve_prompt_at: string | null
          latitude: number | null
          likes_count: number
          listing_id: string | null
          longitude: number | null
          moderation_status: string
          posted_as_garage_car_id: string | null
          reaction_counts: Json
          repost_of_id: string | null
          reposts_count: number
          resolve_prompts: number
          resolved_at: string | null
          spotted_garage_car_id: string | null
          tagged_engine: string | null
          tagged_make: string | null
          tagged_model: string | null
          tagged_year: number | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      group_entry_eligibility: {
        Args: { gid: string }
        Returns: {
          eligible: boolean
          reason: string
        }[]
      }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      join_group: {
        Args: { agreed?: boolean; answers?: Json; gid: string }
        Returns: string
      }
      leave_seller_review: {
        Args: {
          review_body?: string
          review_rating: number
          target_listing: string
        }
        Returns: undefined
      }
      listing_buyer_candidates: {
        Args: { target_listing: string }
        Returns: {
          avatar_url: string
          user_id: string
          username: string
        }[]
      }
      make_offer: {
        Args: {
          offer_amount: number
          offer_message?: string
          target_listing: string
        }
        Returns: string
      }
      manage_group_member: {
        Args: { action: string; gid: string; target_user: string }
        Returns: undefined
      }
      nearby_meets: {
        Args: { lat: number; lng: number; radius_km?: number }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cover_url: string | null
          created_at: string
          description: string
          ends_at: string | null
          going_count: number
          id: string
          interested_count: number
          latitude: number | null
          location_name: string
          longitude: number | null
          organizer_id: string
          reminder_sent_at: string | null
          starts_at: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "car_meets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      nearby_posts: {
        Args: {
          lat: number
          lng: number
          page_offset?: number
          radius_km?: number
        }
        Returns: {
          audience: Database["public"]["Enums"]["post_audience"]
          body: string
          car_id: string | null
          category: Database["public"]["Enums"]["post_category"]
          comments_count: number
          created_at: string
          group_id: string | null
          has_poll: boolean
          id: string
          image_url: string | null
          issue_fix: string | null
          issue_status: string | null
          issue_system: string | null
          last_resolve_prompt_at: string | null
          latitude: number | null
          likes_count: number
          listing_id: string | null
          longitude: number | null
          moderation_status: string
          posted_as_garage_car_id: string | null
          reaction_counts: Json
          repost_of_id: string | null
          reposts_count: number
          resolve_prompts: number
          resolved_at: string | null
          spotted_garage_car_id: string | null
          tagged_engine: string | null
          tagged_make: string | null
          tagged_model: string | null
          tagged_year: number | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      next_car_battle: {
        Args: { exclude_ids?: string[] }
        Returns: {
          battle_losses: number
          battle_wins: number
          id: string
          make: string
          model: string
          nickname: string
          photo_url: string
          user_id: string
          username: string
          year: number
        }[]
      }
      profile_level: {
        Args: { target_user: string }
        Returns: {
          level_floor: number
          level_name: string
          next_level_at: number
          xp: number
        }[]
      }
      rank_garage_car: { Args: { target_id: string }; Returns: number }
      rank_garage_car_brands: {
        Args: { result_limit?: number; result_offset?: number }
        Returns: {
          car_count: number
          make: string
          net_score: number
          rank: number
          total_dislikes: number
          total_likes: number
        }[]
      }
      rank_garage_car_models: {
        Args: {
          filter_make?: string
          result_limit?: number
          result_offset?: number
        }
        Returns: {
          car_count: number
          make: string
          model: string
          net_score: number
          rank: number
          total_dislikes: number
          total_likes: number
        }[]
      }
      rank_garage_cars: {
        Args: { result_limit?: number; result_offset?: number }
        Returns: {
          dislikes_count: number
          followers_count: number
          id: string
          likes_count: number
          make: string
          model: string
          net_score: number
          nickname: string
          photo_url: string
          rank: number
          user_id: string
          username: string
        }[]
      }
      record_ad_event: {
        Args: { event: string; target_ad: string }
        Returns: undefined
      }
      record_consents: {
        Args: {
          born: string
          marketing?: boolean
          privacy_version: string
          terms_version: string
        }
        Returns: string
      }
      record_daily_activity: {
        Args: never
        Returns: {
          current_streak: number
          longest_streak: number
        }[]
      }
      public_profile: {
        Args: { target_username: string }
        Returns: { user_id: string; username: string }[]
      }
      public_profile_handles: {
        Args: { max_rows?: number }
        Returns: { created_at: string; username: string }[]
      }
      record_listing_view: {
        Args: { target_listing: string }
        Returns: undefined
      }
      record_partner_click: {
        Args: { target_partner: string }
        Returns: undefined
      }
      record_profile_view: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      respond_to_offer: {
        Args: {
          new_counter?: number
          offer_action: string
          target_offer: string
        }
        Returns: string
      }
      review_group_post: {
        Args: { decision: string; pid: string }
        Returns: undefined
      }
      revs_feed: {
        Args: { page_offset?: number }
        Returns: {
          audience: Database["public"]["Enums"]["post_audience"]
          body: string
          car_id: string | null
          category: Database["public"]["Enums"]["post_category"]
          comments_count: number
          created_at: string
          group_id: string | null
          has_poll: boolean
          id: string
          image_url: string | null
          issue_fix: string | null
          issue_status: string | null
          issue_system: string | null
          last_resolve_prompt_at: string | null
          latitude: number | null
          likes_count: number
          listing_id: string | null
          longitude: number | null
          moderation_status: string
          posted_as_garage_car_id: string | null
          reaction_counts: Json
          repost_of_id: string | null
          reposts_count: number
          resolve_prompts: number
          resolved_at: string | null
          spotted_garage_car_id: string | null
          tagged_engine: string | null
          tagged_make: string | null
          tagged_model: string | null
          tagged_year: number | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seller_score: {
        Args: { target_user: string }
        Returns: {
          actioned_reports: number
          listings_count: number
          score: number
        }[]
      }
      seller_stats: {
        Args: { target_seller: string }
        Returns: {
          active_listings: number
          member_since: string
          rating_avg: number
          replies_sampled: number
          reply_minutes: number
          reviews_count: number
          sold_listings: number
        }[]
      }
      send_app_update: {
        Args: { update_message: string; update_url?: string }
        Returns: number
      }
      send_due_meet_reminders: { Args: never; Returns: number }
      send_my_car_reminders: { Args: never; Returns: number }
      send_my_resolve_prompts: { Args: never; Returns: number }
      send_my_weekly_recap: { Args: never; Returns: boolean }
      set_listing_buyer: {
        Args: { target_buyer: string; target_listing: string }
        Returns: undefined
      }
      set_marketing_consent: { Args: { opt_in: boolean }; Returns: undefined }
      suggested_profiles: {
        Args: { result_limit?: number }
        Returns: {
          avatar_url: string
          followers: number
          reason: string
          user_id: string
          username: string
        }[]
      }
      trending_hashtags: {
        Args: { prefix?: string; result_limit?: number }
        Returns: {
          tag: string
          uses: number
        }[]
      }
      vote_car_battle: {
        Args: { loser: string; winner: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "active" | "banned" | "removed"
      car_status: "verified" | "unverified"
      fault_source: "ai" | "owner"
      friendship_status: "pending" | "accepted"
      fuel_type: "petrol" | "diesel" | "electric" | "hybrid" | "lpg" | "other"
      garage_car_ownership_status: "current" | "previous"
      listing_type: "car" | "part"
      mod_category:
        | "wheels"
        | "suspension"
        | "exhaust"
        | "intake"
        | "engine"
        | "exterior"
        | "interior"
        | "lighting"
        | "audio"
        | "brakes"
        | "other"
      post_audience: "public" | "friends"
      post_category:
        | "discussion"
        | "diagnostics"
        | "modifications"
        | "bodywork"
        | "maintenance"
        | "showcase"
        | "for_sale"
        | "spotted"
      post_report_reason:
        | "spam"
        | "scam"
        | "sexual_spam"
        | "harassment"
        | "hate"
        | "dangerous"
        | "off_topic"
        | "other"
      post_report_status: "open" | "dismissed" | "actioned"
      profile_persona:
        | "owner"
        | "modifier"
        | "enthusiast"
        | "diy_mechanic"
        | "trader"
      profile_role: "user" | "admin"
      protected_term_match: "word" | "phrase"
      transmission_type: "manual" | "automatic" | "cvt" | "dct" | "other"
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
      account_status: ["active", "banned", "removed"],
      car_status: ["verified", "unverified"],
      fault_source: ["ai", "owner"],
      friendship_status: ["pending", "accepted"],
      fuel_type: ["petrol", "diesel", "electric", "hybrid", "lpg", "other"],
      garage_car_ownership_status: ["current", "previous"],
      listing_type: ["car", "part"],
      mod_category: [
        "wheels",
        "suspension",
        "exhaust",
        "intake",
        "engine",
        "exterior",
        "interior",
        "lighting",
        "audio",
        "brakes",
        "other",
      ],
      post_audience: ["public", "friends"],
      post_category: [
        "discussion",
        "diagnostics",
        "modifications",
        "bodywork",
        "maintenance",
        "showcase",
        "for_sale",
        "spotted",
      ],
      post_report_reason: [
        "spam",
        "scam",
        "sexual_spam",
        "harassment",
        "hate",
        "dangerous",
        "off_topic",
        "other",
      ],
      post_report_status: ["open", "dismissed", "actioned"],
      profile_persona: [
        "owner",
        "modifier",
        "enthusiast",
        "diy_mechanic",
        "trader",
      ],
      profile_role: ["user", "admin"],
      protected_term_match: ["word", "phrase"],
      transmission_type: ["manual", "automatic", "cvt", "dct", "other"],
    },
  },
} as const
