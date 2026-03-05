/**
 * v6 - The WS message is binary. Inspect the raw bytes to understand encoding.
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = '/Users/karl/work/language-app';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
    baseURL: BASE_URL,
  });

  const page = await context.newPage();

  const traceMessages = [];
  await page.exposeFunction('__trace', (msg) => {
    traceMessages.push(msg);
    console.log('TRACE:', msg);
  });

  await page.addInitScript(() => {
    const OrigWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);

      if (url && url.includes('generativelanguage')) {
        window.__trace('Gemini WS constructor: ' + url.slice(0, 80));

        let _onmessage = null;
        Object.defineProperty(ws, 'onmessage', {
          get() { return _onmessage; },
          set(fn) {
            window.__trace('onmessage SET');
            _onmessage = async function(event) {
              const data = event.data;
              const dataType = typeof data;
              const isBlob = data instanceof Blob;
              const isArrayBuffer = data instanceof ArrayBuffer;

              let textContent = null;
              let hexPreview = null;
              let byteLength = null;

              if (isBlob) {
                byteLength = data.size;
                const ab = await data.arrayBuffer();
                const bytes = new Uint8Array(ab);
                byteLength = bytes.length;
                // Convert to text
                try {
                  const dec = new TextDecoder('utf-8');
                  textContent = dec.decode(bytes);
                } catch(e) {}
                // Hex preview
                hexPreview = Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2,'0')).join(' ');
                window.__trace('onmessage BLOB size=' + byteLength + ' text="' + (textContent||'').slice(0,200) + '" hex=' + hexPreview);
              } else if (isArrayBuffer) {
                const bytes = new Uint8Array(data);
                byteLength = bytes.length;
                try {
                  const dec = new TextDecoder('utf-8');
                  textContent = dec.decode(bytes);
                } catch(e) {}
                hexPreview = Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2,'0')).join(' ');
                window.__trace('onmessage ArrayBuffer size=' + byteLength + ' text="' + (textContent||'').slice(0,200) + '" hex=' + hexPreview);
              } else if (dataType === 'string') {
                window.__trace('onmessage STRING: ' + data.slice(0, 300));
              } else {
                window.__trace('onmessage UNKNOWN type: ' + dataType);
              }

              // Now call the real handler - but wrap JSON.parse to catch the failure
              const origJSONParse = JSON.parse;
              let parseAttempts = [];
              JSON.parse = function(text) {
                parseAttempts.push(typeof text + ':' + String(text).slice(0, 50));
                try {
                  return origJSONParse.call(this, text);
                } catch(e) {
                  window.__trace('JSON.parse FAILED on: ' + String(text).slice(0, 100) + ' error: ' + e.message);
                  throw e;
                }
              };

              try {
                fn.call(this, event);
              } catch(e) {
                window.__trace('onmessage handler THREW: ' + e.name + ': ' + e.message);
              } finally {
                JSON.parse = origJSONParse;
                if (parseAttempts.length > 0) {
                  window.__trace('JSON.parse was called ' + parseAttempts.length + ' times: ' + parseAttempts.join(', '));
                }
              }
            };
            ws.addEventListener('message', _onmessage);
          },
          configurable: true,
        });

        ws.addEventListener('close', evt => {
          window.__trace('WS CLOSE code=' + evt.code + ' reason=' + evt.reason);
        });
      }
      return ws;
    };
    window.WebSocket.prototype = OrigWS.prototype;
    window.WebSocket.CONNECTING = OrigWS.CONNECTING;
    window.WebSocket.OPEN = OrigWS.OPEN;
    window.WebSocket.CLOSING = OrigWS.CLOSING;
    window.WebSocket.CLOSED = OrigWS.CLOSED;
  });

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('HMR') && !text.includes('React DevTools') && !text.includes('webpack') && !text.includes('turbopack') && !text.includes('ScriptProcessor')) {
      console.log('CONSOLE [' + msg.type() + ']:', text.slice(0, 200));
    }
  });

  page.on('pageerror', err => {
    console.log('PAGE_ERR:', err.message);
  });

  await page.goto(BASE_URL + '/app', { waitUntil: 'networkidle' });
  await sleep(800);

  // Step 2: Click Start Call
  await page.locator('button').nth(1).click();
  await sleep(500);

  // Step 3: Click Phone
  console.log('Clicking Phone button...');
  await page.locator('button').nth(0).click();

  // Wait for WS activity
  await sleep(5000);

  await page.screenshot({ path: SCREENSHOT_DIR + '/v6-final.png', fullPage: true });

  console.log('\n=== FULL TRACE ===');
  traceMessages.forEach((m, i) => console.log(`[${i}]`, m));

  const finalText = await page.locator('body').innerText();
  console.log('\nFinal state:', finalText.includes('Connecting...') ? 'STUCK' : finalText.slice(0, 80));

  console.log('\n=== DIAGNOSIS ===');
  const blobMsg = traceMessages.find(m => m.includes('BLOB') || m.includes('ArrayBuffer'));
  const stringMsg = traceMessages.find(m => m.includes('STRING'));
  const jsonFailed = traceMessages.find(m => m.includes('JSON.parse FAILED'));

  if (blobMsg) {
    console.log('MESSAGE TYPE: Binary (Blob/ArrayBuffer)');
    console.log('The server is sending binary frames.');
    if (blobMsg.includes('setupComplete') || blobMsg.includes('text="')) {
      const match = blobMsg.match(/text="([^"]{0,300})"/);
      if (match) {
        console.log('Decoded text content:', match[1]);
        if (match[1].includes('setupComplete') || match[1].includes('setup_complete')) {
          console.log('FINDING: Message IS valid JSON/text but delivered as binary Blob.');
          console.log('BUG: The code does JSON.parse(event.data) but event.data is a Blob, not a string.');
          console.log('FIX NEEDED: Read Blob with FileReader or event.data.text() before JSON.parse');
        }
      }
    }
  } else if (stringMsg) {
    console.log('MESSAGE TYPE: String (text frame)');
    console.log('Message was text but JSON.parse failed?');
  }

  if (jsonFailed) {
    console.log('JSON.parse failed:', jsonFailed);
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
