/**
 * Standalone Playwright script to test the Gemini Live API voice call connection.
 * Run with: node test-voice-call.mjs
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
      '--allow-file-access',
    ],
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
    // Grant microphone permission for localhost
    baseURL: BASE_URL,
  });

  const page = await context.newPage();

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log('CONSOLE:', text);
  });

  // Capture WebSocket frames
  const wsMessages = [];
  let wsConnected = false;
  let wsCloseCode = null;
  let wsCloseReason = null;

  page.on('websocket', ws => {
    console.log('WS OPENED:', ws.url());
    wsConnected = true;

    ws.on('framesent', frame => {
      const preview = frame.payload.toString().slice(0, 200);
      console.log('WS SENT:', preview);
    });

    ws.on('framereceived', frame => {
      const preview = frame.payload.toString().slice(0, 300);
      wsMessages.push(preview);
      console.log('WS RECEIVED:', preview);
    });

    ws.on('close', () => {
      console.log('WS CLOSED');
    });
  });

  // Capture page errors
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });

  // ---- Step 1: Navigate to /app ----
  console.log('\n=== STEP 1: Navigate to /app ===');
  await page.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' });
  await sleep(1000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-test-1-initial.png`, fullPage: true });
  console.log('Screenshot: voice-test-1-initial.png');

  // Check what's on page
  const pageTitle = await page.title();
  const pageText = await page.locator('body').innerText().catch(() => '');
  console.log('Page title:', pageTitle);
  console.log('Page text (first 300 chars):', pageText.slice(0, 300));

  // ---- Step 2: Find and click the phone/mic button ----
  console.log('\n=== STEP 2: Click the call button ===');

  // Look for the start call button (phone icon or mic icon)
  let callButton = null;

  // Try multiple selectors
  const buttonSelectors = [
    'button:has(svg[data-lucide="phone"])',
    'button:has(svg[data-lucide="mic"])',
    '[class*="rounded-full"]:has(svg)',
    'button[class*="bg-gradient"]',
  ];

  for (const sel of buttonSelectors) {
    const btn = page.locator(sel).first();
    const count = await btn.count();
    if (count > 0) {
      console.log('Found button with selector:', sel);
      callButton = btn;
      break;
    }
  }

  if (!callButton) {
    // Try finding by text content near "Start Call"
    const startCallText = page.getByText('Start Call');
    const startCallCount = await startCallText.count();
    if (startCallCount > 0) {
      // Click the button above "Start Call" text
      callButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      console.log('Using first button with SVG');
    }
  }

  if (!callButton) {
    console.log('ERROR: Could not find call button');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-test-error-no-button.png`, fullPage: true });
    await browser.close();
    return;
  }

  // Take screenshot before clicking
  await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-test-2-before-click.png`, fullPage: true });

  await callButton.click();
  console.log('Clicked call button');
  await sleep(500);

  // ---- Step 3: Observe connecting state ----
  console.log('\n=== STEP 3: Check connecting state ===');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-test-3-connecting.png`, fullPage: true });

  const connectingText = await page.getByText('Connecting...').count();
  console.log('Is showing "Connecting...":', connectingText > 0);

  // ---- Step 4: Wait up to 15 seconds for state change ----
  console.log('\n=== STEP 4: Waiting up to 15 seconds for connection result ===');

  let finalStatus = 'connecting';
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    console.log(`  ... ${i + 1}s elapsed`);

    const isConnecting = await page.getByText('Connecting...').count();
    const isActive = await page.getByText('active').count();
    const isIdle = await page.getByText('Ready to practice?').count();
    const isConnectionLost = await page.getByText('Connection Lost').count();
    const isMicDenied = await page.getByText('Microphone Access Denied').count();

    if (isActive > 0) {
      finalStatus = 'active';
      console.log('  -> Status: ACTIVE (connected!)');
      break;
    } else if (isIdle > 0 && !isConnecting) {
      finalStatus = 'idle-after-connect';
      console.log('  -> Status: returned to IDLE (connection failed)');
      break;
    } else if (isConnectionLost > 0) {
      finalStatus = 'connection-lost';
      console.log('  -> Status: CONNECTION LOST error shown');
      break;
    } else if (isMicDenied > 0) {
      finalStatus = 'mic-denied';
      console.log('  -> Status: MICROPHONE DENIED error shown');
      break;
    } else if (isConnecting > 0) {
      console.log('  -> Still connecting...');
    } else {
      console.log('  -> Status unclear, checking body text...');
      const body = await page.locator('body').innerText().catch(() => '');
      console.log('     Body (200 chars):', body.slice(0, 200));
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/voice-test-4-final.png`, fullPage: true });
  console.log('Screenshot: voice-test-4-final.png');

  // ---- Step 5: Report results ----
  console.log('\n=== FINAL REPORT ===');
  console.log('Final UI Status:', finalStatus);
  console.log('WebSocket connected:', wsConnected);
  console.log('WebSocket messages received:', wsMessages.length);

  if (wsMessages.length > 0) {
    console.log('\nFirst WS messages from server:');
    wsMessages.slice(0, 5).forEach((m, i) => console.log(`  [${i}]`, m));
  }

  console.log('\nConsole errors/warnings:');
  consoleLogs
    .filter(l => l.includes('[ERROR]') || l.includes('[WARN]'))
    .forEach(l => console.log(' ', l));

  // Determine pass/fail
  if (finalStatus === 'active') {
    console.log('\nRESULT: PASS - Call connected successfully, UI transitioned to active state');
  } else if (finalStatus === 'connecting' && wsConnected) {
    console.log('\nRESULT: PARTIAL - WebSocket connected but UI still stuck on "Connecting..."');
    console.log('  This suggests setupComplete message was not received or not handled');
  } else if (finalStatus === 'connecting' && !wsConnected) {
    console.log('\nRESULT: FAIL - WebSocket never connected (check API key / network)');
  } else {
    console.log('\nRESULT: FAIL - Connection did not succeed. Status:', finalStatus);
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
