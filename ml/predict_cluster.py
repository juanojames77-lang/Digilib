# ml/predict_cluster.py - UPDATED FOR RENDER
import sys
import os
import tempfile
import warnings
from urllib.request import urlretrieve
from PyPDF2 import PdfReader
from sklearn.externals import joblib
from sklearn.metrics import pairwise_distances_argmin_min

warnings.filterwarnings("ignore")

# Model paths
MODEL_URLS = {
    'vectorizer': 'https://res.cloudinary.com/YOUR_CLOUD_NAME/raw/upload/vectorizer.joblib',
    'kmeans': 'https://res.cloudinary.com/YOUR_CLOUD_NAME/raw/upload/kmeans.joblib'
}

def download_models():
    """Download models if they don't exist locally"""
    if not os.path.exists('ml/vectorizer.joblib'):
        print("Downloading models...")
        os.makedirs('ml', exist_ok=True)
        urlretrieve(MODEL_URLS['vectorizer'], 'ml/vectorizer.joblib')
        urlretrieve(MODEL_URLS['kmeans'], 'ml/kmeans.joblib')
        print("Models downloaded successfully")

def main():
    # Get PDF path from command line
    if len(sys.argv) < 2:
        print("ERROR: No PDF path provided")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    # Download models first
    download_models()
    
    # Load models
    try:
        vectorizer = joblib.load('ml/vectorizer.joblib')
        kmeans = joblib.load('ml/kmeans.joblib')
    except Exception as e:
        print(f"ERROR: Failed to load models - {e}")
        sys.exit(1)
    
    # Read PDF
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + " "
        
        if not text.strip():
            print("ERROR: No text extracted from PDF")
            sys.exit(1)
            
    except Exception as e:
        print(f"ERROR: Failed to read PDF - {e}")
        sys.exit(1)
    
    # Predict cluster
    try:
        X = vectorizer.transform([text])
        cluster = kmeans.predict(X)[0]
        
        # Compute confidence
        closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
        distance = distances[0]
        confidence = max(0.0, min(1.0, 1 - distance / 10))
        
        print(f"{cluster},{confidence:.2f}")
        
    except Exception as e:
        print(f"ERROR: Prediction failed - {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()