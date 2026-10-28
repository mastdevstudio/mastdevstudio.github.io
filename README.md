# Mast Dev Studio

Statický web publikovaný z větve `main` pomocí GitHub Pages. Nevyžaduje sestavení ani instalaci závislostí.

## Struktura

- `index.html` — úvod, hry, nástroje a odkaz na 3D modely.
- `styles.css` — společný modrý vzhled hlavní stránky a zásad soukromí.
- `js/gallery.js` — přístupná galerie screenshotů (dialog, šipky, Escape).
- `privacy/index.html` — rozcestník zásad soukromí.
- `privacy/<aplikace>.html` — plné české a anglické zásady jednotlivých aplikací.
- `privacy-*.html` v kořeni — pouze kompatibilní přesměrování původních adres. Zachovat: tyto URL používají App Store a starší odkazy. GitHub Pages nenabízí vlastní HTTP přesměrování, proto se používá HTML refresh, canonical a přímý náhradní odkaz.
- `assets/` — ikony a původní screenshoty.
- `manuals/` — příručky aplikací.
- `DZ/` — samostatný web s vlastními styly a skripty.

## Lokální kontrola

V kořeni repozitáře spusťte `python -m http.server 8000` a otevřete `http://localhost:8000/`.

Při přidání aplikace aktualizujte kartu na úvodní stránce, rozcestník `privacy/index.html`, zásady soukromí a počty aplikací/her/nástrojů v úvodu a záhlavích skupin. Původní zásady mají zůstat dostupné; při změně URL přidejte přesměrování. Obsah zásad a datum účinnosti měňte pouze při skutečné změně zpracování dat.
