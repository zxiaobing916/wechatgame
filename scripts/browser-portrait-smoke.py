"""Portrait regression entry point; now uses the immersive touch layout."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name("browser-immersive-smoke.py")),run_name="__main__")
