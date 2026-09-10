"use client";

import { AlertTriangle, Camera, LoaderCircle, PackagePlus, Plus, ScanLine, X } from "lucide-react";
import { useRef, useState } from "react";
import type { EquipmentLabelExtraction } from "@/ai/equipment-label";
import type { SiteEquipment } from "@/domain/models";

const typeLabels: Record<SiteEquipment["type"], string> = { panel: "PV panel", pv_string: "PV string", battery: "Battery", inverter: "Inverter", generator: "Generator", protection: "Protection device", meter: "Meter", other: "Other" };
const conditionLabels: Record<SiteEquipment["condition"], string> = { new: "New", used_good: "Used — appears good", used_unknown: "Used — condition unknown", needs_testing: "Needs testing", for_parts: "For parts only" };

export function SiteEquipmentInventory({ siteId, projectId, initialEquipment, initialEditId, title = "Equipment you already have", description = "Record new, second-hand or inherited equipment here before deciding which system should use it." }: { siteId: string; projectId?: string; initialEquipment: SiteEquipment[]; initialEditId?: string; title?: string; description?: string }) {
  const initiallyEditing = initialEquipment.find((item) => item.id === initialEditId);
  const [items, setItems] = useState(initialEquipment);
  const [adding, setAdding] = useState(Boolean(initiallyEditing));
  const [editingItem, setEditingItem] = useState<SiteEquipment | undefined>(initiallyEditing);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<EquipmentLabelExtraction>();
  const [photoPath, setPhotoPath] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function setField(name: string, value: string) {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) field.value = value;
  }
  function applyExtraction(result: EquipmentLabelExtraction) {
    setField("type", result.equipmentType);
    setField("name", [result.manufacturer, result.model].filter(Boolean).join(" ") || typeLabels[result.equipmentType]);
    setField("manufacturer", result.manufacturer); setField("model", result.model); setField("serialNumber", result.serialNumber);
    setField("ratedVoltage", result.ratedVoltage); setField("ratedPower", result.ratedPower); setField("capacity", result.capacity);
  }
  async function analyze(file?: File) {
    if (!file) return;
    if (!projectId) { setError("Create or select a system before scanning a label. You can still enter the equipment details manually."); return; }
    setAnalyzing(true); setError(""); setExtraction(undefined); setPhotoPath("");
    const body = new FormData(); body.set("file", file); body.set("projectId", projectId);
    try {
      const response = await fetch("/api/equipment/analyze-label", { method: "POST", body }); const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not read the label");
      setExtraction(result.extraction); setPhotoPath(result.photoPath); applyExtraction(result.extraction);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not read the label"); } finally { setAnalyzing(false); }
  }
  async function submit(formData: FormData) {
    setSaving(true); setError("");
    const enteredSpecifications: Record<string, string> = Object.fromEntries([
      ["ratedVoltage", formData.get("ratedVoltage")], ["ratedPower", formData.get("ratedPower")], ["capacity", formData.get("capacity")],
      ["ratedCurrent", extraction?.ratedCurrent], ["phase", extraction?.phase], ["frequency", extraction?.frequency], ["ingressRating", extraction?.ingressRating],
      ["certifications", extraction?.certifications.join(", ")], ...((extraction?.otherSpecifications ?? []).map((item) => [item.label, item.value])),
    ].filter(([, value]) => String(value ?? "").trim()).map(([key, value]) => [String(key), String(value)]));
    const specifications: Record<string, string | number> = { ...(editingItem?.specifications ?? {}), ...enteredSpecifications };
    for (const key of ["ratedVoltage", "ratedPower", "capacity"]) if (!String(formData.get(key) ?? "").trim()) delete specifications[key];
    const payload = { id: editingItem?.id, siteId, type: formData.get("type"), name: formData.get("name"), manufacturer: formData.get("manufacturer"), model: formData.get("model"), serialNumber: formData.get("serialNumber"), quantity: Number(formData.get("quantity")), condition: formData.get("condition"), specifications, notes: formData.get("notes"), photoPath };
    try {
      const response = await fetch("/api/equipment", { method: editingItem ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save equipment"); const row = body.equipment;
      const mapped = { id: row.id, siteId: row.site_id, type: row.type, name: row.name, manufacturer: row.manufacturer ?? undefined, model: row.model ?? undefined, serialNumber: row.serial_number ?? undefined, quantity: row.quantity, condition: row.condition, status: row.status, specifications: row.specifications ?? {}, notes: row.notes ?? undefined, photoUrls: row.photo_urls ?? [] } as SiteEquipment;
      setItems((current) => editingItem ? current.map((item) => item.id === mapped.id ? mapped : item) : [...current, mapped]);
      setAdding(false); setEditingItem(undefined); setExtraction(undefined); setPhotoPath("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save equipment"); } finally { setSaving(false); }
  }

  return <div className="animate-rise space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="eyebrow">Site inventory</div><h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.045em] md:text-[30px]">{title}</h1><p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">{description}</p></div><button onClick={() => { setEditingItem(undefined); setExtraction(undefined); setPhotoPath(""); setAdding(true); }} className="flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-[10px] font-bold text-white"><Plus size={14}/>Add equipment</button></div>
    <div className="flex gap-3 rounded-2xl border border-[#ecd9aa] bg-[#fff8e7] p-4 text-[#6f5518]"><AlertTriangle size={18} className="shrink-0"/><p className="text-[11px] leading-5"><strong>Second-hand equipment needs verification.</strong> Wattson can compare recorded ratings, but condition, battery health, firmware and protection requirements may still need hands-on testing or an independent check.</p></div>
    {items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="card p-5"><div className="flex justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf2fb] text-brand"><PackagePlus size={17}/></span><span className="rounded-full bg-[#fff1cf] px-2 py-1 text-[9px] font-bold uppercase text-[#8b6512]">{item.status}</span></div><h2 className="mt-4 text-sm font-bold">{item.name}</h2><p className="mt-1 text-[10px] text-muted">{[item.manufacturer, item.model].filter(Boolean).join(" • ") || typeLabels[item.type]}</p>{item.serialNumber && <p className="mt-1 text-[9px] text-muted">Serial: {item.serialNumber}</p>}<div className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-[#eef3f8] p-2"><span className="block text-muted">Quantity</span><strong>{item.quantity}</strong></div><div className="rounded-xl bg-[#eef3f8] p-2"><span className="block text-muted">Condition</span><strong>{conditionLabels[item.condition]}</strong></div></div><button onClick={() => { setEditingItem(item); setExtraction(undefined); setPhotoPath(""); setAdding(true); }} className="mt-4 w-full rounded-xl border border-line py-2 text-[10px] font-bold text-brand">Edit details or rescan label</button></article>)}</div> : <div className="card grid min-h-52 place-items-center p-8 text-center"><div><PackagePlus className="mx-auto text-muted"/><h2 className="mt-4 text-sm font-bold">No equipment recorded yet</h2><p className="mt-2 text-xs text-muted">Add anything you already own or may want Wattson to consider.</p></div></div>}
    {adding && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0b2740]/45 p-5 backdrop-blur-sm"><form key={editingItem?.id ?? "new"} ref={formRef} action={submit} className="card my-8 w-full max-w-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><div className="eyebrow">Site inventory</div><h2 className="mt-2 font-display text-2xl font-extrabold">{editingItem ? "Edit equipment" : "Add equipment"}</h2></div><button type="button" onClick={() => { setAdding(false); setEditingItem(undefined); }} className="grid size-8 place-items-center rounded-lg hover:bg-[#eef3f8]"><X size={17}/></button></div>
      {projectId ? <label className="mt-5 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-[#91aec9] bg-[#f7fafd] p-4"><span className="grid size-11 place-items-center rounded-xl bg-white text-brand"><Camera size={20}/></span><span className="flex-1"><strong className="block text-xs">Scan an equipment label</strong><span className="mt-1 block text-[10px] text-muted">JPEG, PNG or WebP, up to 8 MB. Review every field before saving.</span></span>{analyzing ? <LoaderCircle className="animate-spin text-brand" size={19}/> : <ScanLine className="text-brand" size={19}/>}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={analyzing} onChange={(event) => void analyze(event.target.files?.[0])}/></label> : <p className="mt-5 rounded-xl border border-line bg-[#f7fafc] p-3 text-[10px] leading-4 text-muted">Enter the details manually. Label scanning becomes available once this Site has a system record.</p>}
      {error && <div className="mt-4 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#9c3e2e]">{error}</div>}{extraction && <div className="mt-4 rounded-xl border border-line bg-[#f8fafc] p-3 text-[10px]"><div className="flex items-center justify-between"><strong>Label details added for review</strong><span className="uppercase text-brand">{extraction.confidence} confidence</span></div>{extraction.warnings.length > 0 && <p className="mt-2 text-[#8b6512]">{extraction.warnings.join(" ")}</p>}{extraction.unreadableFields.length > 0 && <p className="mt-1 text-muted">Could not read: {extraction.unreadableFields.join(", ")}</p>}</div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="What is it?"><select name="type" required defaultValue={editingItem?.type ?? ""} className="field"><option value="">Choose type</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Your name for it"><input name="name" required defaultValue={editingItem?.name} className="field" placeholder="e.g. Garage battery"/></Field><Field label="Manufacturer"><input name="manufacturer" defaultValue={editingItem?.manufacturer} className="field" placeholder="If known"/></Field><Field label="Model"><input name="model" defaultValue={editingItem?.model} className="field" placeholder="From the rating label"/></Field><Field label="Serial number"><input name="serialNumber" defaultValue={editingItem?.serialNumber} className="field" placeholder="If visible"/></Field><Field label="Quantity"><input name="quantity" type="number" min="1" defaultValue={editingItem?.quantity ?? 1} required className="field"/></Field><Field label="Condition"><select name="condition" defaultValue={editingItem?.condition ?? "used_unknown"} required className="field">{Object.entries(conditionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Rated voltage"><input name="ratedVoltage" defaultValue={editingItem?.specifications.ratedVoltage} className="field" placeholder="e.g. 51.2 V"/></Field><Field label="Power rating"><input name="ratedPower" defaultValue={editingItem?.specifications.ratedPower} className="field" placeholder="e.g. 5 kW"/></Field><Field label="Capacity"><input name="capacity" defaultValue={editingItem?.specifications.capacity} className="field" placeholder="e.g. 5.12 kWh or 100 Ah"/></Field><label className="text-xs font-bold sm:col-span-2">Notes<textarea name="notes" rows={3} defaultValue={editingItem?.notes} className="field py-3" placeholder="Where it came from, age, visible damage, included cables or anything else known"/></label></div><button disabled={saving || analyzing} className="mt-6 h-11 w-full rounded-xl bg-brand text-xs font-bold text-white disabled:opacity-50">{saving ? "Saving…" : editingItem ? "Save equipment changes" : "Add to site inventory"}</button></form></div>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs font-bold">{label}{children}</label>; }
