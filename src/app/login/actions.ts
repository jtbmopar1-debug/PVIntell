"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
  if(email!==formData.get("emailConfirm")) redirect("/login?mode=signup&error=The+two+email+addresses+do+not+match");
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) redirect("/login?mode=signup&error=Enter+a+valid+email+and+an+8-character+password");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function loginWithGoogle() {
  const supabase=await createClient();
  const requestHeaders=await headers();
  const host=requestHeaders.get("x-forwarded-host")??requestHeaders.get("host")??"localhost:3000";
  const protocol=requestHeaders.get("x-forwarded-proto")??(host.startsWith("localhost")?"http":"https");
  const requestOrigin=`${protocol}://${host}`;
  const origin=process.env.NODE_ENV==="development"?requestOrigin:(process.env.NEXT_PUBLIC_APP_URL??requestOrigin);
  const {data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${origin}/auth/callback`}});
  if(error)redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if(data.url)redirect(data.url);
  redirect("/login?error=Google+sign-in+could+not+be+started");
}
