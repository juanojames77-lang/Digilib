# ================= ml/predict_cluster.py =================
import sys
import os
import warnings

# Suppress ALL warnings
warnings.filterwarnings("ignore")

def main():
    # Default fallback values
    default_cluster = 0
    default_confidence = 0.5
    
    try:
        # 1. Check arguments
        if len(sys.argv) < 2:
            print(f"{default_cluster},{default_confidence}")
            return
        
        pdf_path = sys.argv[1]
        
        # 2. Check if file exists
        if not os.path.exists(pdf_path):
            print(f"{default_cluster},{default_confidence}")
            return
        
        # 3. Import dependencies
        try:
            from PyPDF2 import PdfReader
            import joblib
            from sklearn.metrics import pairwise_distances_argmin_min
        except ImportError as e:
            print(f"{default_cluster},{default_confidence}")
            print(f"Import error: {e}", file=sys.stderr)
            return
        
        # 4. Find model files
        current_dir = os.path.dirname(os.path.abspath(__file__))
        vectorizer_path = os.path.join(current_dir, 'vectorizer.joblib')
        kmeans_path = os.path.join(current_dir, 'kmeans.joblib')
        
        # 5. Check if models exist
        if not os.path.exists(vectorizer_path):
            print(f"{default_cluster},{default_confidence}")
            print(f"Model not found: {vectorizer_path}", file=sys.stderr)
            return
            
        if not os.path.exists(kmeans_path):
            print(f"{default_cluster},{default_confidence}")
            print(f"Model not found: {kmeans_path}", file=sys.stderr)
            return
        
        # 6. Load models
        try:
            vectorizer = joblib.load(vectorizer_path)
            kmeans = joblib.load(kmeans_path)
        except Exception as e:
            print(f"{default_cluster},{default_confidence}")
            print(f"Error loading models: {e}", file=sys.stderr)
            return
        
        # 7. Extract text from PDF
        try:
            reader = PdfReader(pdf_path)
            text = ""
            
            # Read first 5 pages max
            for i in range(min(5, len(reader.pages))):
                try:
                    page_text = reader.pages[i].extract_text()
                    if page_text:
                        text += page_text + " "
                except:
                    continue
            
            # If no text, use placeholder
            if not text.strip():
                text = "academic research thesis dissertation study paper document"
            
            # Limit text length
            text = text[:3000]
            
        except Exception as e:
            print(f"{default_cluster},{default_confidence}")
            print(f"Error reading PDF: {e}", file=sys.stderr)
            return
        
        # 8. Make prediction
        try:
            X = vectorizer.transform([text])
            cluster = kmeans.predict(X)[0]
            
            # Calculate confidence
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            confidence = max(0.4, min(0.95, 1.0 - (distance / 20.0)))
            
            # Ensure cluster is 0-5
            cluster = max(0, min(5, cluster))
            
            # Format output
            print(f"{cluster},{confidence:.2f}")
            
        except Exception as e:
            print(f"{default_cluster},{default_confidence}")
            print(f"Error in prediction: {e}", file=sys.stderr)
            return
            
    except Exception as e:
        # Ultimate fallback
        print(f"{default_cluster},{default_confidence}")
        print(f"Unexpected error: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()