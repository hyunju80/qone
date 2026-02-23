# Fix Customer Hub Workspace Display

- [x] Investigate `App.tsx` project data flow to `CustomerHub` <!-- id: 0 -->
- [x] Verify `CustomerHub` "Intelligence" modal workspace filtering logic <!-- id: 1 -->
- [x] Verify `WorkspaceSelection` filtering logic (when accessed from Customer Hub) <!-- id: 2 -->
- [x] Ensure `projects` state contains all necessary projects for Super Admin <!-- id: 3 -->
- [x] Fix "Manage Workspace" not showing data (Fixed by mapping API response) <!-- id: 4 -->
- [x] Fix "Intelligence" modal not showing data (Fixed by mapping API response) <!-- id: 5 -->

# Gemini AI Integration

- [ ] Add `google-generativeai` to backend requirements <!-- id: 6 -->
- [ ] Create Backend AI Schemas and Endpoints <!-- id: 7 -->
- [ ] Implement Server-Side Tool Logic (Schedules, Scripts, etc.) <!-- id: 8 -->
- [ ] Update Frontend `MainConsole.tsx` to use Backend API <!-- id: 9 -->
- [ ] Verify Chat and Tool Execution <!-- id: 10 -->
- [x] Refactor Gemini Model Config to `core/config.py` <!-- id: 11 -->

# Browsing-based Scenario Generator

- [x] Add `playwright` and `beautifulsoup4` dependencies <!-- id: 12 -->
- [x] Create `CrawlerService` (headless=False) <!-- id: 13 -->
- [x] Create `/scenarios/analyze-url` Endpoint <!-- id: 14 -->
- [x] Update `ScenarioGenerator.tsx` to use new Endpoint <!-- id: 15 -->
- [x] Implement Backend Persistence (Save Screenshot/DOM/JSON to logs) <!-- id: 16 -->
- [x] Implement Frontend Stop/Abort logic <!-- id: 17 -->
