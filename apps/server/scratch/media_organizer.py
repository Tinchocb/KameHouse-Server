import os
import re
import shutil
import argparse
from pathlib import Path

# Common patterns for anime/series
PATTERNS = [
    # Movies: Name (Year) [Movie].mkv
    r"(?P<title>.*?)\s*\((?P<year>\d{4})\)\s*\[Movie\].*\.(?P<ext>\w+)",
    # [Group] Series - 01 [720p].mkv -> S01E01
    r"\[.*\]\s*(?P<series>.*?)\s*-\s*(?P<ep>\d+)\s*.*?\.(?P<ext>\w+)",
    # Series S01E01
    r"(?P<series>.*?)\s*[Ss](?P<season>\d+)[Ee](?P<ep>\d+).*\.(?P<ext>\w+)",
    # Series - 01.mkv
    r"(?P<series>.*?)\s*-\s*(?P<ep>\d+).*\.(?P<ext>\w+)",
]

def clean_name(name):
    return name.strip().replace("_", " ").replace(".", " ")

def organize_media(root_path, dry_run=True):
    root = Path(root_path)
    if not root.exists():
        print(f"Error: Path {root_path} does not exist.")
        return

    print(f"{'DRY RUN: ' if dry_run else ''}Organizing media in {root_path}...")

    # Define subfolders
    subfolders = ["Series", "Peliculas"]
    
    for sub in subfolders:
        folder_path = root / sub
        if not folder_path.exists():
            continue
            
        print(f"\n--- Processing {sub} ---")
        
        for file in folder_path.rglob("*"):
            if file.is_dir() or file.suffix.lower() not in [".mkv", ".mp4", ".avi", ".mov", ".ts"]:
                continue

            filename = file.name
            matched = False

            for pattern in PATTERNS:
                match = re.search(pattern, filename)
                if match:
                    data = match.groupdict()
                    name = clean_name(data.get("series", data.get("title", "Unknown")))
                    # Remove trailing dashes if any
                    name = re.sub(r"\s*-\s*$", "", name)
                    ext = data.get("ext")
                    
                    if sub == "Series":
                        ep_num = int(data.get("ep", 1))
                        season_num = int(data.get("season", 1))
                        
                        # Target: Series/Name/Season 01/Name - S01E01.ext
                        new_dir = folder_path / name / f"Season {season_num:02d}"
                        new_filename = f"{name} - S{season_num:02d}E{ep_num:02d}.{ext}"
                    else:
                        # Target: Peliculas/Name (Year)/Name (Year).ext
                        year = data.get("year")
                        if not year:
                            year_match = re.search(r"\((\d{4})\)", filename) or re.search(r"(\d{4})", filename)
                            year = year_match.group(1) if year_match else ""
                        
                        folder_name = f"{name} ({year})" if year else name
                        new_dir = folder_path / folder_name
                        new_filename = f"{folder_name}.{ext}"

                    dest_path = new_dir / new_filename

                    if not dry_run:
                        new_dir.mkdir(parents=True, exist_ok=True)
                        if not dest_path.exists():
                            # Move file
                            try:
                                shutil.move(str(file), str(dest_path))
                                print(f"Moved: {filename} -> {sub}/{new_dir.name}/{new_filename}")
                            except Exception as e:
                                print(f"Error moving {filename}: {e}")
                    else:
                        print(f"Would move: {filename} -> {sub}/{new_dir.name}/{new_filename}")
                    
                    matched = True
                    break
            
            if not matched:
                print(f"Could not identify: {filename}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Organize anime/series files for KameHouse")
    parser.add_argument("path", help="Root path of your media")
    parser.add_argument("--run", action="store_true", help="Actually perform the move (default is dry-run)")
    
    args = parser.parse_args()
    organize_media(args.path, dry_run=not args.run)
