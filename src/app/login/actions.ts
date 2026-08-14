"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({ email: z.email(), password: z.string().min(8) });

export async function login(formData: FormData) {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=Enter+a+valid+email+and+an+8-character+password");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function signup(formData: FormData) {
  const email=formData.get("email");
  if(email!==formData.get("emailConfirm")) redirect("/login?error=The+two+email+addresses+do+not+match");
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=Enter+a+valid+email+and+an+8-character+password");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function loginWithGoogle() {
  const supabase=await createClient();
  const origin=process.env.NEXT_PUBLIC_APP_URL??"https://www.pvintell.com";
  const {data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${origin}/auth/callback`}});
  if(error)redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if(data.url)redirect(data.url);
  redirect("/login?error=Google+sign-in+could+not+be+started");
}
