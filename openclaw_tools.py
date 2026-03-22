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
        process = subprocess.Popen(
            ['python', 'analytics.py'], 
            stdin=subprocess.PIPE, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        try:
            stdout, stderr = process.communicate(input=logs_json, timeout=10)  # 10s hard limit
        except subprocess.TimeoutExpired:
            process.kill()
            return {"success": False, "error": "Analytics process timed out after 10 seconds."}
        if process.returncode != 0 or stderr:
            return {"success": False, "error": stderr or "Analytics script exited with error."}
        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            return {"success": False, "error": f"Non-JSON output from analytics: {stdout[:200]}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    print("Fuaak OpenClaw Ecosystem Wrapper is ready.")
    print("For full integration, you can install the SDK (pip install openclaw_ai) and register these tools!")
