import asyncio
import json
from playwright.async_api import async_playwright

SERIES_URLS = {
    "original": "https://es.wikipedia.org/wiki/Anexo:Episodios_de_Dragon_Ball",
    "z": "https://es.wikipedia.org/wiki/Anexo:Episodios_de_Dragon_Ball_Z",
    "gt": "https://es.wikipedia.org/wiki/Anexo:Episodios_de_Dragon_Ball_GT",
    "kai": "https://es.wikipedia.org/wiki/Anexo:Episodios_de_Dragon_Ball_Kai",
    "super": "https://es.wikipedia.org/wiki/Anexo:Episodios_de_Dragon_Ball_Super",
    "daima": "https://es.wikipedia.org/wiki/Anexo:Episodios_de_Dragon_Ball_Daima"
}

async def scrape_series(page, series_id, url):
    print(f"Navegando a la Wiki de {series_id}...")
    try:
        response = await page.goto(url, timeout=60000)
        if response.status == 404:
            print(f"URL no encontrada para {series_id}")
            return []
    except Exception as e:
        print(f"Error al cargar {url}: {e}")
        return []

    print(f"Extrayendo títulos para {series_id}...")
    titles = await page.evaluate('''() => {
        const results = [];
        const tables = document.querySelectorAll('table.wikitable');
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                // Buscamos la fila donde esté el título en español.
                // Usualmente en Wikipedia el número está en el td 0 o th 0, y el título en el td 1 o 2.
                
                // Intento heurístico: si encontramos algo parecido a "Título"
                // Para simplificar, buscamos un número al principio
                if (cells.length >= 2) {
                    let numStr = "";
                    let title = "";
                    
                    const th = row.querySelector('th');
                    if (th) {
                        numStr = th.innerText.trim();
                        title = cells[1] ? cells[1].innerText.trim() : cells[0].innerText.trim();
                    } else {
                        numStr = cells[0].innerText.trim();
                        title = cells[1].innerText.trim();
                    }
                    
                    // Limpiar título de comillas y saltos
                    title = title.replace(/"/g, '').split('\\n')[0];
                    
                    const match = numStr.match(/^(\\d+)/);
                    if (match) {
                        results.push({num: parseInt(match[1]), title: title});
                    }
                }
            });
        });
        return results;
    }''')

    # Remove duplicates and sort
    unique_titles = {}
    for t in titles:
        if t['num'] not in unique_titles:
            unique_titles[t['num']] = t['title']
    
    sorted_titles = [{"num": k, "title": unique_titles[k]} for k in sorted(unique_titles.keys())]
    return sorted_titles

async def run():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            all_titles = {}
            for series_id, url in SERIES_URLS.items():
                titles = await scrape_series(page, series_id, url)
                all_titles[series_id] = titles
                print(f"-> {series_id}: extraídos {len(titles)} episodios.")
            
            with open('db_all_titles.json', 'w', encoding='utf-8') as f:
                json.dump(all_titles, f, ensure_ascii=False, indent=2)
            
            print(f"¡Hecho! Se guardaron todas las series en db_all_titles.json.")
            await browser.close()
        except Exception as e:
            print(f"Error fatal: {e}")

if __name__ == "__main__":
    asyncio.run(run())
