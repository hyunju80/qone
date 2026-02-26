
import base64
import re
import sys
import asyncio
import threading
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright, Page, Browser, Playwright
from bs4 import BeautifulSoup

class CrawlerService:
    # Singleton-like storage for sessions
    # Dictionary structure: { "session_id": { "browser": Browser, "page": Page, "playwright": Playwright } }
    _sessions: Dict[str, Dict[str, Any]] = {}

    def __init__(self):
        self._bg_thread = None
        self._bg_loop = None
        self._loop_ready = threading.Event()

    def _start_background_loop(self):
        """Runs in a dedicated background thread to handle Playwright on Windows."""
        try:
            if sys.platform == 'win32':
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            
            self._bg_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._bg_loop)
            self._loop_ready.set()
            self._bg_loop.run_forever()
        except:
            pass

    def _ensure_background_thread(self):
        if self._bg_thread is None or not self._bg_thread.is_alive():
            self._loop_ready.clear()
            self._bg_thread = threading.Thread(target=self._start_background_loop, daemon=True, name="CrawlerThread")
            self._bg_thread.start()
            self._loop_ready.wait()

    def _run_in_bg(self, coro):
        self._ensure_background_thread()
        future = asyncio.run_coroutine_threadsafe(coro, self._bg_loop)
        return asyncio.wrap_future(future)

    def _ensure_session(self, session_id: str):
        if session_id not in self._sessions:
            raise ValueError(f"Session {session_id} not found or active.")
        return self._sessions[session_id]

    def _clean_dom(self, html_content: str) -> str:
        """
        Aggressively simplifies HTML for LLM consumption (Token Optimization).
        """
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove massive clutter
        for tag in soup(['script', 'style', 'xml', 'head', 'noscript', 'meta', 'link', 'svg', 'iframe']):
            tag.decompose()

        allowed_attrs = ['id', 'name', 'class', 'href', 'type', 'placeholder', 'role', 'aria-label', 'title', 'alt', 'for', 'value']
        
        for tag in soup.find_all(True):
            # Remove comments
            if tag.string and "<!--" in tag.string: 
                    continue 
                    
            # Filter attributes
            attrs = list(tag.attrs.keys())
            for attr in attrs:
                if attr not in allowed_attrs:
                    del tag.attrs[attr]
            
            # Truncate long text content (e.g. policies)
            if tag.string and len(tag.string) > 200:
                tag.string = tag.string[:200] + "..."

        clean_html = soup.decode_contents()
        
        # Remove excessive whitespace using Regex
        clean_html = re.sub(r'\n\s*\n', '\n', clean_html)
        clean_html = re.sub(r'\s+', ' ', clean_html)  # Collapse spaces

        # Hard limit
        if len(clean_html) > 100000:
            clean_html = clean_html[:100000] + "...(truncated)"
            
        return clean_html

    async def start_session(self, session_id: str, url: str) -> Dict[str, Any]:
        """
        Starts a persistent browser session (Async).
        """
        return await self._run_in_bg(self._start_session_impl(session_id, url))

    async def _start_session_impl(self, session_id: str, url: str) -> Dict[str, Any]:
        if session_id in self._sessions:
            try:
                await self._close_session_impl(session_id)
            except:
                pass

        p = await async_playwright().start()
        # Headless=False for visibility as requested
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        except Exception as e:
            print(f"Initial Navigation Warning: {e}")
            # Continue anyway, page might be partially loaded

        self._sessions[session_id] = {
            "playwright": p,
            "browser": browser,
            "context": context,
            "page": page
        }
        
        return await self._get_state_impl(session_id)

    def _get_active_page(self, session_id: str) -> Page:
        # Note: This helper might need to return the page object directly.
        # But in async, we can't easily wait for 'pages' property if it was a property.
        # Actually context.pages is a property list, so it's sync access for the list object,
        # but the page object methods are async.
        session = self._ensure_session(session_id)
        context = session.get("context")
        
        # If context is available, try to get the last page (popup/new tab)
        if context and context.pages:
            target_page = context.pages[-1]
            try:
                # bring_to_front is async
                # We can't await here if this is sync.
                # So we should make _get_active_page async or just return the page.
                pass 
            except:
                pass
            return target_page
            
        return session["page"]

    async def _bring_to_front(self, page: Page):
        try:
            await page.bring_to_front()
        except:
            pass

    async def perform_action(self, session_id: str, action_type: str, selector: str = None, value: str = None) -> Dict[str, Any]:
        """
        Executes an action on the active page.
        """
        return await self._run_in_bg(self._perform_action_impl(session_id, action_type, selector, value))

    async def _perform_action_impl(self, session_id: str, action_type: str, selector: str = None, value: str = None) -> Dict[str, Any]:
        page = self._get_active_page(session_id)
        await self._bring_to_front(page)
        
        try:
            if action_type == "click":
                # Fallback to loose matching if strict selector fails
                try:
                    await page.click(selector, timeout=3000)
                except:
                    # Try finding by text if selector looks like text
                    if not selector.startswith((".", "#", "//")):
                         await page.get_by_text(selector).first.click(timeout=3000)
                    else:
                        raise

            elif action_type == "type":
                 await page.fill(selector, value)

            elif action_type == "scroll":
                await page.evaluate("window.scrollBy(0, 500)")

            elif action_type == "wait":
                 await page.wait_for_timeout(2000)
                 
            elif action_type == "navigate":
                 await page.goto(value)
                 
            # Wait a bit for UI update
            await page.wait_for_timeout(1000)

        except Exception as e:
             return {"error": str(e), **await self._get_state_impl(session_id)}

        return await self._get_state_impl(session_id)

    async def get_state(self, session_id: str) -> Dict[str, Any]:
        """
        Returns the current state (Title, URL, Clean HTML, Screenshot).
        """
        return await self._run_in_bg(self._get_state_impl(session_id))

    async def _get_state_impl(self, session_id: str) -> Dict[str, Any]:
        page = self._get_active_page(session_id)
        await self._bring_to_front(page)
        
        # Screenshot
        try:
            screenshot_bytes = await page.screenshot(type='jpeg', quality=60)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
        except:
            screenshot_b64 = ""

        # DOM
        try:
            content = await page.content()
            clean_html = self._clean_dom(content)
        except:
            clean_html = "<html>Error capturing DOM</html>"

        return {
            "title": await page.title(),
            "url": page.url,
            "html_structure": clean_html,
            "screenshot": screenshot_b64
        }

    async def close_session(self, session_id: str):
        if self._bg_thread and self._bg_thread.is_alive():
            await self._run_in_bg(self._close_session_impl(session_id))

    async def _close_session_impl(self, session_id: str):
        if session_id in self._sessions:
            session = self._sessions[session_id]
            try:
                await session["browser"].close()
                await session["playwright"].stop()
            except Exception as e:
                # Browser might be already closed or process dead
                print(f"Warning during session close: {e}")
            finally:
                del self._sessions[session_id]

    async def crawl(self, url: str) -> Dict[str, Any]:
        """
        One-off crawl (Async).
        Starts a session, gets state, and closes it immediately.
        """
        import uuid
        session_id = f"crawl-{uuid.uuid4()}"
        try:
             state = await self.start_session(session_id, url)
             return state
        finally:
             await self.close_session(session_id)
