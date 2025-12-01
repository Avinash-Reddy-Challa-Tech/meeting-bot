import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { meetingId, meetingCode } = body;

  console.log('Start recording for meeting:', meetingId, meetingCode);

  // TODO: 
  // 1. Get OAuth access token for Meet Media API (server-side).
  // 2. Use Meet REST + Media API to connect to the active conference.
  // 3. Start capturing media and writing it to storage.

  return NextResponse.json({ ok: true });
}
