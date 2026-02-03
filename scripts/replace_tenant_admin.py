#!/usr/bin/env python3
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE_DIRS = {'.git', 'node_modules', 'frontend/dist', 'htmlcov', '__pycache__'}
EXTENSIONS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.sql', '.md', '.json', '.sh', '.txt', '.html'}

replacements = [
    ("tenant_manager@sparknode.io", "tenant_manager@sparknode.io"),
    ("tenant_manager", "tenant_manager"),
    ("Tenant Manager", "Tenant Manager"),
]

changed_files = []

for dirpath, dirnames, filenames in os.walk(ROOT):
    # skip excluded dirs
    parts = Path(dirpath).parts
    if any(p in EXCLUDE_DIRS for p in parts):
        continue
    for fn in filenames:
        fp = Path(dirpath) / fn
        if fp.suffix.lower() not in EXTENSIONS:
            continue
        try:
            text = fp.read_text(encoding='utf-8')
        except Exception:
            continue
        new_text = text
        for old, new in replacements:
            new_text = new_text.replace(old, new)
        if new_text != text:
            fp.write_text(new_text, encoding='utf-8')
            changed_files.append(str(fp.relative_to(ROOT)))

print(f"Replaced in {len(changed_files)} files")
for f in changed_files:
    print(f)
