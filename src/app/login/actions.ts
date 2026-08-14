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
  const password=formData.get("password");
  if(password!==formData.get("passwordConfirm")) redirect("/login?mode=signup&error=The+two+passwords+do+not+match");
  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) redirect("/login?mode=signup&error=Enter+a+valid+email+and+an+8-character+password");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error?.message.toLowerCase().includes("already registered")) {
    redirect("/login?setup=password&error=This+email+already+has+a+Google+account.+Continue+with+Google+below+to+add+a+PVIntell+password.");
  }
  if (error) redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function loginWithGoogle(formData:FormData) {
  const supabase=await createClient();
  const requestHeaders=await headers();
  const host=requestHeaders.get("x-forwarded-host")??requestHeaders.get("host")??"localhost:3000";
  const protocol=requestHeaders.get("x-forwarded-proto")??(host.startsWith("localhost")?"http":"https");
  const requestOrigin=`${protocol}://${host}`;
  const origin=process.env.NODE_ENV==="development"?requestOrigin:(process.env.NEXT_PUBLIC_APP_URL??requestOrigin);
  const requestedNext=formData.get("next");
  const next=typeof requestedNext==="string"&&requestedNext.startsWith("/")&&!requestedNext.startsWith("//")?requestedNext:"/";
  const callback=new URL("/auth/callback",origin);callback.searchParams.set("next",next);
  const {data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:callback.toString()}});
  if(error)redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if(data.url)redirect(data.url);
  redirect("/login?error=Google+sign-in+could+not+be+started");
}
