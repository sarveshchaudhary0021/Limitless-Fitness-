import { voiceManager, INDIAN_LANGUAGES, GREETINGS } from './voice.js';

// ─────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────

let currentLang   = 'hi-IN';
let chatHistory   = [];
let isStreaming   = false;
let autoSpeak     = true;

// ─────────────────────────────────────────────────
// INIT — build language dropdown + greeting
// ─────────────────────────────────────────────────

function init() {
  const select = document.getElementById('lang-select');

  INDIAN_LANGUAGES.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = `${lang.label} — ${lang.name}`;
    if (lang.code === 'hi-IN') opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', (e) => changeLanguage(e.target.value));

  // Show greeting in default language
  appendMessage('bot', GREETINGS['hi-IN']);

  // Keyboard shortcut: Enter to send
  document.getElementById('text-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
}

// ─────────────────────────────────────────────────
// CHANGE LANGUAGE
// ─────────────────────────────────────────────────

function changeLanguage(langCode) {
  currentLang = langCode;
  voiceManager.setLanguage(langCode);
  chatHistory = []; // reset context on language change

  const placeholders = {
    'hi-IN': 'हिंदी में पूछें या माइक दबाएँ...',
    'bn-IN': 'বাংলায় জিজ্ঞেস করুন বা মাইক চাপুন...',
    'te-IN': 'తెలుగులో అడగండి లేదా మైక్ నొక్కండి...',
    'ta-IN': 'தமிழில் கேளுங்கள் அல்லது மைக் அழுத்துங்கள்...',
    'mr-IN': 'मराठीत विचारा किंवा माइक दाबा...',
    'gu-IN': 'ગુજરાતીમાં પૂછો અથવા માઇક દબાવો...',
    'kn-IN': 'ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ...',
    'ml-IN': 'മലയാളത്തിൽ ചോദിക്കൂ അല്ലെങ്കിൽ മൈക്ക് അമർത്തൂ...',
    'pa-IN': 'ਪੰਜਾਬੀ ਵਿੱਚ ਪੁੱਛੋ ਜਾਂ ਮਾਈਕ ਦਬਾਓ...',
    'or-IN': 'ଓଡ଼ିଆରେ ପଚାରନ୍ତୁ କିମ୍ବା ମାଇକ ଦବାନ୍ତୁ...',
    'ur-IN': 'اردو میں پوچھیں یا مائیک دبائیں...',
    'as-IN': 'অসমীয়াত সোধক বা মাইক টিপক...',
    'en-IN': 'Ask in English or press mic...',
  };

  document.getElementById('text-input').placeholder =
    placeholders[langCode] || placeholders['en-IN'];

  appendMessage('bot', GREETINGS[langCode] || GREETINGS['en-IN']);
}

// ─────────────────────────────────────────────────
// SEND MESSAGE TO AI
// ─────────────────────────────────────────────────

async function sendMessage() {
  if (isStreaming) return;

  const input = document.getElementById('text-input');
  const msg   = input.value.trim();
  if (!msg) return;

  input.value = '';
  voiceManager.stopSpeaking();

  appendMessage('user', msg);
  const botBubble = appendMessage('bot', '', true); // blank with loader
  isStreaming = true;
  setInputState(false);

  let fullResponse = '';

  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        language: currentLang,
        chatHistory: chatHistory.slice(-8),
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') break;
        try {
          const { token } = JSON.parse(raw);
          if (token) {
            fullResponse += token;
            botBubble.querySelector('.msg-text').textContent = fullResponse;
            scrollToBottom();
          }
        } catch {}
      }
    }

    // Save to chat history
    chatHistory.push({ role: 'user',      content: msg          });
    chatHistory.push({ role: 'assistant', content: fullResponse });

    // Auto-speak response
    if (autoSpeak && fullResponse) {
      voiceManager.speak(fullResponse, currentLang);
    }

  } catch (err) {
    botBubble.querySelector('.msg-text').textContent =
      'Something went wrong. Please try again.';
    console.error(err);
  } finally {
    isStreaming = false;
    setInputState(true);
    botBubble.querySelector('.loader')?.remove();
  }
}

// ─────────────────────────────────────────────────
// VOICE INPUT — MIC BUTTON
// ─────────────────────────────────────────────────

function toggleMic() {
  const micBtn = document.getElementById('mic-btn');

  if (voiceManager.isListening) {
    voiceManager.stopListening();
    micBtn.classList.remove('active');
    return;
  }

  voiceManager.stopSpeaking();

  voiceManager.startListening({
    onInterim: (text) => {
      document.getElementById('text-input').value = text;
    },
    onFinal: (text) => {
      document.getElementById('text-input').value = text;
      micBtn.classList.remove('active');
      sendMessage();
    },
    onError: (err) => {
      micBtn.classList.remove('active');
      console.warn('Voice error:', err);
    },
    onEnd: () => {
      micBtn.classList.remove('active');
    },
  });

  micBtn.classList.add('active');
}

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────

function appendMessage(role, text, showLoader = false) {
  const wrap = document.getElementById('messages');
  const div  = document.createElement('div');
  div.className = `msg ${role}`;

  if (role === 'bot') {
    div.innerHTML = `
      <div class="avatar">F</div>
      <div class="bubble">
        <span class="msg-text">${text}</span>
        ${showLoader ? '<span class="loader"></span>' : ''}
        ${!showLoader ? `<button class="speak-btn" title="Read aloud">🔊</button>` : ''}
      </div>`;

    if (!showLoader) {
      div.querySelector('.speak-btn').onclick = () => {
        voiceManager.speak(text, currentLang);
      };
    }
  } else {
    div.innerHTML = `<div class="bubble user-bubble"><span class="msg-text">${text}</span></div>`;
  }

  wrap.appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  const wrap = document.getElementById('messages');
  wrap.scrollTop = wrap.scrollHeight;
}

function setInputState(enabled) {
  document.getElementById('text-input').disabled = !enabled;
  document.getElementById('send-btn').disabled   = !enabled;
}

function toggleAutoSpeak() {
  autoSpeak = !autoSpeak;
  const btn = document.getElementById('autospeak-btn');
  btn.textContent = autoSpeak ? '🔊' : '🔇';
  btn.title = autoSpeak ? 'Auto-speak ON' : 'Auto-speak OFF';
}

// Expose to HTML onclick
window.sendMessage   = sendMessage;
window.toggleMic     = toggleMic;
window.toggleAutoSpeak = toggleAutoSpeak;

document.addEventListener('DOMContentLoaded', init);
