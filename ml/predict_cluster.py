# ================= ml/predict_cluster.py =================
import sys
import os
import warnings

# Suppress ALL warnings
warnings.filterwarnings("ignore")

# Debug logging to stderr (visible in Render logs)
sys.stderr.write(f"🚀 Python ML script started\n")
sys.stderr.write(f"📁 Working directory: {os.getcwd()}\n")
sys.stderr.write(f"📄 Arguments: {sys.argv}\n")

def main():
    # Default fallback values
    default_cluster = 0
    default_confidence = 0.5
    
    try:
        # 1. Check arguments
        if len(sys.argv) < 2:
            sys.stderr.write("❌ Missing PDF path argument\n")
            print(f"{default_cluster},{default_confidence}")
            return
        
        pdf_path = sys.argv[1]
        sys.stderr.write(f"📄 PDF path: {pdf_path}\n")
        
        # 2. Check if file exists
        if not os.path.exists(pdf_path):
            sys.stderr.write(f"❌ PDF file not found: {pdf_path}\n")
            print(f"{default_cluster},{default_confidence}")
            return
        
        sys.stderr.write(f"✅ PDF file exists, size: {os.path.getsize(pdf_path)} bytes\n")
        
        # 3. Import dependencies
        try:
            sys.stderr.write("🔄 Importing PyPDF2...\n")
            from PyPDF2 import PdfReader
            
            sys.stderr.write("🔄 Importing joblib...\n")
            import joblib
            
            sys.stderr.write("🔄 Importing sklearn...\n")
            from sklearn.metrics import pairwise_distances_argmin_min
            
            sys.stderr.write("✅ All imports successful\n")
        except ImportError as e:
            sys.stderr.write(f"❌ Import error: {e}\n")
            print(f"{default_cluster},{default_confidence}")
            return
        
        # 4. Find model files
        current_dir = os.path.dirname(os.path.abspath(__file__))
        sys.stderr.write(f"📁 Current directory: {current_dir}\n")
        
        # List all files in ml directory
        ml_files = os.listdir(current_dir) if os.path.exists(current_dir) else []
        sys.stderr.write(f"📂 ML directory files: {ml_files}\n")
        
        vectorizer_path = os.path.join(current_dir, 'vectorizer.joblib')
        kmeans_path = os.path.join(current_dir, 'kmeans.joblib')
        
        # 5. Check if models exist
        if not os.path.exists(vectorizer_path):
            sys.stderr.write(f"❌ Vectorizer not found at: {vectorizer_path}\n")
            sys.stderr.write(f"📁 Does directory exist? {os.path.exists(os.path.dirname(vectorizer_path))}\n")
            print(f"{default_cluster},{default_confidence}")
            return
            
        if not os.path.exists(kmeans_path):
            sys.stderr.write(f"❌ KMeans model not found at: {kmeans_path}\n")
            print(f"{default_cluster},{default_confidence}")
            return
        
        sys.stderr.write(f"✅ Vectorizer found: {os.path.getsize(vectorizer_path)} bytes\n")
        sys.stderr.write(f"✅ KMeans model found: {os.path.getsize(kmeans_path)} bytes\n")
        
        # 6. Load models
        try:
            sys.stderr.write("🔄 Loading vectorizer...\n")
            vectorizer = joblib.load(vectorizer_path)
            sys.stderr.write("🔄 Loading KMeans...\n")
            kmeans = joblib.load(kmeans_path)
            sys.stderr.write("✅ Models loaded successfully\n")
        except Exception as e:
            sys.stderr.write(f"❌ Error loading models: {e}\n")
            print(f"{default_cluster},{default_confidence}")
            return
        
        # 7. Extract text from PDF
        try:
            sys.stderr.write("📖 Extracting text from PDF...\n")
            reader = PdfReader(pdf_path)
            text = ""
            
            # Read first 3 pages max
            page_count = min(3, len(reader.pages))
            sys.stderr.write(f"📄 PDF has {len(reader.pages)} pages, reading {page_count} pages\n")
            
            for i in range(page_count):
                try:
                    page_text = reader.pages[i].extract_text()
                    if page_text:
                        text += page_text + " "
                except Exception as page_error:
                    sys.stderr.write(f"⚠️ Error reading page {i}: {page_error}\n")
                    continue
            
            sys.stderr.write(f"📝 Extracted text length: {len(text)} characters\n")
            
            # If no text, use placeholder based on filename
            if not text.strip():
                text = "academic research thesis dissertation study paper document"
                sys.stderr.write("⚠️ No text extracted, using placeholder\n")
            
            # Show first 100 chars for debugging
            sys.stderr.write(f"📝 First 100 chars: {text[:100]}...\n")
            
        except Exception as e:
            sys.stderr.write(f"❌ Error reading PDF: {e}\n")
            print(f"{default_cluster},{default_confidence}")
            return
        
        # 8. Make prediction
        try:
            sys.stderr.write("🧠 Transforming text...\n")
            X = vectorizer.transform([text])
            sys.stderr.write(f"📊 Vector shape: {X.shape}\n")
            
            sys.stderr.write("🧠 Predicting cluster...\n")
            cluster = kmeans.predict(X)[0]
            
            # Calculate confidence
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            confidence = max(0.4, min(0.95, 1.0 - (distance / 20.0)))
            
            # Ensure cluster is 0-5
            cluster = max(0, min(5, cluster))
            
            sys.stderr.write(f"🎯 Prediction: cluster={cluster}, distance={distance:.2f}, confidence={confidence:.2f}\n")
            
            # Format output
            print(f"{cluster},{confidence:.2f}")
            
        except Exception as e:
            sys.stderr.write(f"❌ Error in prediction: {e}\n")
            print(f"{default_cluster},{default_confidence}")
            return
            
    except Exception as e:
        # Ultimate fallback
        sys.stderr.write(f"💥 Unexpected error: {e}\n")
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"{default_cluster},{default_confidence}")

if __name__ == "__main__":
    main()
    sys.stderr.write("🏁 Python script finished\n")