import { redirect } from "next/navigation";

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/systems?site=${id}`);
}
