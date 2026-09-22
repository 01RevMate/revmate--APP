import { supabase } from "@/integrations/supabase/client";

export async function sendAppUpdate(message: string, actionUrl: string) {
  const { data, error } = await supabase.rpc("send_app_update", {
    update_message: message,
    update_url: actionUrl || "/",
  });
  if (error) throw error;
  return data;
}
