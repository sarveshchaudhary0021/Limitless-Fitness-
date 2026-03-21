---
description: Fuaak OpenClaw AI Voice Pipeline Infrastructure
---
# AI Assistant End-To-End Workflow

The Fuaak AI Coach utilizes a highly optimized cross-platform orchestration pipeline integrating a NodeJS server layer, Python AI execution context, and robust Frontend Vanilla JS browser nodes natively executing SpeechSynthesis and NLP hooks.

## Process Flow Diagram

1. **User Initiation (Browser)**
   - The user expands the chatbot widget (`ai-coach.js`) on *any* webpage within the directory ecosystem.
   - The user explicitly chooses between **Text Input** or **Voice Dictation**:
      - *Text Input*: Types into the field and submits explicitly without enabling continuous auditory context.
      - *Voice Input*: Clicks the Microphone icon, triggering native Google/Edge `webkitSpeechRecognition`. Audio is instantly captured and decoded into a string upon silence. *(`isVoiceInitiated` boolean flags to `True`)*

2. **Network Layer (ExpressJS API Hub)**
   - The finalized query string routes to `POST http://localhost:5000/api/chat`.
   - `server.js` captures the payload string, sanitizes it, and spawns a native backend child-process bound specifically mapped to the Python execution module (`fuaak_agent.py`) rather than the restrictive `npx openclaw` engine.

3. **Cognitive Computing (Python & Groq API)**
   - `fuaak_agent.py` evaluates the `sys.argv[1]` string payload.
   - Using the custom-built `openclaw_tools.py`, it executes backend keyword analytics on the query (e.g. checking recent "workout" database sets or analytics algorithms to provide deep Limitless Fitness personalization constraints).
   - Generates an intensive Fuaak branded `system_prompt` mapped accurately stringing regional constraint checks to intercept Indian Languages strictly dynamically based on input inference (`Hindi`, `Marathi`, `Tamil`, etc).
   - Secures a Lightning Fast REST push to the **Groq Gateway** (`llama-3.3-70b-versatile`) bypassing intensive local memory loads and outputting the absolute AI translation and calculation inside an ASCII standard `JSON` envelope locally to stdout.

4. **Response Parsing & Callback**
   - The Node container listens actively to standard out buffer closures, scraping strictly using regex mappings (`/\{[\s\S]*"success"[\s\S]*"reply"[\s\S]*\}/`) to ignore intermediate python OS logs and extracting the clean reply JSON.
   - Transmits HTTP 200 payload directly back to the `ai-coach.js` instance residing on the client active window via promise resolution. 

5. **Audio Speech Resolution Contexts**
   - Text pushes to the GUI natively as a grey bubble mapping to `#fff` CSS.
   - The UI evaluates the original payload Boolean:
     - **If Text**: End of sequence.
     - **If Voice**: Automatically pulls natively resolved `window.speechSynthesis` nodes (e.g. *Zira / David OS voice packs*). 
   - Generates spoken audio. Upon audio playback completion (`utterThis.onend`), the script conditionally *re-opens* the user's `webkitSpeechRecognition` logic seamlessly bouncing the user loop directly back to Step 1 without manual interaction!
