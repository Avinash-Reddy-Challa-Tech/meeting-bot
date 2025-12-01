// Google Meet REST API Service
// Handles meeting space creation, management, and conference operations

export interface MeetingSpace {
  name: string;
  meetingUri: string;
  meetingCode: string;
  config?: {
    entryPointAccess?: {
      accessCodes?: string[];
      passcodes?: string[];
    };
    accessType?: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
  };
}

export interface Conference {
  name: string;
  startTime: string;
  endTime?: string;
}

export interface ConferenceRecord {
  name: string;
  startTime: string;
  endTime?: string;
  expireTime?: string;
  space: string;
}

export interface Participant {
  name: string;
  earliestStartTime: string;
  latestEndTime?: string;
  signalingId?: string;
  phoneNumber?: string;
  anonymousUser?: {
    displayName: string;
  };
}

export class GoogleMeetRESTService {
  private accessToken: string;
  private static readonly BASE_URL = 'https://meet.googleapis.com/v2beta';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(endpoint: string, method = 'GET', body?: any): Promise<any> {
    const url = `${GoogleMeetRESTService.BASE_URL}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      if (response.status === 204) {
        return null; // No content
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to make request to ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Create a new meeting space
   */
  async createSpace(config?: any): Promise<MeetingSpace> {
    const body = config || {};
    return await this.makeRequest('/spaces', 'POST', body);
  }

  /**
   * Get meeting space by name
   */
  async getSpace(spaceName: string): Promise<MeetingSpace> {
    return await this.makeRequest(`/spaces/${spaceName}`);
  }

  /**
   * Get meeting space by meeting code
   */
  async getSpaceByMeetingCode(meetingCode: string): Promise<MeetingSpace> {
    return await this.makeRequest(`/spaces:findByMeetingCode?meetingCode=${meetingCode}`);
  }

  /**
   * Update meeting space
   */
  async updateSpace(spaceName: string, updates: any, updateMask: string): Promise<MeetingSpace> {
    return await this.makeRequest(`/spaces/${spaceName}?updateMask=${updateMask}`, 'PATCH', updates);
  }

  /**
   * End an active meeting in a space
   */
  async endActiveConference(spaceName: string): Promise<void> {
    return await this.makeRequest(`/spaces/${spaceName}:endActiveConference`, 'POST');
  }

  /**
   * Get the active conference in a space
   */
  async getActiveConference(spaceName: string): Promise<Conference | null> {
    try {
      return await this.makeRequest(`/spaces/${spaceName}/activeConference`);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null; // No active conference
      }
      throw error;
    }
  }

  /**
   * Connect to active conference for Media API
   */
  async connectActiveConference(
    spaceName: string,
    sdpOffer: string,
    cloudProjectNumber: string
  ): Promise<{ sdpAnswer: string }> {
    const body = {
      sdpOffer,
      cloudProjectNumber
    };
    
    return await this.makeRequest(
      `/spaces/${spaceName}/activeConference:connectActiveConference`,
      'POST',
      body
    );
  }

  /**
   * List conference records for a space
   */
  async listConferenceRecords(spaceName: string, pageSize = 25, pageToken?: string): Promise<{
    conferenceRecords: ConferenceRecord[];
    nextPageToken?: string;
  }> {
    let endpoint = `/spaces/${spaceName}/conferenceRecords?pageSize=${pageSize}`;
    if (pageToken) {
      endpoint += `&pageToken=${pageToken}`;
    }
    
    return await this.makeRequest(endpoint);
  }

  /**
   * Get a specific conference record
   */
  async getConferenceRecord(conferenceRecordName: string): Promise<ConferenceRecord> {
    return await this.makeRequest(`/conferenceRecords/${conferenceRecordName}`);
  }

  /**
   * List participants for a conference
   */
  async listParticipants(
    conferenceRecordName: string,
    pageSize = 25,
    pageToken?: string,
    filter?: string
  ): Promise<{
    participants: Participant[];
    nextPageToken?: string;
    totalSize: number;
  }> {
    let endpoint = `/conferenceRecords/${conferenceRecordName}/participants?pageSize=${pageSize}`;
    if (pageToken) {
      endpoint += `&pageToken=${pageToken}`;
    }
    if (filter) {
      endpoint += `&filter=${encodeURIComponent(filter)}`;
    }
    
    return await this.makeRequest(endpoint);
  }

  /**
   * Get a specific participant
   */
  async getParticipant(participantName: string): Promise<Participant> {
    return await this.makeRequest(`/participants/${participantName}`);
  }

  /**
   * List recordings for a conference
   */
  async listRecordings(conferenceRecordName: string, pageSize = 25, pageToken?: string): Promise<{
    recordings: any[];
    nextPageToken?: string;
  }> {
    let endpoint = `/conferenceRecords/${conferenceRecordName}/recordings?pageSize=${pageSize}`;
    if (pageToken) {
      endpoint += `&pageToken=${pageToken}`;
    }
    
    return await this.makeRequest(endpoint);
  }

  /**
   * Get a specific recording
   */
  async getRecording(recordingName: string): Promise<any> {
    return await this.makeRequest(`/recordings/${recordingName}`);
  }

  /**
   * List transcripts for a conference
   */
  async listTranscripts(conferenceRecordName: string, pageSize = 25, pageToken?: string): Promise<{
    transcripts: any[];
    nextPageToken?: string;
  }> {
    let endpoint = `/conferenceRecords/${conferenceRecordName}/transcripts?pageSize=${pageSize}`;
    if (pageToken) {
      endpoint += `&pageToken=${pageToken}`;
    }
    
    return await this.makeRequest(endpoint);
  }

  /**
   * Get a specific transcript
   */
  async getTranscript(transcriptName: string): Promise<any> {
    return await this.makeRequest(`/transcripts/${transcriptName}`);
  }

  /**
   * Get meeting space ID from meeting code
   */
  async getSpaceIdFromMeetingCode(meetingCode: string): Promise<string> {
    try {
      const space = await this.getSpaceByMeetingCode(meetingCode);
      // Extract space ID from the space name
      // Space names have format: "spaces/{spaceId}"
      return space.name.split('/')[1];
    } catch (error) {
      console.error('Failed to get space ID from meeting code:', error);
      throw error;
    }
  }

  /**
   * Wait for active conference to start
   */
  async waitForActiveConference(spaceName: string, timeoutMs = 60000, intervalMs = 5000): Promise<Conference> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const conference = await this.getActiveConference(spaceName);
        if (conference) {
          return conference;
        }
      } catch (error) {
        console.log('No active conference yet, waiting...');
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error(`No active conference found within ${timeoutMs}ms`);
  }

  /**
   * Helper method to extract space name from meeting URI
   */
  static extractSpaceNameFromUri(meetingUri: string): string | null {
    // Meeting URIs typically have format: https://meet.google.com/abc-defg-hij
    const match = meetingUri.match(/meet\.google\.com\/([a-z0-9-]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Helper method to validate meeting code format
   */
  static isValidMeetingCode(meetingCode: string): boolean {
    // Meeting codes are typically 10-12 characters with format: abc-defg-hij
    return /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/i.test(meetingCode);
  }
}

export default GoogleMeetRESTService;