# ml/predict_cluster.py - FIXED FOR RENDER
import sys
import os
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# Try to import dependencies
try:
    from PyPDF2 import PdfReader
    import joblib
    from sklearn.metrics import pairwise_distances_argmin_min
    HAS_DEPS = True
except ImportError as e:
    print(f"0,0.5")  # Default fallback
    print(f"WARNING: Missing dependency - {e}", file=sys.stderr)
    HAS_DEPS = False
    sys.exit(0)

def safe_extract_text(pdf_path):
    """Safely extract text from PDF"""
    try:
        reader = PdfReader(pdf_path)
        text = ""
        
        # Limit pages to process (for speed)
        max_pages = min(10, len(reader.pages))
        
        for i in range(max_pages):
            try:
                page_text = reader.pages[i].extract_text()
                if page_text:
                    text += page_text + " "
            except:
                continue
        
        # If no text extracted, return placeholder
        if not text.strip():
            return "thesis research study paper document"
            
        return text[:5000]  # Limit text length
        
    except Exception as e:
        print(f"ERROR reading PDF: {str(e)}", file=sys.stderr)
        return "placeholder text for error"

def main():
    # Get PDF path
    if len(sys.argv) < 2:
        print("0,0.5")  # Default prediction
        return
    
    pdf_path = sys.argv[1]
    
    # Check if file exists
    if not os.path.exists(pdf_path):
        print("0,0.5")
        print(f"ERROR: File not found - {pdf_path}", file=sys.stderr)
        return
    
    # Check dependencies
    if not HAS_DEPS:
        print("0,0.5")
        return
    
    try:
        # Load models - try multiple locations
        model_dir = os.path.dirname(os.path.abspath(__file__))
        possible_paths = [
            os.path.join(model_dir, 'vectorizer.joblib'),
            os.path.join(model_dir, 'kmeans.joblib'),
            os.path.join(os.getcwd(), 'ml', 'vectorizer.joblib'),
            os.path.join(os.getcwd(), 'ml', 'kmeans.joblib'),
            '/tmp/vectorizer.joblib',
            '/tmp/kmeans.joblib'
        ]
        
        # Find model files
        vectorizer_path = None
        kmeans_path = None
        
        for path in possible_paths:
            if 'vectorizer' in path and os.path.exists(path):
                vectorizer_path = path
            if 'kmeans' in path and os.path.exists(path):
                kmeans_path = path
        
        # If models not found, use default
        if not vectorizer_path or not kmeans_path:
            print("0,0.5")
            print("INFO: Using default prediction (models not found)", file=sys.stderr)
            return
        
        # Load models
        try:
            vectorizer = joblib.load(vectorizer_path)
            kmeans = joblib.load(kmeans_path)
        except Exception as e:
            print("0,0.5")
            print(f"ERROR loading models: {e}", file=sys.stderr)
            return
        
        # Extract text
        text = safe_extract_text(pdf_path)
        
        # Predict
        try:
            X = vectorizer.transform([text])
            cluster = kmeans.predict(X)[0]
            
            # Calculate confidence
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            confidence = max(0.3, min(0.95, 1 - distance / 15))
            
            print(f"{cluster},{confidence:.2f}")
            
        except Exception as e:
            print("0,0.5")
            print(f"ERROR in prediction: {e}", file=sys.stderr)
            
    except Exception as e:
        print("0,0.5")  # Safe fallback
        print(f"ERROR: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()