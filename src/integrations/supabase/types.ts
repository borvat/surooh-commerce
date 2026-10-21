export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          new_data: Json | null;
          old_data: Json | null;
          organization_id: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          organization_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          organization_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      bom_lines: {
        Row: {
          component_id: string;
          created_at: string;
          id: string;
          product_id: string;
          quantity_required: number;
          updated_at: string;
        };
        Insert: {
          component_id: string;
          created_at?: string;
          id?: string;
          product_id: string;
          quantity_required: number;
          updated_at?: string;
        };
        Update: {
          component_id?: string;
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity_required?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bom_lines_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "components";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bom_lines_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "v_component_availability";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bom_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bom_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "v_product_availability";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_credentials: {
        Row: {
          channel_id: string;
          client_id: string;
          client_id_last4: string;
          created_at: string;
          last_error: string | null;
          organization_id: string;
          secret_ciphertext: string;
          secret_iv: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          channel_id: string;
          client_id: string;
          client_id_last4: string;
          created_at?: string;
          last_error?: string | null;
          organization_id: string;
          secret_ciphertext: string;
          secret_iv: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          channel_id?: string;
          client_id?: string;
          client_id_last4?: string;
          created_at?: string;
          last_error?: string | null;
          organization_id?: string;
          secret_ciphertext?: string;
          secret_iv?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_credentials_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: true;
            referencedRelation: "sales_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_credentials_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_listings: {
        Row: {
          active: boolean;
          attrs_synced_at: string | null;
          bol_colour: string | null;
          bol_contents: string | null;
          bol_corrected_stock: number | null;
          bol_pack: number | null;
          bol_product_id: string | null;
          bol_stock: number | null;
          channel_id: string;
          condition: string | null;
          countries: string[] | null;
          created_at: string;
          desired_publish_qty: number | null;
          enriched_at: string | null;
          external_ean: string | null;
          external_offer_id: string | null;
          for_sale: boolean | null;
          fulfillment_method: Database["public"]["Enums"]["fulfillment_method"];
          id: string;
          inventory_owner: Database["public"]["Enums"]["inventory_owner"];
          last_pushed_at: string | null;
          last_pushed_qty: number | null;
          last_synced_at: string | null;
          mapping_status: Database["public"]["Enums"]["mapping_status"];
          note: string | null;
          organization_id: string;
          product_id: string | null;
          raw: Json | null;
          reference: string | null;
          remote_modified_at: string | null;
          remote_reported_qty: number | null;
          sync_status: string;
          title: string | null;
          unit_price: number | null;
          updated_at: string;
          variant_color: string | null;
          variant_label: string | null;
          variant_pack: number | null;
        };
        Insert: {
          active?: boolean;
          attrs_synced_at?: string | null;
          bol_colour?: string | null;
          bol_contents?: string | null;
          bol_corrected_stock?: number | null;
          bol_pack?: number | null;
          bol_product_id?: string | null;
          bol_stock?: number | null;
          channel_id: string;
          condition?: string | null;
          countries?: string[] | null;
          created_at?: string;
          desired_publish_qty?: number | null;
          enriched_at?: string | null;
          external_ean?: string | null;
          external_offer_id?: string | null;
          for_sale?: boolean | null;
          fulfillment_method?: Database["public"]["Enums"]["fulfillment_method"];
          id?: string;
          inventory_owner?: Database["public"]["Enums"]["inventory_owner"];
          last_pushed_at?: string | null;
          last_pushed_qty?: number | null;
          last_synced_at?: string | null;
          mapping_status?: Database["public"]["Enums"]["mapping_status"];
          note?: string | null;
          organization_id: string;
          product_id?: string | null;
          raw?: Json | null;
          reference?: string | null;
          remote_modified_at?: string | null;
          remote_reported_qty?: number | null;
          sync_status?: string;
          title?: string | null;
          unit_price?: number | null;
          updated_at?: string;
          variant_color?: string | null;
          variant_label?: string | null;
          variant_pack?: number | null;
        };
        Update: {
          active?: boolean;
          attrs_synced_at?: string | null;
          bol_colour?: string | null;
          bol_contents?: string | null;
          bol_corrected_stock?: number | null;
          bol_pack?: number | null;
          bol_product_id?: string | null;
          bol_stock?: number | null;
          channel_id?: string;
          condition?: string | null;
          countries?: string[] | null;
          created_at?: string;
          desired_publish_qty?: number | null;
          enriched_at?: string | null;
          external_ean?: string | null;
          external_offer_id?: string | null;
          for_sale?: boolean | null;
          fulfillment_method?: Database["public"]["Enums"]["fulfillment_method"];
          id?: string;
          inventory_owner?: Database["public"]["Enums"]["inventory_owner"];
          last_pushed_at?: string | null;
          last_pushed_qty?: number | null;
          last_synced_at?: string | null;
          mapping_status?: Database["public"]["Enums"]["mapping_status"];
          note?: string | null;
          organization_id?: string;
          product_id?: string | null;
          raw?: Json | null;
          reference?: string | null;
          remote_modified_at?: string | null;
          remote_reported_qty?: number | null;
          sync_status?: string;
          title?: string | null;
          unit_price?: number | null;
          updated_at?: string;
          variant_color?: string | null;
          variant_label?: string | null;
          variant_pack?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "channel_listings_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "sales_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_listings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_listings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_listings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "v_product_availability";
            referencedColumns: ["id"];
          },
        ];
      };
      component_stock: {
        Row: {
          component_id: string;
          physical_qty: number;
          reserved_qty: number;
          updated_at: string;
          warehouse_id: string;
        };
        Insert: {
          component_id: string;
          physical_qty?: number;
          reserved_qty?: number;
          updated_at?: string;
          warehouse_id: string;
        };
        Update: {
          component_id?: string;
          physical_qty?: number;
          reserved_qty?: number;
          updated_at?: string;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "component_stock_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "components";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "component_stock_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "v_component_availability";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "component_stock_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      components: {
        Row: {
          active: boolean;
          archived_at: string | null;
          barcode: string | null;
          created_at: string;
          id: string;
          low_stock_threshold: number;
          name: string;
          organization_id: string;
          safety_stock: number;
          sku: string;
          unit_of_measure: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          archived_at?: string | null;
          barcode?: string | null;
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          name: string;
          organization_id: string;
          safety_stock?: number;
          sku: string;
          unit_of_measure?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          archived_at?: string | null;
          barcode?: string | null;
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          name?: string;
          organization_id?: string;
          safety_stock?: number;
          sku?: string;
          unit_of_measure?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "components_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_outbox: {
        Row: {
          attempts: number;
          channel_id: string;
          completed_at: string | null;
          created_at: string;
          desired_qty: number;
          id: number;
          idempotency_key: string;
          last_error: string | null;
          listing_id: string;
          operation: string;
          organization_id: string;
          payload: Json;
          payload_hash: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["outbox_status"];
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          channel_id: string;
          completed_at?: string | null;
          created_at?: string;
          desired_qty: number;
          id?: never;
          idempotency_key: string;
          last_error?: string | null;
          listing_id: string;
          operation?: string;
          organization_id: string;
          payload: Json;
          payload_hash: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["outbox_status"];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          channel_id?: string;
          completed_at?: string | null;
          created_at?: string;
          desired_qty?: number;
          id?: never;
          idempotency_key?: string;
          last_error?: string | null;
          listing_id?: string;
          operation?: string;
          organization_id?: string;
          payload?: Json;
          payload_hash?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["outbox_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_outbox_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "sales_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_outbox_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "channel_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_outbox_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "v_listing_sync";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_outbox_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      order_lines: {
        Row: {
          created_at: string;
          fulfillment_method: Database["public"]["Enums"]["fulfillment_method"];
          id: string;
          inventory_owner: Database["public"]["Enums"]["inventory_owner"];
          listing_id: string | null;
          order_id: string;
          product_id: string;
          quantity: number;
          remote_status: string | null;
        };
        Insert: {
          created_at?: string;
          fulfillment_method?: Database["public"]["Enums"]["fulfillment_method"];
          id?: string;
          inventory_owner?: Database["public"]["Enums"]["inventory_owner"];
          listing_id?: string | null;
          order_id: string;
          product_id: string;
          quantity: number;
          remote_status?: string | null;
        };
        Update: {
          created_at?: string;
          fulfillment_method?: Database["public"]["Enums"]["fulfillment_method"];
          id?: string;
          inventory_owner?: Database["public"]["Enums"]["inventory_owner"];
          listing_id?: string | null;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          remote_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_lines_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "channel_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "v_listing_sync";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "v_product_availability";
            referencedColumns: ["id"];
          },
        ];
      };
      order_reservations: {
        Row: {
          component_id: string;
          order_id: string;
          quantity: number;
          warehouse_id: string;
        };
        Insert: {
          component_id: string;
          order_id: string;
          quantity: number;
          warehouse_id: string;
        };
        Update: {
          component_id?: string;
          order_id?: string;
          quantity?: number;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_reservations_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "components";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_reservations_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "v_component_availability";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_reservations_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_reservations_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          cancelled_at: string | null;
          channel_id: string | null;
          created_at: string;
          created_by: string | null;
          external_ref: string | null;
          fulfilled_at: string | null;
          id: string;
          note: string | null;
          order_number: number;
          organization_id: string;
          status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
          warehouse_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          channel_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          external_ref?: string | null;
          fulfilled_at?: string | null;
          id?: string;
          note?: string | null;
          order_number?: never;
          organization_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
          warehouse_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          channel_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          external_ref?: string | null;
          fulfilled_at?: string | null;
          id?: string;
          note?: string | null;
          order_number?: never;
          organization_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "sales_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          organization_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          organization_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_attributes: {
        Row: {
          confirmed_by: string | null;
          created_at: string;
          id: string;
          key: string;
          organization_id: string;
          product_id: string;
          source: string;
          status: string;
          updated_at: string;
          value_numeric: number | null;
          value_text: string | null;
        };
        Insert: {
          confirmed_by?: string | null;
          created_at?: string;
          id?: string;
          key: string;
          organization_id: string;
          product_id: string;
          source: string;
          status: string;
          updated_at?: string;
          value_numeric?: number | null;
          value_text?: string | null;
        };
        Update: {
          confirmed_by?: string | null;
          created_at?: string;
          id?: string;
          key?: string;
          organization_id?: string;
          product_id?: string;
          source?: string;
          status?: string;
          updated_at?: string;
          value_numeric?: number | null;
          value_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_attributes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "v_product_availability";
            referencedColumns: ["id"];
          },
        ];
      };
      product_families: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_families_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      product_review_decisions: {
        Row: {
          created_at: string;
          created_by: string | null;
          decision: string;
          id: string;
          kind: string;
          organization_id: string;
          product_ids: string[];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          decision: string;
          id?: string;
          kind: string;
          organization_id: string;
          product_ids: string[];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          decision?: string;
          id?: string;
          kind?: string;
          organization_id?: string;
          product_ids?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_review_decisions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          archived_at: string | null;
          created_at: string;
          ean: string | null;
          family_id: string | null;
          family_key: string | null;
          id: string;
          image_url: string | null;
          is_demo: boolean;
          master_reference: string | null;
          name: string;
          name_overridden: boolean;
          organization_id: string;
          primary_listing_id: string | null;
          product_type: Database["public"]["Enums"]["product_type"];
          relationship_status: string;
          relationship_type: string | null;
          sku: string;
          stock_component_id: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          ean?: string | null;
          family_id?: string | null;
          family_key?: string | null;
          id?: string;
          image_url?: string | null;
          is_demo?: boolean;
          master_reference?: string | null;
          name: string;
          name_overridden?: boolean;
          organization_id: string;
          primary_listing_id?: string | null;
          product_type?: Database["public"]["Enums"]["product_type"];
          relationship_status?: string;
          relationship_type?: string | null;
          sku: string;
          stock_component_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          ean?: string | null;
          family_id?: string | null;
          family_key?: string | null;
          id?: string;
          image_url?: string | null;
          is_demo?: boolean;
          master_reference?: string | null;
          name?: string;
          name_overridden?: boolean;
          organization_id?: string;
          primary_listing_id?: string | null;
          product_type?: Database["public"]["Enums"]["product_type"];
          relationship_status?: string;
          relationship_type?: string | null;
          sku?: string;
          stock_component_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "product_families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_primary_listing_id_fkey";
            columns: ["primary_listing_id"];
            isOneToOne: false;
            referencedRelation: "channel_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_primary_listing_id_fkey";
            columns: ["primary_listing_id"];
            isOneToOne: false;
            referencedRelation: "v_listing_sync";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_stock_component_id_fkey";
            columns: ["stock_component_id"];
            isOneToOne: false;
            referencedRelation: "components";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_stock_component_id_fkey";
            columns: ["stock_component_id"];
            isOneToOne: false;
            referencedRelation: "v_component_availability";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      sales_channels: {
        Row: {
          account_label: string | null;
          active: boolean;
          code: string;
          company: Json;
          config: Json;
          created_at: string;
          external_account_ref: string | null;
          id: string;
          is_demo: boolean;
          last_order_sync_at: string | null;
          last_product_sync_at: string | null;
          last_sync_at: string | null;
          last_sync_message: string | null;
          live_write_enabled: boolean;
          name: string;
          organization_id: string;
          provider: string;
          retailer_id: string | null;
          retailer_info: Json | null;
          retailer_name: string | null;
          retailer_synced_at: string | null;
          status: string;
          stock_buffer: number;
          stock_cap: number | null;
          updated_at: string;
        };
        Insert: {
          account_label?: string | null;
          active?: boolean;
          code: string;
          company?: Json;
          config?: Json;
          created_at?: string;
          external_account_ref?: string | null;
          id?: string;
          is_demo?: boolean;
          last_order_sync_at?: string | null;
          last_product_sync_at?: string | null;
          last_sync_at?: string | null;
          last_sync_message?: string | null;
          live_write_enabled?: boolean;
          name: string;
          organization_id: string;
          provider?: string;
          retailer_id?: string | null;
          retailer_info?: Json | null;
          retailer_name?: string | null;
          retailer_synced_at?: string | null;
          status?: string;
          stock_buffer?: number;
          stock_cap?: number | null;
          updated_at?: string;
        };
        Update: {
          account_label?: string | null;
          active?: boolean;
          code?: string;
          company?: Json;
          config?: Json;
          created_at?: string;
          external_account_ref?: string | null;
          id?: string;
          is_demo?: boolean;
          last_order_sync_at?: string | null;
          last_product_sync_at?: string | null;
          last_sync_at?: string | null;
          last_sync_message?: string | null;
          live_write_enabled?: boolean;
          name?: string;
          organization_id?: string;
          provider?: string;
          retailer_id?: string | null;
          retailer_info?: Json | null;
          retailer_name?: string | null;
          retailer_synced_at?: string | null;
          status?: string;
          stock_buffer?: number;
          stock_cap?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_channels_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          component_id: string;
          created_at: string;
          id: number;
          movement_type: Database["public"]["Enums"]["movement_type"];
          order_id: string | null;
          organization_id: string;
          physical_after: number;
          physical_delta: number;
          reason: string | null;
          reference: string | null;
          reserved_after: number;
          reserved_delta: number;
          user_id: string | null;
          warehouse_id: string;
        };
        Insert: {
          component_id: string;
          created_at?: string;
          id?: never;
          movement_type: Database["public"]["Enums"]["movement_type"];
          order_id?: string | null;
          organization_id: string;
          physical_after: number;
          physical_delta?: number;
          reason?: string | null;
          reference?: string | null;
          reserved_after: number;
          reserved_delta?: number;
          user_id?: string | null;
          warehouse_id: string;
        };
        Update: {
          component_id?: string;
          created_at?: string;
          id?: never;
          movement_type?: Database["public"]["Enums"]["movement_type"];
          order_id?: string | null;
          organization_id?: string;
          physical_after?: number;
          physical_delta?: number;
          reason?: string | null;
          reference?: string | null;
          reserved_after?: number;
          reserved_delta?: number;
          user_id?: string | null;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "components";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "v_component_availability";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      warehouses: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          is_default: boolean;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_component_availability: {
        Row: {
          active: boolean | null;
          archived_at: string | null;
          available_qty: number | null;
          barcode: string | null;
          created_at: string | null;
          id: string | null;
          is_low: boolean | null;
          low_stock_threshold: number | null;
          name: string | null;
          organization_id: string | null;
          physical_qty: number | null;
          reserved_qty: number | null;
          safety_stock: number | null;
          sku: string | null;
          unit_of_measure: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "components_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      v_listing_sync: {
        Row: {
          active: boolean | null;
          channel_code: string | null;
          channel_id: string | null;
          channel_name: string | null;
          computed_desired_qty: number | null;
          derived_available: number | null;
          desired_publish_qty: number | null;
          external_ean: string | null;
          external_offer_id: string | null;
          fulfillment_method: Database["public"]["Enums"]["fulfillment_method"] | null;
          id: string | null;
          inventory_owner: Database["public"]["Enums"]["inventory_owner"] | null;
          last_pushed_at: string | null;
          last_pushed_qty: number | null;
          last_synced_at: string | null;
          mapping_status: Database["public"]["Enums"]["mapping_status"] | null;
          note: string | null;
          organization_id: string | null;
          product_ean: string | null;
          product_id: string | null;
          product_sku: string | null;
          reconciliation_state: string | null;
          remote_reported_qty: number | null;
          stock_buffer: number | null;
          stock_cap: number | null;
          sync_status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "channel_listings_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "sales_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_listings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_listings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_listings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "v_product_availability";
            referencedColumns: ["id"];
          },
        ];
      };
      v_product_availability: {
        Row: {
          active: boolean | null;
          archived_at: string | null;
          available_qty: number | null;
          bom_line_count: number | null;
          bottleneck_sku: string | null;
          created_at: string | null;
          ean: string | null;
          id: string | null;
          name: string | null;
          organization_id: string | null;
          product_type: Database["public"]["Enums"]["product_type"] | null;
          sku: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      v_stock_reconciliation: {
        Row: {
          component_id: string | null;
          in_sync: boolean | null;
          ledger_physical: number | null;
          ledger_reserved: number | null;
          physical_qty: number | null;
          reserved_qty: number | null;
          warehouse_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "component_stock_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "components";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "component_stock_component_id_fkey";
            columns: ["component_id"];
            isOneToOne: false;
            referencedRelation: "v_component_availability";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "component_stock_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      _apply_stock: {
        Args: {
          _component: string;
          _order: string;
          _pdelta: number;
          _rdelta: number;
          _reason: string;
          _reference: string;
          _type: Database["public"]["Enums"]["movement_type"];
          _user: string;
          _warehouse: string;
        };
        Returns: undefined;
      };
      _chk: {
        Args: { _act: number; _exp: number; _name: string; _step: string };
        Returns: Json;
      };
      _ensure_primary: { Args: { _pid: string }; Returns: undefined };
      _err: { Args: { _msg: string; _row: number }; Returns: Json };
      _is_int: { Args: { _t: string }; Returns: boolean };
      _product_for_ean: {
        Args: { _ean: string; _org: string };
        Returns: string;
      };
      apply_bol_attributes: {
        Args: { _channel_id: string; _rows: Json };
        Returns: number;
      };
      apply_bol_enrichment: {
        Args: { _channel_id: string; _rows: Json };
        Returns: number;
      };
      bootstrap_user: { Args: never; Returns: string };
      cancel_order: { Args: { _order_id: string }; Returns: undefined };
      channel_credential_status: {
        Args: never;
        Returns: {
          channel_id: string;
          client_id_last4: string;
          last_error: string;
          status: string;
          updated_at: string;
        }[];
      };
      confirm_listing: {
        Args: { _listing_id: string; _product_id: string };
        Returns: undefined;
      };
      current_org_id: { Args: never; Returns: string };
      default_warehouse_id: { Args: { _org: string }; Returns: string };
      fulfill_order: { Args: { _order_id: string }; Returns: undefined };
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_org_role: {
        Args: {
          _org: string;
          _roles: Database["public"]["Enums"]["app_role"][];
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      import_bom: { Args: { _apply?: boolean; _rows: Json }; Returns: Json };
      import_components: {
        Args: { _apply?: boolean; _rows: Json };
        Returns: Json;
      };
      import_listings: {
        Args: { _apply?: boolean; _rows: Json };
        Returns: Json;
      };
      import_products: {
        Args: { _apply?: boolean; _rows: Json };
        Returns: Json;
      };
      is_org_member: { Args: { _org: string }; Returns: boolean };
      merge_products: {
        Args: {
          _keep_target?: boolean;
          _master_reference?: string;
          _sources: string[];
          _stock_value?: number;
          _target: string;
        };
        Returns: undefined;
      };
      place_order: {
        Args: {
          _channel_id?: string;
          _external_ref?: string;
          _lines: Json;
          _note?: string;
          _warehouse_id?: string;
        };
        Returns: string;
      };
      plan_stock_sync: { Args: { _channel_id: string }; Returns: number };
      post_stock_movement: {
        Args: {
          _component_id: string;
          _movement_type: Database["public"]["Enums"]["movement_type"];
          _quantity: number;
          _reason: string;
          _reference?: string;
          _warehouse_id?: string;
        };
        Returns: undefined;
      };
      remove_member: {
        Args: { _org: string; _user_id: string };
        Returns: undefined;
      };
      reset_product_attribute: {
        Args: { _key: string; _product_id: string };
        Returns: undefined;
      };
      run_acceptance_test: { Args: never; Returns: Json };
      set_bundle_contents: {
        Args: { _items: Json; _product_id: string };
        Returns: undefined;
      };
      set_channel_company: {
        Args: { _channel_id: string; _company: Json };
        Returns: undefined;
      };
      set_channel_retailer: {
        Args: { _channel_id: string; _info: Json };
        Returns: undefined;
      };
      set_channel_status: {
        Args: { _channel_id: string; _message: string; _status: string };
        Returns: undefined;
      };
      set_listing_variant: {
        Args: {
          _color: string;
          _label: string;
          _listing_id: string;
          _pack: number;
        };
        Returns: undefined;
      };
      set_member_role: {
        Args: {
          _email: string;
          _org: string;
          _role: Database["public"]["Enums"]["app_role"];
        };
        Returns: undefined;
      };
      set_primary_listing: { Args: { _listing_id: string }; Returns: undefined };
      set_product_as_stock_item: {
        Args: { _product_id: string };
        Returns: string;
      };
      set_product_attribute: {
        Args: {
          _key: string;
          _product_id: string;
          _source: string;
          _status: string;
          _value: string;
        };
        Returns: undefined;
      };
      set_product_bom: {
        Args: { _lines: Json; _product_id: string };
        Returns: undefined;
      };
      set_product_family: {
        Args: { _name: string; _product_id: string };
        Returns: undefined;
      };
      set_product_master: {
        Args: { _master_reference: string; _name: string; _product_id: string };
        Returns: undefined;
      };
      set_product_normal: { Args: { _product_id: string }; Returns: undefined };
      set_product_relationship: {
        Args: { _product_id: string; _status: string; _type: string };
        Returns: undefined;
      };
      unmerge_listing: { Args: { _listing_id: string }; Returns: string };
      upsert_bol_offers: {
        Args: { _channel_id: string; _full?: boolean; _offers: Json };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "warehouse" | "viewer";
      fulfillment_method: "FBR" | "FBB";
      inventory_owner: "INTERNAL" | "BOL";
      mapping_status: "UNMAPPED" | "SUGGESTED" | "CONFIRMED" | "EXCEPTION";
      movement_type:
        "receipt" | "adjustment" | "reservation" | "release" | "sale" | "return" | "damaged";
      order_status: "placed" | "fulfilled" | "cancelled";
      outbox_status: "queued" | "sending" | "succeeded" | "failed" | "superseded";
      product_type: "SIMPLE" | "BUNDLE";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "warehouse", "viewer"],
      fulfillment_method: ["FBR", "FBB"],
      inventory_owner: ["INTERNAL", "BOL"],
      mapping_status: ["UNMAPPED", "SUGGESTED", "CONFIRMED", "EXCEPTION"],
      movement_type: [
        "receipt",
        "adjustment",
        "reservation",
        "release",
        "sale",
        "return",
        "damaged",
      ],
      order_status: ["placed", "fulfilled", "cancelled"],
      outbox_status: ["queued", "sending", "succeeded", "failed", "superseded"],
      product_type: ["SIMPLE", "BUNDLE"],
    },
  },
} as const;
