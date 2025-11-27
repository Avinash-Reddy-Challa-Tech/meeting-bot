#!/usr/bin/env python3
"""
Google Meet Bot with Authentication
Logs into Google account and joins a Google Meet meeting
"""

import asyncio
import logging
from datetime import datetime
from playwright.async_api import async_playwright

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s'
)
logger = logging.getLogger(__name__)

class GoogleMeetBot:
    """Google Meet bot with authentication"""
    
    def __init__(self, email=None, password=None):
        self.email = email 
        self.password = password
        if not self.email or not self.password:
            raise ValueError("Email and password are required")
    
    async def join_meet(self, meet_url):
        """Join a Google Meet with authentication"""
        
        logger.info(f"🚀 Starting Google Meet Bot")
        logger.info(f"📧 Email: {self.email}")
        logger.info(f"🔗 Meet URL: {meet_url}")
        
        async with async_playwright() as p:
            # Create persistent context for session persistence
            context_dir = "./meet_bot_context"
            
            # Launch with persistent context and stealth settings
            context = await p.chromium.launch_persistent_context(
                user_data_dir=context_dir,
                headless=False,
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
            
            try:
                # Step 1: Check if already logged in
                logger.info("🔐 Checking authentication status...")
                await page.goto('https://accounts.google.com')
                await asyncio.sleep(3)
                
                # If not logged in, perform login
                if 'signin' in page.url.lower() or 'accounts.google.com' in page.url:
                    logger.info("🔑 Not logged in, attempting authentication...")
                    login_success = await self._perform_login(page)
                    
                    if not login_success:
                        logger.error("❌ Authentication failed")
                        await context.close()
                        return False
                else:
                    logger.info("✅ Already authenticated!")
                
                # Step 2: Navigate to Google Meet
                logger.info(f"🎥 Navigating to Meet: {meet_url}")
                await page.goto(meet_url)
                await asyncio.sleep(5)
                
                # Step 3: Handle pre-join screen
                await self._handle_prejoin_screen(page)
                
                # Step 4: Join the meeting
                await self._join_meeting(page)
                
                # Step 5: Stay in meeting
                logger.info("✅ Successfully joined the meeting!")
                logger.info("🎯 Bot is now in the meeting. Press Ctrl+C to exit.")
                
                # Keep the meeting open
                await self._stay_in_meeting(page)
                
            except KeyboardInterrupt:
                logger.info("👋 Exiting meeting...")
            except Exception as e:
                logger.error(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
            finally:
                await context.close()
    
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
    
    async def _stay_in_meeting(self, page):
        """Keep the bot in the meeting"""
        
        logger.info("⏰ Staying in meeting... (Press Ctrl+C to exit)")
        
        try:
            while True:
                await asyncio.sleep(10)
                
                # Check if still in meeting
                try:
                    # Look for leave button as indicator we're still in meeting
                    leave_button = await page.query_selector('button[aria-label*="Leave" i]')
                    if leave_button:
                        logger.debug("✅ Still in meeting...")
                    else:
                        logger.warning("⚠️ May have been disconnected from meeting")
                except:
                    pass
                    
        except KeyboardInterrupt:
            logger.info("👋 Leaving meeting...")
            raise

async def main():
    """Main function"""
    
    print("🤖 Google Meet Bot")
    print("=" * 50)
    
    # Configuration
    email = ''
    password = ''
    meet_url = ''
    
    # Create bot instance
    bot = GoogleMeetBot(email=email, password=password)
    
    # Join the meeting
    await bot.join_meet(meet_url)

if __name__ == "__main__":
    asyncio.run(main())