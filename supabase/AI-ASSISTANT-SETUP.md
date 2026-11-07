# USC Assistant client integration

The `ai-chat` Supabase Edge Function is deployed separately. To make the website chat use it, load the client bridge after the main inline app script in `index.html` and before `</body>`:

```html
<script src="ai-assistant.js"></script>
```

This bridge replaces the browser's keyword-only `aiSend`, sets English welcome text and prompt chips, sends only the latest 12 chat turns to the `ai-chat` Edge Function, and displays its English response. It relies on the existing globally accessible `sb`, `esc`, `aiAdd`, and `aiBot` helpers.

Do not put the OpenAI API key in this file. Keep it in Supabase Edge Function Secrets as `OPENAI_API_KEY`. After adding the script tag, commit the change and allow GitHub Pages to redeploy. Then test a general question; inspect Supabase Edge Function logs if it fails.
