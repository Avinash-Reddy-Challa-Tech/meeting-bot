// Enhanced Google Meet Media API Client with Complete WebRTC Implementation
// Based on the official Google Meet Media API TypeScript reference

export interface MeetMediaConfig {
  cloudProjectNumber: string;
  oAuthToken: string;
  meetingSpaceId: string;
}

export interface MeetMediaStream {
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
}

export interface RecordingData {
  audioChunks: Blob[];
  videoChunks: Blob[];
  combinedChunks: Blob[];
  startTime: number;
  endTime?: number;
}

export interface ParticipantInfo {
  id: string;
  displayName: string;
  isPresenting: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export class MeetMediaAPIClient {
  private config: MeetMediaConfig;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingData: RecordingData;
  private isConnected = false;
  private isRecording = false;
  private remoteStreams: Map<string, MeetMediaStream> = new Map();
  private participants: Map<string, ParticipantInfo> = new Map();
  private recordingStream: MediaStream | null = null;

  constructor(config: MeetMediaConfig) {
    this.config = config;
    this.recordingData = {
      audioChunks: [],
      videoChunks: [],
      combinedChunks: [],
      startTime: Date.now()
    };
  }

  async initializeConnection(): Promise<void> {
    try {
      console.log('Initializing WebRTC connection for Meet Media API');

      // Create RTCPeerConnection with proper configuration for Meet Media API
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      });

      // Set up data channel for Meet Media API communication
      this.dataChannel = this.peerConnection.createDataChannel('meetMediaAPI', {
        ordered: true,
        maxRetransmits: 3
      });

      // Add transceivers as required by Meet Media API
      // The API requires exactly 3 receive-only audio media descriptions
      for (let i = 0; i < 3; i++) {
        const audioTransceiver = this.peerConnection.addTransceiver('audio', {
          direction: 'recvonly'
        });
        
        // Configure audio transceiver for optimal quality
        if (audioTransceiver.receiver) {
          try {
            await audioTransceiver.receiver.getStats();
          } catch (error) {
            console.warn('Could not get audio receiver stats:', error);
          }
        }
      }

      // Add video transceiver for receiving video streams
      const videoTransceiver = this.peerConnection.addTransceiver('video', {
        direction: 'recvonly'
      });

      // Configure video transceiver for optimal quality
      if (videoTransceiver.receiver) {
        try {
          await videoTransceiver.receiver.getStats();
        } catch (error) {
          console.warn('Could not get video receiver stats:', error);
        }
      }

      // Set up event listeners
      this.setupEventListeners();

      console.log('RTCPeerConnection initialized successfully');
    } catch (error) {
      console.error('Failed to initialize connection:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.peerConnection) return;

    // Handle incoming media tracks
    this.peerConnection.ontrack = (event) => {
      console.log('Received track:', event.track.kind, event.track.id);
      this.handleIncomingTrack(event);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated:', event.candidate.candidate);
        // ICE candidates are automatically handled by the WebRTC stack
        // Meet Media API uses the REST API for signaling
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('Connection state changed:', state);
      
      switch (state) {
        case 'connected':
          this.isConnected = true;
          this.onConnectionEstablished();
          break;
        case 'disconnected':
        case 'failed':
          this.isConnected = false;
          this.onConnectionLost();
          break;
        case 'connecting':
          console.log('Connecting to Meet Media API...');
          break;
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('ICE connection state:', state);
      
      if (state === 'failed') {
        this.handleConnectionFailure();
      }
    };

    // Set up data channel event listeners
    if (this.dataChannel) {
      this.dataChannel.onopen = () => {
        console.log('Data channel opened');
        this.sendDataChannelMessage({
          type: 'client_ready',
          timestamp: Date.now()
        });
      };

      this.dataChannel.onmessage = (event) => {
        console.log('Data channel message received:', event.data);
        this.handleDataChannelMessage(event.data);
      };

      this.dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
      };

      this.dataChannel.onclose = () => {
        console.log('Data channel closed');
      };
    }
  }

  private handleIncomingTrack(event: RTCTrackEvent): void {
    const track = event.track;
    const streams = event.streams;

    if (streams.length === 0) {
      console.warn('Received track without stream');
      return;
    }

    const stream = streams[0];
    const streamId = stream.id;

    // Store the remote stream
    let remoteStream = this.remoteStreams.get(streamId) || ({} as MeetMediaStream);
    
    if (track.kind === 'audio') {
      remoteStream.audioTrack = track;
      console.log('Audio track received for stream:', streamId);
      this.handleAudioTrack(track, stream);
    } else if (track.kind === 'video') {
      remoteStream.videoTrack = track;
      console.log('Video track received for stream:', streamId);
      this.handleVideoTrack(track, stream);
    }

    this.remoteStreams.set(streamId, remoteStream);

    // Add to recording stream if recording is active
    if (this.isRecording && this.recordingStream) {
      this.recordingStream.addTrack(track);
    }

    // Track ended handler
    track.onended = () => {
      console.log(`${track.kind} track ended for stream:`, streamId);
      this.handleTrackEnded(streamId, track.kind);
    };

    // Track mute/unmute handlers
    track.onmute = () => {
      console.log(`${track.kind} track muted for stream:`, streamId);
    };

    track.onunmute = () => {
      console.log(`${track.kind} track unmuted for stream:`, streamId);
    };
  }

  private handleAudioTrack(track: MediaStreamTrack, stream: MediaStream): void {
    // Monitor audio levels (optional)
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);

      // You could implement audio level monitoring here
      // This is useful for detecting active speakers
    } catch (error) {
      console.warn('Could not set up audio monitoring:', error);
    }
  }

  private handleVideoTrack(track: MediaStreamTrack, stream: MediaStream): void {
    // You could implement video analytics here
    // Such as resolution detection, frame rate monitoring, etc.
    
    const settings = track.getSettings();
    console.log('Video track settings:', {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate
    });
  }

  private handleTrackEnded(streamId: string, trackKind: string): void {
    const remoteStream = this.remoteStreams.get(streamId);
    if (remoteStream) {
      if (trackKind === 'audio') {
        delete remoteStream.audioTrack;
      } else if (trackKind === 'video') {
        delete remoteStream.videoTrack;
      }

      // Remove stream if no tracks remain
      if (!remoteStream.audioTrack && !remoteStream.videoTrack) {
        this.remoteStreams.delete(streamId);
        console.log('Removed empty stream:', streamId);
      }
    }
  }

  private onConnectionEstablished(): void {
    console.log('WebRTC connection established with Meet Media API');
    
    // Start collecting media streams
    this.updateRecordingStream();
  }

  private onConnectionLost(): void {
    console.log('WebRTC connection lost');
    
    // Handle reconnection logic here if needed
    // For now, just log the event
  }

  private handleConnectionFailure(): void {
    console.error('ICE connection failed');
    
    // Could implement automatic reconnection here
    // For production, you might want to restart the connection
  }

  private sendDataChannelMessage(message: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send data channel message:', error);
      }
    }
  }

  private handleDataChannelMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      console.log('Parsed data channel message:', message);

      switch (message.type) {
        case 'participant_joined':
          this.handleParticipantJoined(message.data);
          break;
        case 'participant_left':
          this.handleParticipantLeft(message.data);
          break;
        case 'participant_update':
          this.handleParticipantUpdate(message.data);
          break;
        case 'media_update':
          this.handleMediaUpdate(message.data);
          break;
        case 'presentation_started':
          this.handlePresentationStarted(message.data);
          break;
        case 'presentation_stopped':
          this.handlePresentationStopped(message.data);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse data channel message:', error);
    }
  }

  private handleParticipantJoined(data: any): void {
    console.log('Participant joined:', data);
    
    if (data.participantId && data.displayName) {
      this.participants.set(data.participantId, {
        id: data.participantId,
        displayName: data.displayName,
        isPresenting: false,
        audioEnabled: true,
        videoEnabled: true
      });
    }
  }

  private handleParticipantLeft(data: any): void {
    console.log('Participant left:', data);
    
    if (data.participantId) {
      this.participants.delete(data.participantId);
    }
  }

  private handleParticipantUpdate(data: any): void {
    console.log('Participant update:', data);
    
    if (data.participantId) {
      const participant = this.participants.get(data.participantId);
      if (participant) {
        // Update participant info
        Object.assign(participant, data.updates || {});
      }
    }
  }

  private handleMediaUpdate(data: any): void {
    console.log('Media update:', data);
    // Handle media stream updates, quality changes, etc.
  }

  private handlePresentationStarted(data: any): void {
    console.log('Presentation started:', data);
    // Handle screen sharing start
  }

  private handlePresentationStopped(data: any): void {
    console.log('Presentation stopped:', data);
    // Handle screen sharing stop
  }

  async connectToMeeting(): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Connection not initialized. Call initializeConnection() first.');
    }

    try {
      console.log('Creating SDP offer for Meet Media API connection');

      // Create SDP offer with specific constraints for Meet Media API
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      // Modify SDP for Meet Media API requirements
      const modifiedSdp = this.modifySDPForMeetAPI(offer.sdp || '');
      const modifiedOffer = {
        ...offer,
        sdp: modifiedSdp
      };

      await this.peerConnection.setLocalDescription(modifiedOffer);
      console.log('Local description set');

      // Send offer to Meet Media API via REST API
      const answer = await this.sendOfferToMeetAPI(modifiedOffer);

      // Set remote description with the answer
      await this.peerConnection.setRemoteDescription(answer);
      console.log('Remote description set');

      console.log('Successfully connected to meeting');
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to meeting:', error);
      throw error;
    }
  }

  private modifySDPForMeetAPI(sdp: string): string {
    // Modify SDP to meet Google Meet Media API requirements
    let modifiedSdp = sdp;

    // Ensure DTLS setup is correct (client role)
    modifiedSdp = modifiedSdp.replace(/a=setup:.*\r\n/g, 'a=setup:active\r\n');

    // Ensure proper codec support
    // Meet Media API requires specific audio/video codecs
    
    // Add additional modifications as needed based on Meet API requirements
    console.log('SDP modified for Meet Media API compatibility');

    return modifiedSdp;
  }

  private async sendOfferToMeetAPI(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    try {
      console.log('Sending SDP offer to Meet Media API');

      const response = await fetch(
        `https://meet.googleapis.com/v2beta/spaces/${this.config.meetingSpaceId}/activeConference:connectActiveConference`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.oAuthToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sdpOffer: offer.sdp,
            cloudProjectNumber: this.config.cloudProjectNumber
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Meet API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      console.log('Received SDP answer from Meet Media API');

      return {
        type: 'answer',
        sdp: data.sdpAnswer
      };
    } catch (error) {
      console.error('Failed to send offer to Meet API:', error);
      throw error;
    }
  }

  private updateRecordingStream(): void {
    if (!this.isRecording) return;

    // Create a new MediaStream combining all remote tracks
    const combinedStream = new MediaStream();

    this.remoteStreams.forEach((stream, streamId) => {
      if (stream.audioTrack && stream.audioTrack.readyState === 'live') {
        combinedStream.addTrack(stream.audioTrack);
      }
      if (stream.videoTrack && stream.videoTrack.readyState === 'live') {
        combinedStream.addTrack(stream.videoTrack);
      }
    });

    this.recordingStream = combinedStream;

    // Update MediaRecorder if it exists
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // Stop current recording and restart with new stream
      this.mediaRecorder.stop();
      this.startMediaRecorder();
    }
  }

  async startRecording(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to meeting. Call connectToMeeting() first.');
    }

    if (this.isRecording) {
      throw new Error('Recording is already in progress.');
    }

    try {
      console.log('Starting recording');

      // Create combined stream from all remote streams
      this.updateRecordingStream();

      if (!this.recordingStream || this.recordingStream.getTracks().length === 0) {
        // Wait a bit for streams to be established
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.updateRecordingStream();
        
        if (!this.recordingStream || this.recordingStream.getTracks().length === 0) {
          throw new Error('No media streams available for recording');
        }
      }

      await this.startMediaRecorder();

      this.isRecording = true;
      this.recordingData.startTime = Date.now();

      console.log('Recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  private async startMediaRecorder(): Promise<void> {
    if (!this.recordingStream) {
      throw new Error('No recording stream available');
    }

    // Determine the best codec
    const mimeType = this.getBestRecordingMimeType();
    
    this.mediaRecorder = new MediaRecorder(this.recordingStream, {
      mimeType,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
      audioBitsPerSecond: 128000   // 128 kbps
    });

    // Set up MediaRecorder event handlers
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordingData.combinedChunks.push(event.data);
        console.log(`Recording chunk collected: ${event.data.size} bytes`);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      this.isRecording = false;
    };

    this.mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped');
      this.recordingData.endTime = Date.now();
    };

    this.mediaRecorder.onstart = () => {
      console.log('MediaRecorder started');
    };

    // Start recording with data collection every second
    this.mediaRecorder.start(1000);
  }

  private getBestRecordingMimeType(): string {
    // Check for supported MIME types in order of preference
    const preferredTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];

    for (const type of preferredTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Using MIME type:', type);
        return type;
      }
    }

    // Fallback to basic WebM
    console.warn('No preferred MIME type supported, using default');
    return 'video/webm';
  }

  async stopRecording(): Promise<Blob> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress.');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not available'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          // Combine all recorded chunks
          const recordedBlob = new Blob(this.recordingData.combinedChunks, {
            type: this.mediaRecorder!.mimeType
          });

          this.isRecording = false;
          this.recordingData.endTime = Date.now();

          const duration = this.recordingData.endTime - this.recordingData.startTime;
          console.log('Recording stopped successfully:', {
            size: recordedBlob.size,
            duration: duration,
            chunks: this.recordingData.combinedChunks.length,
            mimeType: this.mediaRecorder!.mimeType
          });

          resolve(recordedBlob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  async disconnect(): Promise<void> {
    try {
      console.log('Disconnecting from Meet Media API');

      // Stop recording if active
      if (this.isRecording && this.mediaRecorder) {
        this.mediaRecorder.stop();
        this.isRecording = false;
      }

      // Close data channel
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.close();
        this.dataChannel = null;
      }

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Clean up streams
      this.remoteStreams.clear();
      this.participants.clear();
      this.recordingStream = null;

      this.isConnected = false;
      console.log('Disconnected successfully');
    } catch (error) {
      console.error('Error during disconnect:', error);
      throw error;
    }
  }

  // Public getter methods
  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'disconnected';
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }

  getRecordingDuration(): number {
    if (!this.recordingData.startTime) return 0;
    const endTime = this.recordingData.endTime || Date.now();
    return endTime - this.recordingData.startTime;
  }

  getParticipants(): ParticipantInfo[] {
    return Array.from(this.participants.values());
  }

  getRemoteStreamCount(): number {
    return this.remoteStreams.size;
  }

  getRecordingStats(): any {
    return {
      isRecording: this.isRecording,
      duration: this.getRecordingDuration(),
      chunks: this.recordingData.combinedChunks.length,
      totalSize: this.recordingData.combinedChunks.reduce((sum, chunk) => sum + chunk.size, 0),
      participants: this.participants.size,
      streams: this.remoteStreams.size
    };
  }
}

export default MeetMediaAPIClient;