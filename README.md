# Classic view for Keepa (unofficial)

**Unofficial. Not affiliated with, endorsed by or supported by Keepa GmbH.** "Keepa" is their name; this project only changes how their page looks in your own browser.

A free Chrome extension that shows Keepa in its October 2026 layout, on keepa.com product pages and in the Keepa box on Amazon product pages. The data is the same live Keepa data you see today. Only the layout is old.

You get the old product page back as a whole: the Amazon Price History / Track product / Data / Variations tabs, the legend on the right, the Day to All range list, the Data tab tables (Product Details, Offers, Buy Box Statistics), Statistic, Compare international Amazon prices, Share Graph and Graph Settings.

## Install (2 minutes)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder.
4. Open any Keepa product page, for example `https://keepa.com/#!product/1-B0BQRST9PK`, or any Amazon product page with the Keepa extension installed.

On install the extension downloads the old files once and checks them. This takes a few seconds. Classic view turns on when they are ready.

## Switch between old and new

- On keepa.com, the button in the bottom-right corner of a product page switches views.
- The extension icon has the same switch. It also controls the Keepa box on Amazon. Reload open Amazon pages after you switch.

Classic view only takes over product pages and the Amazon box. Deals, Product Finder, Tracking and the rest of keepa.com stay on the new site.

## How it works

- Keepa's own web build from October 13, 2026 is saved on the Wayback Machine. The extension downloads 6 files from there: the page, the Amazon box page (September 11), `keepa.js`, `keepa.css`, the October English labels and `grid.js`.
- Each file must match a fixed SHA-256 checksum, so the extension runs Keepa's exact files or nothing. No Keepa code ships inside this extension.
- `grid.js` draws the Data tab tables. The October 13 copy was never archived, so the extension uses the September 4 copy. It has the same 23 table classes the October page calls. October added one tool to the Offers table, "Check stock past limit". The extension adds that tool, ported from Keepa's current code, with the October labels.
- While classic view is on, a network rule adds `kc=1` to the address of Keepa product pages and the Amazon box, and removes Keepa's script policy header on those pages. The page script sees `kc=1` and loads the old page. Turn classic view off and the rule is gone.
- The old page uses the same live Keepa data feed (protocol version 3.0) as the new site. The Amazon box uses the same messages to talk to the Keepa extension as before.

## Permissions

- `keepa.com`: to load the classic page.
- `web.archive.org`: to download the October files once.
- Amazon sites: Chrome only lets an extension change a frame's network request when it also has access to the page that loads the frame. The extension does not read or change Amazon pages.

## Limits

- If Keepa changes its data feed in a way the October page can't read, classic view will break. Switch to the new view until it is fixed.
- If the Wayback Machine is down on first use, classic view stays off and the popup says so. Try again later.
