# predict_cluster.py
import sys
import os
import requests
from PyPDF2 import PdfReader
from joblib import load
import warnings
import tempfile
from sklearn.metrics import pairwise_distances_argmin_min

warnings.filterwarnings("ignore")

# --- Load model and vectorizer ---
vectorizer = load("ml/vectorizer.joblib")
kmeans = load("ml/kmeans.joblib")

# --- Get PDF path or URL ---
pdf_source = sys.argv[1]

# --- Check file extension first ---
if not pdf_source.lower().endswith(".pdf") and not pdf_source.startswith("http"):
    print("ERROR: Not a PDF")
    sys.exit(1)

# --- Download if URL ---
if pdf_source.startswith("http://") or pdf_source.startswith("https://"):
    try:
        response = requests.get(pdf_source)
        response.raise_for_status()
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        temp_file.write(response.content)
        temp_file.close()
        pdf_path = temp_file.name
    except Exception as e:
        print("ERROR: Failed to download PDF")
        sys.exit(1)
else:
    pdf_path = pdf_source

# --- Read PDF ---
try:
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
except Exception as e:
    print("ERROR: Failed to read PDF")
    if pdf_source.startswith("http"):
        os.unlink(pdf_path)
    sys.exit(1)

# --- Predict cluster ---
try:
    X = vectorizer.transform([text])
    cluster = kmeans.predict(X)[0]

    # --- Compute pseudo-confidence ---
    closest, distances = pairwise_distances_argmin_min(X, kmeans.cluster_centers_)
    distance = distances[0]
    confidence = max(0.0, min(1.0, 1 - distance / 10))  # normalize (adjust 10 if needed)

    print(f"{cluster},{confidence:.2f}")
except Exception as e:
    print("ERROR: Prediction failed")
    if pdf_source.startswith("http"):
        os.unlink(pdf_path)
    sys.exit(1)

# --- Cleanup temporary file if needed ---
if pdf_source.startswith("http"):
    os.unlink(pdf_path)
