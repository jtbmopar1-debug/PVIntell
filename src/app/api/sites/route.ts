export async function POST() {
  return Response.json(
    { error: "New Sites are created through Start here.", startUrl: "/discovery/new-system" },
    { status: 409 },
  );
}
