'use client';

import { useEffect, useState } from 'react';
import {
  meet,
  MeetSidePanelClient,
  MeetingInfo,
} from '@googleworkspace/meet-addons/meet.addons';

type RecordingStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';

export default function SidePanelPage() {
  const [sidePanelClient, setSidePanelClient] = useState<MeetSidePanelClient>();
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // TODO: replace with your real project number
  const CLOUD_PROJECT_NUMBER = '693246358019';

  // Initialize addon session + side panel client
  useEffect(() => {
    (async () => {
      try {
        const session = await meet.addon.createAddonSession({
          cloudProjectNumber: CLOUD_PROJECT_NUMBER,
        });
        const client = await session.createSidePanelClient();
        setSidePanelClient(client);

        const info = await client.getMeetingInfo();
        setMeetingInfo(info);
      } catch (e: any) {
        console.error('Failed to init side panel:', e);
        setError('Failed to initialize add-on side panel.');
      }
    })();
  }, []);

  async function startRecording() {
    if (!meetingInfo) return;
    setStatus('starting');
    setError(null);

    try {
      const res = await fetch('/api/recording/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: meetingInfo.meetingId,
          meetingCode: meetingInfo.meetingCode,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setStatus('recording');
    } catch (e: any) {
      console.error('Error starting recording:', e);
      setStatus('error');
      setError(e.message || 'Failed to start recording');
    }
  }

  async function stopRecording() {
    if (!meetingInfo) return;
    setStatus('stopping');
    setError(null);

    try {
      const res = await fetch('/api/recording/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: meetingInfo.meetingId,
          meetingCode: meetingInfo.meetingCode,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setStatus('idle');
    } catch (e: any) {
      console.error('Error stopping recording:', e);
      setStatus('error');
      setError(e.message || 'Failed to stop recording');
    }
  }

  const disabled = !meetingInfo || status === 'starting' || status === 'stopping';

  return (
    <div style={{ padding: 12, fontFamily: 'sans-serif', fontSize: 14 }}>
      <h3>Meeting Recorder</h3>
      {meetingInfo && (
        <div style={{ marginBottom: 8 }}>
          <div><strong>Meeting code:</strong> {meetingInfo.meetingCode}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            ID: {meetingInfo.meetingId}
          </div>
        </div>
      )}
      {!meetingInfo && <div>Loading meeting info…</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={startRecording}
          disabled={disabled || status === 'recording'}
        >
          {status === 'starting' ? 'Starting…' : 'Start recording'}
        </button>
        <button
          onClick={stopRecording}
          disabled={disabled || status === 'idle'}
        >
          {status === 'stopping' ? 'Stopping…' : 'Stop recording'}
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Status:</strong> {status}
      </div>

      {error && (
        <div style={{ marginTop: 8, color: 'red' }}>
          {error}
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        When you click <b>Start recording</b>, we’ll connect a Media API client
        to this Meet and capture audio/video on your backend.
      </p>
    </div>
  );
}
