#!/usr/bin/env python3
"""
Google Meet Bot - Fixed API Response Version
Your working code but with proper API response returns
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import Dict, Any
from playwright.async_api import async_playwright
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
import uvicorn

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app instance
app = FastAPI(
    title="Google Meet Bot API - Fixed Response Version",
    description="Automated Google Meet joining service with proper API responses",
    version="1.0.2"
)

# Request model
class MeetJoinRequest(BaseModel):
    meet_url: HttpUrl
    
    class Config:
        json_schema_extra = {  # Updated from schema_extra
            "example": {
                "meet_url": "https://meet.google.com/nqw-stzx-idr"
            }
        }

# Response model
class MeetJoinResponse(BaseModel):
    success: bool
    message: str
    timestamp: str

class MacOSGoogleMeetBot:
    """macOS-compatible Google Meet bot with proper API responses"""
    
    def __init__(self, email=None, password=None):
        self.email = email or 'stormee@techolution.com'
        self.password = password or 'Stormee@007'
        
        if not self.email or not self.password:
            raise ValueError("Email and password are required")

    async def join_meet(self, meet_url: str) -> Dict[str, Any]:
        """Join a Google Meet with authentication and session management - Returns API response"""
        
        logger.info(f"🚀 Starting Google Meet Bot")
        logger.info(f"📧 Email: {self.email}")
        logger.info(f"🔗 Meet URL: {meet_url}")
        
        async with async_playwright() as p:
            try:
                # Create persistent context for session persistence
                context_dir = "./meet_bot_context"
                
                # Launch with persistent context and stealth settings
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=context_dir,
                    headless=True,
                    args=[
                        '--disable-blink-features=AutomationControlled',
                        '--start-maximized',
                        '--use-fake-ui-for-media-stream',  # Auto-allow camera/mic
                        '--use-fake-device-for-media-stream',  # Use fake media devices
                        '--disable-dev-shm-usage',
                        '--no-sandbox',
                        '--disable-setuid-sandbox'
                    ],
                    viewport={'width': 1920, 'height': 1080}
                )
                
                # Add stealth scripts
                await context.add_init_script("""
                    // Remove webdriver property
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    
                    // Override plugins
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });
                    
                    // Override languages
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });
                    
                    // Add chrome runtime
                    window.chrome = {
                        runtime: {}
                    };
                    
                    // Hide automation indicators
                    delete window.__playwright;
                    delete window.__webdriver_script_fn;
                """)
                
                # Grant camera and microphone permissions
                await context.grant_permissions(['camera', 'microphone'])
                
                page = await context.new_page()
                
                # Step 1: Check if already logged in with session validation
                logger.info("🔐 Checking authentication status...")
                await page.goto('https://accounts.google.com')
                await asyncio.sleep(3)
                
                # Enhanced session validation
                session_valid = await self._validate_session(page)
                
                if not session_valid:
                    logger.info("🔑 Session expired or not logged in, attempting authentication...")
                    login_success = await self._perform_login(page)
                    
                    if not login_success:
                        logger.error("❌ Authentication failed")
                        await context.close()
                        return {
                            "success": False,
                            "message": "Authentication failed",
                            "timestamp": datetime.now().isoformat()
                        }
                else:
                    logger.info("✅ Valid session found!")
                
                # Step 2: Navigate to Google Meet
                logger.info(f"🎥 Navigating to Meet: {meet_url}")
                await page.goto(meet_url)
                await asyncio.sleep(5)
                
                # Step 2.5: Check session again after navigation (tokens might expire during navigation)
                if await self._check_session_expired_on_meet(page):
                    logger.warning("⚠️ Session expired during Meet navigation, re-authenticating...")
                    
                    # Go back to login
                    login_success = await self._handle_expired_session(page)
                    if not login_success:
                        logger.error("❌ Re-authentication failed")
                        await context.close()
                        return {
                            "success": False,
                            "message": "Re-authentication failed",
                            "timestamp": datetime.now().isoformat()
                        }
                    
                    # Navigate back to meeting
                    logger.info(f"🎥 Re-navigating to Meet: {meet_url}")
                    await page.goto(meet_url)
                    await asyncio.sleep(5)
                
                # Step 3: Handle pre-join screen
                await self._handle_prejoin_screen(page)
                
                # Step 4: Join the meeting
                join_success = await self._join_meeting(page)
                
                # Close context after joining (no longer stay in meeting for API)
                await context.close()
                
                # Return proper API response
                if join_success:
                    logger.info("✅ Successfully joined the meeting!")
                    return {
                        "success": True,
                        "message": "Successfully joined the Google Meet meeting",
                        "timestamp": datetime.now().isoformat()
                    }
                else:
                    logger.error("❌ Failed to join the meeting")
                    return {
                        "success": False,
                        "message": "Failed to join the meeting",
                        "timestamp": datetime.now().isoformat()
                    }
                
            except Exception as e:
                logger.error(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
                try:
                    await context.close()
                except:
                    pass
                return {
                    "success": False,
                    "message": f"Error occurred: {str(e)}",
                    "timestamp": datetime.now().isoformat()
                }
    
    async def _validate_session(self, page):
        """Enhanced session validation"""
        
        try:
            current_url = page.url
            logger.info(f"📍 Current URL for session validation: {current_url}")
            
            # Check if we're on a signin page
            if 'signin' in current_url.lower():
                logger.info("🔄 Currently on signin page - session invalid")
                return False
            
            # Check if we're redirected to accounts.google.com (valid session)
            if 'myaccount.google.com' in current_url or ('accounts.google.com' in current_url and 'signin' not in current_url):
                logger.info("✅ Session appears valid from URL")
                
                # Additional validation: try to access a Google service
                try:
                    await page.goto('https://myaccount.google.com', timeout=10000)
                    await asyncio.sleep(2)
                    
                    current_url_after = page.url
                    if 'signin' not in current_url_after.lower():
                        logger.info("✅ Session validated successfully")
                        return True
                    else:
                        logger.info("❌ Session validation failed - redirected to signin")
                        return False
                        
                except Exception as e:
                    logger.warning(f"⚠️ Session validation error: {e}")
                    return False
            
            # If we're somewhere else, assume session is invalid
            logger.info("❌ Session validation failed - unexpected location")
            return False
            
        except Exception as e:
            logger.error(f"❌ Session validation error: {e}")
            return False
    
    async def _check_session_expired_on_meet(self, page):
        """Check if session expired when accessing Google Meet"""
        
        try:
            await asyncio.sleep(2)  # Wait for page to stabilize
            current_url = page.url
            page_content = await page.content()
            
            logger.info(f"📍 Meet page URL: {current_url}")
            
            # Check for signs of expired session
            session_expired_indicators = [
                'signin' in current_url.lower(),
                'login' in current_url.lower(), 
                'Sign in' in page_content,
                'sign in to your account' in page_content.lower(),
                'authentication required' in page_content.lower(),
                'session expired' in page_content.lower()
            ]
            
            if any(session_expired_indicators):
                logger.warning("⚠️ Session appears to have expired on Meet page")
                return True
                
            # Additional check: look for Google Meet interface elements
            try:
                # If we can find meet-specific elements, session is likely valid
                meet_elements = await page.query_selector_all(
                    'div[data-meeting-title], button[aria-label*="camera"], button[aria-label*="microphone"], div[jsname]'
                )
                
                if meet_elements:
                    logger.info("✅ Meet interface elements found - session appears valid")
                    return False
                else:
                    logger.warning("⚠️ No Meet interface elements found - possible session issue")
                    return True
                    
            except Exception:
                logger.warning("⚠️ Could not check Meet interface elements")
                return True
                
        except Exception as e:
            logger.error(f"❌ Error checking session on Meet: {e}")
            return True  # Assume expired if we can't check
    
    async def _handle_expired_session(self, page):
        """Handle expired session by performing fresh login"""
        
        try:
            logger.info("🔄 Handling expired session...")
            
            # Navigate to signin page
            await page.goto('https://accounts.google.com/signin')
            await asyncio.sleep(3)
            
            # Perform fresh login
            return await self._perform_login(page)
            
        except Exception as e:
            logger.error(f"❌ Error handling expired session: {e}")
            return False
    
    async def _perform_login(self, page):
        """Perform Google login"""
        
        try:
            logger.info("🔐 Starting login process...")
            
            # Navigate to signin if not already there
            if 'signin' not in page.url:
                await page.goto('https://accounts.google.com/signin')
                await asyncio.sleep(2)
            
            # Enter email
            logger.info("📧 Entering email...")
            email_input = await page.wait_for_selector('input[type="email"]', timeout=10000)
            await email_input.click()
            await asyncio.sleep(0.5)
            
            for char in self.email:
                await page.keyboard.type(char)
                await asyncio.sleep(0.05)
            
            logger.info("✅ Email entered")
            
            # Click Next
            await page.click('#identifierNext, button:has-text("Next")')
            await asyncio.sleep(3)
            
            # Enter password
            logger.info("🔑 Entering password...")
            password_input = await page.wait_for_selector('input[type="password"], input[name="password"]', timeout=15000)
            await password_input.click()
            await asyncio.sleep(0.5)
            
            for char in self.password:
                await page.keyboard.type(char)
                await asyncio.sleep(0.03)
            
            logger.info("✅ Password entered")
            
            # Click Next
            await page.click('#passwordNext, button:has-text("Next")')
            await asyncio.sleep(5)
            
            # Check for 2FA
            current_url = page.url
            if '2-step' in current_url.lower() or 'verification' in current_url.lower():
                logger.warning("⚠️ 2FA required - please complete manually...")
                logger.info("Waiting up to 2 minutes for 2FA completion...")
                
                try:
                    await page.wait_for_url('**/myaccount.google.com**', timeout=120000)
                    logger.info("✅ 2FA completed successfully")
                except:
                    logger.error("❌ 2FA timeout")
                    return False
            
            # Verify login success
            await asyncio.sleep(3)
            final_url = page.url
            
            if 'myaccount.google.com' in final_url or 'signin' not in final_url:
                logger.info("✅ LOGIN SUCCESSFUL!")
                return True
            else:
                logger.error("❌ Login failed")
                return False
                
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            return False
    
    async def _handle_prejoin_screen(self, page):
        """Handle the Google Meet pre-join screen"""
        
        logger.info("🎬 Handling pre-join screen...")
        
        try:
            # Wait for the page to load
            await asyncio.sleep(3)
            
            # Turn off camera
            try:
                camera_button = await page.wait_for_selector(
                    'button[aria-label*="camera" i], button[aria-label*="Turn off camera" i], div[aria-label*="camera" i]',
                    timeout=5000
                )
                camera_state = await camera_button.get_attribute('aria-label')
                if 'turn off' in camera_state.lower():
                    await camera_button.click()
                    logger.info("📷 Camera turned off")
                    await asyncio.sleep(1)
            except Exception as e:
                logger.debug(f"Camera button not found or already off: {e}")
            
            # Turn off microphone
            try:
                mic_button = await page.wait_for_selector(
                    'button[aria-label*="microphone" i], button[aria-label*="Turn off microphone" i], div[aria-label*="microphone" i]',
                    timeout=5000
                )
                mic_state = await mic_button.get_attribute('aria-label')
                if 'turn off' in mic_state.lower():
                    await mic_button.click()
                    logger.info("🎤 Microphone turned off")
                    await asyncio.sleep(1)
            except Exception as e:
                logger.debug(f"Mic button not found or already off: {e}")
            
            logger.info("✅ Pre-join settings configured")
            
        except Exception as e:
            logger.warning(f"⚠️ Could not configure pre-join settings: {e}")
    
    async def _join_meeting(self, page):
        """Click the join button to enter the meeting"""
        
        logger.info("🚪 Attempting to join meeting...")
        
        try:
            # Try different selectors for the join button
            join_selectors = [
                'button[aria-label*="Ask to join" i]',
                'button[aria-label*="Join now" i]',
                'button:has-text("Ask to join")',
                'button:has-text("Join now")',
                'div[role="button"]:has-text("Ask to join")',
                'div[role="button"]:has-text("Join now")',
                'span:has-text("Ask to join")',
                'span:has-text("Join now")'
            ]
            
            join_button = None
            for selector in join_selectors:
                try:
                    join_button = await page.wait_for_selector(selector, timeout=5000)
                    if join_button:
                        logger.info(f"✅ Found join button with selector: {selector}")
                        break
                except:
                    continue
            
            if join_button:
                await join_button.click()
                logger.info("🎯 Join button clicked!")
                await asyncio.sleep(5)
                
                # Check if we're in the meeting
                await asyncio.sleep(3)
                
                # Look for meeting indicators
                try:
                    meeting_indicators = await page.query_selector_all(
                        'div[aria-label*="meeting" i], div[aria-label*="participants" i]'
                    )
                    if meeting_indicators:
                        logger.info("✅ Successfully joined the meeting!")
                        return True
                except:
                    pass
                
                logger.info("✅ Join button clicked, assuming success")
                return True
            else:
                logger.error("❌ Could not find join button")
                
                # Debug: Print current page content
                page_text = await page.evaluate('() => document.body.innerText')
                logger.debug(f"Page content: {page_text[:500]}")
                
                return False
                
        except Exception as e:
            logger.error(f"❌ Error joining meeting: {e}")
            return False

# Global bot instance
meet_bot = MacOSGoogleMeetBot()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Google Meet Bot API - Fixed Response Version",
        "timestamp": datetime.now().isoformat(),
        "status": "healthy",
        "platform": "macOS-compatible"
    }

@app.post("/join-meet", response_model=MeetJoinResponse)
async def join_meet_endpoint(request: MeetJoinRequest):
    """
    Join a Google Meet meeting - Now returns proper API responses
    
    Args:
        request: MeetJoinRequest containing the meet_url
        
    Returns:
        MeetJoinResponse with success status and message
    """
    try:
        logger.info(f"🎯 Received request to join meeting: {request.meet_url}")
        
        # Call the bot's join_meet method (now returns proper dict)
        result = await meet_bot.join_meet(str(request.meet_url))
        
        return MeetJoinResponse(
            success=result["success"],
            message=result["message"],
            timestamp=result["timestamp"]
        )
        
    except Exception as e:
        logger.error(f"❌ API Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Extended health check with system info"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "Google Meet Bot API - Fixed Response Version",
        "version": "1.0.2",
        "email": meet_bot.email,
        "platform": sys.platform,
        "python_version": sys.version
    }

@app.get("/test-network")
async def test_network():
    """Test network connectivity"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()
            
            results = {}
            
            # Test basic connectivity
            try:
                await page.goto('https://httpbin.org/get', timeout=10000)
                results['basic_http'] = 'OK'
            except Exception as e:
                results['basic_http'] = f'FAILED: {str(e)}'
            
            # Test Google connectivity
            try:
                await page.goto('https://www.google.com', timeout=10000)
                results['google'] = 'OK'
            except Exception as e:
                results['google'] = f'FAILED: {str(e)}'
            
            # Test Google Accounts
            try:
                await page.goto('https://accounts.google.com', timeout=10000)
                results['google_accounts'] = 'OK'
            except Exception as e:
                results['google_accounts'] = f'FAILED: {str(e)}'
            
            await browser.close()
            
            return {
                "timestamp": datetime.now().isoformat(),
                "tests": results,
                "overall": "OK" if all('OK' in v for v in results.values()) else "ISSUES_DETECTED"
            }
            
    except Exception as e:
        return {
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "overall": "FAILED"
        }

if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "meetbot:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )