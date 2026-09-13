import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { GalleryManager } from "@/components/gallery-manager";
import { createClient } from "@/lib/supabase/server";

export default async function GalleryPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");
  const rows = await supabase.from("user_gallery_images").select("id,storage_path,file_name,source,created_at").eq("owner_id", userId).order("created_at", { ascending: false });
  if (rows.error) throw rows.error;
  const images = (await Promise.all((rows.data ?? []).map(async (item) => {
    const signed = await supabase.storage.from("project-photos").createSignedUrl(item.storage_path, 3600);
    return signed.data?.signedUrl ? { id: item.id, fileName: item.file_name, source: item.source as "gallery" | "wattson", createdAt: item.created_at, url: signed.data.signedUrl } : null;
  }))).filter((item): item is NonNullable<typeof item> => Boolean(item));
  return <main className="min-h-screen bg-canvas p-4 md:p-6"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between"><Link href="/settings" className="flex items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15}/>Settings</Link><BrandLogo compact/></div><header className="mt-7"><div className="eyebrow">Your images</div><h1 className="mt-2 font-display text-2xl font-extrabold">Gallery</h1><p className="mt-1.5 text-xs text-muted">Keep equipment labels, site photos and Wattson chat images in one private collection.</p></header><GalleryManager images={images}/></div></main>;
}
