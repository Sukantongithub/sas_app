#!/bin/bash
# ML Service Setup Script

echo "🚀 Setting up Motion Pattern Detection ML Service..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✓ Python 3 found"

# Navigate to ml_service directory
cd "$(dirname "$0")" || exit 1

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows
    source venv/Scripts/activate
else
    # macOS/Linux
    source venv/bin/activate
fi

echo "✓ Virtual environment created and activated"

# Install dependencies
echo "📚 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✓ Dependencies installed"

# Train the model
echo "🤖 Training Motion Pattern Detection model..."
python motion_detector.py

echo "✅ Setup complete!"
echo ""
echo "To start the ML service, run:"
echo "  source venv/bin/activate  # On MacOS/Linux"
echo "  venv\\Scripts\\activate    # On Windows"
echo "  python app.py"
echo ""
echo "The service will run on http://localhost:5001"
