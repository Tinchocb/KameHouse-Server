import sqlite3
import re
import os

db_path = r'C:/Users/marti/AppData/Roaming/KameHouse/kamehouse.db'
overrides_path = r'd:/Proyectos personales/KameHouse/apps/server/internal/api/metadata_provider/latin_overrides.go'

def update_database():
    if not os.path.exists(db_path):
        print(f"Error: No se encontró la base de datos en {db_path}")
        return

    try:
        # 1. Parse the Go file to get the titles
        with open(overrides_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Regex to find map entries: 12609: { "1": "...", ... }
        # This is a bit simplified but should work for our structure
        titles_map = {}
        
        # Find all blocks like ID: { ... }
        blocks = re.findall(r'(\d+):\s*\{([^}]+)\}', content, re.DOTALL)
        
        for media_id_str, episodes_block in blocks:
            media_id = int(media_id_str)
            episodes = re.findall(r'"(\d+)":\s*"([^"]+)"', episodes_block)
            titles_map[media_id] = {int(num): title for num, title in episodes}

        print(f"Leídos {len(titles_map)} medios del archivo de configuración.")

        # 2. Connect to DB and update
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        updated_count = 0
        
        for tmdb_id, episodes in titles_map.items():
            # Get the internal library_media.id for this tmdb_id
            # Note: For movies, our tmdb_id in the map has the 1,000,000 offset
            search_id = tmdb_id
            if tmdb_id >= 1000000:
                search_id = tmdb_id - 1000000
                
            cursor.execute("SELECT id FROM library_media WHERE tmdb_id = ?", (search_id,))
            media_row = cursor.fetchone()
            
            if not media_row:
                continue
                
            internal_id = media_row[0]
            
            for ep_num, title in episodes.items():
                cursor.execute("""
                    UPDATE library_episodes 
                    SET title = ? 
                    WHERE library_media_id = ? AND episode_number = ?
                """, (title, internal_id, ep_num))
                if cursor.rowcount > 0:
                    updated_count += 1

        conn.commit()
        conn.close()
        
        print(f"¡Éxito! Se actualizaron {updated_count} títulos en la base de datos.")

    except Exception as e:
        print(f"Error durante la actualización: {e}")

if __name__ == "__main__":
    update_database()
