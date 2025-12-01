'use client';

import { useEffect, useState } from 'react';
import { meet, MeetMainStageClient } from '@googleworkspace/meet-addons/meet.addons';

interface RecordingData {
  type: 'RECORDING_STARTED' | 'RECORDING_STOPPED';
  meetingCode: string;
  startTime?: string;
  endTime?: string;
  recordingData?: any;
}

interface RecordingStatus {
  isRecording: boolean;
  startTime?: string;
  duration?: number;
  meetingCode?: string;
}

export default function MainStagePage() {
  const [mainStageClient, setMainStageClient] = useState<MeetMainStageClient>();
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>({
    isRecording: false
  });
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  const CLOUD_PROJECT_NUMBER = '693246358019';

  useEffect(() => {
    (async () => {
      try {
        const session = await meet.addon.createAddonSession({
          cloudProjectNumber: CLOUD_PROJECT_NUMBER,
        });
        const client = await session.createMainStageClient();
        setMainStageClient(client);

        // Listen for messages from side panel
                // Some SDK typings may not include addOnSidePanelDataListener; cast to any to call it safely.
                (client as any).addOnSidePanelDataListener((data: RecordingData) => {
                  handleSidePanelMessage(data);
                });

        console.log('Main stage client initialized successfully');
      } catch (error) {
        console.error('Failed to initialize main stage client:', error);
      }
    })();
  }, []);

  // Update recording duration every second
  useEffect(() => {
    if (!recordingStatus.isRecording || !recordingStatus.startTime) return;

    const interval = setInterval(() => {
      const startTime = new Date(recordingStatus.startTime!).getTime();
      const duration = Date.now() - startTime;
      setRecordingStatus(prev => ({ ...prev, duration }));
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingStatus.isRecording, recordingStatus.startTime]);

  // Hide success message after 5 seconds
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  const handleSidePanelMessage = (data: RecordingData) => {
    console.log('Received message from side panel:', data);
    
    switch (data.type) {
      case 'RECORDING_STARTED':
        setRecordingStatus({
          isRecording: true,
          startTime: data.startTime,
          duration: 0,
          meetingCode: data.meetingCode
        });
        break;
        
      case 'RECORDING_STOPPED':
        setRecordingStatus({
          isRecording: false,
          startTime: undefined,
          duration: undefined,
          meetingCode: undefined
        });
        
        // Show success message with recording URL if available
        if (data.recordingData?.cloudinaryResult?.secure_url) {
          setLastRecordingUrl(data.recordingData.cloudinaryResult.secure_url);
          setShowSuccessMessage(true);
        }
        break;
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const openRecording = () => {
    if (lastRecordingUrl) {
      window.open(lastRecordingUrl, '_blank');
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: 32,
      boxSizing: 'border-box',
      fontFamily: 'Google Sans, sans-serif',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }}>
      {/* Recording Status Indicator */}
      {recordingStatus.isRecording && (
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          backgroundColor: '#ea4335',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000
        }}>
          <div style={{
            width: 8,
            height: 8,
            backgroundColor: 'white',
            borderRadius: '50%'
          }} />
          <span style={{ fontWeight: 500, fontSize: 14 }}>
            REC {recordingStatus.duration ? formatDuration(recordingStatus.duration) : '0:00'}
          </span>
        </div>
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <div style={{
          position: 'absolute',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#34a853',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          zIndex: 1000
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              Recording Saved Successfully!
            </div>
            {lastRecordingUrl && (
              <button
                onClick={openRecording}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 0,
                  marginTop: 4
                }}
              >
                View Recording →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{
        textAlign: 'center',
        maxWidth: 600,
        margin: '0 auto'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 24
        }}>
          🎥
        </div>

        <h2 style={{
          fontSize: 32,
          fontWeight: 400,
          color: '#3c4043',
          margin: '0 0 16px 0'
        }}>
          Meeting Recorder
        </h2>

        <p style={{
          fontSize: 18,
          color: '#5f6368',
          margin: '0 0 32px 0',
          lineHeight: 1.5
        }}>
          {recordingStatus.isRecording 
            ? `Recording in progress for ${recordingStatus.meetingCode || 'this meeting'}...`
            : 'Use the side panel to start recording this meeting.'
          }
        </p>

        {/* Recording Features */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 24,
          marginTop: 48
        }}>
          <div style={{
            padding: 24,
            backgroundColor: 'white',
            borderRadius: 12,
            border: '1px solid #e8eaed',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎤</div>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: '0 0 8px 0', color: '#3c4043' }}>
              Audio Capture
            </h3>
            <p style={{ fontSize: 14, color: '#5f6368', margin: 0 }}>
              High-quality audio from all participants
            </p>
          </div>

          <div style={{
            padding: 24,
            backgroundColor: 'white',
            borderRadius: 12,
            border: '1px solid #e8eaed',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📹</div>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: '0 0 8px 0', color: '#3c4043' }}>
              Video Recording
            </h3>
            <p style={{ fontSize: 14, color: '#5f6368', margin: 0 }}>
              Full video with screen sharing support
            </p>
          </div>

          <div style={{
            padding: 24,
            backgroundColor: 'white',
            borderRadius: 12,
            border: '1px solid #e8eaed',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>☁️</div>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: '0 0 8px 0', color: '#3c4043' }}>
              Cloud Storage
            </h3>
            <p style={{ fontSize: 14, color: '#5f6368', margin: 0 }}>
              Automatic upload to secure cloud storage
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 48,
          padding: 20,
          backgroundColor: '#e8f0fe',
          borderRadius: 8,
          border: '1px solid #dadce0'
        }}>
          <h4 style={{ 
            fontSize: 14, 
            fontWeight: 500, 
            margin: '0 0 12px 0', 
            color: '#1a73e8' 
          }}>
            💡 How to Record
          </h4>
          <ul style={{ 
            margin: 0, 
            paddingLeft: 20, 
            fontSize: 14, 
            color: '#3c4043',
            lineHeight: 1.6
          }}>
            <li>Open the side panel on the right</li>
            <li>Click "Start Recording" to begin</li>
            <li>Recording will capture audio, video, and screen shares</li>
            <li>Click "Stop Recording" when finished</li>
            <li>Your recording will be saved automatically</li>
          </ul>
        </div>
      </div>
    </div>
  );
}