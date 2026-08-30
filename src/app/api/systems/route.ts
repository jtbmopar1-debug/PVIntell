export async function POST() {
  return Response.json(
    { error: "New power systems are created through Start here.", startUrl: "/discovery/new-system" },
    { status: 409 },
  );
}
