import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { meetingId, meetingCode } = body;

  console.log('Stop recording for meeting:', meetingId, meetingCode);

  // TODO:
  // 1. Tell your Media API client to stop WebRTC session.
  // 2. Finalize recording file / transcription.

  return NextResponse.json({ ok: true });
}
