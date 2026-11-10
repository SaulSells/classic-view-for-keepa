// Keepa Classic: content script (isolated world, document_start, keepa.com pages and the Keepa
// box frame on Amazon). main.js decides at once from the kc=1 flag in the address. This script
// fetches the verified build, hands it over, handles failures, and shows the view toggle.
(() => {
  const isBox = location.pathname === '/keepaBox.html';
  if (window.top !== window && !isBox) return;

  const SS_RELOADS = 'keepaClassic.reloads';
  const SS_BYPASS = 'keepaClassic.bypass';
  const SS_NOTE = 'keepaClassic.note';
  const ss = {
    get: k => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
    del: k => { try { sessionStorage.removeItem(k); } catch {} },
  };
  const send = msg => new Promise(res => {
    try { chrome.runtime.sendMessage(msg, r => res(r || { ok: false, error: chrome.runtime.lastError?.message || 'no reply' })); }
    catch (e) { res({ ok: false, error: e.message }); }
  });

  function productRoute() {
    if (isBox) return 'box';
    const p = location.pathname.match(/^\/product\/(\d+)-([A-Z0-9]{10})/i);
    if (p) return p[1] + '-' + p[2];
    const h = location.hash.match(/^#!product\/(\d+)-([A-Z0-9]{10})/i);
    return h ? h[1] + '-' + h[2] : null;
  }
  const flagged = () => /(?:^|[?&])kc=1(?:&|$)/.test(location.search.slice(1));
  const classicUrl = r => 'https://keepa.com/?kc=1#!product/' + r;
  const newUrl = r => 'https://keepa.com/product/' + r;

  // A few reloads at most per tab session, so a bad state can never loop.
  function safeGo(url) {
    const n = Number(ss.get(SS_RELOADS) || 0);
    if (n >= 3) return false;
    ss.set(SS_RELOADS, String(n + 1));
    url ? location.replace(url) : location.reload();
    return true;
  }
  function fallBack(note) {
    ss.set(SS_BYPASS, '1');
    ss.set(SS_NOTE, note);
    location.reload();
  }

  // ---------- toggle pill (shadow DOM so neither Keepa version's CSS touches it) ----------
  let pillHost = null;
  // ---------- toggle inside the Keepa box on Amazon ----------
  // Classic box: an inline link in the box's own link row ("News ✜ Support ✜ …").
  // New box (no such row): a small corner button.
  async function boxSwitch(classic) {
    const r = await send({ type: 'setOn', on: !classic });
    if (!r.ok) return false;
    location.replace('https://keepa.com/keepaBox.html' + (classic ? '' : '?kc=1'));
    return true;
  }
  function showBoxToggle(mode) {
    const classic = mode === 'classic';
    const label = classic ? 'New Keepa view' : 'Classic Keepa view';
    const onClick = async ev => {
      ev.preventDefault();
      const el = ev.currentTarget;
      el.textContent = classic ? 'Switching…' : 'Loading classic…';
      if (!(await boxSwitch(classic))) el.textContent = 'Classic files unavailable';
    };
    const placeInline = () => {
      if (document.getElementById('kc-box-toggle')) return true;
      const news = [...document.querySelectorAll('a[href$="#!news"]')][0];
      if (!news || !news.parentNode) return false;
      const a = document.createElement('a');
      a.id = 'kc-box-toggle'; a.href = '#'; a.textContent = label; a.title = 'Classic view for Keepa: switch the layout';
      const sep = document.createElement('span');
      sep.innerHTML = '&ensp;&#x271C;&ensp;';
      a.addEventListener('click', onClick);
      news.parentNode.insertBefore(a, news);
      news.parentNode.insertBefore(sep, news);
      return true;
    };
    const placeCorner = () => {
      if (!document.body || document.getElementById('kc-box-corner')) return;
      const host = document.createElement('div');
      host.id = 'kc-box-corner';
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        a{position:fixed;right:6px;top:4px;z-index:2147483647;font:500 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
          color:#256a9a;background:#fff;border:1px solid #c9d2dc;border-radius:999px;padding:4px 8px;text-decoration:none;opacity:.8}
        a:hover{opacity:1}</style><a href="#" title="Classic view for Keepa: switch the layout">${label}</a>`;
      root.querySelector('a').addEventListener('click', onClick);
      document.body.appendChild(host);
    };
    if (classic) {
      // The old box rebuilds its link row on each product, so keep the link in place.
      const tick = () => { placeInline(); };
      setInterval(tick, 700);
      // If the row never shows (layout change), fall back to the corner button.
      setTimeout(() => { if (!placeInline()) placeCorner(); }, 8000);
    } else {
      const wait = () => (document.body ? placeCorner() : setTimeout(wait, 300));
      wait();
      setInterval(() => { if (!document.getElementById('kc-box-corner')) placeCorner(); }, 1500);
    }
  }

  function showPill(mode, note) {
    if (isBox) return showBoxToggle(mode);
    const attach = () => {
      if (!document.body) return setTimeout(attach, 200);
      if (pillHost && pillHost.isConnected) pillHost.remove();
      pillHost = document.createElement('div');
      pillHost.id = 'keepa-classic-toggle';
      const root = pillHost.attachShadow({ mode: 'open' });
      const classic = mode === 'classic';
      root.innerHTML = `
        <style>
          .pill{position:fixed;right:14px;bottom:14px;z-index:2147483647;display:flex;align-items:center;gap:8px;
            font:500 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1f2933;
            background:#fff;border:1px solid #c9d2dc;border-radius:999px;padding:6px 6px 6px 12px;
            box-shadow:0 2px 10px rgba(0,0,0,.12);opacity:.85;transition:opacity .15s}
          .pill:hover{opacity:1}
          button{font:inherit;cursor:pointer;border:0;border-radius:999px;padding:6px 10px;
            background:${classic ? '#e8eef5' : '#256a9a'};color:${classic ? '#1f2933' : '#fff'}}
          button[disabled]{opacity:.6;cursor:default}
          .note{color:#b42318;max-width:280px;line-height:1.3}
          .x{background:transparent;color:#697585;padding:4px 6px}
        </style>
        <div class="pill" role="region" aria-label="Classic view for Keepa">
          <span class="${note ? 'note' : ''}">${note || (classic ? 'Classic Keepa view' : 'New Keepa view')}</span>
          <button class="go" type="button">${classic ? 'Switch to new' : 'Switch to classic'}</button>
          <button class="x" type="button" title="Hide until next page">✕</button>
        </div>`;
      const go = root.querySelector('.go');
      go.addEventListener('click', async () => {
        const route = productRoute();
        go.disabled = true;
        ss.del(SS_RELOADS); ss.del(SS_BYPASS);
        if (classic) {
          await send({ type: 'setOn', on: false });
          location.replace(route ? newUrl(route) : 'https://keepa.com/');
        } else {
          go.textContent = 'Loading classic…';
          const r = await send({ type: 'setOn', on: true });
          if (!r.ok) { go.disabled = false; go.textContent = 'Switch to classic'; root.querySelector('span').textContent = 'Classic files unavailable: ' + (r.error || 'unknown'); return; }
          location.replace(route ? classicUrl(route) : 'https://keepa.com/?kc=1');
        }
      });
      root.querySelector('.x').addEventListener('click', () => pillHost.remove());
      document.body.appendChild(pillHost);
    };
    attach();
  }

  // ---------- classic ----------
  async function runClassic(route) {
    // main.js has already opened a fresh document, so none of the new site's code runs.
    const on = await send({ type: 'getOn' });
    if (on.ok && !on.on) {
      // Stale kc=1 (bookmark, back button) while classic is off.
      if (isBox) return fallBack('');
      return safeGo(newUrl(route)) || fallBack('');
    }
    const res = await send({ type: 'getBuild' });
    if (!res.ok) return fallBack('Classic files unavailable (' + res.error + '). Showing new view.');

    let status = 'no-reply';
    const onStatus = ev => { status = String(ev.detail); };
    document.addEventListener('keepa-classic-status', onStatus);
    document.dispatchEvent(new CustomEvent('keepa-classic-build', { detail: JSON.stringify({ ...res.build, route }) }));
    document.removeEventListener('keepa-classic-status', onStatus);

    if (status === 'csp') {
      await send({ type: 'repair' });
      if (safeGo()) return;
      return fallBack('Classic view blocked by page policy. Showing new view.');
    }
    if (status !== 'ok') return fallBack('Classic view failed (' + status + '). Showing new view.');
    ss.del(SS_RELOADS);

    showPill('classic');
    if (!isBox) {
      // Leaving product pages inside the old app: hand over to the new site (Deals, Finder, etc.).
      window.addEventListener('hashchange', () => {
        if (!productRoute() && location.hash.length > 2) location.replace('https://keepa.com/' + location.hash);
      });
    }
  }

  // ---------- new site ----------
  let skipRoute = null; // a product that just fell back to the new view is not switched again
  function runNewSite(note) {
    if (isBox) return showBoxToggle('new');
    let shownFor = null;
    const tick = async () => {
      const r = productRoute();
      if (r && shownFor !== r) {
        shownFor = r;
        // Classic is on, but the new site got here by in-app navigation: switch this page over.
        if (r !== skipRoute) {
          const on = await send({ type: 'getOn' });
          if (on.ok && on.on && on.active && productRoute() === r) { safeGo(classicUrl(r)); return; }
        }
        showPill('new', note); note = null;
      }
      if (!r && pillHost && pillHost.isConnected) { pillHost.remove(); shownFor = null; }
    };
    document.addEventListener('DOMContentLoaded', tick);
    setInterval(tick, 1000);
  }

  // ---------- decide (same test as main.js) ----------
  const route = productRoute();
  const bypass = ss.get(SS_BYPASS) === '1';
  if (route && flagged() && !bypass) {
    runClassic(route);
  } else {
    const note = ss.get(SS_NOTE);
    ss.del(SS_NOTE);
    // A bypass lasts for one page load, and for that product while this page stays open.
    if (bypass) { ss.del(SS_BYPASS); skipRoute = route; }
    runNewSite(bypass ? note : null);
  }
})();
