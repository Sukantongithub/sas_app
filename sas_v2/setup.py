#!/usr/bin/env python3
"""
Setup script for ESP8266 Motion Classification project
Initializes Python environment and dependencies
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(cmd, description):
    """Run command and report status"""
    print(f"\n{'='*60}")
    print(f"🔧 {description}")
    print(f"{'='*60}")
    print(f"Command: {cmd}\n")
    
    try:
        result = subprocess.run(cmd, shell=True, cwd="m:\\tmp\\MAD", capture_output=False)
        if result.returncode == 0:
            print(f"✅ Success: {description}")
            return True
        else:
            print(f"⚠️  Warning: {description} returned code {result.returncode}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("🚀 ESP8266 Motion Classification - Setup")
    print("="*60)
    
    venv_path = "m:\\tmp\\MAD\\.venv"
    
    # Check Python version
    print(f"\n📌 Python version: {sys.version}")
    
    # Check if venv exists
    if Path(venv_path).exists():
        print(f"✅ Virtual environment found at {venv_path}")
    else:
        print(f"❌ Virtual environment not found. Creating...")
        run_command(f'cd m:\\tmp\\MAD && {sys.executable} -m venv .venv', 
                   "Create virtual environment")
    
    # Upgrade pip
    pip_exe = f"{venv_path}\\Scripts\\pip.exe"
    run_command(f'"{pip_exe}" install --upgrade pip setuptools wheel',
               "Upgrade pip and setuptools")
    
    # Install dependencies
    run_command(f'"{pip_exe}" install -r requirements.txt --no-cache-dir',
               "Install dependencies from requirements.txt")
    
    # Create directories
    os.makedirs("m:\\tmp\\MAD\\models", exist_ok=True)
    os.makedirs("m:\\tmp\\MAD\\results", exist_ok=True)
    print("✅ Created models/ and results/ directories")
    
    print("\n" + "="*60)
    print("✅ Setup Complete!")
    print("="*60)
    print("""
📚 Next steps:

1. Train models:
   .venv\\Scripts\\python train_model_fixed.py

2. Start inference server:
   .venv\\Scripts\\python inference_fixed.py

3. Run Node.js server (in another terminal):
   npm start

4. Open dashboard:
   http://localhost:5000

Enjoy! 🎉
""")

if __name__ == "__main__":
    main()
