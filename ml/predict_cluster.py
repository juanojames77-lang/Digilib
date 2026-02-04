#!/usr/bin/env python3
"""
ML Model for PDF Cluster Prediction
Uses vectorizer.joblib and kmeans.joblib
"""
import sys
import os
import warnings
import traceback

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
        log("Starting ML prediction")
        
        # 1. Check arguments
        if len(sys.argv) < 2:
            log("Error: No PDF path provided")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        pdf_path = sys.argv[1]
        log(f"Processing: {pdf_path}")
        
        # 2. Check if file exists
        if not os.path.exists(pdf_path):
            log(f"Error: File not found: {pdf_path}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 3. IMPORT PYPDF FOR READING PDF
        try:
            from pypdf import PdfReader
            log("Success: pypdf imported")
        except ImportError:
            try:
                from PyPDF2 import PdfReader
                log("Success: PyPDF2 imported")
            except ImportError as e:
                log(f"Error: No PDF library found: {e}")
                print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
                return
        
        # 4. IMPORT ML LIBRARIES
        try:
            import joblib
            from sklearn.metrics import pairwise_distances_argmin_min
            log("Success: ML libraries imported")
        except ImportError as e:
            log(f"Error: ML libraries failed: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 5. CHECK MODEL FILES EXIST
        current_dir = os.path.dirname(os.path.abspath(__file__))
        vectorizer_path = os.path.join(current_dir, 'vectorizer.joblib')
        kmeans_path = os.path.join(current_dir, 'kmeans.joblib')
        
        log(f"Looking for models in: {current_dir}")
        log(f"Vectorizer: {vectorizer_path}")
        log(f"KMeans: {kmeans_path}")
        
        if not os.path.exists(vectorizer_path):
            log(f"Error: vectorizer.joblib not found")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        if not os.path.exists(kmeans_path):
            log(f"Error: kmeans.joblib not found")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        log(f"Models found: {os.path.getsize(vectorizer_path)} bytes, {os.path.getsize(kmeans_path)} bytes")
        
        # 6. LOAD YOUR ML MODELS
        try:
            log("Loading vectorizer...")
            vectorizer = joblib.load(vectorizer_path)
            
            log("Loading KMeans...")
            kmeans = joblib.load(kmeans_path)
            
            log(f"Model loaded: {kmeans.n_clusters} clusters")
        except Exception as e:
            log(f"Error loading models: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 7. EXTRACT TEXT FROM PDF
        try:
            log("Reading PDF...")
            reader = PdfReader(pdf_path)
            text = ""
            
            # Read first 3 pages or all if less
            pages_to_read = min(3, len(reader.pages))
            log(f"PDF has {len(reader.pages)} pages, reading {pages_to_read}")
            
            for i in range(pages_to_read):
                try:
                    page_text = reader.pages[i].extract_text()
                    if page_text and page_text.strip():
                        text += page_text + " "
                except Exception as page_err:
                    log(f"Warning: Page {i} error: {page_err}")
                    continue
            
            if not text.strip():
                text = "academic research thesis dissertation paper"
                log("Warning: Using placeholder text")
            
            log(f"Extracted {len(text)} characters")
            if len(text) > 100:
                log(f"Sample: {text[:100]}...")
            
        except Exception as e:
            log(f"Error reading PDF: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 8. USE YOUR ML MODEL FOR PREDICTION
        try:
            log("Transforming text with vectorizer...")
            X = vectorizer.transform([text])
            log(f"Vector shape: {X.shape}")
            
            log("Predicting cluster with KMeans...")
            cluster = kmeans.predict(X)[0]
            log(f"Raw cluster prediction: {cluster}")
            
            # Calculate confidence based on distance
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            
            # Convert distance to confidence (0.4 to 0.95)
            confidence = max(0.4, min(0.95, 1.0 - (distance / 20.0)))
            
            # Ensure cluster is within 0-5 range
            cluster = max(0, min(5, cluster))
            
            log(f"Final prediction: Cluster={cluster}, Distance={distance:.4f}, Confidence={confidence:.4f}")
            
            # Output for Node.js (cluster,confidence)
            print(f"{cluster},{confidence:.4f}")
            
        except Exception as e:
            log(f"Error in ML prediction: {e}")
            traceback.print_exc(file=sys.stderr)
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
            
    except Exception as e:
        log(f"Unexpected error: {e}")
        traceback.print_exc(file=sys.stderr)
        print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")

if __name__ == "__main__":
    main()
    log("ML script finished")