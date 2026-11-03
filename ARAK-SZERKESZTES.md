# Az árlista átírása

Az oldalon az **Árlista** az `arak.txt` fájlból készül. Ha ebben átírsz egy árat vagy egy szöveget, 1-2 percen belül megváltozik a weboldalon is.

## Lépések

1. Jelentkezz be a GitHubra (a szdabeauty@gmail.com címmel).
2. Nyisd meg ezt a címet: <https://github.com/szdabeauty/szdabeauty/blob/main/arak.txt>
3. Kattints a **ceruza** ikonra a jobb felső részen (Edit this file).
4. Írd át a számot vagy a szöveget. A sor elején a `*` jelet és a `|` jelet (magyar billentyűzeten: AltGr + W) hagyd a helyén.
5. Kattints a zöld **Commit changes...** gombra, majd a felugró ablakban még egyszer a **Commit changes** gombra.
6. Várj 1-2 percet, nyisd meg az oldalt, és nyomj **Ctrl + F5**-öt.

## Példák

**Ár átírása:** a `* Neuro Gaba Therapy | 25.000 Ft / 60 perc` sorban a 25.000-et írd át.

**Új kezelés:** másolj ki egy meglévő kezelést (a `*` sortól a leírás végéig), tedd elé és mögé egy üres sort, és írd át a nevét, árát, leírását.

**Kezelés törlése:** töröld ki a kezelés összes sorát (a `*` sortól az utolsó leírás sorig).

**Új gyantázás sor:** a `[LISTA: GYANTÁZÁS]` alá írd be így: `Szemöldök | 1.800 Ft`

Az `arak.txt` tetején, a `#` jellel kezdődő sorokban ott van az összes szabály is.

## Ha valami nem sikerül

Ha elrontasz valamit (például kimarad a `*` jel), az oldal nem frissül, és a **régi árlista marad látható**, tehát nem tudsz kárt tenni. A GitHubon a mentésed mellett piros X jelenik meg. Ilyenkor szólj Vincének, ő megnézi és kijavítja.

---

### Technikai megjegyzés (fejlesztőknek)

- A `build.mjs` (Node, függőség nélkül) az `arak.txt` alapján újraírja az `<!-- ARAK:START -->` és `<!-- ARAK:END -->` jelölések közötti részt minden `.html` fájlban.
- Cloudflare: Workers & Pages → a projekt → Settings → Build → **Build command: `node build.mjs`**. Hiba esetén a script nem nulla kilépési kóddal áll meg, a build megbukik, a korábbi verzió marad élesben.
- Helyben: `node build.mjs` (írás), `node build.mjs --check` (csak ellenőrzés).
- A `.assetsignore` miatt az `arak.txt`, a `build.mjs` és ez a leírás nem kerül fel a nyilvános oldalra.
