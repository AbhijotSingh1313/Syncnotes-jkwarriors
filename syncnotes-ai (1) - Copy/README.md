<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env` file in the project root and add your key:
   ```
   VITE_API_KEY=your_gemini_api_key_here
   ```
   After updating the `.env` file, restart the dev server if it's running.

   **Security note:** Placing the API key in a client-side env exposes it to anyone who can inspect your bundled code. For production, prefer a server-side proxy that keeps the key secret.
3. Run the app:
   `npm run dev`
