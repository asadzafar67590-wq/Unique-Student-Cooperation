// USC general-purpose AI assistant. Set OPENAI_API_KEY and APP_ORIGIN as Edge Function secrets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const appOrigin = Deno.env.get('APP_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in to use the assistant.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !openAiKey) {
    console.error('Missing required Edge Function configuration.');
    return json({ error: 'Assistant is not configured yet. Please contact the administrator.' }, 503);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Your session is invalid or expired. Please sign in again.' }, 401);

  let payload: { messages?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Request must contain valid JSON.' }, 400);
  }

  if (!Array.isArray(payload.messages) || payload.messages.length < 1 || payload.messages.length > 20) {
    return json({ error: 'Send between 1 and 20 recent messages.' }, 400);
  }

  const messages = payload.messages.map((message: unknown) => {
    if (!message || typeof message !== 'object') return null;
    const item = message as { role?: unknown; content?: unknown };
    if (!['user', 'assistant'].includes(String(item.role))) return null;
    if (typeof item.content !== 'string' || item.content.trim().length === 0 || item.content.length > 4000) return null;
    return { role: item.role as 'user' | 'assistant', content: item.content.trim() };
  });
  if (messages.some((message) => message === null)) {
    return json({ error: 'Each message needs a user/assistant role and 1–4000 characters of text.' }, 400);
  }

  const systemPrompt = `You are USC Assistant for the Unique Student Cooperation student portal. Be helpful, capable, friendly, and clear. Answer general questions across topics as well as student-portal questions. Reply in the language the user uses, including Urdu, Roman Urdu, or English. Give practical steps and explain concepts simply. For USC-specific schedules, fees, grades, policies, or account records that are not provided in the conversation, do not invent facts; say you cannot see that information and direct the student to the relevant portal section or administrator. Never claim to have accessed student records. Do not request passwords, one-time codes, or sensitive personal data. For emergencies or professional medical/legal/financial matters, give general information and encourage contacting an appropriate professional. Keep answers concise unless detail is requested.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.6,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      console.error('AI provider returned status', response.status);
      return json({ error: 'The assistant could not answer right now. Please try again shortly.' }, 502);
    }
    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
      return json({ error: 'The assistant returned an empty response. Please try again.' }, 502);
    }
    return json({ answer: answer.trim() });
  } catch (error) {
    console.error('AI request failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Could not reach the assistant. Check your connection and try again.' }, 502);
  }
});
