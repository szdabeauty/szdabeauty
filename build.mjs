// Rebuilds the "Árlista" section of the pages from arak.txt.
//
//   node build.mjs           rewrite the price list in every .html file that has the markers
//   node build.mjs --check   change nothing, exit 1 if a page is out of date
//
// Cloudflare runs this as the "Build command", so editing arak.txt on GitHub updates the site.
// If arak.txt has a mistake the script stops with a Hungarian message and a non-zero exit code:
// the build fails and the previous version of the site stays online.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const START = '<!-- ARAK:START -->';
const END = '<!-- ARAK:END -->';
const checkOnly = process.argv.includes('--check');

class ArakError extends Error {}
const fail = (line, msg) => { throw new ArakError(line ? `arak.txt, ${line}. sor: ${msg}` : `arak.txt: ${msg}`); };

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function splitPipe(s, n) {
  const i = s.indexOf('|');
  if (i < 0 && /\d\s*Ft\b/i.test(s)) fail(n, 'Úgy tűnik, az ár a név mellett maradt. Tedd közéjük a | jelet: Név | Ár');
  return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

function parse(text) {
  const blocks = [];
  let block = null, item = null, tier = null;
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
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

function main() {
  const blocks = parse(readFileSync(join(dir, 'arak.txt'), 'utf8'));
  const html = '\n' + render(blocks) + '\n  ';
  const count = blocks.reduce((s, b) => s + (b.items ? b.items.length : 0), 0);
  let touched = 0, stale = 0;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.html'))) {
    const old = readFileSync(join(dir, f), 'utf8');
    const a = old.indexOf(START), b = old.indexOf(END);
    if (a < 0 && b < 0) continue;
    if (a < 0 || b < a) fail(0, `A(z) ${f} fájlban hiányzik vagy rossz helyen van a ${a < 0 ? START : END} jelölés.`);
    const next = old.slice(0, a + START.length) + html + old.slice(b);
    touched++;
    if (next !== old) {
      stale++;
      if (!checkOnly) writeFileSync(join(dir, f), next);
      console.log(`${checkOnly ? 'Elavult' : 'Frissítve'}: ${f}`);
    }
  }
  if (!touched) fail(0, `Egyik .html fájlban sincs ${START} ... ${END} jelölés, nincs hova beírni az árlistát.`);
  console.log(`Árlista rendben: ${count} kezelés, ${blocks.length} rész, ${touched} oldal${stale ? '' : ' (nem változott semmi)'}.`);
  if (checkOnly && stale) process.exit(1);
}

try { main(); } catch (e) {
  if (e instanceof ArakError) { console.error('\nHIBA az árlistában!\n' + e.message + '\n\nAz oldal nem frissült, a régi árlista marad látható.\n'); process.exit(1); }
  throw e;
}
