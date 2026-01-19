export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          role?: string;
          created_at?: string;
        };
      };
      invite_tokens: {
        Row: {
          id: string;
          token: string;
          used: boolean;
          used_by: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          used?: boolean;
          used_by?: string | null;
          created_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          token?: string;
          used?: boolean;
          used_by?: string | null;
          created_at?: string;
          expires_at?: string;
        };
      };
      channels: {
        Row: {
          id: string;
          name: string;
          telegram_link: string;
          topic: string;
          description: string | null;
          is_active: boolean;
          ai_enabled: boolean;
          ai_status: 'stopped' | 'running' | 'error';
          ai_last_run_at: string | null;
          ai_error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          telegram_link: string;
          topic: string;
          description?: string | null;
          is_active?: boolean;
          ai_enabled?: boolean;
          ai_status?: 'stopped' | 'running' | 'error';
          ai_last_run_at?: string | null;
          ai_error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          telegram_link?: string;
          topic?: string;
          description?: string | null;
          is_active?: boolean;
          ai_enabled?: boolean;
          ai_status?: 'stopped' | 'running' | 'error';
          ai_last_run_at?: string | null;
          ai_error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          channel_id: string;
          title: string | null;
          content: Json;
          plain_text: string;
          status: 'pending' | 'published' | 'rejected' | 'draft';
          scheduled_at: string | null;
          published_at: string | null;
          ai_generated: boolean;
          ai_editing: boolean;
          original_content: Json | null;
          generation_prompt: string | null;
          source_content_ids: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          title?: string | null;
          content: Json;
          plain_text: string;
          status?: 'pending' | 'published' | 'rejected' | 'draft';
          scheduled_at?: string | null;
          published_at?: string | null;
          ai_generated?: boolean;
          ai_editing?: boolean;
          original_content?: Json | null;
          generation_prompt?: string | null;
          source_content_ids?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          channel_id?: string;
          title?: string | null;
          content?: Json;
          plain_text?: string;
          status?: 'pending' | 'published' | 'rejected' | 'draft';
          scheduled_at?: string | null;
          published_at?: string | null;
          ai_generated?: boolean;
          ai_editing?: boolean;
          original_content?: Json | null;
          generation_prompt?: string | null;
          source_content_ids?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sources: {
        Row: {
          id: string;
          channel_id: string;
          name: string;
          type: 'telegram' | 'website' | 'rss';
          url: string;
          last_parsed_at: string | null;
          is_active: boolean;
          last_content_hash: string | null;
          parsing_config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          name: string;
          type: 'telegram' | 'website' | 'rss';
          url: string;
          last_parsed_at?: string | null;
          is_active?: boolean;
          last_content_hash?: string | null;
          parsing_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          channel_id?: string;
          name?: string;
          type?: 'telegram' | 'website' | 'rss';
          url?: string;
          last_parsed_at?: string | null;
          is_active?: boolean;
          last_content_hash?: string | null;
          parsing_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      parsed_content: {
        Row: {
          id: string;
          source_id: string;
          content_hash: string;
          title: string | null;
          content: string;
          url: string | null;
          published_at: string | null;
          parsed_at: string;
          used_in_posts: boolean;
          metadata: Json;
        };
        Insert: {
          id?: string;
          source_id: string;
          content_hash: string;
          title?: string | null;
          content: string;
          url?: string | null;
          published_at?: string | null;
          parsed_at?: string;
          used_in_posts?: boolean;
          metadata?: Json;
        };
        Update: {
          id?: string;
          source_id?: string;
          content_hash?: string;
          title?: string | null;
          content?: string;
          url?: string | null;
          published_at?: string | null;
          parsed_at?: string;
          used_in_posts?: boolean;
          metadata?: Json;
        };
      };
      ai_generation_logs: {
        Row: {
          id: string;
          channel_id: string | null;
          post_id: string | null;
          action_type: 'generate' | 'edit' | 'regenerate';
          prompt: string;
          model: string;
          tokens_used: number | null;
          cost_usd: number | null;
          success: boolean;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel_id?: string | null;
          post_id?: string | null;
          action_type: 'generate' | 'edit' | 'regenerate';
          prompt: string;
          model: string;
          tokens_used?: number | null;
          cost_usd?: number | null;
          success?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          channel_id?: string | null;
          post_id?: string | null;
          action_type?: 'generate' | 'edit' | 'regenerate';
          prompt?: string;
          model?: string;
          tokens_used?: number | null;
          cost_usd?: number | null;
          success?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
