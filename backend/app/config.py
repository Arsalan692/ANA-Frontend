"""Service settings. Everything about a particular model lives in its recipe (app/recipes/), not here."""
import os
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
# One folder per model, named by the recipe id: models/<id>/. Resolved from the project folder, not the
# working directory, so the service can start from anywhere.
MODELS = Path(os.environ.get('ANA_MODELS_DIR', PROJECT / 'models'))
# The model used for each task when the website does not name one. Falls back to the first installed model.
DEFAULT_MODELS = {
    'screening': os.environ.get('ANA_DEFAULT_SCREENING_MODEL', 'efficientnet-b0-aida-r1'),
    'cells': os.environ.get('ANA_DEFAULT_CELL_MODEL', 'cells-resnet18-adjusted'),
}
# Models are loaded on first use; at most this many stay in memory (the least recently used is dropped).
MAX_LOADED_MODELS = int(os.environ.get('ANA_MAX_LOADED_MODELS', '3'))

# Upload limits. The field limits match the frontend (frontend/src/lib/images.ts).
MAX_FIELDS = 12  # Fields in one sample.
MAX_CELLS = 24   # Cell images in one request.
MAX_BYTES = 20 * 1024 * 1024
MAX_PIXELS = 40_000_000
# Detected from the file contents, not the name or declared type. TIFF is accepted for AIDA-style exports.
FORMATS = {'JPEG', 'PNG', 'BMP', 'TIFF'}

# The dev frontend reaches the API through Vite's proxy; CORS only matters when it is opened directly.
FRONTEND_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173']
