#!/usr/bin/env python3
"""
ML Model for PDF Cluster Prediction
Uses vectorizer.joblib and kmeans.joblib
NOW USING PDFPLUMBER FOR PDF READING
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
        
        # 3. IMPORT PDFPLUMBER
        try:
            import pdfplumber
            log("✅ pdfplumber imported successfully")
        except ImportError as e:
            log(f"❌ CRITICAL: pdfplumber not installed: {e}")
            log("💡 Solution: Add 'pip3 install pdfplumber' to render.yaml buildCommand")
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
        
        log(f"📁 Current directory: {current_dir}")
        
        if not os.path.exists(vectorizer_path):
            log(f"❌ vectorizer.joblib not found at: {vectorizer_path}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        if not os.path.exists(kmeans_path):
            log(f"❌ kmeans.joblib not found at: {kmeans_path}")
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        log(f"✅ Models found")
        
        # 6. LOAD YOUR ML MODELS
        try:
            log("🔄 Loading vectorizer...")
            vectorizer = joblib.load(vectorizer_path)
            
            log("🔄 Loading KMeans...")
            kmeans = joblib.load(kmeans_path)
            
            log(f"✅ Model loaded: {kmeans.n_clusters} clusters")
        except Exception as e:
            log(f"❌ Error loading models: {e}")
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
            print(f"{DEFAULT_CLUSTER},{DEFAULT_CONFIDENCE}")
            return
        
        # 8. USE YOUR ML MODEL FOR PREDICTION
        try:
            log("🧠 Transforming text with vectorizer...")
            X = vectorizer.transform([text])
            log(f"📊 Vector shape: {X.shape}")
            
            log("🧠 Predicting cluster with KMeans...")
            cluster = kmeans.predict(X)[0]
            
            # Calculate confidence based on distance
            closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
            distance = distances[0]
            
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