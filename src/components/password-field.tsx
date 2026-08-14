"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordField({label,name,autoComplete="current-password",placeholder=""}:{label:string;name:string;autoComplete?:string;placeholder?:string}){
  const [visible,setVisible]=useState(false);
  return <label className="block text-xs font-bold">{label}<span className="relative mt-2 block"><input name={name} type={visible?"text":"password"} autoComplete={autoComplete} required minLength={8} maxLength={72} className="h-12 w-full rounded-xl border border-line bg-white px-4 pr-12 font-normal outline-none focus:border-brand" placeholder={placeholder}/><button type="button" onClick={()=>setVisible(value=>!value)} aria-label={visible?"Hide password":"Show password"} aria-pressed={visible} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted hover:text-ink">{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label>
}
