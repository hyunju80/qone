<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1bDZn4rx3N6wtgcGYu_91t-MHmlD6gENR

## Run Locally

**Prerequisites:**  Node.js


### Backend (Windows)
1. Install dependencies:
   `pip install -r backend/requirements.txt`
2. Run the server (must use run.py for Playwright support):
   `cd backend && python run.py`

### Frontend
1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
