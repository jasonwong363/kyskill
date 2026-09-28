#!/usr/bin/env python3
"""Compatibility entry point for the shared KY exporter."""
import argparse, os, subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('html'); p.add_argument('--output', required=True)
p.add_argument('--width', type=int, default=1080)
p.add_argument('--scale', type=int, default=1)
p.add_argument('--target-height', type=int, default=2800)
a=p.parse_args()
script=Path(__file__).resolve().parents[4]/'scripts/export-wechat.cjs'
raise SystemExit(subprocess.call([os.environ.get('QUOTE_NODE_EXECUTABLE','node'), str(script), a.html, a.output, '报价', '--width', str(a.width), '--scale', str(a.scale), '--target-height', str(a.target_height)]))
