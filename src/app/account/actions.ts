"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const passwordSchema=z.string().min(8).max(72);
export async function setPassword(formData:FormData){
  const password=formData.get("password");const confirm=formData.get("passwordConfirm");
  if(password!==confirm)redirect("/account?error=The+passwords+do+not+match");
  const parsed=passwordSchema.safeParse(password);if(!parsed.success)redirect("/account?error=Use+a+password+between+8+and+72+characters");
  const supabase=await createClient();const claims=await supabase.auth.getClaims();if(claims.error||!claims.data?.claims?.sub)redirect("/login");
  const {error}=await supabase.auth.updateUser({password:parsed.data});if(error)redirect(`/account?error=${encodeURIComponent(error.message)}`);
  redirect("/account?message=Your+PVIntell+password+has+been+saved");
}
