/* USC Assistant client bridge.
 * Load this script after index.html's main inline application script.
 * It uses the existing Supabase client (`sb`) and chat helpers (`aiAdd`, `aiBot`).
 */
(function () {
  'use strict';

  const conversation = [];
  const prompts = [
    'Explain photosynthesis',
    'Help me write a study plan',
    'How do I reset my portal password?',
    'Tell me a fun fact'
  ];

  function renderPrompts() {
    const container = document.getElementById('aiChips');
    if (!container) return;
    container.replaceChildren();
    prompts.forEach((prompt) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = prompt;
      button.addEventListener('click', () => {
        const input = document.getElementById('aiInput');
        if (!input) return;
        input.value = prompt;
        window.aiSend();
      });
      container.appendChild(button);
    });
  }

  window.toggleAI = function toggleAI() {
    const box = document.getElementById('aiBox');
    const input = document.getElementById('aiInput');
    const messages = document.getElementById('aiMsgs');
    if (!box || !input || !messages) return;

    box.classList.toggle('open');
    if (!box.classList.contains('open')) return;

    if (!messages.children.length) {
      window.aiBot('Hello! I am the USC Assistant. Ask me a general question or request help with the student portal.');
    }
    renderPrompts();
    input.placeholder = 'Ask me anything...';
    input.focus();
  };

  window.aiSend = async function aiSend() {
    const input = document.getElementById('aiInput');
    if (!input) return;
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    window.aiAdd('me', window.esc(question));
    const typing = window.aiAdd('bot', '<span class="dots"><span></span><span></span><span></span></span>');
    conversation.push({ role: 'user', content: question });

    const button = document.querySelector('.aiIn button');
    if (button) button.disabled = true;

    try {
      if (typeof sb === 'undefined' || !sb) throw new Error('Supabase client unavailable');
      const { data, error } = await sb.functions.invoke('ai-chat', {
        body: { messages: conversation.slice(-12) }
      });
      if (error) throw error;
      if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error('Invalid assistant response');
      }

      typing.remove();
      conversation.push({ role: 'assistant', content: data.answer });
      window.aiBot(data.answer);
    } catch (error) {
      typing.remove();
      conversation.pop();
      console.error('USC Assistant request failed:', error);
      window.aiBot('Sorry, I could not reach the AI service. Please try again in a moment.');
    } finally {
      if (button) button.disabled = false;
      input.focus();
    }
  };

  window.aiAsk = function aiAsk(prompt) {
    const input = document.getElementById('aiInput');
    if (!input) return;
    input.value = prompt;
    window.aiSend();
  };

  const input = document.getElementById('aiInput');
  if (input) input.placeholder = 'Ask me anything...';
})();
