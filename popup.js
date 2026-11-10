const box = document.getElementById('on');
const status = document.getElementById('status');

function show(r) {
  if (!r) return;
  if (r.on && !r.active) status.textContent = 'Downloading and checking the classic files…';
  else status.textContent = r.on ? 'Classic view is on.' : 'Classic view is off.';
}

chrome.runtime.sendMessage({ type: 'getOn' }, r => { box.checked = !!(r && r.on); show(r); });

box.addEventListener('change', async () => {
  box.disabled = true;
  status.textContent = box.checked ? 'Downloading and checking the classic files…' : 'Turning off…';
  const r = await chrome.runtime.sendMessage({ type: 'setOn', on: box.checked });
  box.disabled = false;
  if (!r.ok) { status.textContent = 'Classic files unavailable: ' + (r.error || 'unknown') + '. Try again later.'; return; }
  status.textContent = (r.on ? 'Classic view is on.' : 'Classic view is off.') + ' Reload open Amazon pages to update the Keepa box.';
  const tabs = await chrome.tabs.query({ url: 'https://keepa.com/*' });
  for (const t of tabs) chrome.tabs.reload(t.id);
});
