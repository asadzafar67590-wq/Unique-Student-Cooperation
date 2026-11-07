# USC Assistant: Supabase setup

The assistant Edge Function keeps the OpenAI API key on the server side. Never put the key in `index.html`, browser storage, or a chat message.

## 1. Configure secrets

In the Supabase dashboard for this project, open **Edge Functions → Secrets** and confirm:

- `OPENAI_API_KEY` — your OpenAI secret key
- `ALLOWED_ORIGINS` — optional; comma-separated website origins. If omitted, the function allows `https://asadzafar67590-wq.github.io`.

Origins contain only the scheme and hostname (no repository path). For local testing, add the local origin, such as `http://localhost:8000`, to `ALLOWED_ORIGINS` too.

## 2. Deploy the function

Install and sign in to the Supabase CLI, then from the repository root run:

```sh
supabase link --project-ref jcujgxteaflgbrlvieko
supabase functions deploy ai-chat
```

Keep JWT verification enabled. The Supabase browser client invokes the function with its project key. Do not add an OpenAI key to client-side code.

## 3. Connect the existing chat widget

The existing assistant is still a local keyword bot until its `aiSend()` implementation in `index.html` is replaced. The current Supabase client is named `sb`. Replace the existing `aiSend()` function with the following code, and change the input placeholder to `Ask me anything...`:

```js
const aiConversation = [];

async function aiSend(){
  const input = document.getElementById('aiInput');
  const question = input.value.trim();
  if (!question) return;

  input.value = '';
  aiAdd('me', esc(question));
  const typing = aiAdd('bot', '<span class="dots"><span></span><span></span><span></span></span>');

  aiConversation.push({ role: 'user', content: question });
  const sendButton = document.querySelector('.aiIn button');
  if (sendButton) sendButton.disabled = true;

  try {
    if (!sb) throw new Error('Supabase client is unavailable');
    const { data, error } = await sb.functions.invoke('ai-chat', {
      body: { messages: aiConversation.slice(-12) }
    });
    if (error) throw error;
    if (!data || typeof data.answer !== 'string') throw new Error('Invalid assistant response');

    typing.remove();
    aiConversation.push({ role: 'assistant', content: data.answer });
    aiBot(data.answer);
  } catch (error) {
    typing.remove();
    aiConversation.pop();
    console.error('USC Assistant request failed:', error);
    aiBot('Sorry, I could not reach the AI service. Please try again in a moment.');
  } finally {
    if (sendButton) sendButton.disabled = false;
    input.focus();
  }
}
```

For portal navigation, keep the existing keyword answers as an optional portal-specific layer, or add navigation actions after the AI response. Do not send student records or other private data to the model. The AI endpoint currently accepts only chat messages and responds in English.

## 4. Test

Deploy the function, open the GitHub Pages site, and ask a general question in the assistant. If it fails, check **Supabase → Edge Functions → ai-chat → Logs**. Confirm that the OpenAI account has API billing/credits enabled.
