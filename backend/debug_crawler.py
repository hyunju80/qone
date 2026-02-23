import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.crawler import CrawlerService

async def test_crawl():
    print("Starting crawl test...")
    crawler = CrawlerService()
    try:
        result = await crawler.crawl("https://example.com")
        print("Crawl Successful!")
        print(f"Title: {result['title']}")
        print(f"Screenshot size: {len(result['screenshot'])}")
    except Exception as e:
        print(f"CRAWL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_crawl())
