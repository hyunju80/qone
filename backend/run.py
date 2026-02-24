
import sys
import uvicorn
import asyncio

if __name__ == "__main__":
    if sys.platform == 'win32':
        # Force the ProactorEventLoop policy for Windows/Playwright support
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        print("Enforced WindowsProactorEventLoopPolicy")

    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
