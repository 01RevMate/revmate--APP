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
      listings: {
        Row: {
          car_id: string
          created_at: string
          description: string | null
          id: string
          price: number | null
          status: string
          title: string
          type: Database["public"]["Enums"]["listing_type"]
          user_id: string
        }
        Insert: {
          car_id: string
          created_at?: string
          description?: string | null
          id?: string
          price?: number | null
          status?: string
          title: string
          type?: Database["public"]["Enums"]["listing_type"]
          user_id: string
        }
        Update: {
          car_id?: string
          created_at?: string
          description?: string | null
          id?: string
          price?: number | null
          status?: string
          title?: string
          type?: Database["public"]["Enums"]["listing_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
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
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
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
      posts: {
        Row: {
          body: string
          car_id: string | null
          category: Database["public"]["Enums"]["post_category"]
          comments_count: number
          created_at: string
          id: string
          image_url: string | null
          likes_count: number
          posted_as_garage_car_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          car_id?: string | null
          category?: Database["public"]["Enums"]["post_category"]
          comments_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          posted_as_garage_car_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          car_id?: string | null
          category?: Database["public"]["Enums"]["post_category"]
          comments_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          posted_as_garage_car_id?: string | null
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
            foreignKeyName: "posts_posted_as_garage_car_id_fkey"
            columns: ["posted_as_garage_car_id"]
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
      garage_cars: {
        Row: {
          car_id: string | null
          created_at: string
          generation: string | null
          id: string
          make: string
          model: string
          nickname: string
          photo_url: string | null
          spec: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          car_id?: string | null
          created_at?: string
          generation?: string | null
          id?: string
          make: string
          model: string
          nickname: string
          photo_url?: string | null
          spec?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          car_id?: string | null
          created_at?: string
          generation?: string | null
          id?: string
          make?: string
          model?: string
          nickname?: string
          photo_url?: string | null
          spec?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          cover_photo_url: string | null
          created_at: string
          id: string
          persona: Database["public"]["Enums"]["profile_persona"]
          role: Database["public"]["Enums"]["profile_role"]
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          cover_photo_url?: string | null
          created_at?: string
          id?: string
          persona?: Database["public"]["Enums"]["profile_persona"]
          role?: Database["public"]["Enums"]["profile_role"]
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          cover_photo_url?: string | null
          created_at?: string
          id?: string
          persona?: Database["public"]["Enums"]["profile_persona"]
          role?: Database["public"]["Enums"]["profile_role"]
          user_id?: string
          username?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: { check_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      car_status: "verified" | "unverified"
      fault_source: "ai" | "owner"
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
      post_category: "discussion" | "diagnostics" | "modifications" | "bodywork" | "maintenance" | "showcase"
      profile_persona: "owner" | "modifier" | "enthusiast" | "diy_mechanic" | "trader"
      profile_role: "user" | "admin"
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
      car_status: ["verified", "unverified"],
      fault_source: ["ai", "owner"],
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
      post_category: ["discussion", "diagnostics", "modifications", "bodywork", "maintenance", "showcase"],
      profile_persona: ["owner", "modifier", "enthusiast", "diy_mechanic", "trader"],
      profile_role: ["user", "admin"],
    },
  },
} as const
