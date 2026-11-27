"""Prepare the pinned variable Noto fonts for the quote renderer."""

import argparse
import hashlib
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.request import urlopen

UPSTREAM = "https://raw.githubusercontent.com/google/fonts/40cd5edf3831c9e0012b96345c476598595b9970/ofl/"
FONTS = {
    "NotoSansSC.ttf": (
        "notosanssc/NotoSansSC%5Bwght%5D.ttf",
        "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da",
    ),
    "NotoSerifSC.ttf": (
        "notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
        "050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9",
    ),
}


def checksum(path):
    digest = hashlib.sha256()
    with path.open("rb") as reader:
        for block in iter(lambda: reader.read(256 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def prepare(destination):
    destination.mkdir(parents=True, exist_ok=True)
    for name, (source, expected) in FONTS.items():
        target = destination / name
        if target.is_file() and checksum(target) == expected:
            print(target)
            continue
        with NamedTemporaryFile(dir=destination, delete=False) as writer:
            temp = Path(writer.name)
        try:
            with urlopen(UPSTREAM + source, timeout=45) as response, temp.open("wb") as writer:
                for block in iter(lambda: response.read(256 * 1024), b""):
                    writer.write(block)
            if checksum(temp) != expected:
                raise ValueError(f"Font checksum did not match: {name}")
            temp.replace(target)
        finally:
            temp.unlink(missing_ok=True)
        print(target)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--out", type=Path, required=True, help="Destination directory for variable TTF files")
    args = cli.parse_args()
    try:
        prepare(args.out.resolve())
    except (OSError, ValueError) as error:
        cli.exit(1, f"{error}\n")
