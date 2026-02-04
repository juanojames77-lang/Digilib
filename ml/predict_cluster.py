#!/usr/bin/env python3
"""
ML Model for PDF Cluster Prediction
Uses vectorizer.joblib and kmeans.joblib
NOW USING PDFPLUMBER FOR PDF READING
WITH ADDED SYSTEM PATHS FOR RENDER
"""
import sys
import os
import warnings

# ========== SOLUTION 4: FORCE ADD RENDER PYTHON PATHS ==========
# Add common Python package paths where Render installs packages
sys.path.extend([
    '/usr/local/lib/python3.9/site-packages',      # System Python 3.9
    '/usr/local/lib/python3.10/site-packages',     # System Python 3.10  
    '/usr/local/lib/python3.11/site-packages',     # System Python 3.11
    '/usr/local/lib/python3.12/site-packages',     # System Python 3.12
    '/usr/local/lib/python3.13/site-packages',     # System Python 3.13 (your version!)
    '/usr/lib/python3/dist-packages',              # Ubuntu/Debian system packages
    '/usr/lib/python3.9/dist-packages',
    '/home/render/.local/lib/python3.9/site-packages',  # User installs
    '/home/render/.local/lib/python3.13/site-packages', # User Python 3.13
    '/opt/render/.local/lib/python3.9/site-packages',   # Render specific
    '/opt/render/project/src/.local/lib/python3.9/site-packages',
    '/opt/venv/lib/python3.9/site-packages',       # Virtual environment
    '/opt/venv/lib/python3.13/site-packages',      # Virtual env Python 3.13
])

# Debug: Show Python path
print(f"[ML-DEBUG] Python version: {sys.version}", file=sys.stderr)
print(f"[ML-DEBUG] Python executable: {sys.executable}", file=sys.stderr)
print(f"[ML-DEBUG] Current directory: {os.getcwd()}", file=sys.stderr)
print(f"[ML-DEBUG] Script location: {os.path.dirname(os.path.abspath(__file__))}", file=sys.stderr)
print(f"[ML-DEBUG] Total paths in sys.path: {len(sys.path)}", file=sys.stderr)

# Check if directories exist
for path in sys.path:
    if os.path.exists(path):
        print(f"[ML-DEBUG] Path exists: {path}", file=sys.stderr)

# Suppress warnings
warnings.filterwarnings("ignore")

def log(message):
    """Log to stderr for debugging"""
    print(f"[ML] {message}", file=sys.stderr, flush=True)

def main():
    # Default values if ML fails
    DEFAULT_CLUSTER = 0
    DEFAULT_CONFIDENCE = 0.5
    
    try:
        log("🚀 Starting ML prediction with pdfplumber")
        
        # 1. Check arguments
        if len(sys.argv) < 2:
            log("❌ Error: No PDF path provided")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        pdf_path = sys.argv[1]
        log(f"📄 Processing: {pdf_path}")
        
        # 2. Check if file exists
        if not os.path.exists(pdf_path):
            log(f"❌ Error: File not found")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 3. IMPORT PDFPLUMBER - WITH EXTRA DEBUGGING
        try:
            log("🔄 Attempting to import pdfplumber...")
            
            # List what's in Python path before import
            log(f"Python sys.path locations checked: {len(sys.path)}")
            
            import pdfplumber
            log(f"✅ pdfplumber imported successfully!")
            log(f"📦 pdfplumber version: {pdfplumber.__version__}")
            log(f"📁 pdfplumber location: {pdfplumber.__file__}")
            
        except ImportError as e:
            log(f"❌ CRITICAL: pdfplumber not installed")
            log(f"💥 Import error details: {e}")
            log(f"🔍 Python was looking in these paths:")
            for i, path in enumerate(sys.path[:20]):  # Show first 20 paths
                log(f"  {i:2d}. {path}")
            
            # Try to find where pip installed packages
            log(f"🔍 Checking common install locations...")
            common_locations = [
                '/usr/local/lib/python3.13/site-packages/pdfplumber',
                '/usr/local/lib/python3.9/site-packages/pdfplumber',
                '/home/render/.local/lib/python3.13/site-packages/pdfplumber',
            ]
            
            for loc in common_locations:
                if os.path.exists(loc):
                    log(f"✅ Found pdfplumber at: {loc}")
                else:
                    log(f"❌ Not found at: {loc}")
            
            log("💡 Solution: Make sure 'pip3 install pdfplumber' runs in render.yaml buildCommand")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 4. IMPORT ML LIBRARIES
        try:
            import joblib
            from sklearn.metrics import pairwise_distances_argmin_min
            log("✅ ML libraries imported")
            log(f"📦 joblib version: {joblib.__version__}")
        except ImportError as e:
            log(f"❌ ML libraries failed: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 5. CHECK MODEL FILES EXIST
        current_dir = os.path.dirname(os.path.abspath(__file__))
        vectorizer_path = os.path.join(current_dir, 'vectorizer.joblib')
        kmeans_path = os.path.join(current_dir, 'kmeans.joblib')
        
        log(f"📁 Current directory: {current_dir}")
        log(f"🔍 Looking for vectorizer at: {vectorizer_path}")
        log(f"🔍 Looking for kmeans at: {kmeans_path}")
        
        if not os.path.exists(vectorizer_path):
            log(f"❌ vectorizer.joblib not found!")
            log(f"💡 Make sure vectorizer.joblib is in ml/ directory")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        if not os.path.exists(kmeans_path):
            log(f"❌ kmeans.joblib not found!")
            log(f"💡 Make sure kmeans.joblib is in ml/ directory")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        log(f"✅ Models found")
        log(f"📏 vectorizer size: {os.path.getsize(vectorizer_path)} bytes")
        log(f"📏 kmeans size: {os.path.getsize(kmeans_path)} bytes")
        
        # 6. LOAD YOUR ML MODELS
        try:
            log("🔄 Loading vectorizer...")
            vectorizer = joblib.load(vectorizer_path)
            
            log("🔄 Loading KMeans...")
            kmeans = joblib.load(kmeans_path)
            
            log(f"✅ Model loaded: {kmeans.n_clusters} clusters")
        except Exception as e:
            log(f"❌ Error loading models: {e}")
            import traceback
            traceback.print_exc(file=sys.stderr)
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 7. EXTRACT TEXT FROM PDF USING PDFPLUMBER
        try:
            log("📖 Opening PDF with pdfplumber...")
            text = ""
            
            with pdfplumber.open(pdf_path) as pdf:
                pages_to_read = min(3, len(pdf.pages))
                log(f"📄 PDF has {len(pdf.pages)} pages, reading {pages_to_read}")
                
                for i in range(pages_to_read):
                    try:
                        page = pdf.pages[i]
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            text += page_text + " "
                            log(f"✅ Page {i+1}: {len(page_text)} chars")
                    except Exception as page_err:
                        log(f"⚠️ Page {i+1} error: {page_err}")
                        continue
            
            if not text.strip():
                text = "academic research thesis dissertation paper"
                log("⚠️ No text extracted, using placeholder")
            
            log(f"📝 Total extracted: {len(text)} characters")
            if len(text) > 100:
                log(f"Sample: {text[:100]}...")
            
        except Exception as e:
            log(f"❌ PDF reading error: {e}")
            import traceback
            traceback.print_exc(file=sys.stderr)
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 8. USE YOUR ML MODEL FOR PREDICTION
        try:
            log("🧠 Transforming text with vectorizer...")
            X = vectorizer.transform([text])
            log(f"📊 Vector shape: {X.shape}")
            
            log("🧠 Predicting cluster with KMeans...")
            cluster = kmeans.predict(X)[0]
            log(f"📈 Raw cluster prediction: {cluster}")
            
            # Calculate confidence based on distance
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            log(f"📏 Distance to cluster center: {distance:.4f}")
            
            # Convert distance to confidence (0.4 to 0.95)
            confidence = max(0.4, min(0.95, 1.0 - (distance / 20.0)))
            
            # Ensure cluster is within 0-5 range
            cluster = max(0, min(5, cluster))
            
            log(f"🎯 FINAL PREDICTION: Cluster {cluster}, Confidence {confidence:.2f}")
            
            # Output for Node.js (cluster,confidence)
            print(f"{cluster},{confidence:.2f}")
            
        except Exception as e:
            log(f"❌ Prediction error: {e}")
            import traceback
            traceback.print_exc(file=sys.stderr)
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
            
    except Exception as e:
        log(f"💥 Unexpected error: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")

if __name__ == "__main__":
    main()
    log("🏁 ML script finished")