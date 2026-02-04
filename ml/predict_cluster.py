#!/usr/bin/env python3
"""
ML Model for PDF Cluster Prediction
Uses vectorizer.joblib and kmeans.joblib
"""
import sys
import os
import warnings

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
        log("🚀 Starting ML prediction")
        
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
        
        # 3. IMPORT PDF LIBRARY - FIXED!
        try:
            # Try pypdf first (new package name - what you installed)
            from pypdf import PdfReader
            log("✅ Using pypdf")
        except ImportError:
            try:
                # Fallback to PyPDF2 (old package name)
                from PyPDF2 import PdfReader
                log("✅ Using PyPDF2 (fallback)")
            except ImportError as e:
                log(f"❌ No PDF library found: {e}")
                log("💡 Install with: python3 -m pip install pypdf")
                print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
                return
        
        # 4. IMPORT ML LIBRARIES
        try:
            import joblib
            from sklearn.metrics import pairwise_distances_argmin_min
            log("✅ ML libraries imported")
        except ImportError as e:
            log(f"❌ ML libraries failed: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 5. CHECK MODEL FILES EXIST
        current_dir = os.path.dirname(os.path.abspath(__file__))
        vectorizer_path = os.path.join(current_dir, 'vectorizer.joblib')
        kmeans_path = os.path.join(current_dir, 'kmeans.joblib')
        
        if not os.path.exists(vectorizer_path):
            log(f"❌ vectorizer.joblib not found")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        if not os.path.exists(kmeans_path):
            log(f"❌ kmeans.joblib not found")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        log(f"✅ Models found")
        
        # 6. LOAD YOUR ML MODELS
        try:
            vectorizer = joblib.load(vectorizer_path)
            kmeans = joblib.load(kmeans_path)
            log(f"✅ Model loaded")
        except Exception as e:
            log(f"❌ Error loading models: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 7. EXTRACT TEXT FROM PDF
        try:
            reader = PdfReader(pdf_path)
            text = ""
            
            # Read first 3 pages
            pages_to_read = min(3, len(reader.pages))
            
            for i in range(pages_to_read):
                try:
                    page_text = reader.pages[i].extract_text()
                    if page_text:
                        text += page_text + " "
                except:
                    continue
            
            if not text.strip():
                text = "academic research thesis"
                log("⚠️ No text extracted, using placeholder")
            
            log(f"📝 Extracted {len(text)} characters")
            
        except Exception as e:
            log(f"❌ PDF reading error: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 8. USE YOUR ML MODEL FOR PREDICTION
        try:
            X = vectorizer.transform([text])
            cluster = kmeans.predict(X)[0]
            
            # Calculate confidence
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            confidence = max(0.4, min(0.95, 1.0 - (distance / 20.0)))
            
            # Ensure cluster is 0-5
            cluster = max(0, min(5, cluster))
            
            log(f"🎯 Prediction: Cluster {cluster}, Confidence {confidence:.2f}")
            print(f"{cluster},{confidence:.2f}")
            
        except Exception as e:
            log(f"❌ Prediction error: {e}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
            
    except Exception as e:
        log(f"💥 Unexpected error: {e}")
        print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")

if __name__ == "__main__":
    main()
    log("🏁 ML script finished")