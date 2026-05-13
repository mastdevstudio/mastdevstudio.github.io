# David Žára web – developer structure (v94)

## Cíl refaktoru
Tato verze zachovává vizuál, obsah, obrázky i funkcionalitu kalkulaček. Refaktor se zaměřuje na technickou údržbu:

- žádné velké inline CSS bloky v HTML,
- společná clean-up vrstva v `site-clean.css`,
- mobilní navigace v `site-nav.js`,
- hypoteční kalkulačka v `hypotecni-kalkulacka.js`,
- důchodová kalkulačka v `penze-v13-script.js`,
- refinancování v `refi-script.js`.

## Struktura stylů
- `site-clean.css` – poslední společná clean/konverzní vrstva.
- `site-fixed-header.css` – společná vrstva pro fixní horní menu.
- `page-*.css` – styly vytažené z konkrétních stránek, aby HTML bylo čitelnější.
- `page-shared-service.css` – společný styl pro stránky s identickou strukturou služby.
- `refi-style.css` – hlavní styl refinancování.
- `penze-v13-styles.css` – hlavní styl důchodové kalkulačky.

## Co je zachováno
- hero obrázky,
- barevnost,
- rozložení,
- kalkulačky,
- formuláře,
- datové balíčky,
- favicony.

## Další technický krok pro 10/10
1. Sloučit `page-*.css` do skutečného design systému.
2. Omezit počet `!important`.
3. Z jednotlivých kalkulaček udělat modulární JS strukturu:
   - výpočty,
   - validace,
   - vykreslení výsledku,
   - odesílání formuláře.
4. Udělat browser QA v Chrome/Safari/iPhone.

## v97 content/design cleanup
Tato verze nedělá jednotný text CTA napříč celým webem. CTA zůstává tematické podle stránky.
Sjednocuje se hlavně:
- vizuální styl CTA,
- šířka hlavních bloků,
- rytmus sekcí,
- karta/formulář/panel systém,
- odstranění duplicitních vysvětlovacích bloků.

Ponechaný delší text je záměrně tam, kde má rozhodovací, metodickou nebo důvěryhodnostní funkci.
