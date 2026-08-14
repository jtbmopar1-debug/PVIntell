import OpenAI from "openai";
import { z } from "zod";
import { MockAIProvider } from "@/ai/provider";
import type { Project } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";

const requestSchema=z.object({message:z.string().trim().min(1).max(4000),projectId:z.uuid(),project:z.custom<Project>()});
const wattsonInstructions=`You are Wattson, PVIntell's project-aware solar power guide. The user may be a complete beginner. Ask about ordinary life and desired outcomes rather than electrical terminology. If a value is unknown, explain it simply, offer a conservative estimate, and clearly label that estimate. Use the supplied project as the source of truth. Explain recommendations from this specific project. Never present mains-voltage or high-current DC work as trivial; identify when a qualified or licensed professional may be required. Keep the next response helpful and concise. Do not claim live telemetry when the context says it is simulated.`;

export async function POST(request:Request){
 const parsed=requestSchema.safeParse(await request.json());if(!parsed.success)return Response.json({error:"Invalid Wattson request"},{status:400});
 const supabase=await createClient();const claims=await supabase.auth.getClaims();const userId=claims.data?.claims?.sub;if(claims.error||typeof userId!=="string")return Response.json({error:"Unauthorized"},{status:401});
 const owned=await supabase.from("projects").select("id").eq("id",parsed.data.projectId).eq("owner_id",userId).maybeSingle();if(owned.error||!owned.data)return Response.json({error:"Project not found"},{status:404});
 let conversation=await supabase.from("conversations").select("id").eq("project_id",parsed.data.projectId).order("created_at").limit(1).maybeSingle();if(conversation.error)return Response.json({error:conversation.error.message},{status:400});
 if(!conversation.data){const created=await supabase.from("conversations").insert({project_id:parsed.data.projectId,title:"Wattson project discovery"}).select("id").single();if(created.error)return Response.json({error:created.error.message},{status:400});conversation={...conversation,data:created.data};}
 const conversationId=conversation.data?.id;if(!conversationId)return Response.json({error:"Could not create conversation"},{status:500});const userInsert=await supabase.from("chat_messages").insert({conversation_id:conversationId,role:"user",content:parsed.data.message});if(userInsert.error)return Response.json({error:userInsert.error.message},{status:400});
 const recent=await supabase.from("chat_messages").select("role,content").eq("conversation_id",conversationId).order("created_at",{ascending:false}).limit(12);const history=(recent.data??[]).reverse();
 let message:string;let provider="mock";
 if(process.env.OPENAI_API_KEY){
   const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
   const context={project:parsed.data.project,recentConversation:history,telemetryStatus:"simulated telemetry only"};
   const response=await openai.responses.create({model:process.env.OPENAI_MODEL??"gpt-5.6-luna",instructions:wattsonInstructions,input:`Structured PVIntell context:\n${JSON.stringify(context)}\n\nLatest user message:\n${parsed.data.message}`,text:{verbosity:"low"}});
   message=response.output_text||"I couldn't form a response. Please try that again.";provider="openai";
 }else{message=await new MockAIProvider().sendMessage(parsed.data.message,{project:parsed.data.project});}
 const assistantInsert=await supabase.from("chat_messages").insert({conversation_id:conversationId,role:"assistant",content:message,structured_context:{provider,projectId:parsed.data.projectId}});if(assistantInsert.error)return Response.json({error:assistantInsert.error.message},{status:400});
 return Response.json({message,provider});
}
