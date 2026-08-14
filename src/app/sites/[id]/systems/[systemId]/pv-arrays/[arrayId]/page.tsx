import { redirect } from "next/navigation";
export default async function ArrayPage({ params }: { params: Promise<{ id: string; systemId: string; arrayId: string }> }) {
  const { id, systemId, arrayId } = await params;
  redirect(`/sites/${id}/systems/${systemId}/pv-strings/${arrayId}`);
}
