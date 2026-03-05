/**
 * v5 - Inject tracing into the page JS to see exactly where the state machine breaks.
 * We intercept WebSocket.prototype.onmessage assignment to trace the setupComplete handler.
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

  // Expose a function to receive messages from within the page
  const traceMessages = [];
  await page.exposeFunction('__trace', (msg) => {
    traceMessages.push(msg);
    console.log('TRACE:', msg);
  });

  // Inject before page load - intercept WebSocket to trace onmessage
  await page.addInitScript(() => {
    const OrigWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);

      if (url && url.includes('generativelanguage')) {
        window.__trace('WS constructor called for Gemini API');

        // Intercept onmessage assignment
        let _onmessage = null;
        Object.defineProperty(ws, 'onmessage', {
          get() { return _onmessage; },
          set(fn) {
            window.__trace('onmessage handler set on Gemini WS');
            _onmessage = function(event) {
              window.__trace('onmessage FIRED: ' + (typeof event.data === 'string' ? event.data.slice(0, 200) : '[binary]'));
              let result;
              try {
                result = fn.call(this, event);
              } catch(e) {
                window.__trace('onmessage THREW: ' + e.name + ': ' + e.message + '\n' + e.stack.slice(0, 300));
                throw e;
              }
              window.__trace('onmessage completed without throw');
              return result;
            };
            ws.addEventListener('message', _onmessage);
          },
          configurable: true,
        });

        // Also intercept the close event
        ws.addEventListener('close', (evt) => {
          window.__trace('Gemini WS close event: code=' + evt.code + ' reason=' + evt.reason);
        });

        ws.addEventListener('error', (evt) => {
          window.__trace('Gemini WS error event fired');
        });
      }
      return ws;
    };
    window.WebSocket.prototype = OrigWS.prototype;
    window.WebSocket.CONNECTING = OrigWS.CONNECTING;
    window.WebSocket.OPEN = OrigWS.OPEN;
    window.WebSocket.CLOSING = OrigWS.CLOSING;
    window.WebSocket.CLOSED = OrigWS.CLOSED;

    // Also intercept console.error to catch any silent errors
    const origError = console.error.bind(console);
    console.error = function(...args) {
      window.__trace('console.error: ' + args.map(a => String(a)).join(' ').slice(0, 300));
      return origError(...args);
    };

    const origWarn = console.warn.bind(console);
    console.warn = function(...args) {
      window.__trace('console.warn: ' + args.map(a => String(a)).join(' ').slice(0, 200));
      return origWarn(...args);
    };
  });

  const allConsoleLogs = [];
  page.on('console', msg => {
    const text = '[' + msg.type() + '] ' + msg.text();
    allConsoleLogs.push(text);
    if (!text.includes('HMR') && !text.includes('React DevTools') && !text.includes('webpack') && !text.includes('turbopack')) {
      console.log('CONSOLE:', text);
    }
  });

  page.on('pageerror', err => {
    console.log('PAGE_ERR:', err.message);
  });

  // Step 1: Navigate
  await page.goto(BASE_URL + '/app', { waitUntil: 'networkidle' });
  await sleep(800);

  // Step 2: Click Start Call (SpeakPage -> VoiceCall)
  await page.locator('button').nth(1).click();
  await sleep(500);

  // Step 3: Click Phone button in VoiceCall
  console.log('\n=== Clicking Phone button ===');
  await page.locator('button').nth(0).click();

  // Step 4: Wait and collect trace
  await sleep(6000);

  await page.screenshot({ path: SCREENSHOT_DIR + '/v5-final.png', fullPage: true });

  // Step 5: Report
  console.log('\n=== TRACE LOG ===');
  traceMessages.forEach((m, i) => console.log(`[${i}]`, m));

  // Check if onmessage was called
  const onmessageFired = traceMessages.some(m => m.includes('onmessage FIRED'));
  const onmessageThrew = traceMessages.some(m => m.includes('onmessage THREW'));
  const setupCompleteReceived = traceMessages.some(m => m.includes('setupComplete'));
  const onmessageCompleted = traceMessages.some(m => m.includes('onmessage completed'));

  console.log('\n=== KEY FINDINGS ===');
  console.log('Gemini WS constructed:', traceMessages.some(m => m.includes('WS constructor')));
  console.log('onmessage handler set:', traceMessages.some(m => m.includes('onmessage handler set')));
  console.log('onmessage fired (setupComplete):', onmessageFired);
  console.log('setupComplete in payload:', setupCompleteReceived);
  console.log('onmessage threw exception:', onmessageThrew);
  console.log('onmessage completed normally:', onmessageCompleted);

  const finalText = await page.locator('body').innerText();
  console.log('Final UI state:', finalText.includes('Connecting...') ? 'STUCK on Connecting...' :
    finalText.includes('active') ? 'ACTIVE' : finalText.slice(0, 80));

  // Check for errors
  const errors = allConsoleLogs.filter(l =>
    l.toLowerCase().includes('error') || l.includes('Gemini') || l.includes('warn')
  );
  if (errors.length > 0) {
    console.log('\nConsole errors/warnings:');
    errors.forEach(e => console.log(' ', e));
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
