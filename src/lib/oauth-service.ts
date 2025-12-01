// OAuth service for Google Meet API authentication
// Handles OAuth token generation and management

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string; // For server-side flows
  redirectUri: string;
  scopes: string[];
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
}

export class GoogleMeetOAuthService {
  private config: OAuthConfig;
  private static readonly OAUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2';
  private static readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  
  // Required scopes for Meet Media API
  private static readonly REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/meetings.conference.media.readonly',
    'https://www.googleapis.com/auth/meetings.space.readonly'
  ];

  constructor(config: Partial<OAuthConfig>) {
    this.config = {
      scopes: GoogleMeetOAuthService.REQUIRED_SCOPES,
      ...config
    } as OAuthConfig;
  }

  /**
   * Generate OAuth URL for authorization code flow
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      response_type: 'code',
      access_type: 'offline', // To get refresh token
      prompt: 'consent', // Force consent to get refresh token
      ...(state && { state })
    });

    return `${GoogleMeetOAuthService.OAUTH_BASE_URL}/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token (server-side)
   */
  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    if (!this.config.clientSecret) {
      throw new Error('Client secret required for server-side token exchange');
    }

    try {
      const response = await fetch(GoogleMeetOAuthService.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri
        })
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        tokenType: data.token_type || 'Bearer'
      };
    } catch (error) {
      console.error('Failed to exchange code for token:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthToken> {
    if (!this.config.clientSecret) {
      throw new Error('Client secret required for token refresh');
    }

    try {
      const response = await fetch(GoogleMeetOAuthService.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expiresAt: Date.now() + (data.expires_in * 1000),
        tokenType: data.token_type || 'Bearer'
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Get OAuth token using implicit flow (client-side)
   * This method should be called from the browser after user authorization
   */
  async getTokenFromImplicitFlow(): Promise<OAuthToken> {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        this.getAuthorizationUrl(),
        'oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Failed to open OAuth popup'));
        return;
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          reject(new Error('OAuth popup was closed'));
        }
      }, 1000);

      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'OAUTH_SUCCESS') {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          popup.close();
          resolve(event.data.token);
        } else if (event.data.type === 'OAUTH_ERROR') {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          popup.close();
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', messageHandler);
    });
  }

  /**
   * Validate and check if token is expired
   */
  isTokenExpired(token: OAuthToken): boolean {
    return Date.now() >= token.expiresAt - 60000; // Consider expired 1 minute early
  }

  /**
   * Validate token by making a test API call
   */
  async validateToken(token: OAuthToken): Promise<boolean> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        method: 'GET',
        headers: {
          'Authorization': `${token.tokenType} ${token.accessToken}`
        }
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      
      // Check if token has required scopes
      const tokenScopes = data.scope?.split(' ') || [];
      const hasRequiredScopes = GoogleMeetOAuthService.REQUIRED_SCOPES.every(
        scope => tokenScopes.includes(scope)
      );

      return hasRequiredScopes;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Get user info using the access token
   */
  async getUserInfo(token: OAuthToken): Promise<any> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `${token.tokenType} ${token.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }
}

export default GoogleMeetOAuthService;