"""
OpenClaw Ecosystem Integration for Limitless Fitness

This file acts as a secure bridge between your Fuaak backend and the OpenClaw AI Gateway.
By keeping this separate, we ensure OpenClaw never needs raw system shell access to read/write 
your database or run analytics directly.

Security notes:
- subprocess is called with a list (never shell=True), preventing shell injection.
- analytics.py is located by absolute path relative to THIS file, so it works from any CWD.
- A hard 10-second timeout prevents runaway child processes.
"""
import json
import subprocess
import os
import sys

# Resolve absolute path to analytics.py relative to this file's directory
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_ANALYTICS_SCRIPT = os.path.join(_THIS_DIR, 'analytics.py')

def process_workout_logs(logs_dict):
    """
    Safe wrapper to execute the local analytics.py using OpenClaw hooks.
    This can be registered as an OpenClaw tool using the `openclaw_ai` SDK.
    
    Args:
        logs_dict (list): List of dictionary objects containing workout logs.
    
    Returns:
        dict: Parsed JSON output from analytics.py, or an error dict.
    """
    if not isinstance(logs_dict, list):
        return {"success": False, "error": "logs_dict must be a list."}

    if not os.path.isfile(_ANALYTICS_SCRIPT):
        return {"success": False, "error": f"analytics.py not found at: {_ANALYTICS_SCRIPT}"}

    try:
        logs_json = json.dumps(logs_dict)

        # SECURITY: Never use shell=True. Args are a typed list, not a string.
        process = subprocess.Popen(
            [sys.executable, _ANALYTICS_SCRIPT],  # use same Python interpreter
            stdin=subprocess.PIPE, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True,
            cwd=_THIS_DIR  # run from the project directory
        )
        try:
            stdout, stderr = process.communicate(input=logs_json, timeout=10)  # 10s hard limit
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()  # clean up
            return {"success": False, "error": "Analytics process timed out after 10 seconds."}

        if process.returncode != 0:
            return {"success": False, "error": stderr.strip() or "Analytics script exited with non-zero code."}

        if stderr.strip():
            # Non-fatal warning: log it but still try to parse stdout
            print(f"[openclaw_tools] analytics.py stderr: {stderr.strip()}", file=sys.stderr)

        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            return {"success": False, "error": f"Non-JSON output from analytics: {stdout[:200]}"}

    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    print("Fuaak OpenClaw Ecosystem Wrapper is ready.")
    print("For full integration, you can install the SDK (pip install openclaw_ai) and register these tools!")
    print(f"Analytics script path: {_ANALYTICS_SCRIPT}")
    print(f"Analytics script exists: {os.path.isfile(_ANALYTICS_SCRIPT)}")
