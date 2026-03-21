"""
OpenClaw Ecosystem Integration for Limitless Fitness

This file acts as a secure bridge between your Fuaak backend and the OpenClaw AI Gateway.
By keeping this separate, we ensure OpenClaw never needs raw system shell access to read/write 
your database or run analytics directly.
"""
import json
import subprocess

def process_workout_logs(logs_dict):
    """
    Safe wrapper to execute the local analytics.py using OpenClaw hooks.
    This can be registered as an OpenClaw tool using the `openclaw_ai` SDK.
    
    Args:
        logs_dict (list): List of dictionary objects containing workout logs.
    """
    try:
        logs_json = json.dumps(logs_dict)
        # We explicitly isolated this call so OpenClaw runs this wrapper rather than
        # arbitrary shell commands.
        process = subprocess.Popen(
            ['python', 'analytics.py'], 
            stdin=subprocess.PIPE, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(input=logs_json)
        if stderr:
            return {"success": False, "error": stderr}
        return json.loads(stdout)
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    print("Fuaak OpenClaw Ecosystem Wrapper is ready.")
    print("For full integration, you can install the SDK (pip install openclaw_ai) and register these tools!")
