// ─────────────────────────────────────────────────
// ALL 13 MAJOR INDIAN LANGUAGES
// ─────────────────────────────────────────────────

export const INDIAN_LANGUAGES = [
  { code: 'hi-IN', label: 'हिन्दी',    name: 'Hindi'     },
  { code: 'bn-IN', label: 'বাংলা',     name: 'Bengali'   },
  { code: 'te-IN', label: 'తెలుగు',    name: 'Telugu'    },
  { code: 'ta-IN', label: 'தமிழ்',     name: 'Tamil'     },
  { code: 'mr-IN', label: 'मराठी',     name: 'Marathi'   },
  { code: 'gu-IN', label: 'ગુજરાતી',   name: 'Gujarati'  },
  { code: 'kn-IN', label: 'ಕನ್ನಡ',     name: 'Kannada'   },
  { code: 'ml-IN', label: 'മലയാളം',    name: 'Malayalam' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ',    name: 'Punjabi'   },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ',     name: 'Odia'      },
  { code: 'ur-IN', label: 'اردو',      name: 'Urdu'      },
  { code: 'as-IN', label: 'অসমীয়া',   name: 'Assamese'  },
  { code: 'en-IN', label: 'English',   name: 'English'   },
];

// ─────────────────────────────────────────────────
// GREETING MESSAGES PER LANGUAGE
// ─────────────────────────────────────────────────

export const GREETINGS = {
  'hi-IN': 'नमस्ते! मैं आपका FitBot कोच हूँ। वर्कआउट, डाइट या फिटनेस के बारे में पूछें! 💪',
  'bn-IN': 'নমস্কার! আমি আপনার FitBot কোচ। ওয়ার্কআউট, ডায়েট বা ফিটনেস সম্পর্কে জিজ্ঞেস করুন! 💪',
  'te-IN': 'నమస్కారం! నేను మీ FitBot కోచ్. వర్కౌట్, డైట్ లేదా ఫిట్నెస్ గురించి అడగండి! 💪',
  'ta-IN': 'வணக்கம்! நான் உங்கள் FitBot பயிற்சியாளர். வொர்க்அவுட், டயட் அல்லது ஃபிட்னஸ் பற்றி கேளுங்கள்! 💪',
  'mr-IN': 'नमस्कार! मी तुमचा FitBot कोच आहे. वर्कआउट, डाएट किंवा फिटनेसबद्दल विचारा! 💪',
  'gu-IN': 'નમસ્તે! હું તમારો FitBot કોચ છું. વર્કઆઉટ, ડાયેટ અથવા ફિટનેસ વિશે પૂછો! 💪',
  'kn-IN': 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ FitBot ಕೋಚ್. ವರ್ಕೌಟ್, ಡಯಟ್ ಅಥವಾ ಫಿಟ್ನೆಸ್ ಬಗ್ಗೆ ಕೇಳಿ! 💪',
  'ml-IN': 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ FitBot കോച്ചാണ്. വർക്കൗട്ട്, ഡയറ്റ് അല്ലെങ്കിൽ ഫിറ്റ്നസ് പറ്റി ചോദിക്കൂ! 💪',
  'pa-IN': 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ FitBot ਕੋਚ ਹਾਂ। ਵਰਕਆਊਟ, ਡਾਇਟ ਜਾਂ ਫਿਟਨੈਸ ਬਾਰੇ ਪੁੱਛੋ! 💪',
  'or-IN': 'ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କ FitBot କୋଚ୍। ୱାର୍କଆଉଟ୍, ଡାଏଟ୍ ବା ଫିଟ୍ନେସ୍ ବିଷୟରେ ପଚାରନ୍ତୁ! 💪',
  'ur-IN': 'السلام علیکم! میں آپکا FitBot کوچ ہوں۔ ورک آؤٹ، ڈائیٹ یا فٹنس کے بارے میں پوچھیں! 💪',
  'as-IN': 'নমস্কাৰ! মই আপোনাৰ FitBot কোচ। ৱৰ্কআউট, ডায়েট বা ফিটনেছ সম্পৰ্কে সোধক! 💪',
  'en-IN': 'Hello! I am your FitBot Coach. Ask me about workouts, diet or fitness! 💪',
};

// ─────────────────────────────────────────────────
// VOICE MANAGER CLASS
// ─────────────────────────────────────────────────

class VoiceManager {
  constructor() {
    this.currentLang   = 'hi-IN';
    this.recognition   = null;
    this.synthesis     = window.speechSynthesis;
    this.isListening   = false;
    this.isSpeaking    = false;
    this.voicesLoaded  = false;
    this._loadVoices();
  }

  _loadVoices() {
    // Voices load async in most browsers
    if (this.synthesis.getVoices().length) {
      this.voicesLoaded = true;
    } else {
      this.synthesis.addEventListener('voiceschanged', () => {
        this.voicesLoaded = true;
      });
    }
  }

  setLanguage(langCode) {
    this.currentLang = langCode;
  }

  // ── SPEECH TO TEXT ──────────────────────────────

  startListening({ onInterim, onFinal, onError, onEnd }) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onError('Voice input needs Chrome or Edge browser.');
      return;
    }

    this.recognition              = new SR();
    this.recognition.lang         = this.currentLang;
    this.recognition.continuous   = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => { this.isListening = true; };

    this.recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      const isFinal = e.results[e.results.length - 1].isFinal;
      if (isFinal) onFinal(transcript);
      else onInterim(transcript);
    };

    this.recognition.onerror = (e) => {
      this.isListening = false;
      onError(e.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    this.recognition.start();
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  // ── TEXT TO SPEECH ──────────────────────────────

  speak(text, langCode) {
    const lang = langCode || this.currentLang;
    this.synthesis.cancel(); // stop any ongoing speech

    // Break long text into shorter chunks for smoother playback
    const chunks = this._splitIntoChunks(text, 200);
    let index = 0;

    const speakNext = () => {
      if (index >= chunks.length) { this.isSpeaking = false; return; }

      const utt   = new SpeechSynthesisUtterance(chunks[index++]);
      utt.lang    = lang;
      utt.rate    = 0.88;   // slightly slower = clearer for Indian languages
      utt.pitch   = 1.05;
      utt.volume  = 1.0;

      // Find best matching voice
      const voices = this.synthesis.getVoices();
      const voice  =
        voices.find(v => v.lang === lang && v.localService) ||
        voices.find(v => v.lang === lang) ||
        voices.find(v => v.lang.startsWith(lang.split('-')[0])) ||
        voices.find(v => v.lang.startsWith('en'));

      if (voice) utt.voice = voice;
      utt.onend = speakNext;
      utt.onerror = speakNext; // skip chunk on error, continue

      this.isSpeaking = true;
      this.synthesis.speak(utt);
    };

    speakNext();
  }

  stopSpeaking() {
    this.synthesis.cancel();
    this.isSpeaking = false;
  }

  // Split text at sentence boundaries for smooth speech
  _splitIntoChunks(text, maxLen) {
    if (text.length <= maxLen) return [text];
    const sentences = text.match(/[^।.!?\n]+[।.!?\n]*/g) || [text];
    const chunks = [];
    let current = '';
    for (const s of sentences) {
      if ((current + s).length > maxLen && current) {
        chunks.push(current.trim());
        current = s;
      } else {
        current += s;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  getAvailableVoicesForLang(langCode) {
    return this.synthesis.getVoices().filter(
      v => v.lang === langCode || v.lang.startsWith(langCode.split('-')[0])
    );
  }
}

export const voiceManager = new VoiceManager();
