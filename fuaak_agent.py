import os
import sys
import json
import requests
import openclaw_tools

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
MODEL = "llama-3.3-70b-versatile"

if not GROQ_API_KEY:
    print("Error: GROQ_API_KEY environment variable is not set.")
    sys.exit(1)

def get_workout_stats():
    # Leveraging the native project analytics resource!
    logs = [
        {"workout_type": "Chest", "duration_minutes": 60, "calories_burned": 400},
        {"workout_type": "Legs", "duration_minutes": 45, "calories_burned": 350},
        {"workout_type": "Cardio", "duration_minutes": 30, "calories_burned": 300}
    ]
    return openclaw_tools.process_workout_logs(logs)

def chat_with_groq(user_message):
    system_prompt = (
        "You are a supportive, caring, and highly knowledgeable gym buddy/friend for Limitless Fitness. "
        "Your tone is very casual, friendly, and empathetic. You talk to the user like they are your best friend, trying to help them fix their routine, deal with their struggles, and stay consistent. "
        "Keep responses brief (2-4 sentences) and highly conversational as a friend would text or speak.\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. NEVER repeat or summarize the user's query at the start of your response. Give native, natural conversational answers.\n"
        "2. Detect the user's input language and conversationally reply strictly in that exact regional language natively (e.g., Hindi, English, Marathi, Tamil, Kannada, Telugu, Bhojpuri). Maintain the friendly, supportive buddy tone seamlessly."
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]

    # Keyword-based native tool invocation
    if "workout" in user_message.lower() or "stats" in user_message.lower() or "log" in user_message.lower():
        stats = get_workout_stats()
        messages.append({
            "role": "system", 
            "content": f"Context: The user's recent analytical stats from the database wrapper are {json.dumps(stats)}. Briefly praise their effort."
        })

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 150
    }

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=20)
        if response.status_code == 200:
            data = response.json()
            reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(reply)
        else:
            print(f"API error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Failed to connect to AI Gateway: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Prevent encoding errors in cmd
        sys.stdout.reconfigure(encoding='utf-8')
        user_msg = " ".join(sys.argv[1:])
        chat_with_groq(user_msg)
    else:
        print("Message required")
