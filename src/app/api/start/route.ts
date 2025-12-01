import { NextRequest, NextResponse } from 'next/server';
import { GoogleMeetRESTService } from '@/lib/meet-rest-service';
import { GoogleMeetOAuthService } from '../../../lib/oauth-service';
import GoogleMeetRecordingManager from '../../../lib/recording-manager';

// Store active recording sessions - in production, use Redis or database
const activeRecordings = new Map<string, {
  sessionId: string;
  meetingCode: string;
  spaceId: string;
  startTime: number;
  status: 'starting' | 'connected' | 'recording' | 'error';
  recordingManager: GoogleMeetRecordingManager;
}>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingId, meetingCode } = body;

    console.log('Start recording request for meeting:', meetingId, meetingCode);

    if (!meetingCode) {
      return NextResponse.json(
        { error: 'Meeting code is required' },
        { status: 400 }
      );
    }

    // Validate meeting code format
    if (!GoogleMeetRESTService.isValidMeetingCode(meetingCode)) {
      return NextResponse.json(
        { error: 'Invalid meeting code format' },
        { status: 400 }
      );
    }

    // Check if recording is already active for this meeting
    if (activeRecordings.has(meetingCode)) {
      return NextResponse.json(
        { error: 'Recording already active for this meeting' },
        { status: 409 }
      );
    }

    // Get OAuth access token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to obtain access token' },
        { status: 401 }
      );
    }

    // Get cloud project number from environment
    const cloudProjectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
    if (!cloudProjectNumber) {
      return NextResponse.json(
        { error: 'Cloud project number not configured' },
        { status: 500 }
      );
    }

    // Initialize Meet REST API service
    const meetService = new GoogleMeetRESTService(accessToken);

    // Get space information from meeting code
    const spaceId = await meetService.getSpaceIdFromMeetingCode(meetingCode);
    
    console.log('Found space:', spaceId);

    // Initialize recording manager
    const recordingManager = new GoogleMeetRecordingManager(accessToken);

    // Initialize recording session in our tracking
    const sessionData: {
      sessionId: string;
      meetingCode: string;
      spaceId: string;
      startTime: number;
      status: 'starting' | 'connected' | 'recording' | 'error';
      recordingManager: GoogleMeetRecordingManager;
    } = {
      sessionId: '', // Will be filled after starting
      meetingCode,
      spaceId,
      startTime: Date.now(),
      status: 'starting',
      recordingManager
    };

    activeRecordings.set(meetingCode, sessionData);

    try {
      // Start the actual recording process
      console.log('Starting WebRTC recording process...');
      
      const sessionId = await recordingManager.startRecording({
        meetingCode,
        meetingId,
        cloudProjectNumber,
        accessToken,
        recordingQuality: 'HD',
        includeAudio: true,
        includeVideo: true
      });

      // Update session with the returned session ID
      sessionData.sessionId = sessionId;
      sessionData.status = 'recording';

      console.log('Recording started successfully:', sessionId);

      return NextResponse.json({ 
        success: true,
        message: 'Recording started successfully',
        data: {
          sessionId,
          meetingCode,
          spaceId,
          startTime: new Date(sessionData.startTime).toISOString()
        }
      });

    } catch (recordingError) {
      console.error('Failed to start recording process:', recordingError);
      
      // Update status to error
      sessionData.status = 'error';
      
      // Clean up after a delay
      setTimeout(() => {
        activeRecordings.delete(meetingCode);
      }, 60000); // Clean up after 1 minute

      return NextResponse.json(
        { 
          error: 'Failed to start recording',
          details: recordingError instanceof Error ? recordingError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in start recording API:', error);
    return NextResponse.json(
      { error: 'Failed to start recording' },
      { status: 500 }
    );
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    // Implementation for getting OAuth access token
    // This could involve:
    // 1. Using a service account with domain-wide delegation
    // 2. Using stored user tokens with refresh capability
    // 3. Using application default credentials for server-to-server auth

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('Missing required OAuth environment variables');
      return null;
    }

    const oauthService = new GoogleMeetOAuthService({
      clientId,
      clientSecret,
      redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback'
    });

    const token = await oauthService.refreshAccessToken(refreshToken);
    return token.accessToken;

  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

// API endpoint to get recording status
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const meetingCode = url.searchParams.get('meetingCode');

  if (!meetingCode) {
    return NextResponse.json(
      { error: 'Meeting code is required' },
      { status: 400 }
    );
  }

  const session = activeRecordings.get(meetingCode);
  
  if (!session) {
    return NextResponse.json(
      { error: 'No active recording found for this meeting' },
      { status: 404 }
    );
  }

  // Get detailed recording stats if recording is active
  let recordingStats = null;
  if (session.sessionId && session.recordingManager) {
    const recordingSession = session.recordingManager.getSession(session.sessionId);
    if (recordingSession) {
      recordingStats = {
        participants: recordingSession.participants.length,
        chunks: recordingSession.chunks.length,
        totalSize: recordingSession.totalSize,
        duration: Date.now() - recordingSession.startTime
      };
    }
  }

  return NextResponse.json({
    sessionId: session.sessionId,
    meetingCode: session.meetingCode,
    status: session.status,
    duration: Date.now() - session.startTime,
    startTime: new Date(session.startTime).toISOString(),
    recordingStats
  });
}

// Export the activeRecordings map for use in other API routes
export { activeRecordings };