# Az árlista és a céges adatok átírása

Az oldalon két rész szöveges fájlból készül. Ha ezekben átírsz valamit, 1-2 percen belül megváltozik a weboldalon is.

| Fájl | Mit lehet benne átírni |
|---|---|
| `arak.txt` | az **Árlista**: árak, kezelések, leírások |
| `adatok.txt` | **adószám, székhely, cégjegyzékszám / nyilvántartási szám**, e-mail-cím, telefonszám, a szalon címe (az adatkezelési tájékoztatóban és a Kapcsolat résznél jelennek meg) |

## Lépések

1. Jelentkezz be a GitHubra (a szdabeauty@gmail.com címmel).
2. Nyisd meg a fájlt: <https://github.com/szdabeauty/szdabeauty/blob/main/arak.txt> vagy <https://github.com/szdabeauty/szdabeauty/blob/main/adatok.txt>
3. Kattints a **ceruza** ikonra a jobb felső részen (Edit this file).
4. Írd át a számot vagy a szöveget. Az `arak.txt`-ben a sor elején a `*` jelet és a `|` jelet (magyar billentyűzeten: AltGr + W) hagyd a helyén. Az `adatok.txt`-ben a kettőspont előtti nevet hagyd meg, csak a kettőspont utáni részt írd át.
5. Kattints a zöld **Commit changes...** gombra, majd a felugró ablakban még egyszer a **Commit changes** gombra.
6. Várj 1-2 percet, nyisd meg az oldalt, és nyomj **Ctrl + F5**-öt.

## Példák

**Ár átírása:** az `arak.txt`-ben a `* Neuro Gaba Therapy | 25.000 Ft / 60 perc` sorban a 25.000-et írd át.

**Új kezelés:** másolj ki egy meglévő kezelést (a `*` sortól a leírás végéig), tedd elé és mögé egy üres sort, és írd át a nevét, árát, leírását.

**Kezelés törlése:** töröld ki a kezelés összes sorát (a `*` sortól az utolsó leírás sorig).

**Új gyantázás sor:** a `[LISTA: GYANTÁZÁS]` alá írd be így: `Szemöldök | 1.800 Ft`

**Adószám beírása:** az `adatok.txt`-ben az `Adószám:` sor végére írd be a számot, például `Adószám: 12345678-1-23`

**Február végén, a KATA-ra váltáskor:** az `adatok.txt`-ben írd át az `Adatkezelő`, az `Adószám` és a `Cégjegyzékszám / nyilvántartási szám` sort a saját adataidra.

Mindkét fájl tetején, a `#` jellel kezdődő sorokban ott van az összes szabály.

## Ha valami nem sikerül

Ha elrontasz valamit (például kimarad a `*` jel az árlistában, vagy hibás az e-mail-cím az adatoknál), az oldal nem frissül, és a **régi változat marad látható**, tehát nem tudsz kárt tenni. A GitHubon a mentésed mellett piros X jelenik meg. Ilyenkor szólj Vincének, ő megnézi és kijavítja.

---

### Technikai megjegyzés (fejlesztőknek)

- A `build.mjs` (Node, függőség nélkül) az `arak.txt` és az `adatok.txt` alapján újraírja a `<!-- ARAK:START/END -->`, `<!-- ADAT:ADATKEZELO:START/END -->`, `<!-- ADAT:KAPCSOLAT:START/END -->` és `<!-- ADAT:JSONLD:START/END -->` jelölések közötti részeket minden `.html` fájlban.
- Cloudflare: Workers & Pages → a projekt → Settings → Build → **Build command: `node build.mjs`**. Hiba esetén a script nem nulla kilépési kóddal áll meg, a build megbukik, a korábbi verzió marad élesben.
- Helyben: `node build.mjs` (írás), `node build.mjs --check` (csak ellenőrzés). Az üres Adószám/Nyilvántartási szám figyelmeztetést ad, de nem állítja meg a buildet. Éles indítás előtt ellenőrizd, hogy egyetlen `class="todo"` sem maradt az oldalakon.
- A `.assetsignore` miatt az `arak.txt`, az `adatok.txt`, a `build.mjs` és ez a leírás nem kerül fel a nyilvános oldalra.
