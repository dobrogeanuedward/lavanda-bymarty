"""Compatibility launcher for the current refined LAVANDA vector system.

The superseded hand-sketch translation is archived under docs/studies.
"""
from pathlib import Path
import subprocess

subprocess.run(["node", str(Path(__file__).with_name("generate-brand-refined.mjs"))], check=True)
