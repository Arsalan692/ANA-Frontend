import os
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
MODEL_PATH = Path(os.environ.get('ANA_MODEL_PATH', PROJECT / 'Results' / 'aida_binary_resnet18_512_best.pt'))

# Same limits as the frontend (frontend/src/features/workspace/filePolicy.ts).
MAX_FILES = 12
MAX_BYTES = 20 * 1024 * 1024
MAX_PIXELS = 40_000_000
# Detected from the file contents, not the name or declared type. TIFF is accepted for AIDA-style exports.
FORMATS = {'JPEG', 'PNG', 'BMP', 'TIFF'}

# The dev frontend reaches the API through Vite's proxy; CORS only matters when it is opened directly.
FRONTEND_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173']
