export function GET() {
  return Response.json({
    ok: true,
    service: 'chess-backend',
    timestamp: new Date().toISOString()
  });
}
