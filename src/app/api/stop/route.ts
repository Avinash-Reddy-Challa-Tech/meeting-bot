import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!
});

// Import the activeRecordings map from the start route
// In production, use a shared database or Redis
const activeRecordings = new Map<string, {
  sessionId: string;
  meetingCode: string;
  spaceId: string;
  startTime: number;
  status: 'starting' | 'connected' | 'recording' | 'error';
  recordingManager: any; // GoogleMeetRecordingManager instance
}>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingId, meetingCode } = body;

    console.log('Stop recording request for meeting:', meetingId, meetingCode);

    if (!meetingCode) {
      return NextResponse.json(
        { error: 'Meeting code is required' },
        { status: 400 }
      );
    }

    // Check if recording exists for this meeting
    const recordingSession = activeRecordings.get(meetingCode);
    if (!recordingSession) {
      return NextResponse.json(
        { error: 'No active recording found for this meeting' },
        { status: 404 }
      );
    }

    if (recordingSession.status !== 'recording') {
      return NextResponse.json(
        { error: `Cannot stop recording. Current status: ${recordingSession.status}` },
        { status: 400 }
      );
    }

    try {
      // Stop the actual recording using the recording manager
      let recordingBlob: Blob | null = null;
      
      if (recordingSession.recordingManager && recordingSession.sessionId) {
        console.log('Stopping WebRTC recording...');
        
        // Stop the recording and get the final blob
        recordingBlob = await recordingSession.recordingManager.stopRecording(recordingSession.sessionId);
        
        console.log('Recording stopped, blob size:', recordingBlob?.size || 0);
      }

      // Calculate recording duration
      const duration = Date.now() - recordingSession.startTime;
      const durationMinutes = Math.round(duration / 60000);

      let cloudinaryResult = null;

      // Upload to Cloudinary if we have recording data
      if (recordingBlob && recordingBlob.size > 0) {
        console.log('Uploading recording to Cloudinary...');
        cloudinaryResult = await uploadToCloudinary(recordingBlob, {
          meetingCode,
          duration: durationMinutes,
          recordingDate: new Date().toISOString(),
          fileSize: recordingBlob.size
        });
        console.log('Upload completed:', cloudinaryResult?.public_id);
      } else {
        console.warn('No recording data available to upload');
      }

      // Get final recording statistics
      const recordingStats = recordingSession.recordingManager ? 
        recordingSession.recordingManager.getSession(recordingSession.sessionId) : null;

      // Clean up the recording session
      activeRecordings.delete(meetingCode);

      return NextResponse.json({
        success: true,
        message: 'Recording stopped and processed successfully',
        data: {
          sessionId: recordingSession.sessionId,
          meetingCode,
          duration: duration,
          durationMinutes,
          startTime: new Date(recordingSession.startTime).toISOString(),
          endTime: new Date().toISOString(),
          recordingStats: recordingStats ? {
            participants: recordingStats.participants?.length || 0,
            chunks: recordingStats.chunks?.length || 0,
            totalSize: recordingStats.totalSize || 0
          } : null,
          cloudinaryResult: cloudinaryResult ? {
            public_id: cloudinaryResult.public_id,
            secure_url: cloudinaryResult.secure_url,
            asset_id: cloudinaryResult.asset_id,
            version: cloudinaryResult.version,
            duration: cloudinaryResult.duration,
            format: cloudinaryResult.format,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height
          } : null
        }
      });

    } catch (error) {
      console.error('Error stopping recording:', error);
      
      // Update status to error but keep the session for debugging
      recordingSession.status = 'error';
      
      return NextResponse.json(
        { 
          error: 'Failed to stop recording properly',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in stop recording API:', error);
    return NextResponse.json(
      { error: 'Failed to stop recording' },
      { status: 500 }
    );
  }
}

async function uploadToCloudinary(
  recordingBlob: Blob, 
  metadata: { 
    meetingCode: string; 
    duration: number; 
    recordingDate: string;
    fileSize: number;
  }
): Promise<any> {
  try {
    // Convert blob to buffer
    const arrayBuffer = await recordingBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate filename with timestamp and meeting code
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `meet-recording-${metadata.meetingCode}-${timestamp}`;

    // Upload to Cloudinary with enhanced options
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'meet-recordings',
          public_id: filename,
          format: 'mp4', // Convert to MP4 for better compatibility
          transformation: [
            {
              video_codec: 'h264',
              audio_codec: 'aac',
              quality: 'auto',
              // Optimize for web delivery
              flags: 'streaming_attachment'
            }
          ],
          context: {
            meeting_code: metadata.meetingCode,
            duration_minutes: metadata.duration.toString(),
            recording_date: metadata.recordingDate,
            source: 'google-meet-media-api',
            original_size: metadata.fileSize.toString()
          },
          tags: ['google-meet', 'recording', 'webrtc', 'auto-generated'],
          // Add metadata for easier searching and management
          metadata: {
            meeting_code: metadata.meetingCode,
            duration_minutes: metadata.duration,
            recording_date: metadata.recordingDate,
            source: 'meet-media-api',
            original_format: 'webm'
          },
          // Enable video optimization
          eager: [
            {
              video_codec: 'h264',
              audio_codec: 'aac',
              quality: 'auto:good',
              format: 'mp4'
            },
            {
              video_codec: 'h264',
              audio_codec: 'aac',
              quality: 'auto:low',
              format: 'mp4',
              suffix: '_low'
            }
          ],
          // Generate thumbnail
          eager_async: true
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('Cloudinary upload successful:', result?.public_id);
            resolve(result);
          }
        }
      );

      // Write the buffer to the upload stream
      uploadStream.end(buffer);
    });

  } catch (error) {
    console.error('Failed to upload to Cloudinary:', error);
    throw error;
  }
}

// API endpoint to get recording status and stop specific recordings
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const meetingCode = url.searchParams.get('meetingCode');
    const action = url.searchParams.get('action');

    if (action === 'list') {
      // Get all active recordings
      const allRecordings = Array.from(activeRecordings.entries()).map(([code, session]) => {
        let recordingStats = null;
        if (session.recordingManager && session.sessionId) {
          const recording = session.recordingManager.getSession(session.sessionId);
          if (recording) {
            recordingStats = {
              participants: recording.participants?.length || 0,
              chunks: recording.chunks?.length || 0,
              totalSize: recording.totalSize || 0
            };
          }
        }

        return {
          meetingCode: code,
          sessionId: session.sessionId,
          status: session.status,
          duration: Date.now() - session.startTime,
          startTime: new Date(session.startTime).toISOString(),
          recordingStats
        };
      });

      return NextResponse.json({
        recordings: allRecordings,
        count: allRecordings.length
      });
    }

    if (meetingCode) {
      // Get specific recording status
      const session = activeRecordings.get(meetingCode);
      
      if (!session) {
        return NextResponse.json(
          { error: 'No recording found for this meeting code' },
          { status: 404 }
        );
      }

      // Get detailed recording stats
      let recordingStats = null;
      if (session.recordingManager && session.sessionId) {
        const recording = session.recordingManager.getSession(session.sessionId);
        if (recording) {
          recordingStats = {
            participants: recording.participants?.length || 0,
            chunks: recording.chunks?.length || 0,
            totalSize: recording.totalSize || 0,
            status: recording.status
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

    return NextResponse.json(
      { error: 'Meeting code or action parameter required' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in get recording status:', error);
    return NextResponse.json(
      { error: 'Failed to get recording status' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to force stop a recording
export async function DELETE(req: NextRequest) {
  try {
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
        { error: 'No active recording found' },
        { status: 404 }
      );
    }

    try {
      // Force stop the recording
      if (session.recordingManager && session.sessionId) {
        await session.recordingManager.stopRecording(session.sessionId);
      }

      // Clean up
      activeRecordings.delete(meetingCode);

      return NextResponse.json({
        success: true,
        message: 'Recording force stopped',
        meetingCode
      });

    } catch (error) {
      console.error('Error force stopping recording:', error);
      return NextResponse.json(
        { 
          error: 'Failed to force stop recording',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in force stop recording:', error);
    return NextResponse.json(
      { error: 'Failed to force stop recording' },
      { status: 500 }
    );
  }
}