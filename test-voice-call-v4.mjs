/**
 * v4 - trace the exact state update path to find why setupComplete doesn't flip UI to 'active'
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

  const allLogs = [];
  page.on('console', msg => {
    const text = '[' + msg.type() + '] ' + msg.text();
    allLogs.push(text);
    if (!text.includes('HMR') && !text.includes('React DevTools') && !text.includes('webpack')) {
      console.log('CONSOLE:', text);
    }
  });

  page.on('pageerror', err => {
    const text = 'PAGE_ERR: ' + err.message;
    allLogs.push(text);
    console.log(text);
  });

  page.on('websocket', ws => {
    const url = ws.url();
    if (url.includes('generativelanguage')) {
      console.log('GEMINI WS OPENED');
      ws.on('framereceived', frame => {
        console.log('GEMINI RECV:', frame.payload.toString().slice(0, 200));
      });
      ws.on('close', () => console.log('GEMINI WS CLOSED'));
    }
  });

  // Step 1: Navigate
  await page.goto(BASE_URL + '/app', { waitUntil: 'networkidle' });
  await sleep(800);

  // Step 2: Click SpeakPage Start Call button
  await page.locator('button').nth(1).click();
  await sleep(500);

  // Step 3: Test the full audio chain manually in the page context
  console.log('\n=== Testing audio API chain in-page ===');
  const audioChainResult = await page.evaluate(async () => {
    const results = {};
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      results.getUserMedia = 'ok';
      results.trackCount = stream.getTracks().length;

      const ac = new AudioContext();
      results.acState = ac.state;
      results.acSampleRate = ac.sampleRate;

      const sourceNode = ac.createMediaStreamSource(stream);
      results.sourceNode = 'ok';

      const processor = ac.createScriptProcessor(4096, 1, 1);
      results.processor = 'ok';

      let fired = false;
      processor.onaudioprocess = () => { fired = true; };
      const muteGain = ac.createGain();
      muteGain.gain.value = 0;

      sourceNode.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(ac.destination);

      // Wait 500ms for onaudioprocess to fire
      await new Promise(r => setTimeout(r, 500));
      results.processorFired = fired;

      // Clean up
      ac.close();
    } catch(e) {
      results.error = e.name + ': ' + e.message;
    }
    return results;
  });
  console.log('Audio chain result:', JSON.stringify(audioChainResult, null, 2));

  // Step 4: Click Phone button in VoiceCall
  console.log('\n=== Clicking Phone button ===');
  await page.locator('button').nth(0).click();
  await sleep(500);

  // Inject a polling check directly on the React fiber/DOM to track state
  // We'll poll the DOM text to detect transition
  console.log('\n=== Monitoring state for 10s ===');

  for (let i = 1; i <= 10; i++) {
    await sleep(1000);
    const state = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        isConnecting: text.includes('Connecting...'),
        isActive: text.includes('active') && /\d{2}:\d{2}/.test(text),
        hasEnd: text.includes('End'),
        hasTimer: /\d{2}:\d{2}/.test(text),
        hasScenarioPicker: text.includes('Choose a Scenario'),
        hasConnectionLost: text.includes('Connection Lost'),
        preview: text.slice(0, 100),
      };
    });
    console.log(`[${i}s]`, JSON.stringify(state));

    if (state.isActive || state.hasTimer || state.hasScenarioPicker) {
      console.log('ACTIVE STATE REACHED');
      break;
    }
    if (state.hasConnectionLost) {
      console.log('CONNECTION LOST');
      break;
    }
  }

  await page.screenshot({ path: SCREENSHOT_DIR + '/v4-final.png', fullPage: true });

  // Check for errors
  const errors = allLogs.filter(l => l.includes('error') || l.includes('Error') || l.includes('Gemini'));
  if (errors.length > 0) {
    console.log('\nRelevant console output:');
    errors.forEach(e => console.log(' ', e));
  }

  // Final analysis
  console.log('\n=== ANALYSIS ===');
  console.log('Audio chain worked:', !audioChainResult.error);
  if (audioChainResult.error) {
    console.log('Audio chain ERROR:', audioChainResult.error);
  }
  console.log('ScriptProcessor fired:', audioChainResult.processorFired);

  const finalText = await page.locator('body').innerText();
  const isStillConnecting = finalText.includes('Connecting...');
  console.log('Still "Connecting..." after 10s:', isStillConnecting);

  if (isStillConnecting) {
    console.log('\nROOT CAUSE ANALYSIS:');
    console.log('- Server sends setupComplete: YES');
    console.log('- onStatusChange("connected") called: presumably yes (code path is before audio setup)');
    console.log('- setStatus("active") called from onStatusChange: presumably yes');
    console.log('- UI reflects "active": NO');
    console.log('\nPossible causes:');
    console.log('1. The onStatusChange callback is stale (captured before React re-render, stale closure)');
    console.log('2. setStatus is called but React batching prevents the re-render in headless mode');
    console.log('3. The audioContext.createMediaStreamSource throws AFTER onStatusChange, causing error handler');
    console.log('   to call setStatus("idle") overriding the "active" status');
    if (!audioChainResult.processorFired) {
      console.log('\n*** ScriptProcessor did NOT fire - this may cause issues but should not block status transition');
    }
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
