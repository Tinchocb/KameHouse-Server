import asyncio
import json
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            print("Navegando a la Wiki...")
            await page.goto('https://dragonball.fandom.com/es/wiki/Lista_de_episodios_de_Dragon_Ball_Z', timeout=60000)
            
            print("Extrayendo títulos...")
            titles = await page.evaluate('''() => {
                const results = [];
                const tables = document.querySelectorAll('table.wikitable');
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const numStr = cells[0].innerText.trim();
                            const title = cells[1].innerText.trim().replace(/"/g, '');
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
            
            with open('dbz_full_verified.json', 'w', encoding='utf-8') as f:
                json.dump(sorted_titles, f, ensure_ascii=False, indent=2)
            
            print(f"¡Hecho! Se guardaron {len(sorted_titles)} episodios.")
            await browser.close()
        except Exception as e:
            print(f"Error fatal: {e}")

if __name__ == "__main__":
    asyncio.run(run())
