# ================= ml/predict_cluster.py =================
import sys
import os
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def main():
    # Default fallback
    default_cluster = 0
    default_confidence = 0.5
    
    try:
        # 1. Check PDF path
        if len(sys.argv) < 2:
            print(f"{default_cluster},{default_confidence}")
            return
        
        pdf_path = sys.argv[1]
        
        # 2. Try to import PDF reader (TRY BOTH pypdf and PyPDF2)
        try:
            # First try pypdf (new package name)
            from pypdf import PdfReader
            print("✅ Using pypdf", file=sys.stderr)
        except ImportError:
            try:
                # Fallback to PyPDF2 (old package name)
                from PyPDF2 import PdfReader
                print("✅ Using PyPDF2", file=sys.stderr)
            except ImportError:
                print("❌ Neither pypdf nor PyPDF2 found", file=sys.stderr)
                print(f"{default_cluster},{default_confidence}")
                return
        
        # 3. Import ML libraries
        try:
            import joblib
            from sklearn.metrics import pairwise_distances_argmin_min
        except ImportError as e:
            print(f"❌ ML import error: {e}", file=sys.stderr)
            print(f"{default_cluster},{default_confidence}")
            return
        
        # 4. Check model files
        current_dir = os.path.dirname(os.path.abspath(__file__))
        vectorizer_path = os.path.join(current_dir, 'vectorizer.joblib')
        kmeans_path = os.path.join(current_dir, 'kmeans.joblib')
        
        if not os.path.exists(vectorizer_path):
            print(f"❌ Vectorizer missing: {vectorizer_path}", file=sys.stderr)
            print(f"{default_cluster},{default_confidence}")
            return
            
        if not os.path.exists(kmeans_path):
            print(f"❌ KMeans missing: {kmeans_path}", file=sys.stderr)
            print(f"{default_cluster},{default_confidence}")
            return
        
        # 5. Load models
        try:
            vectorizer = joblib.load(vectorizer_path)
            kmeans = joblib.load(kmeans_path)
        except Exception as e:
            print(f"❌ Error loading models: {e}", file=sys.stderr)
            print(f"{default_cluster},{default_confidence}")
            return
        
        # 6. Read PDF text
        try:
            reader = PdfReader(pdf_path)
            text = ""
            
            # Read first 2 pages
            for i in range(min(2, len(reader.pages))):
                try:
                    page_text = reader.pages[i].extract_text()
                    if page_text:
                        text += page_text + " "
                except:
                    continue
            
            if not text.strip():
                text = "academic research thesis"
                
        except Exception as e:
            print(f"❌ Error reading PDF: {e}", file=sys.stderr)
            print(f"{default_cluster},{default_confidence}")
            return
        
        # 7. Make prediction
        try:
            X = vectorizer.transform([text])
            cluster = kmeans.predict(X)[0]
            
            # Calculate confidence
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            confidence = max(0.4, min(0.95, 1.0 - (distance / 20.0)))
            
            # Ensure cluster is 0-5
            cluster = max(0, min(5, cluster))
            
            print(f"{cluster},{confidence:.2f}")
            
        except Exception as e:
            print(f"❌ Prediction error: {e}", file=sys.stderr)
            print(f"{default_cluster},{default_confidence}")
            return
            
    except Exception as e:
        print(f"💥 Unexpected error: {e}", file=sys.stderr)
        print(f"{default_cluster},{default_confidence}")

if __name__ == "__main__":
    main()