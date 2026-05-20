#!/usr/bin/env python3
"""CANopen Master CLI Tool Entry Point"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from canopen_master.cli import cli

if __name__ == '__main__':
    cli()
