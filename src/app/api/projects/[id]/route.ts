import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const projectUpdateSchema=z.object({
  id:z.uuid(),name:z.string().min(1).max(120),description:z.string().max(1000),projectType:z.enum(["off-grid","grid-tied","hybrid"]),phase:z.string(),location:z.string(),goal:z.string(),priorities:z.array(z.string()),systemVoltage:z.number().positive(),autonomyDays:z.number().positive(),peakSunHours:z.number().positive(),
  loads:z.array(z.object({id:z.uuid(),name:z.string(),watts:z.number().nonnegative(),quantity:z.number().int().positive(),hoursPerDay:z.number().min(0).max(24),surgeWatts:z.number().nonnegative(),currentType:z.enum(["AC","DC"]),confidence:z.enum(["estimated","confirmed"]),simultaneous:z.boolean()})),
  assumptions:z.array(z.object({id:z.uuid(),label:z.string(),value:z.string(),reason:z.string(),confidence:z.enum(["estimated","confirmed"])})),
  installationSteps:z.array(z.object({id:z.uuid(),title:z.string(),description:z.string(),safetyLevel:z.enum(["user","low-voltage","high-current-dc","licensed"]),expectedResult:z.string(),complete:z.boolean()})),
  commissioning:z.array(z.object({id:z.uuid(),label:z.string(),value:z.string(),expected:z.string(),recordedAt:z.string(),result:z.enum(["pass","attention"])})),
}).passthrough();

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params; const parsed=projectUpdateSchema.safeParse(await request.json());
  if(!parsed.success||parsed.data.id!==id)return Response.json({error:"Invalid project update"},{status:400});
  const supabase=await createClient();const claims=await supabase.auth.getClaims();if(claims.error||!claims.data?.claims?.sub)return Response.json({error:"Unauthorized"},{status:401});
  const p=parsed.data;const mode=p.projectType==="off-grid"?"off_grid":p.projectType==="grid-tied"?"grid_tied":"hybrid";
  const update=await supabase.from("projects").update({name:p.name,description:p.description,mode,phase:p.phase,location:p.location,system_voltage:p.systemVoltage,settings:{goal:p.goal,priorities:p.priorities,autonomyDays:p.autonomyDays,peakSunHours:p.peakSunHours}}).eq("id",id);
  if(update.error)return Response.json({error:update.error.message},{status:400});
  const writes=[];
  if(p.loads.length)writes.push(supabase.from("loads").upsert(p.loads.map(l=>({id:l.id,project_id:id,name:l.name,watts:l.watts,quantity:l.quantity,hours_per_day:l.hoursPerDay,surge_watts:l.surgeWatts,current_type:l.currentType,confidence:l.confidence,simultaneous:l.simultaneous}))));
  if(p.assumptions.length)writes.push(supabase.from("assumptions").upsert(p.assumptions.map(a=>({id:a.id,project_id:id,label:a.label,value:a.value,reason:a.reason,confidence:a.confidence}))));
  if(p.installationSteps.length)writes.push(supabase.from("installation_steps").upsert(p.installationSteps.map((s,index)=>({id:s.id,project_id:id,position:index+1,title:s.title,instructions:s.description,safety_level:s.safetyLevel,expected_result:s.expectedResult,completed_at:s.complete?new Date().toISOString():null}))));
  if(p.commissioning.length)writes.push(supabase.from("commissioning_records").upsert(p.commissioning.map(r=>({id:r.id,project_id:id,type:r.label,value:{display:r.value},expected_range:{display:r.expected},result:r.result,recorded_at:r.recordedAt}))));
  const results=await Promise.all(writes);const failed=results.find(result=>result.error);if(failed?.error)return Response.json({error:failed.error.message},{status:400});
  return Response.json({saved:true});
}
