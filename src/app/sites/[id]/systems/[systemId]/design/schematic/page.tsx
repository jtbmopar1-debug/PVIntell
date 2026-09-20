import { redirect } from "next/navigation";

export default async function ProposedSchematicPage({ params, searchParams }: PageProps<"/sites/[id]/systems/[systemId]/design/schematic">) {
  const { id, systemId } = await params;
  redirect(`/sites/${id}/systems/${systemId}/schematic`);
}
