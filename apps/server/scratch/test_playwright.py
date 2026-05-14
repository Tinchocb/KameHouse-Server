import asyncio
from playwright.async_api import async_playwright
import json

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("https://dragonball.fandom.com/es/wiki/Lista_de_episodios_de_Dragon_Ball_Z", timeout=60000)
        
        tables = await page.evaluate('''() => {
            return document.querySelectorAll('table').length;
        }''')
        print(f"Tablas encontradas: {tables}")
        
        html = await page.content()
        with open("test.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
