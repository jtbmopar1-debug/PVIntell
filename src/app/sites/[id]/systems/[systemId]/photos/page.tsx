import { ArrowLeft, Camera, ImageIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadSiteWorkspace } from "@/data/cloud-project";
import { createClient } from "@/lib/supabase/server";

type AlbumPhoto = {
  name: string;
  url: string;
  source: "Wattson chat" | "Equipment label";
  createdAt?: string;
};

export default async function SystemPhotosPage({
  params,
}: {
  params: Promise<{ id: string; systemId: string }>;
}) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") redirect("/login");

  const { id: siteId, systemId } = await params;
  let workspace;
  try {
    workspace = await loadSiteWorkspace(supabase, siteId, systemId);
  } catch {
    redirect(`/sites/${siteId}`);
  }

  const folders = [
    { path: `${userId}/${systemId}/wattson`, source: "Wattson chat" as const },
    {
      path: `${userId}/${systemId}/equipment-labels`,
      source: "Equipment label" as const,
    },
  ];
  const photos: AlbumPhoto[] = [];
  for (const folder of folders) {
    const listed = await supabase.storage
      .from("project-photos")
      .list(folder.path, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (listed.error) continue;
    const signed = await Promise.all(
      (listed.data ?? [])
        .filter((file) => file.id)
        .map(async (file) => {
          const path = `${folder.path}/${file.name}`;
          const result = await supabase.storage
            .from("project-photos")
            .createSignedUrl(path, 3600);
          if (!result.data?.signedUrl) return undefined;
          return {
            name: file.name,
            url: result.data.signedUrl,
            source: folder.source,
            createdAt: file.created_at ?? undefined,
          } satisfies AlbumPhoto;
        }),
    );
    photos.push(...signed.filter((photo) => photo !== undefined));
  }
  photos.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return (
    <main className="min-h-screen bg-[#f5f7fa] px-5 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href={`/systems?site=${siteId}`} className="inline-flex items-center gap-2 text-xs font-bold text-brand">
          <ArrowLeft size={15} /> Back to systems
        </Link>
        <div className="my-7 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">
            <Camera size={22} />
          </span>
          <div>
            <div className="eyebrow">System photos</div>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.04em]">
              {workspace.project.name} album
            </h1>
            <p className="mt-2 text-sm text-muted">
              Photos shown to Wattson and equipment labels saved for this system.
            </p>
          </div>
        </div>

        {photos.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <a
                key={`${photo.source}:${photo.name}`}
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                className="card overflow-hidden hover:border-[#7aa6d1]"
              >
                {/* Private signed storage URL; native img avoids a public remote-image allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.source} className="aspect-[4/3] w-full object-cover" />
                <div className="p-4">
                  <strong className="text-xs">{photo.source}</strong>
                  <span className="mt-1 block text-[10px] text-muted">
                    {photo.createdAt ? new Date(photo.createdAt).toLocaleString() : "Saved photo"}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="card grid min-h-64 place-items-center border-dashed p-8 text-center">
            <div>
              <ImageIcon className="mx-auto text-brand" size={32} />
              <h2 className="mt-4 text-lg font-extrabold">No system photos yet</h2>
              <p className="mt-2 text-xs text-muted">
                Add a photo beside Wattson&apos;s message box or scan an equipment label.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
