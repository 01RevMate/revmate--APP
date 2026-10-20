import { supabase } from "@/integrations/supabase/client";

// The generated Supabase types only learn about new tables after Lovable
// regenerates them once a migration has run. Until then, code for pending
// SQL talks to the database through this loosely typed view of the client.

export type LooseQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> &
  Record<
    | "select"
    | "insert"
    | "update"
    | "upsert"
    | "delete"
    | "eq"
    | "in"
    | "gt"
    | "contains"
    | "order"
    | "limit"
    | "maybeSingle",
    (...args: unknown[]) => LooseQuery
  >;

export const looseDb = supabase as unknown as {
  from: (table: string) => LooseQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => LooseQuery;
};
