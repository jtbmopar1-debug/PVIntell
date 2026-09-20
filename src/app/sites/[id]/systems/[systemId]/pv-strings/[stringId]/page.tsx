import { redirect } from "next/navigation";

export default async function StringPage({ params }: { params: Promise<{ id: string; systemId: string; stringId: string }> }) {
  const { id, systemId, stringId } = await params;
  if (stringId === "new") {
    redirect(`/sites/${id}/systems/${systemId}/equipment/new?type=panel&name=PV%20array`);
  }
  redirect(`/sites/${id}/systems/${systemId}/equipment/${stringId}`);
}
