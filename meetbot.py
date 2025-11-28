#!/usr/bin/env python3
"""
Google Meet Bot - VM Optimized Version
Optimized for virtual machine environments with better timeout and input handling
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
    title="Google Meet Bot API - VM Optimized",
    description="Automated Google Meet joining service optimized for VMs",
    version="1.0.4"
)

# Request model
class MeetJoinRequest(BaseModel):
    meet_url: HttpUrl
    
    class Config:
        json_schema_extra = {
            "example": {
                "meet_url": "https://meet.google.com/nqw-stzx-idr"
            }
        }

# Response model
class MeetJoinResponse(BaseModel):
    success: bool
    message: str
    timestamp: str

class VMOptimizedGoogleMeetBot:
    """VM-optimized Google Meet bot with extended timeouts and better input handling"""
    
    def __init__(self, email=None, password=None):
        self.email = email or 'stormee@techolution.com'
        self.password = password or 'Stormee@007'
        
        if not self.email or not self.password:
            raise ValueError("Email and password are required")

    async def join_meet(self, meet_url: str) -> Dict[str, Any]:
        """Join a Google Meet - VM optimized version"""
        
        logger.info(f"🚀 Starting VM-Optimized Google Meet Bot")
        logger.info(f"📧 Email: {self.email}")
        logger.info(f"🔗 Meet URL: {meet_url}")
        
        async with async_playwright() as p:
            try:
                context_dir = "./meet_bot_context"
                
                # VM-optimized browser launch with additional flags
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=context_dir,
                    headless=True,
                    args=[
                        '--disable-blink-features=AutomationControlled',
                        '--start-maximized',
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream',
                        '--disable-dev-shm-usage',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-gpu',  # Better for VMs
                        '--disable-software-rasterizer',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--single-process',  # Better for VM resources
                        '--no-zygote'
                    ],
                    viewport={'width': 1920, 'height': 1080},
                    slow_mo=100  # Add delay for VM stability
                )
                
                # Add stealth scripts
                await context.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });
                    window.chrome = { runtime: {} };
                    delete window.__playwright;
                    delete window.__webdriver_script_fn;
                """)
                
                await context.grant_permissions(['camera', 'microphone'])
                page = await context.new_page()
                
                # Set longer timeouts for VM
                page.set_default_timeout(60000)  # 60 seconds
                page.set_default_navigation_timeout(60000)
                
                # Session validation
                logger.info("🔐 Checking authentication status...")
                await page.goto('https://accounts.google.com', timeout=60000)
                await asyncio.sleep(5)  # Extra wait for VM
                
                session_valid = await self._validate_session(page)
                
                if not session_valid:
                    logger.info("🔑 Session expired or not logged in, attempting authentication...")
                    login_success = await self._perform_login_vm_optimized(page)
                    
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
                
                # Navigate to Google Meet
                logger.info(f"🎥 Navigating to Meet: {meet_url}")
                await page.goto(meet_url, timeout=60000)
                await asyncio.sleep(8)  # Extra wait for VM
                
                # Check session again
                if await self._check_session_expired_on_meet(page):
                    logger.warning("⚠️ Session expired during Meet navigation, re-authenticating...")
                    login_success = await self._handle_expired_session_vm(page)
                    if not login_success:
                        logger.error("❌ Re-authentication failed")
                        await context.close()
                        return {
                            "success": False,
                            "message": "Re-authentication failed",
                            "timestamp": datetime.now().isoformat()
                        }
                    
                    logger.info(f"🎥 Re-navigating to Meet: {meet_url}")
                    await page.goto(meet_url, timeout=60000)
                    await asyncio.sleep(8)
                
                # Handle pre-join and join
                await self._handle_prejoin_screen_vm(page)
                join_success = await self._join_meeting_vm(page)
                
                await context.close()
                
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
        """Session validation with VM timeouts"""
        try:
            current_url = page.url
            logger.info(f"📍 Current URL for session validation: {current_url}")
            
            if 'signin' in current_url.lower():
                logger.info("🔄 Currently on signin page - session invalid")
                return False
            
            if 'myaccount.google.com' in current_url or ('accounts.google.com' in current_url and 'signin' not in current_url):
                logger.info("✅ Session appears valid from URL")
                
                try:
                    await page.goto('https://myaccount.google.com', timeout=30000)
                    await asyncio.sleep(5)  # Extra wait for VM
                    
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
            
            logger.info("❌ Session validation failed - unexpected location")
            return False
            
        except Exception as e:
            logger.error(f"❌ Session validation error: {e}")
            return False
    
    async def _perform_login_vm_optimized(self, page):
        """VM-optimized login with better input handling"""
        
        try:
            logger.info("🔐 Starting VM-optimized login process...")
            
            if 'signin' not in page.url:
                await page.goto('https://accounts.google.com/signin', timeout=30000)
                await asyncio.sleep(5)
            
            # Enter email with VM optimization
            logger.info("📧 Entering email...")
            email_input = await page.wait_for_selector('input[type="email"]', timeout=30000)
            
            # Clear any existing content
            await email_input.click()
            await page.keyboard.press('Control+a')  # Select all
            await page.keyboard.press('Delete')     # Clear
            await asyncio.sleep(1)
            
            # Use fill instead of typing for better reliability in VM
            await email_input.fill(self.email)
            await asyncio.sleep(2)
            
            logger.info("✅ Email entered")
            await page.click('#identifierNext, button:has-text("Next")')
            await asyncio.sleep(6)  # Extra wait for VM
            
            # Enter password with VM optimization
            logger.info("🔑 Entering password...")
            password_input = await page.wait_for_selector('input[type="password"], input[name="password"]', timeout=45000)  # Extended timeout
            
            # Clear any existing content
            await password_input.click()
            await page.keyboard.press('Control+a')
            await page.keyboard.press('Delete')
            await asyncio.sleep(1)
            
            # Use fill method for better reliability
            await password_input.fill(self.password)
            await asyncio.sleep(3)  # Extra wait to ensure password is filled
            
            logger.info("✅ Password entered")
            await page.click('#passwordNext, button:has-text("Next")')
            await asyncio.sleep(8)  # Extended wait for VM
            
            # Check for 2FA with extended timeout
            current_url = page.url
            if '2-step' in current_url.lower() or 'verification' in current_url.lower():
                logger.warning("⚠️ 2FA required - please complete manually...")
                logger.info("Waiting up to 3 minutes for 2FA completion...")
                
                try:
                    await page.wait_for_url('**/myaccount.google.com**', timeout=180000)  # 3 minutes
                    logger.info("✅ 2FA completed successfully")
                except:
                    logger.error("❌ 2FA timeout")
                    return False
            
            # Verify login success with extended timeout
            await asyncio.sleep(5)
            final_url = page.url
            
            if 'myaccount.google.com' in final_url or 'signin' not in final_url:
                logger.info("✅ LOGIN SUCCESSFUL!")
                return True
            else:
                logger.error(f"❌ Login failed - unexpected URL: {final_url}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            return False
    
    async def _check_session_expired_on_meet(self, page):
        """Check session with VM-appropriate timing"""
        try:
            await asyncio.sleep(5)  # Extended wait for VM
            current_url = page.url
            page_content = await page.content()
            
            logger.info(f"📍 Meet page URL: {current_url}")
            
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
                
            try:
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
            return True
    
    async def _handle_expired_session_vm(self, page):
        """Handle expired session - VM optimized"""
        try:
            logger.info("🔄 Handling expired session...")
            await page.goto('https://accounts.google.com/signin', timeout=30000)
            await asyncio.sleep(5)
            return await self._perform_login_vm_optimized(page)
        except Exception as e:
            logger.error(f"❌ Error handling expired session: {e}")
            return False
    
    async def _handle_prejoin_screen_vm(self, page):
        """Handle pre-join screen - VM optimized"""
        logger.info("🎬 Handling pre-join screen...")
        
        try:
            await asyncio.sleep(6)  # Extended wait for VM
            
            # Turn off camera
            try:
                camera_button = await page.wait_for_selector(
                    'button[aria-label*="camera" i], button[aria-label*="Turn off camera" i], div[aria-label*="camera" i]',
                    timeout=15000  # Extended timeout
                )
                camera_state = await camera_button.get_attribute('aria-label')
                if camera_state and 'turn off' in camera_state.lower():
                    await camera_button.click()
                    logger.info("📷 Camera turned off")
                    await asyncio.sleep(2)
            except Exception as e:
                logger.debug(f"Camera button not found or already off: {e}")
            
            # Turn off microphone
            try:
                mic_button = await page.wait_for_selector(
                    'button[aria-label*="microphone" i], button[aria-label*="Turn off microphone" i], div[aria-label*="microphone" i]',
                    timeout=15000  # Extended timeout
                )
                mic_state = await mic_button.get_attribute('aria-label')
                if mic_state and 'turn off' in mic_state.lower():
                    await mic_button.click()
                    logger.info("🎤 Microphone turned off")
                    await asyncio.sleep(2)
            except Exception as e:
                logger.debug(f"Mic button not found or already off: {e}")
            
            logger.info("✅ Pre-join settings configured")
            
        except Exception as e:
            logger.warning(f"⚠️ Could not configure pre-join settings: {e}")
    
    async def _join_meeting_vm(self, page):
        """Join meeting - VM optimized"""
        logger.info("🚪 Attempting to join meeting...")
        
        try:
            await asyncio.sleep(5)  # Extended wait for VM
            
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
                    join_button = await page.wait_for_selector(selector, timeout=10000)
                    if join_button:
                        logger.info(f"✅ Found join button with selector: {selector}")
                        break
                except:
                    continue
            
            if join_button:
                await join_button.click()
                logger.info("🎯 Join button clicked!")
                await asyncio.sleep(10)  # Extended wait for VM
                
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
                return False
                
        except Exception as e:
            logger.error(f"❌ Error joining meeting: {e}")
            return False

# Global bot instance
meet_bot = VMOptimizedGoogleMeetBot()

@app.get("/")
async def root():
    return {
        "message": "Google Meet Bot API - VM Optimized",
        "timestamp": datetime.now().isoformat(),
        "status": "healthy",
        "version": "1.0.4"
    }

@app.post("/join-meet", response_model=MeetJoinResponse)
async def join_meet_endpoint(request: MeetJoinRequest):
    try:
        logger.info(f"🎯 Received request to join meeting: {request.meet_url}")
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
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "Google Meet Bot API - VM Optimized",
        "version": "1.0.4",
        "email": meet_bot.email,
        "platform": sys.platform
    }

if __name__ == "__main__":
    uvicorn.run(
        "meetbot:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )