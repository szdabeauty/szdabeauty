// Rebuilds parts of the pages from two plain text files that can be edited on GitHub:
//
//   arak.txt    -> the "Árlista" section             <!-- ARAK:START --> ... <!-- ARAK:END -->
//   adatok.txt  -> company details (tax number, seat, registration number, e-mail, phone, salon address):
//                  the data block of the privacy notice   <!-- ADAT:ADATKEZELO:START --> ... END
//                  the contact details                    <!-- ADAT:KAPCSOLAT:START --> ... END
//                  the structured data for search engines <!-- ADAT:JSONLD:START --> ... END
//
//   node build.mjs           rewrite those parts in every .html file that has the markers
//   node build.mjs --check   change nothing, exit 1 if a page is out of date
//
// Cloudflare runs this as the "Build command", so editing a text file on GitHub updates the site.
// If a text file has a mistake the script stops with a Hungarian message and a non-zero exit code:
// the build fails and the previous version of the site stays online.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes('--check');

class TxtError extends Error {}
let FILE = 'arak.txt';
const fail = (line, msg) => {
  const e = new TxtError(line ? `${FILE}, ${line}. sor: ${msg}` : `${FILE}: ${msg}`);
  e.file = FILE;
  throw e;
};
const failPage = msg => { throw new TxtError(msg); };

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- arak.txt (price list)

function splitPipe(s, n) {
  const i = s.indexOf('|');
  if (i < 0 && /\d\s*Ft\b/i.test(s)) fail(n, 'Úgy tűnik, az ár a név mellett maradt. Tedd közéjük a | jelet: Név | Ár');
  return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

function parse(text) {
  const blocks = [];
  let block = null, item = null, tier = null;
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1, line = raw.trim();
    if (line.startsWith('#')) return;
    if (!line) { item = tier = null; if (block && block.kind === 'text') block.cur = null; return; }

    const head = line.match(/^\[(.+)\]$/);
    if (head) {
      const title = head[1].trim(), kind = title.match(/^(LISTA|SZÖVEG)\s*:\s*(.+)$/i);
      if (kind && kind[1].toUpperCase() === 'LISTA') block = { kind: 'list', title: kind[2].trim(), rows: [] };
      else if (kind) block = { kind: 'text', title: kind[2].trim(), paras: [], cur: null };
      else block = { kind: 'group', title, items: [] };
      blocks.push(block); item = tier = null;
      return;
    }
    if (!block) fail(n, 'Előbb egy [Cím] sor kell, például [ARKANA neurokozmetikai kezelések].');

    if (block.kind === 'list') {
      const [name, price] = splitPipe(line, n);
      if (!line.includes('|') || !name) fail(n, 'Ebben a listában minden sor így épül fel: Név | Ár');
      block.rows.push({ name, price });
      return;
    }
    if (block.kind === 'text') {
      if (!block.cur) { block.cur = []; block.paras.push(block.cur); }
      block.cur.push(line);
      return;
    }

    // group of treatments
    if (line.startsWith('*')) {
      const [name, price] = splitPipe(line.slice(1), n);
      if (!name) fail(n, 'A * után meg kell adni a kezelés nevét: * Név | Ár');
      item = { name, price, nodes: [], tiers: [], deal: false };
      block.items.push(item); tier = null;
      return;
    }
    if (!item) fail(n, 'Ez a sor nem tartozik egyik kezeléshez sem. Új kezelést a * jellel kezdj: * Név | Ár');
    if (line.startsWith('>')) {
      const [name, price] = splitPipe(line.slice(1), n);
      if (!name) fail(n, 'A > után meg kell adni az alváltozat nevét: > Név | Ár');
      tier = { name: name.replace(/:$/, ''), price, lines: [] };
      item.tiers.push(tier);
      return;
    }
    if (tier) { tier.lines.push(line); return; }          // under a ">" line the text is shown exactly as written
    if (line.startsWith('- ')) item.nodes.push({ t: 'li', text: line.slice(2).trim() });
    else if (line.startsWith('+ ')) { item.nodes.push({ t: 'deal', text: line.slice(2).trim() }); item.deal = true; }
    else item.nodes.push({ t: 'p', text: line });
  });

  if (!blocks.length) fail(0, 'A fájl üres, nincs benne egyetlen [Cím] sem.');
  for (const b of blocks) {
    if (b.kind === 'group' && !b.items.length) fail(0, `A [${b.title}] csoportban nincs egyetlen kezelés sem.`);
    if (b.kind === 'list' && !b.rows.length) fail(0, `A [LISTA: ${b.title}] lista üres.`);
    if (b.kind === 'text' && !b.paras.length) fail(0, `A [SZÖVEG: ${b.title}] rész üres.`);
  }
  return blocks;
}

function renderItem(it) {
  let body = '', ul = '';
  const flush = () => { if (ul) { body += `<ul class="plain-list">${ul}</ul>`; ul = ''; } };
  for (const nd of it.nodes) {
    if (nd.t === 'li') { ul += `<li>${esc(nd.text)}</li>`; continue; }
    flush();
    body += nd.t === 'deal' ? `<p class="deal">${esc(nd.text)}</p>` : `<p>${esc(nd.text)}</p>`;
  }
  flush();
  if (it.tiers.length) {
    body += '\n        <div class="tiers">' + it.tiers.map(t =>
      '\n          <div class="tier"><p class="tier-name">' + esc(t.name) + ':' + (t.price ? ` <b>${esc(t.price)}</b>` : '') + '</p>' +
      t.lines.map(l => `<p>${esc(l)}</p>`).join('') + '</div>').join('') + '\n        </div>\n      ';
  }
  return `    <article class="item${it.deal ? ' bundle' : ''}">\n` +
         `      <div class="item-text"><h3>${esc(it.name)}</h3>${body}</div>\n` +
         (it.price ? `      <p class="price">${esc(it.price)}</p>\n` : '') +
         '    </article>';
}

function render(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.kind === 'group') {
      out.push(`  <p class="group">${esc(b.title)}</p>`, '  <div class="items">', b.items.map(renderItem).join('\n'), '  </div>');
    } else if (b.kind === 'list') {
      out.push(`  <h3 class="wax-h">${esc(b.title)}</h3>`,
        '  <ul class="wax">' + b.rows.map(r => `<li><span>${esc(r.name)}</span><span>${esc(r.price)}</span></li>`).join('') + '</ul>');
    } else {
      out.push(`  <h3 class="wax-h">${esc(b.title)}</h3>`, ...b.paras.map(p => `  <p>${p.map(esc).join('<br>')}</p>`));
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- adatok.txt (company details)

const SITE = 'https://szdabeauty.hu';
const FIELDS = {
  adatkezelo: 'Adatkezelő', szekhely: 'Székhely', adoszam: 'Adószám', nyilvantartasiszam: 'Cégjegyzékszám / nyilvántartási szám',
  email: 'E-mail', telefon: 'Telefon', szaloncime: 'Szalon címe',
};
const ALIAS = { telefonszam: 'telefon', cim: 'szaloncime', cegjegyzekszam: 'nyilvantartasiszam', cegjegyzekszamnyilvantartasiszam: 'nyilvantartasiszam' };
const REQUIRED = ['adatkezelo', 'szekhely', 'email', 'telefon', 'szaloncime'];
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

function parseData(text) {
  const d = {};
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1, line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^([^:]+):(.*)$/);
    if (!m) fail(n, 'Ez a sor így épül fel: Név: érték (kettősponttal).');
    let key = norm(m[1]); key = ALIAS[key] || key;
    if (!FIELDS[key]) fail(n, `Ismeretlen név: "${m[1].trim()}". Ezek lehetnek: ${Object.values(FIELDS).join(', ')}.`);
    if (key in d) fail(n, `A(z) "${FIELDS[key]}" kétszer szerepel.`);
    d[key] = m[2].trim();
  });
  for (const k of REQUIRED) if (!d[k]) fail(0, `A(z) "${FIELDS[k]}" sor hiányzik vagy üres, ezt nem lehet üresen hagyni.`);
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(d.email)) fail(0, `Az e-mail-cím nem tűnik érvényesnek: ${d.email}`);
  const digits = d.telefon.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) fail(0, `A telefonszám nem tűnik érvényesnek: ${d.telefon}`);
  return d;
}

const todo = '<mark class="todo">[még nincs megadva]</mark>';
const telHref = t => 'tel:' + (t.trim().startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
const mapHref = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a).replace(/%20/g, '+');
const mailLink = e => `<a href="mailto:${esc(e)}">${esc(e)}</a>`;
const telLink = t => `<a href="${esc(telHref(t))}">${esc(t)}</a>`;

function renderController(d) {
  return ['<dl>',
    '  <dt>Adatkezelő</dt>', `  <dd>${esc(d.adatkezelo)}</dd>`,
    '  <dt>Székhely</dt>', `  <dd>${esc(d.szekhely)}</dd>`,
    '  <dt>E-mail</dt>', `  <dd>${mailLink(d.email)}</dd>`,
    '  <dt>Telefonszám</dt>', `  <dd>${telLink(d.telefon)}</dd>`,
    '  <dt>Adószám</dt>', `  <dd>${d.adoszam ? esc(d.adoszam) : todo}</dd>`,
    '  <dt>Cégjegyzékszám / nyilvántartási szám</dt>', `  <dd>${d.nyilvantartasiszam ? esc(d.nyilvantartasiszam) : todo}</dd>`,
    '</dl>'].join('\n');
}

function renderContact(d) {
  return ['<dl>',
    '  <dt>E-mail</dt>', `  <dd>${mailLink(d.email)}</dd>`,
    '  <dt>Telefonszám</dt>', `  <dd>${telLink(d.telefon)}</dd>`,
    '  <dt>Cím</dt>',
    `  <dd>${esc(d.szaloncime)}<br><a class="maplink" href="${esc(mapHref(d.szaloncime))}" rel="noopener">Megnyitás a Térképen</a></dd>`,
    '</dl>'].join('\n');
}

function renderJsonLd(d) {
  const m = d.szaloncime.match(/^(\d{4})\s+([^,]+),\s*(.+)$/);
  const address = m
    ? { '@type': 'PostalAddress', streetAddress: m[3].trim(), postalCode: m[1], addressLocality: m[2].trim(), addressCountry: 'HU' }
    : { '@type': 'PostalAddress', streetAddress: d.szaloncime, addressCountry: 'HU' };
  const data = {
    '@context': 'https://schema.org', '@type': 'BeautySalon', '@id': SITE + '/#salon',
    name: 'SZDA Beauty & Skin', url: SITE + '/', image: SITE + '/img/og.jpg', logo: SITE + '/img/logo.webp',
    description: 'Szépségszalon Tatabányán: arckezelések, gyantázás, szemöldök- és szempilla styling, manikűr, pedikűr, smink.',
    telephone: telHref(d.telefon).slice(4), email: d.email, address,
    founder: { '@type': 'Person', name: 'Szabóné Deli Anna' },
    sameAs: ['https://www.facebook.com/share/1HsgUf9JpY/', 'https://www.instagram.com/szdabeauty888/'],
  };
  return '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';
}

// ---------------------------------------------------------------- putting the parts into the pages

const marker = (name, edge) => `<!-- ${name}:${edge} -->`;
const wrap = (html, ind) => '\n' + ind + html.split('\n').join('\n' + ind) + '\n' + ind;

function applyBlock(text, file, name, inner) {
  const S = marker(name, 'START'), E = marker(name, 'END');
  const a = text.indexOf(S), b = text.indexOf(E);
  if (a < 0 && b < 0) return null;                          // this page does not have that block
  if (a < 0 || b < a) failPage(`A(z) ${file} fájlban hiányzik vagy rossz helyen van a ${a < 0 ? S : E} jelölés.`);
  return text.slice(0, a + S.length) + inner + text.slice(b);
}

function main() {
  FILE = 'arak.txt';
  const blocks = parse(readFileSync(join(dir, 'arak.txt'), 'utf8'));
  FILE = 'adatok.txt';
  const data = parseData(readFileSync(join(dir, 'adatok.txt'), 'utf8'));

  const parts = [
    { name: 'ARAK', inner: '\n' + render(blocks) + '\n  ' },
    { name: 'ADAT:ADATKEZELO', inner: wrap(renderController(data), '  ') },
    { name: 'ADAT:KAPCSOLAT', inner: wrap(renderContact(data), '    ') },
    { name: 'ADAT:JSONLD', inner: wrap(renderJsonLd(data), '') },
  ];

  const used = new Set(), pages = new Set();
  let stale = 0;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.html'))) {
    const old = readFileSync(join(dir, f), 'utf8');
    let next = old;
    for (const p of parts) {
      const r = applyBlock(next, f, p.name, p.inner);
      if (r !== null) { next = r; used.add(p.name); pages.add(f); }
    }
    if (next !== old) {
      stale++;
      if (!checkOnly) writeFileSync(join(dir, f), next);
      console.log(`${checkOnly ? 'Elavult' : 'Frissítve'}: ${f}`);
    }
  }
  if (!used.has('ARAK')) failPage(`Egyik .html fájlban sincs ${marker('ARAK', 'START')} ... ${marker('ARAK', 'END')} jelölés, nincs hova beírni az árlistát.`);
  for (const p of parts) if (!used.has(p.name)) console.warn(`FIGYELEM: a(z) ${marker(p.name, 'START')} jelölés egyik oldalban sincs meg.`);

  const count = blocks.reduce((s, b) => s + (b.items ? b.items.length : 0), 0);
  console.log(`Árlista rendben: ${count} kezelés, ${blocks.length} rész.`);
  console.log(`Céges adatok rendben (adatok.txt).`);
  console.log(`${pages.size} oldal ellenőrizve${stale ? '' : ', nem változott semmi'}.`);
  const missing = ['adoszam', 'nyilvantartasiszam'].filter(k => !data[k]).map(k => FIELDS[k]);
  if (missing.length) console.warn(`FIGYELEM: még nincs megadva az adatok.txt fájlban: ${missing.join(', ')}. Az oldalon sárga felirat jelzi, éles használat előtt ki kell tölteni.`);
  if (checkOnly && stale) process.exit(1);
}

try { main(); } catch (e) {
  if (e instanceof TxtError) {
    console.error(`\nHIBA${e.file ? ` a(z) ${e.file} fájlban` : ''}!\n${e.message}\n\nAz oldal nem frissült, a régi változat marad látható.\n`);
    process.exit(1);
  }
  throw e;
}
