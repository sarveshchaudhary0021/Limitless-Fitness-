(function() {
    const htmlObj = `
<style>
/* ── Chatbot Widget ───────────────────────────── */
.chatbot-widget { position: fixed; bottom: 30px; right: 30px; z-index: 9999; font-family: "Inter", sans-serif; }
.chatbot-bubble { width: 60px; height: 60px; border-radius: 50%; background: #E8FF47; color: #0A0A0B; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 32px rgba(232,255,71,0.25); cursor: pointer; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.chatbot-bubble:hover { transform: scale(1.1); }
.chat-icon { width: 28px; height: 28px; }
.chatbot-window { position: absolute; bottom: 80px; right: 0; width: 350px; height: 500px; background: rgba(15, 15, 18, 0.85); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,0.6); opacity: 0; pointer-events: none; transform: translateY(20px) scale(0.95); transform-origin: bottom right; transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1); overflow: hidden; }
.chatbot-window.open { opacity: 1; pointer-events: all; transform: translateY(0) scale(1); }
.chatbot-header { padding: 16px 20px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
.chatbot-title { font-weight: 700; font-size: 15px; color: #fff; }
.chatbot-close { background: none; border: none; color: #888; font-size: 24px; cursor: pointer; line-height: 1; padding: 0; transition: color 0.2s; }
.chatbot-close:hover { color: #E8FF47; }
.chatbot-messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.chatbot-messages::-webkit-scrollbar { width: 4px; }
.chatbot-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
.chat-msg { max-width: 85%; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; line-height: 1.5; word-wrap: break-word; }
.ai-msg { background: rgba(255,255,255,0.05); color: #fff; align-self: flex-start; border-bottom-left-radius: 4px; }
.user-msg { background: #E8FF47; color: #0A0A0B; align-self: flex-end; border-bottom-right-radius: 4px; font-weight: 500; }
.chatbot-input-area { padding: 16px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 8px; background: rgba(0,0,0,0.2); }
.chatbot-input-area input { flex: 1; background: transparent; border: none; color: #fff; font-size: 14px; padding: 8px 0; outline: none; }
.chatbot-input-area input::placeholder { color: #888; }
.chat-send-btn { background: #E8FF47; color: #0A0A0B; border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: transform 0.2s; flex-shrink: 0; }
.chat-send-btn:hover { transform: scale(1.05); }
.chat-send-btn svg { width: 16px; height: 16px; margin-left: -2px; }
.chat-loading { align-self: flex-start; color: #888; font-size: 12px; font-style: italic; margin-left: 4px;}
@media (max-width: 500px) { .chatbot-window { width: calc(100vw - 40px); bottom: 100px; right: auto; left: 20px; } .chatbot-bubble { bottom: 20px; right: 20px; } }
</style>
<div id="chatbot-widget" class="chatbot-widget">
   <div class="chatbot-bubble" onclick="window.toggleChat()" aria-label="Open AI Assistant">
       <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
   </div>
   <div class="chatbot-window" id="chatbot-window">
       <div class="chatbot-header">
           <div class="chatbot-title">OpenClaw AI Coach</div>
           <select id="voice-choice" aria-label="Voice Select" style="background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; font-size:12px; margin-right:8px; cursor:pointer; outline:none;">
               <option value="male" style="background:#1a1a1a; color:#fff;">Male Voice</option>
               <option value="female" style="background:#1a1a1a; color:#fff;">Female Voice</option>
           </select>
           <button class="chatbot-close" onclick="window.toggleChat()" aria-label="Close chat">×</button>
       </div>
       <div class="chatbot-messages" id="chatbot-messages">
           <div class="chat-msg ai-msg">Hi! I'm your Limitless Fitness AI Coach. How can I help you today?</div>
       </div>
       <div class="chatbot-input-area">
           <input type="text" id="chat-input" placeholder="Type a message..." onkeypress="window.handleChatEnter(event)">
           <button class="chat-mic-btn" id="chat-mic-btn" onclick="window.toggleVoice()" aria-label="Voice input" style="background:transparent; border:none; color:#888; cursor:pointer; padding:6px; transition:color 0.2s;">
               <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
           </button>
           <button class="chat-send-btn" onclick="window.sendChatMessage(false)" aria-label="Send message">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
           </button>
       </div>
   </div>
</div>
`;
    // Inject the HTML into the DOM
    document.body.insertAdjacentHTML('beforeend', htmlObj);

    window.synth = window.speechSynthesis;
    window.voices = [];
    window.populateVoiceList = function() { window.voices = window.synth.getVoices(); };
    window.populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = window.populateVoiceList;
    }

    window.speakText = function(text) {
      if (window.synth.speaking) { window.synth.cancel(); }
      if (text !== '') {
        const utterThis = new SpeechSynthesisUtterance(text);
        
        // Dynamically detect if the AI responded in Hindi (Devanagari script)
        const isHindi = /[\u0900-\u097F]/.test(text);
        utterThis.lang = isHindi ? 'hi-IN' : 'en-IN'; // Force the browser's native fluent phonetic dictionary

        const selectedVoiceGender = document.getElementById('voice-choice').value;
        let selectedVoice = null;
        
        // Filter the browser's global voices to match our strict language target
        const targetVoices = window.voices.filter(v => v.lang === utterThis.lang || v.lang.startsWith(isHindi ? 'hi' : 'en'));
        
        if (selectedVoiceGender === 'female') {
            selectedVoice = targetVoices.find(v => v.name.includes('Google हिन्दी') || v.name.includes('Lekha') || v.name.includes('Kalpana') || v.name.includes('Aditi') || v.name.toLowerCase().includes('female')) 
                         || targetVoices[0];
        } else {
            selectedVoice = targetVoices.find(v => v.name.includes('Hemant') || v.name.includes('Ravi') || v.name.toLowerCase().includes('male'))
                         || targetVoices.find(v => !v.name.includes('Female') && !v.name.includes('Kalpana') && !v.name.includes('Lekha'))
                         || targetVoices[0];
        }
        
        if (selectedVoice) { utterThis.voice = selectedVoice; }
        utterThis.pitch = 1.0;
        utterThis.rate = 0.90; // Slower, hyper-fluent, easy-to-understand pace
        utterThis.onstart = () => { window.isAiSpeaking = true; };
        utterThis.onend = () => { 
            window.isAiSpeaking = false; 
            if(window.isVoiceModeActive && window.recognition) { 
                setTimeout(() => {
                    try { 
                        window.recognition.start(); 
                        document.getElementById('chat-mic-btn').classList.add('recording'); 
                        document.getElementById('chat-mic-btn').style.color = '#F09595'; 
                    } catch(e){} 
                }, 500);
            }
        };
        window.synth.speak(utterThis);
      }
    };

    window.recognition = null;
    window.isVoiceModeActive = false;
    window.isAiSpeaking = false;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      window.recognition = new SpeechRecognition();
      window.recognition.continuous = false;
      window.recognition.interimResults = false;
      window.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('chat-input').value = transcript;
        window.sendChatMessage(true); // Flag this sequence as Voice-Initiated
      };
      window.recognition.onend = () => {
        if (!window.isVoiceModeActive && !window.isAiSpeaking) {
            const micBtn = document.getElementById('chat-mic-btn');
            if (micBtn) { micBtn.classList.remove('recording'); micBtn.style.color = '#888'; }
        }
      };
    }

    window.toggleVoice = function() {
      if (!window.recognition) return alert('Your browser does not support voice recognition. Try Chrome or Edge!');
      const micBtn = document.getElementById('chat-mic-btn');
      window.isVoiceModeActive = !window.isVoiceModeActive;
      if (!window.isVoiceModeActive) {
        window.recognition.stop();
        if(window.synth.speaking) window.synth.cancel();
        micBtn.classList.remove('recording');
        micBtn.style.color = '#888';
      } else {
        try { window.recognition.start(); } catch(e){}
        micBtn.classList.add('recording');
        micBtn.style.color = '#F09595'; // Red active state
      }
    };

    window.toggleChat = function() {
      document.getElementById('chatbot-window').classList.toggle('open');
      if (document.getElementById('chatbot-window').classList.contains('open')) {
          document.getElementById('chat-input').focus();
      }
    };

    window.handleChatEnter = function(e) {
      if (e.key === 'Enter') window.sendChatMessage(false);
    };

    window.sendChatMessage = async function(isVoiceInitiated = false) {
      const inputEl = document.getElementById('chat-input');
      const text = inputEl.value.trim();
      if (!text) return;
      const messagesDiv = document.getElementById('chatbot-messages');
      const userDiv = document.createElement('div');
      userDiv.className = 'chat-msg user-msg';
      userDiv.textContent = text;
      messagesDiv.appendChild(userDiv);
      inputEl.value = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'chat-loading';
      loadingDiv.textContent = 'Typing...';
      messagesDiv.appendChild(loadingDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      try {
        const res = await fetch('http://localhost:5000/api/chat', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        loadingDiv.remove();
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-msg ai-msg';
        const replyText = data.reply || data.error || 'Connection error';
        aiDiv.textContent = replyText;
        messagesDiv.appendChild(aiDiv);
        
        // Only trigger Audio Synthesis if the user utilized the microphone!
        if (isVoiceInitiated) {
            window.speakText(replyText);
        }
      } catch (err) {
        loadingDiv.remove();
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-msg ai-msg';
        aiDiv.textContent = 'Error connecting to the AI Coach.';
        aiDiv.style.color = '#F09595';
        messagesDiv.appendChild(aiDiv);
      }
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };

})();
