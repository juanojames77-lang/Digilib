#!/usr/bin/env python3
"""
ML Model for PDF Cluster Prediction - SIMPLIFIED VERSION
"""
import sys
import os
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def log(message):
    print(f"[ML] {message}", file=sys.stderr, flush=True)

def main():
    # Default fallback values
    DEFAULT_CLUSTER = 0
    DEFAULT_CONFIDENCE = 0.5
    
    try:
        log("Starting ML prediction")
        
        # Check arguments
        if len(sys.argv) < 2:
            log("No PDF path provided")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        pdf_path = sys.argv[1]
        log(f"Processing: {pdf_path}")
        
        # Check if file exists
        if not os.path.exists(pdf_path):
            log("File not found")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # ==================== IMPORT SECTION ====================
        # Try to import Python libraries
        try:
            # PDF library - use pypdf (newer, works better)
            from pypdf import PdfReader
            log("Using pypdf for PDF reading")
        except ImportError:
            log("ERROR: pypdf not installed!")
            log("Please run: pip install pypdf")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        try:
            # ML libraries
            import joblib
            from sklearn.metrics import pairwise_distances_argmin_min
            log("ML libraries imported successfully")
        except ImportError as e:
            log(f"ERROR: ML libraries not installed: {e}")
            log("Please run: pip install scikit-learn joblib")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        # =======================================================
        
        # Check for ML model files
        script_dir = os.path.dirname(os.path.abspath(__file__))
        vectorizer_path = os.path.join(script_dir, 'vectorizer.joblib')
        kmeans_path = os.path.join(script_dir, 'kmeans.joblib')
        
        if not os.path.exists(vectorizer_path):
            log(f"ERROR: vectorizer.joblib not found at {vectorizer_path}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        if not os.path.exists(kmeans_path):
            log(f"ERROR: kmeans.joblib not found at {kmeans_path}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        log("All model files found")
        
        # Load ML models
        try:
            vectorizer = joblib.load(vectorizer_path)
            kmeans = joblib.load(kmeans_path)
            log("Models loaded successfully")
        except Exception as e:
            log(f"ERROR loading models: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # Extract text from PDF
        try:
            reader = PdfReader(pdf_path)
            text = ""
            
            # Read only first page to be fast
            if len(reader.pages) > 0:
                page = reader.pages[0]
                page_text = page.extract_text()
                if page_text:
                    text = page_text[:5000]  # Limit text length
            
            if not text.strip():
                text = "research paper academic thesis"
                log("Used placeholder text (no text extracted)")
            
            log(f"Extracted {len(text)} characters")
            
        except Exception as e:
            log(f"ERROR reading PDF: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # Make prediction
        try:
            # Transform text
            X = vectorizer.transform([text])
            
            # Predict cluster
            cluster = kmeans.predict(X)[0]
            
            # Calculate confidence
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            confidence = max(0.3, min(0.9, 1.0 - (distance / 15.0)))
            
            # Ensure valid cluster number (0-5)
            cluster = max(0, min(5, cluster))
            
            log(f"Prediction: Cluster {cluster}, Confidence {confidence:.2f}")
            print(f"{cluster},{confidence:.2f}")
            
        except Exception as e:
            log(f"ERROR during prediction: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
            
    except Exception as e:
        log(f"UNEXPECTED ERROR: {e}")
        print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")

if __name__ == "__main__":
    main()