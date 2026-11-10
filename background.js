// Keepa Classic: background service worker.
// Downloads Keepa's own October 2026 web files from the Wayback Machine once, checks each one
// against a pinned SHA-256, and keeps them in chrome.storage.local. Nothing of Keepa's ships
// inside this extension.
//
// The "classic" network ruleset is the single on/off switch. While it is on, it:
//   - adds ?kc=1 to product page addresses and the Amazon box frame, which the page script reads
//     at once to decide, and
//   - on kc=1 pages, sets Keepa's October policy (hash-only inline scripts, plus blob: for the
//     verified copies) in place of today's script policy.
// It is only turned on after every file is downloaded and verified.

const BUILD = '20261013';
const FILES = {
  html: {
    url: 'https://web.archive.org/web/20261012095647id_/https://keepa.com/',
    sha256: 'ea6b3e4af683b849200ef6e2aa00c82bfbfc37dd7b5390b2b37ab7b6bf16363e',
  },
  // Page shell of the Keepa box on Amazon (Sep 11 2026, the last one before the redesign).
  box: {
    url: 'https://web.archive.org/web/20260911203326id_/https://keepa.com/keepaBox.html',
    sha256: '07b73a7132c05b66ed20d559c2d61ee2c6c2a0b3766cd928906392f18b988883',
  },
  js: {
    url: 'https://web.archive.org/web/20261012095648id_/https://keepa.com/cdn/20261013/keepa.js',
    sha256: 'bccc31f7991eb204430ef217e4955aa744f73c3dee7a03449787c10f5de5b7ff',
  },
  css: {
    url: 'https://web.archive.org/web/20261012095647id_/https://keepa.com/cdn/20261013/keepa.css',
    sha256: '3f4f4a841a37ae58d7c96e529413c14bffd9c0ef5e2a2dc5215050dcdc030f74',
  },
  // The Oct 13 grid.js (tables in the Data tab) was never archived. The Sep 4 one exposes the same
  // 23 grid classes the Oct 13 keepa.js calls. main.js adds the one method it lacks.
  grid: {
    url: 'https://web.archive.org/web/20260913184357id_/https://keepa.com/cdn/20260904/grid.js',
    sha256: 'f0bc665a96e96ffa1d77b291917db29855af2bbb56f99f90abaa19c887ed690c',
  },
  en: {
    url: 'https://web.archive.org/web/20261012095648id_/https://keepa.com/cdn/languages/en.json?20261013',
    sha256: '89f7f3db9fa050ad2419df908e47d011712b18416e266acc1307e56776c16ab1',
  },
};
const KEY = 'build_' + BUILD;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const isComplete = b => !!b && Object.keys(FILES).every(k => typeof b[k] === 'string' && b[k].length > 0);

let loading = null;
async function loadBuild() {
  const cached = (await chrome.storage.local.get(KEY))[KEY];
  if (isComplete(cached)) return cached;
  if (loading) return loading;
  loading = (async () => {
    const out = { ...(cached || {}) };
    for (const [name, f] of Object.entries(FILES)) {
      if (out[name]) continue;
      let lastErr = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const r = await fetch(f.url, { cache: 'no-store' });
          if (!r.ok) throw new Error(name + ': HTTP ' + r.status);
          const text = await r.text();
          const got = await sha256Hex(text);
          if (got !== f.sha256) throw new Error(name + ': checksum mismatch ' + got.slice(0, 12));
          out[name] = text;
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
        }
      }
      if (lastErr) {
        await chrome.storage.local.set({ [KEY]: out }); // keep what did download
        throw lastErr;
      }
    }
    await chrome.storage.local.set({ [KEY]: out });
    return out;
  })();
  try { return await loading; } finally { loading = null; }
}

async function setRules(enabled) {
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled ? { enableRulesetIds: ['classic'] } : { disableRulesetIds: ['classic'] }
  );
}

// Turning on waits for the verified files, so a page never switches to classic before they exist.
async function setOn(on) {
  await chrome.storage.local.set({ on });
  if (!on) { await setRules(false); return { ok: true, on: false }; }
  try {
    await loadBuild();
    await setRules(true);
    return { ok: true, on: true };
  } catch (e) {
    await setRules(false);
    return { ok: false, on: true, error: e.message };
  }
}

async function isOn() {
  return (await chrome.storage.local.get('on')).on !== false; // default on
}

async function boot() {
  const r = await setOn(await isOn());
  if (!r.ok) console.warn('[Keepa Classic] classic files not ready:', r.error);
}
chrome.runtime.onInstalled.addListener(boot);
chrome.runtime.onStartup.addListener(boot);

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    if (msg.type === 'getBuild') {
      try { reply({ ok: true, build: await loadBuild() }); }
      catch (e) { reply({ ok: false, error: e.message }); }
    } else if (msg.type === 'setOn') {
      reply(await setOn(!!msg.on));
    } else if (msg.type === 'getOn') {
      const rules = await chrome.declarativeNetRequest.getEnabledRulesets();
      reply({ ok: true, on: await isOn(), active: rules.includes('classic') });
    } else if (msg.type === 'repair') {
      // A page found the rules off while classic is meant to be on: try again.
      reply(await setOn(await isOn()));
    }
  })();
  return true;
});
