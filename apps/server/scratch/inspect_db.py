import sqlite3
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

db_path = r'C:/Users/marti/AppData/Roaming/KameHouse/kamehouse.db'

def check_titles():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check Z and Original DB with Season Number
        cursor.execute("""
            SELECT m.tmdb_id, m.title_english, e.season_number, e.episode_number, e.title 
            FROM library_episodes e
            JOIN library_media m ON e.library_media_id = m.id
            WHERE m.tmdb_id IN (12609, 12971, 12697, 62715)
            ORDER BY m.tmdb_id, e.season_number, e.episode_number ASC
            LIMIT 200
        """)
        rows = cursor.fetchall()
        for row in rows:
            print(f"[{row[0]}] {row[1]} - S{row[2]}E{row[3]}: {row[4]}")
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_titles()
