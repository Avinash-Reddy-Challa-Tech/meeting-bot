'use client';

import { useEffect, useState } from 'react';
import { meet, MeetMainStageClient } from '@googleworkspace/meet-addons/meet.addons';

export default function MainStagePage() {
  const [mainStageClient, setMainStageClient] = useState<MeetMainStageClient>();
  const CLOUD_PROJECT_NUMBER = '693246358019'; // same as above

  useEffect(() => {
    (async () => {
      const session = await meet.addon.createAddonSession({
        cloudProjectNumber: CLOUD_PROJECT_NUMBER,
      });
      const client = await session.createMainStageClient();
      setMainStageClient(client);
      // Optionally: get starting state, messages from side panel, etc.
    })();
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: 24,
      boxSizing: 'border-box',
      fontFamily: 'sans-serif',
    }}>
      <h2>Meeting Recorder</h2>
      <p>Everyone in the call can see this main stage.</p>
      <p>
        Use the side panel to start/stop recording. You can show
        live status, summary, waveform, etc here.
      </p>
    </div>
  );
}
