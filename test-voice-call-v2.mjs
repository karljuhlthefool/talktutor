/**
 * Playwright script v2 - Inspect DOM structure then test voice call
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

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() !== 'log' || !text.includes('HMR')) {
      console.log('CONSOLE:', text);
    }
  });

  // Capture page errors
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    consoleLogs.push('[PAGE_ERROR] ' + err.message);
  });

  // Capture ALL WebSocket connections
  const wsConnections = {};
  page.on('websocket', ws => {
    const url = ws.url();
    if (url.includes('generativelanguage')) {
      console.log('\n*** GEMINI WS OPENED:', url.slice(0, 100) + '...');
      wsConnections['gemini'] = { url, frames: [], closed: false };

      ws.on('framesent', frame => {
        const payload = frame.payload.toString();
        wsConnections['gemini'].frames.push({ dir: 'sent', payload: payload.slice(0, 500) });
        console.log('GEMINI WS SENT:', payload.slice(0, 200));
      });

      ws.on('framereceived', frame => {
        const payload = frame.payload.toString();
        wsConnections['gemini'].frames.push({ dir: 'received', payload: payload.slice(0, 500) });
        console.log('GEMINI WS RECEIVED:', payload.slice(0, 300));
      });

      ws.on('close', () => {
        wsConnections['gemini'].closed = true;
        console.log('*** GEMINI WS CLOSED');
      });
    }
  });

  // ---- Step 1: Navigate and inspect DOM ----
  console.log('\n=== STEP 1: Navigate to /app and inspect DOM ===');
  await page.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' });
  await sleep(1500);

  // Inspect all buttons on the page
  const buttons = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    return Array.from(btns).map((btn, i) => ({
      index: i,
      text: btn.innerText.trim().slice(0, 100),
      className: btn.className.slice(0, 150),
      ariaLabel: btn.getAttribute('aria-label'),
      svgCount: btn.querySelectorAll('svg').length,
    }));
  });

  console.log('\nAll buttons found on page:');
  buttons.forEach(b => {
    console.log(`  [${b.index}] text="${b.text}" svgs=${b.svgCount} class="${b.className.slice(0, 60)}..."`);
  });

  await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-test-v2-1-initial.png`, fullPage: true });
  console.log('Screenshot: voice-test-v2-1-initial.png');

  // ---- Step 2: Click the correct "Start Call" button ----
  console.log('\n=== STEP 2: Click the Start Call button ===');

  // The start call button is a large rounded button with a Mic icon
  // Based on the code, it has class containing "rounded-full" and "bg-gradient-to-br from-blue-500"
  // On the /app page (SpeakPage), it's near "Start Call" text

  // Find button near "Start Call" text
  const startCallLabel = await page.getByText('Start Call');
  const labelCount = await startCallLabel.count();
  console.log('"Start Call" text elements found:', labelCount);

  // The button is just above the "Start Call" text in a flex column
  // Try clicking by finding button that contains Mic svg
  const allButtonsInfo = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    return Array.from(btns).map((btn, i) => {
      const svgs = btn.querySelectorAll('svg');
      const svgClasses = Array.from(svgs).map(s => s.getAttribute('class') || '').join(',');
      const rect = btn.getBoundingClientRect();
      return {
        index: i,
        text: btn.innerText.trim(),
        svgClasses,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        hasMicIcon: btn.innerHTML.includes('M12 2a3 3 0 0 0-3 3v7') || btn.innerHTML.includes('mic'),
        hasPhoneIcon: btn.innerHTML.includes('phone') || btn.innerHTML.includes('Phone'),
        innerHTML_preview: btn.innerHTML.slice(0, 200),
      };
    });
  });

  console.log('\nDetailed button analysis:');
  allButtonsInfo.forEach(b => {
    if (b.width > 50 || b.svgClasses) {
      console.log(`  [${b.index}] ${b.width}x${b.height}px text="${b.text}" mic=${b.hasMicIcon} phone=${b.hasPhoneIcon}`);
      console.log(`         innerHTML: ${b.innerHTML_preview.slice(0, 100)}`);
    }
  });

  // Click the large round button (the main Start Call button)
  // It should be roughly square and large (128x128 based on w-32 h-32 = 8rem = 128px)
  const largeButton = allButtonsInfo.find(b => b.width > 100 && b.width < 200 && b.hasMicIcon);
  if (largeButton) {
    console.log(`\nClicking large mic button at index ${largeButton.index}`);
    await page.locator('button').nth(largeButton.index).click();
  } else {
    // Fallback: click button near "Start Call" text
    const startCallSection = page.locator('div').filter({ hasText: /^Start Call$/ });
    const nearButton = page.locator('button').filter({ has: page.locator('svg') }).nth(1);
    console.log('Falling back to button with SVG #1');
    await nearButton.click();
  }

  await sleep(800);

  // Snapshot the page state after click
  const stateAfterClick = await page.evaluate(() => {
    return {
      bodyText: document.body.innerText.slice(0, 300),
      hasConnecting: document.body.innerText.includes('Connecting'),
      hasStartCall: document.body.innerText.includes('Start Call'),
    };
  });
  console.log('State after click:', stateAfterClick);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-test-v2-2-after-click.png`, fullPage: true });
  console.log('Screenshot: voice-test-v2-2-after-click.png');

  if (!stateAfterClick.hasConnecting && stateAfterClick.hasStartCall) {
    console.log('\nPage still shows "Start Call" - click may not have triggered the call flow.');
    console.log('The app may require authentication before allowing calls.');

    // Check for login redirect or auth wall
    const currentURL = page.url();
    console.log('Current URL:', currentURL);

    // Check if there is a login/auth requirement visible
    const bodyHTML = await page.evaluate(() => document.body.innerHTML.slice(0, 1000));
    console.log('Body HTML preview:', bodyHTML.slice(0, 500));

    await browser.close();
    return;
  }

  // ---- Step 3: Wait for Gemini WS and connection result ----
  console.log('\n=== STEP 3: Waiting up to 15 seconds for Gemini WS connection ===');

  let finalStatus = 'unknown';
  let geminiWsConnected = false;

  for (let i = 0; i < 15; i++) {
    await sleep(1000);

    const state = await page.evaluate(() => ({
      bodyText: document.body.innerText.slice(0, 400),
      hasConnecting: document.body.innerText.includes('Connecting...'),
      hasActive: document.body.innerText.includes('active'),
      hasConnectionLost: document.body.innerText.includes('Connection Lost'),
      hasMicDenied: document.body.innerText.includes('Microphone Access Denied'),
      hasScenarioPicker: document.body.innerText.includes('Choose a Scenario'),
      hasEndButton: document.body.innerText.includes('End'),
      hasTimer: /\d{2}:\d{2}/.test(document.body.innerText),
    }));

    geminiWsConnected = !!wsConnections['gemini'];

    console.log(`  [${i+1}s] connecting=${state.hasConnecting} active=${state.hasActive} geminiWS=${geminiWsConnected} timer=${state.hasTimer} scenarioPicker=${state.hasScenarioPicker}`);

    if (state.hasActive || state.hasTimer || state.hasScenarioPicker) {
      finalStatus = 'active';
      console.log('  -> ACTIVE STATE REACHED');
      break;
    } else if (state.hasConnectionLost) {
      finalStatus = 'connection-lost';
      console.log('  -> CONNECTION LOST error');
      break;
    } else if (state.hasMicDenied) {
      finalStatus = 'mic-denied';
      console.log('  -> MIC DENIED error');
      break;
    } else if (!state.hasConnecting && !state.hasActive) {
      finalStatus = 'idle';
      console.log('  -> Back to IDLE (silent failure)');
      break;
    }
  }

  if (finalStatus === 'unknown') {
    finalStatus = 'stuck-connecting';
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-test-v2-3-final.png`, fullPage: true });
  console.log('Screenshot: voice-test-v2-3-final.png');

  // ---- Step 4: Detailed Gemini WS report ----
  console.log('\n=== GEMINI WEBSOCKET REPORT ===');
  if (wsConnections['gemini']) {
    const gws = wsConnections['gemini'];
    console.log('Connected: YES');
    console.log('Closed:', gws.closed);
    console.log('Total frames:', gws.frames.length);
    console.log('\nFrames:');
    gws.frames.slice(0, 10).forEach((f, i) => {
      console.log(`  [${i}] ${f.dir.toUpperCase()}: ${f.payload.slice(0, 250)}`);
    });
  } else {
    console.log('Gemini WebSocket NEVER OPENED');
    console.log('This means the call flow was not triggered at all.');
  }

  // ---- Summary ----
  console.log('\n=== FINAL SUMMARY ===');
  console.log('Final Status:', finalStatus);
  console.log('Gemini WS Connected:', !!wsConnections['gemini']);

  const errors = consoleLogs.filter(l => l.includes('[ERROR]') || l.includes('PAGE_ERROR'));
  if (errors.length > 0) {
    console.log('\nErrors found:');
    errors.forEach(e => console.log(' ', e));
  }

  if (finalStatus === 'active') {
    console.log('\nRESULT: PASS - Call connected, UI in active state');
  } else if (finalStatus === 'stuck-connecting') {
    const hasGemini = !!wsConnections['gemini'];
    const hasSetupComplete = hasGemini && wsConnections['gemini'].frames.some(
      f => f.dir === 'received' && f.payload.includes('setupComplete')
    );
    console.log('\nRESULT: FAIL - UI stuck on "Connecting..."');
    console.log('  Gemini WS opened:', hasGemini);
    console.log('  setupComplete received:', hasSetupComplete);
  } else {
    console.log('\nRESULT: FAIL - Status:', finalStatus);
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
