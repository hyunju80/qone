import pytest
import re
from playwright.sync_api import Page, expect

def test_gnb_navigation_benefit_brand(page: Page):
    """
    Test Case: GNB '혜택 브랜드' 메뉴 이동
    Description: 메인 페이지 접속 후 GNB 영역의 '혜택 브랜드' 메뉴를 클릭하여 
                 해당 페이지로 정상 이동하는지 검증합니다.
    """
    try:
        # 1. Base URL 접속
        page.goto("https://sktmembership.tworld.co.kr/")
        
        print(f"DEBUG: Page Title: {page.title()}")
        print(f"DEBUG: Current URL: {page.url}")

        # 2. 메인 페이지 로드 확인
        expect(page).to_have_url(re.compile(r".*tworld\.co\.kr.*"))

        # 3. GNB '혜택 브랜드' 링크 클릭
        # Add a small wait to ensure hydration/rendering
        page.wait_for_timeout(2000)
        
        # Check if the element exists
        link = page.get_by_role("link", name="혜택 브랜드")
        if link.count() == 0:
             print("DEBUG: '혜택 브랜드' link NOT found by role.")
             print(f"DEBUG: Visible text: {page.locator('body').inner_text()[:500]}")
        else:
             print("DEBUG: Link found, clicking...")
             link.click()

        # 4. 이동 완료 검증
        expect(page).to_have_url(re.compile(r".*brand-benefit.*"))
        
    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="error_gnb.jpg")
        raise e
