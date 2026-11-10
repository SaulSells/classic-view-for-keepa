// Keepa Classic: page-world helper (runs at document_start in the page's own JS context).
// When the address carries kc=1 (added by the extension's network rule while classic is on), it
// opens a fresh document at once, so none of the new site's code runs. content.js then hands it
// the verified October build, and it writes the old page into that document.
//   - keepa.com product pages: Keepa's Oct 13 2026 page
//   - keepa.com/keepaBox.html (the Keepa box inside Amazon pages): the Sep 11 box shell, running
//     the same Oct 13 code
(() => {
  const isBox = location.pathname === '/keepaBox.html';
  if (window.top !== window && !isBox) return;

  const route = (() => {
    if (isBox) return 'box';
    const p = location.pathname.match(/^\/product\/(\d+)-([A-Z0-9]{10})/i);
    if (p) return p[1] + '-' + p[2];
    const h = location.hash.match(/^#!product\/(\d+)-([A-Z0-9]{10})/i);
    return h ? h[1] + '-' + h[2] : null;
  })();
  const flagged = /(?:^|[?&])kc=1(?:&|$)/.test(location.search.slice(1));
  if (!flagged) return;
  let bypass = false;
  try { bypass = sessionStorage.getItem('keepaClassic.bypass') === '1'; } catch {}

  // On kc=1 addresses the network rule sets the October script policy, and the new site's own
  // inline scripts do not run under it. Pages that stay on the new site (Deals, Finder, a
  // fallback) move to kc=0, which keeps Keepa's current policy. content.js leaves them alone.
  if (!route || bypass) {
    document.open();
    location.replace(location.pathname + location.search.replace(/(^|[?&])kc=1(?=&|$)/, '$1kc=0') + location.hash);
    return;
  }

  // Do not call window.stop() first: that would make document.open() a no-op.
  document.open();

  // Results go back to content.js as string events (strings cross between the two JS worlds).
  const done = status => document.dispatchEvent(new CustomEvent('keepa-classic-status', { detail: status }));

  const SHELLS = {
    page: {
      js: '<script crossorigin="anonymous" src="//keepa.com/cdn/20261013/keepa.js"></script>',
      css: 'href="//keepa.com/cdn/20261013/keepa.css"',
    },
    box: {
      js: '<script crossorigin="anonymous" charset="UTF-8" type="text/javascript" src="//keepa.com/cdn/20260904/keepa.js"></script>',
      css: 'href="//keepa.com/cdn/20260904/keepa.css"',
    },
  };

  // grid.js add-on: the Oct 13 page calls GridOffer.setQuantityCheck(state), which the archived
  // Sep 4 grid.js lacks. This is a port of Keepa's own "Check stock past limit" tool for the
  // Offers table toolbar, using the October labels.
  const GRID_ADDON = `
;(function(){
var on=function(type,attr,fn){document.addEventListener(type,function(e){var t=e.target&&e.target.closest&&e.target.closest("["+attr+"]");if(t&&typeof GridGlossary!=="undefined")fn(t.getAttribute(attr))})};
on("click","data-kc-glossary-print",function(id){GridGlossary.print(id)});
on("input","data-kc-glossary-filter",function(id){GridGlossary.filter(id)});
})();
;(function(){try{
if(typeof GridOffer==="undefined"||GridOffer.setQuantityCheck)return;
var st={status:null,running:!1,outcome:null,run:null};
var OUT={read:["fa-check-circle","#2e7d32","_1730"],noLimit:["fa-info-circle","#2b6cb0","_1731"],noReading:["fa-exclamation-circle","#b26a00","_1732"],notRun:["fa-minus-circle","#888","_1733"]};
var L=function(k){try{return (window.la&&window.la[k])||k}catch(e){return k}};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
function render(){var bar=document.getElementById("grid-tools-offer");if(!bar)return;
var el=bar.querySelector(".tool__quantityCheck");
if(!el){el=document.createElement("span");el.className="tool__quantityCheck";var ex=bar.querySelector(".tool__export");if(ex&&ex.parentNode)ex.parentNode.insertBefore(el,ex.nextSibling);else bar.appendChild(el)}
var P=st.status,S=st.running,O=st.outcome,h="";
if(S||P&&P.enabled&&P.sellers>0){var spent=!S&&P.left===0,dis=S||spent;
var txt=S?L("_1787"):P.left>=0?L("_1960").replace("#left#",P.left).replace("#max#",P.perDay):L("_2034");
h+='<span class="trigger" role="button" aria-disabled="'+dis+'" title="'+esc(L("_1961"))+'" style="'+(dis?"opacity:.55;cursor:default":"cursor:pointer")+'"><i class="fa fa-fw '+(S?"fa-spinner fa-spin":"fa-cubes")+' fa-lg"></i>&ensp;'+esc(txt)+'&emsp;</span>'}
if(O&&!S){var k=OUT[O]||OUT.notRun;h+='<span class="tool__quantityCheckOutcome" style="color:'+k[1]+'" title="'+esc(O==="error"?L("_error"):L(k[2]))+'"><i class="fa fa-fw '+k[0]+' fa-lg"></i>&ensp;'+esc(L(k[2]))+'&emsp;</span>'}
el.innerHTML=h;el.style.display=h?"":"none";
var t=el.querySelector('.trigger[aria-disabled="false"]');t&&t.addEventListener("click",function(){st.run&&st.run()})}
GridOffer.setQuantityCheck=function(s){st=Object.assign({},st,s);render()};
var init=GridOffer.init;if(typeof init==="function")GridOffer.init=function(){var r=init.apply(this,arguments);try{r&&r.always&&r.always(function(){setTimeout(render,0)})}catch(e){}setTimeout(render,400);return r};
}catch(e){console.warn("[Keepa Classic] quantity check add-on",e)}})();`;

  // The October policy (see rules_classic.json) allows inline scripts only by hash. Two inline
  // handlers in grid.js become data attributes; GRID_ADDON listens for them.
  const GRID_ATTRS = [
    ['onclick="GridGlossary.print(\'${q}\')"', 'data-kc-glossary-print="${q}"'],
    ['oninput="GridGlossary.filter(\'${q}\')"', 'data-kc-glossary-filter="${q}"'],
  ];

  // This inline script runs only under the extension's policy, which lists its hash. Under
  // Keepa's current policy it is blocked, so the network rule is not on yet.
  const PROBE = 'document.currentScript.dataset.ok="1"';
  const policyReady = () => {
    const s = document.createElement('script');
    s.textContent = PROBE;
    document.appendChild(s);
    const ok = s.dataset.ok === '1';
    s.remove();
    return ok;
  };

  // Only the first event counts: content.js sends it once, before any page code runs.
  document.addEventListener('keepa-classic-build', ev => {
    let b;
    try { b = JSON.parse(ev.detail); } catch { return done('bad-input'); }

    if (!policyReady()) return done('csp');

    const shell = SHELLS[isBox ? 'box' : 'page'];
    let html = isBox ? b.box : b.html;
    if (!html || !html.includes(shell.js) || !html.includes(shell.css)) return done('shell-changed');

    let grid = String(b.grid || '');
    for (const [from, to] of GRID_ATTRS) grid = grid.split(from).join(to);

    const blobUrl = (text, type) => URL.createObjectURL(new Blob([text], { type }));
    const jsUrl = blobUrl(b.js, 'text/javascript');
    const cssUrl = blobUrl(b.css, 'text/css');
    const enUrl = blobUrl(b.en, 'application/json');
    const gridUrl = blobUrl(grid + GRID_ADDON, 'text/javascript');

    // Two path swaps, set on this window before the old code runs (the window and its prototypes
    // survive document.open): the October English labels for today's reworded file, and the
    // archived grid.js for /cdn/20261013/grid.js, which Keepa no longer serves.
    const EN_RE = /\/cdn\/languages\/en\.json\?20261013/;
    const GRID_RE = /\/cdn\/20261013\/grid\.js$/;
    const xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
      const args = [...arguments];
      if (typeof u === 'string' && EN_RE.test(u)) args[1] = enUrl;
      return xhrOpen.apply(this, args);
    };
    const pageFetch = window.fetch;
    window.fetch = function (i, n) {
      if (typeof i === 'string' && EN_RE.test(i)) i = enUrl;
      return pageFetch.call(this, i, n);
    };
    const src = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    Object.defineProperty(HTMLScriptElement.prototype, 'src', {
      configurable: true, enumerable: src.enumerable, get: src.get,
      set(v) { if (typeof v === 'string' && GRID_RE.test(v)) v = gridUrl; src.set.call(this, v); },
    });

    // The old code finds its build folder from script[src$="keepa.js"], so an inert tag keeps the
    // Oct 13 path.
    const scripts =
      '<script type="text/x-keepa-classic-ref" src="//keepa.com/cdn/20261013/keepa.js"></script>' +
      `<script src="${jsUrl}"></script>`;
    html = html.replace(shell.css, `href="${cssUrl}"`).replace(shell.js, scripts);

    if (!isBox) history.replaceState(history.state, '', '/?kc=1#!product/' + route);
    document.write(html);
    document.close();
    done('ok');
  }, { once: true });
})();
