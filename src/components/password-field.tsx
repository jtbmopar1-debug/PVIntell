"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordField({label,name,autoComplete="current-password",placeholder=""}:{label:string;name:string;autoComplete?:string;placeholder?:string}){
  const [visible,setVisible]=useState(false);
  return <label className="block text-[10px] font-bold">{label}<span className="relative mt-1 block"><input name={name} type={visible?"text":"password"} autoComplete={autoComplete} required minLength={8} maxLength={72} className="h-10 w-full rounded-lg border border-line bg-white px-3 pr-10 text-[11px] font-normal outline-none focus:border-brand" placeholder={placeholder}/><button type="button" onClick={()=>setVisible(value=>!value)} aria-label={visible?"Hide password":"Show password"} aria-pressed={visible} className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted hover:text-ink">{visible?<EyeOff size={15}/>:<Eye size={15}/>}</button></span></label>
}
