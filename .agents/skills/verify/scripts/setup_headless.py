#!/usr/bin/env python3
"""Prepare a checksum-verified private Sway runtime on Arch; no system install."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

from display import RUNTIME


def prepare():
    if shutil.which('sway'):
        print('System Sway is available')
        return
    records = {}
    for database in Path('/var/lib/pacman/sync').glob('*.db'):
        with tarfile.open(database) as archive:
            for member in archive.getmembers():
                if not member.name.endswith('/desc'):
                    continue
                fields = archive.extractfile(member).read().decode().split('\n\n')
                record = {field.splitlines()[0].strip('%'): field.splitlines()[1:]
                          for field in fields if field.strip()}
                if 'FILENAME' in record and 'SHA256SUM' in record:
                    records[record['FILENAME'][0]] = record
    urls = subprocess.check_output(['pacman', '-Sp', '--print-format', '%l', 'sway'], text=True).splitlines()
    RUNTIME.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='dailyxp-sway-') as scratch:
        for url in urls:
            filename = url.rsplit('/', 1)[-1]
            record = records.get(filename)
            if not record:
                raise RuntimeError(f'No trusted package metadata for {filename}')
            cached = Path('/var/cache/pacman/pkg') / filename
            package = Path(scratch) / filename
            if cached.exists():
                shutil.copyfile(cached, package)
            else:
                name = record['NAME'][0]
                archive_url = f'https://archive.archlinux.org/packages/{name[0]}/{name}/{filename}'
                urllib.request.urlretrieve(archive_url, package)
            digest = hashlib.sha256(package.read_bytes()).hexdigest()
            if digest != record['SHA256SUM'][0]:
                raise RuntimeError(f'Package checksum mismatch: {filename}')
            subprocess.run(['bsdtar', '-xf', str(package), '-C', str(RUNTIME)], check=True)
    subprocess.run([str(RUNTIME / 'usr/bin/sway'), '--version'], check=True,
                   env={'LD_LIBRARY_PATH': str(RUNTIME / 'usr/lib')})
    print(f'Private runtime ready: {RUNTIME}')


if __name__ == '__main__':
    prepare()
