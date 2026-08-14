import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, InstallationStep, Project } from "@/domain/models";

const defaultSteps: Omit<InstallationStep, "id">[] = [
  ["Planning & approvals","Confirm locations, cable routes, access, and local approvals.","user","A documented layout reviewed by the installer."],
  ["Battery installation","Mount batteries as specified and verify isolation before interconnection.","high-current-dc","A secure, isolated bank ready for inspection."],
  ["DC protection","Install manufacturer-specified fusing, isolation, and over-current protection.","high-current-dc","Protected conductors with documented ratings."],
  ["Inverter installation","Mount the inverter with required clearances and segregated cabling.","licensed","Equipment ready for connection and inspection."],
  ["PV installation","Install array, earthing, DC cabling, labels, and isolation to the approved design.","licensed","Array isolated and ready for pre-power tests."],
  ["AC wiring","Complete regulated AC connections and protection.","licensed","Certificate and test results recorded."],
  ["Communications","Connect inverter, BMS, and monitoring communications.","low-voltage","All devices visible with stable communication."],
  ["Configuration","Apply battery-approved charge limits and operating priorities.","low-voltage","Settings match the commissioning sheet."],
  ["Pre-power checks","Verify polarity, torque, insulation tests, and protective devices.","licensed","Signed pre-energisation checklist."],
  ["Commissioning","Energise in the approved sequence and record measurements.","licensed","System operating normally with baseline readings."],
].map(([title,description,safetyLevel,expectedResult])=>({title,description,safetyLevel:safetyLevel as InstallationStep["safetyLevel"],expectedResult,complete:false}));

export async function loadOrCreateProject(supabase: SupabaseClient, userId: string) {
  const { data: firstProject, error } = await supabase.from("projects").select("*").order("created_at").limit(1).maybeSingle();
  if (error) throw error;
  let row = firstProject;
  if (!row) {
    const created = await supabase.from("projects").insert({ owner_id:userId, name:"My first power system", description:"Tell Wattson what you want this system to do.", mode:"off_grid", phase:"discover", system_voltage:48, settings:{ autonomyDays:2, peakSunHours:4.2, priorities:[] } }).select("*").single();
    if (created.error) throw created.error;
    row=created.data;
    const stepRows=defaultSteps.map((step,index)=>({project_id:row.id,position:index+1,title:step.title,instructions:step.description,safety_level:step.safetyLevel,expected_result:step.expectedResult}));
    const stepInsert=await supabase.from("installation_steps").insert(stepRows); if(stepInsert.error) throw stepInsert.error;
  }
  const [loads,assumptions,components,steps,records,conversation]=await Promise.all([
    supabase.from("loads").select("*").eq("project_id",row.id).order("name"),
    supabase.from("assumptions").select("*").eq("project_id",row.id).order("created_at"),
    supabase.from("system_components").select("*").eq("project_id",row.id).order("created_at"),
    supabase.from("installation_steps").select("*").eq("project_id",row.id).order("position"),
    supabase.from("commissioning_records").select("*").eq("project_id",row.id).order("recorded_at"),
    supabase.from("conversations").select("id").eq("project_id",row.id).order("created_at").limit(1).maybeSingle(),
  ]);
  for(const result of [loads,assumptions,components,steps,records,conversation]) if(result.error) throw result.error;
  let messages:ChatMessage[]=[];
  if(conversation.data?.id){const result=await supabase.from("chat_messages").select("*").eq("conversation_id",conversation.data.id).order("created_at").limit(50);if(result.error)throw result.error;messages=(result.data??[]).map(m=>({id:m.id,role:m.role==="user"?"user":"assistant",content:m.content,createdAt:m.created_at}))}
  const settings=(row.settings??{}) as Record<string,unknown>;
  const project:Project={
    id:row.id,name:row.name,description:row.description??"",projectType:row.mode==="grid_tied"?"grid-tied":row.mode,phase:row.phase,location:row.location??"Location not set",goal:String(settings.goal??""),priorities:Array.isArray(settings.priorities)?settings.priorities.map(String):[],systemVoltage:row.system_voltage??48,autonomyDays:Number(settings.autonomyDays??2),peakSunHours:Number(settings.peakSunHours??4.2),
    loads:(loads.data??[]).map(l=>({id:l.id,name:l.name,watts:l.watts,quantity:l.quantity,hoursPerDay:l.hours_per_day,surgeWatts:l.surge_watts??l.watts,currentType:l.current_type,confidence:l.confidence,simultaneous:l.simultaneous})),
    assumptions:(assumptions.data??[]).map(a=>({id:a.id,label:a.label,value:typeof a.value==="string"?a.value:JSON.stringify(a.value),reason:a.reason??"",confidence:a.confidence})),
    components:(components.data??[]).map(c=>({id:c.id,kind:c.type,name:c.model??c.type,manufacturer:c.manufacturer??undefined,model:c.model??undefined,quantity:c.quantity,location:c.installation_location??undefined,status:c.confidence,specs:c.specifications??{}})),
    installationSteps:(steps.data??[]).map(s=>({id:s.id,title:s.title,description:s.instructions,safetyLevel:s.safety_level,expectedResult:s.expected_result??"",complete:Boolean(s.completed_at)})),
    commissioning:(records.data??[]).map(r=>({id:r.id,label:r.type,value:typeof r.value==="string"?r.value:JSON.stringify(r.value),expected:r.expected_range?JSON.stringify(r.expected_range):"Not specified",recordedAt:r.recorded_at,result:r.result==="pass"?"pass":"attention"})),
  };
  return {project,messages};
}
