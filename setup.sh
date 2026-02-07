#!/bin/bash
# setup.sh - Force Python installation on Render
set -e  # Exit on error

echo "🔧 Starting setup for Digital Library on Render..."

# Check current directory
echo "📁 Current directory: $(pwd)"
echo "📁 Contents:"
ls -la

# 1. Install Node dependencies
echo "📦 Installing Node dependencies..."
npm install

# 2. Check and install Python if missing
echo "🐍 Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "📥 Installing Python 3 and pip..."
    apt-get update
    apt-get install -y python3 python3-pip python3-venv
fi

echo "✅ Python version: $(python3 --version)"
echo "✅ Pip version: $(pip3 --version)"

# 3. Install Python ML dependencies
echo "📦 Installing Python ML dependencies..."
pip3 install --upgrade pip

# Create requirements.txt if missing
if [ ! -f "requirements.txt" ]; then
    echo "📝 Creating requirements.txt..."
    echo "pypdf==4.2.0" > requirements.txt
    echo "scikit-learn==1.3.2" >> requirements.txt
    echo "joblib==1.3.2" >> requirements.txt
    echo "numpy==1.24.3" >> requirements.txt
fi

echo "📋 Requirements.txt content:"
cat requirements.txt

# Install from requirements.txt
pip3 install -r requirements.txt

# 4. Verify installations
echo "✅ Verifying Python packages..."
python3 -c "
try:
    import pypdf
    print('✅ pypdf version:', pypdf.__version__)
except ImportError as e:
    print('❌ pypdf import failed:', e)

try:
    import sklearn
    print('✅ sklearn version:', sklearn.__version__)
except ImportError as e:
    print('❌ sklearn import failed:', e)

try:
    import joblib
    print('✅ joblib imported')
except ImportError as e:
    print('❌ joblib import failed:', e)

try:
    import numpy
    print('✅ numpy version:', numpy.__version__)
except ImportError as e:
    print('❌ numpy import failed:', e)
"

# 5. Test ML script directly
echo "🧪 Testing ML script..."
if [ -f "ml/predict_cluster.py" ]; then
    echo "Creating test PDF..."
    echo "computer science machine learning thesis research" > /tmp/test.pdf
    echo "Running ML script..."
    python3 ml/predict_cluster.py /tmp/test.pdf || echo "ML test failed (this might be OK)"
    rm -f /tmp/test.pdf
else
    echo "⚠️ ML script not found at ml/predict_cluster.py"
fi

echo "🎉 Setup completed!"