/**
 * Playwright script v3 - Two-step flow: SpeakPage -> VoiceCall -> handleStartCall
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

  // Capture all console output
  const consoleLogs = [];
  page.on('console', msg => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (!text.includes('[HMR]') && !text.includes('webpack-hmr')) {
      console.log('CONSOLE:', text);
    }
  });

  page.on('pageerror', err => {
    const text = '[PAGE_ERROR] ' + err.message;
    consoleLogs.push(text);
    console.log(text);
  });

  // Track Gemini WebSocket specifically
  const geminiWS = { opened: false, frames: [], closed: false, closeCode: null, closeReason: null };

  page.on('websocket', ws => {
    const url = ws.url();
    if (url.includes('generativelanguage')) {
      geminiWS.opened = true;
      console.log('\n*** GEMINI WS OPENED:', url.slice(0, 120) + '...');

      ws.on('framesent', frame => {
        const payload = frame.payload.toString();
        geminiWS.frames.push({ dir: 'sent', payload });
        // Only log non-audio frames (audio frames are huge base64 blobs)
        let parsed;
        try { parsed = JSON.parse(payload); } catch { parsed = null; }
        if (!parsed?.realtime_input) {
          console.log('GEMINI SENT:', payload.slice(0, 300));
        }
      });

      ws.on('framereceived', frame => {
        const payload = frame.payload.toString();
        geminiWS.frames.push({ dir: 'received', payload });
        console.log('GEMINI RECEIVED:', payload.slice(0, 400));
      });

      ws.on('close', () => {
        geminiWS.closed = true;
        console.log('*** GEMINI WS CLOSED');
      });
    }
  });

  // ---- Step 1: Navigate to /app ----
  console.log('\n=== STEP 1: Navigate to /app (SpeakPage) ===');
  await page.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' });
  await sleep(1000);

  const initialText = await page.locator('body').innerText();
  console.log('Initial page text:', initialText.slice(0, 200));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v3-1-speak-page.png`, fullPage: true });

  // ---- Step 2: Click "Start Call" mic button on SpeakPage ----
  console.log('\n=== STEP 2: Click "Start Call" mic button (SpeakPage) ===');
  // This is button[1] - the 128x128px mic button
  await page.locator('button').nth(1).click();
  await sleep(600);

  const afterStep2Text = await page.locator('body').innerText();
  console.log('After SpeakPage click:', afterStep2Text.slice(0, 150));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/v3-2-voice-call-idle.png`, fullPage: true });

  // Now we should be in VoiceCall component, status='idle'
  // Shows "Ready to practice?" and a Phone button
  const hasReadyToPractice = afterStep2Text.includes('Ready to practice');
  console.log('VoiceCall idle state shown:', hasReadyToPractice);

  if (!hasReadyToPractice) {
    console.log('ERROR: Did not reach VoiceCall idle state. Aborting.');
    await browser.close();
    return;
  }

  // ---- Step 3: Click the Phone button inside VoiceCall ----
  console.log('\n=== STEP 3: Click Phone button in VoiceCall (triggers handleStartCall) ===');

  // In VoiceCall, the phone button is the only button when status='idle' (unless error)
  // It has class "w-24 h-24 rounded-full"
  const buttons = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    return Array.from(btns).map((btn, i) => {
      const rect = btn.getBoundingClientRect();
      return {
        index: i,
        text: btn.innerText.trim(),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        hasPhone: btn.innerHTML.toLowerCase().includes('phone'),
        hasMic: btn.innerHTML.toLowerCase().includes('mic'),
        className: btn.className.slice(0, 100),
      };
    });
  });

  console.log('Buttons in VoiceCall idle state:');
  buttons.forEach(b => console.log(`  [${b.index}] ${b.width}x${b.height}px phone=${b.hasPhone} mic=${b.hasMic} text="${b.text}"`));

  const phoneBtn = buttons.find(b => b.hasPhone && b.width > 60);
  if (phoneBtn) {
    console.log(`Clicking Phone button at index ${phoneBtn.index}`);
    await page.locator('button').nth(phoneBtn.index).click();
  } else {
    console.log('Fallback: clicking first button with rounded-full class');
    await page.locator('button').first().click();
  }

  const timeOfClick = Date.now();
  await sleep(500);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/v3-3-after-phone-click.png`, fullPage: true });

  const stateAfterPhone = await page.locator('body').innerText();
  console.log('State after phone click:', stateAfterPhone.slice(0, 200));

  // ---- Step 4: Wait up to 15 seconds and monitor ====
  console.log('\n=== STEP 4: Wait up to 15s for connection result ===');

  let finalStatus = 'unknown';

  for (let i = 1; i <= 15; i++) {
    await sleep(1000);

    const state = await page.evaluate(() => ({
      bodyText: document.body.innerText.slice(0, 500),
      isConnecting: document.body.innerText.includes('Connecting...'),
      isActive: document.body.innerText.includes('active') && /\d{2}:\d{2}/.test(document.body.innerText),
      hasTimer: /\d{2}:\d{2}/.test(document.body.innerText),
      hasEnd: document.body.innerText.includes('End'),
      hasScenarioPicker: document.body.innerText.includes('Choose a Scenario'),
      hasConnectionLost: document.body.innerText.includes('Connection Lost'),
      hasMicDenied: document.body.innerText.includes('Microphone Access Denied'),
      hasReadyToPractice: document.body.innerText.includes('Ready to practice'),
    }));

    const elapsed = Math.round((Date.now() - timeOfClick) / 1000);
    console.log(`  [${i}s / ${elapsed}s from click] connecting=${state.isConnecting} active=${state.isActive} timer=${state.hasTimer} geminiWS=${geminiWS.opened} geminiFrames=${geminiWS.frames.filter(f=>f.dir==='received').length}`);

    if (state.isActive || (state.hasTimer && state.hasEnd)) {
      finalStatus = 'active';
      console.log('  -> ACTIVE! Call connected successfully.');
      break;
    } else if (state.hasScenarioPicker) {
      finalStatus = 'active-with-scenario-picker';
      console.log('  -> ACTIVE + Scenario Picker showing!');
      break;
    } else if (state.hasConnectionLost) {
      finalStatus = 'connection-lost';
      console.log('  -> CONNECTION LOST error shown');
      break;
    } else if (state.hasMicDenied) {
      finalStatus = 'mic-denied';
      console.log('  -> MICROPHONE DENIED');
      break;
    } else if (state.hasReadyToPractice && !state.isConnecting) {
      finalStatus = 'back-to-idle';
      console.log('  -> Back to idle (silent failure)');
      break;
    }
    // else still connecting...
  }

  if (finalStatus === 'unknown') {
    finalStatus = 'stuck-connecting';
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/v3-4-final.png`, fullPage: true });
  console.log('Screenshot: v3-4-final.png');

  // ---- Step 5: Full Gemini WS analysis ----
  console.log('\n=== GEMINI WS ANALYSIS ===');
  console.log('WS Opened:', geminiWS.opened);
  console.log('WS Closed:', geminiWS.closed);
  console.log('Total frames:', geminiWS.frames.length);

  const sentFrames = geminiWS.frames.filter(f => f.dir === 'sent');
  const receivedFrames = geminiWS.frames.filter(f => f.dir === 'received');

  console.log('Sent frames:', sentFrames.length);
  console.log('Received frames:', receivedFrames.length);

  if (sentFrames.length > 0) {
    console.log('\nFirst sent frame (setup payload):');
    console.log(sentFrames[0].payload.slice(0, 600));
  }

  if (receivedFrames.length > 0) {
    console.log('\nAll received frames from server:');
    receivedFrames.forEach((f, i) => {
      console.log(`  [recv ${i}]:`, f.payload.slice(0, 400));
    });
  } else {
    console.log('\nNo frames received from Gemini server.');
  }

  // Check for setupComplete
  const hasSetupComplete = receivedFrames.some(f => f.payload.includes('setupComplete'));
  console.log('\nsetupComplete received:', hasSetupComplete);

  // Check for error messages in received frames
  const errorFrames = receivedFrames.filter(f =>
    f.payload.includes('error') || f.payload.includes('Error') || f.payload.includes('INVALID')
  );
  if (errorFrames.length > 0) {
    console.log('\nError frames from server:');
    errorFrames.forEach(f => console.log(' ', f.payload.slice(0, 400)));
  }

  // ---- Console errors ----
  const errors = consoleLogs.filter(l =>
    l.includes('[ERROR]') || l.includes('PAGE_ERROR') || l.includes('Gemini')
  );
  if (errors.length > 0) {
    console.log('\nRelevant console output:');
    errors.forEach(e => console.log(' ', e));
  }

  // ---- Final verdict ----
  console.log('\n=== FINAL VERDICT ===');
  console.log('UI Final Status:', finalStatus);

  if (finalStatus === 'active' || finalStatus === 'active-with-scenario-picker') {
    console.log('RESULT: PASS');
    console.log('  - Gemini WS connected:', geminiWS.opened);
    console.log('  - setupComplete received:', hasSetupComplete);
    console.log('  - UI transitioned to active call state');
  } else if (finalStatus === 'stuck-connecting') {
    console.log('RESULT: FAIL - Stuck on "Connecting..."');
    if (geminiWS.opened && !hasSetupComplete) {
      console.log('  ROOT CAUSE: WebSocket opened, setup sent, but no setupComplete from server');
      console.log('  -> Server rejected the setup payload (check model name, API key, config)');
    } else if (!geminiWS.opened) {
      console.log('  ROOT CAUSE: Gemini WebSocket never opened');
      console.log('  -> Check NEXT_PUBLIC_GEMINI_API_KEY env var');
    }
  } else if (finalStatus === 'connection-lost') {
    console.log('RESULT: FAIL - Connection Lost error shown');
    console.log('  -> WebSocket opened but closed with error');
  } else if (finalStatus === 'mic-denied') {
    console.log('RESULT: FAIL - Microphone permission denied in browser');
  } else if (finalStatus === 'back-to-idle') {
    console.log('RESULT: FAIL - Silently returned to idle');
    if (!geminiWS.opened) {
      console.log('  -> Most likely: NEXT_PUBLIC_GEMINI_API_KEY is missing');
    }
  } else {
    console.log('RESULT: FAIL - Unknown status:', finalStatus);
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
