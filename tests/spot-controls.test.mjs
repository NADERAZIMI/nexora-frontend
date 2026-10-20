import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

// Characterization tests: preserve current behavior, including documented gaps.
const root = new URL('../', import.meta.url);
const baseline = JSON.parse(await readFile(new URL('baseline.json', import.meta.url), 'utf8'));
const selectors = {
  price: '[data-testid="spot-trade-buyPrice"]',
  total: '[data-testid="spot-trade-buyTotal"]',
  buy: '[class*="__dirBtnWrapper"] > [class*="__buyBtn"]',
  sell: '[class*="__dirBtnWrapper"] > [class*="__sellBtn"]',
  form: '[class*="__buyWrapper"]',
  rail: '.ant-slider-v2', slider: '[role="slider"]',
  checkbox: 'input.ant-checkbox-v2-input', notice: '[role="status"]',
};
const activeClass = 'index-module-scss-module__fsa5Rq__active';
let browser, server, baseURL;
let serverOutput = '';
before(async () => {
  // A separate ephemeral loopback server leaves the user's preview untouched.
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const started = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Vite startup timed out: ${serverOutput}`)), 30000);
    const collect = chunk => {
      serverOutput += chunk.toString();
      const match = serverOutput.match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    };
    server.stdout.on('data', collect); server.stderr.on('data', collect);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Vite exited ${code}: ${serverOutput}`)); });
  });
  baseURL = await started;
  browser = await chromium.launch({ headless: true, ...(process.env.SPOT_BROWSER_CHANNEL ? { channel: process.env.SPOT_BROWSER_CHANNEL } : {}) });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
});

async function pageFor(t) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const errors = [], external = [];
  // This suite must never exercise the original venue's remote destinations.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL).origin) return route.continue();
    external.push(url.href); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await context.close(); assert.deepEqual(errors, [], 'no page exceptions'); assert.deepEqual(external, [], 'no external HTTP requests'); });
  await page.goto(baseURL);
  await page.locator(selectors.slider).waitFor();
  // Effect-installed attribute proves the delegated handlers are ready.
  await page.waitForFunction(() => document.querySelector('[role="slider"]')?.hasAttribute('aria-label'));
  return page;
}
async function notice(page) { await page.locator(selectors.notice).waitFor(); return page.locator(selectors.notice).innerText(); }
async function percent(page, value) {
  assert.equal(await page.locator(selectors.slider).getAttribute('aria-valuenow'), String(value));
  assert.equal(await page.locator(selectors.slider).evaluate(el => el.style.left), `${value}%`);
  assert.equal(await page.locator('.ant-slider-v2-track').evaluate(el => el.style.width), `${value}%`);
  assert.equal(await page.locator(selectors.total).inputValue(), '0');
}

test('frozen application, archived DOM, CSS and official assets remain byte-identical', async () => {
  for (const [file, expected] of Object.entries(baseline.files)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(file, root))).digest('hex'), expected, file);
  }
});
test('local authoritative HTML remains unchanged when available', async t => {
  const file = new URL('nexora-spot.html', root);
  try { await access(file); } catch (error) { if (error.code === 'ENOENT') { t.skip('Raw SingleFile reference is intentionally untracked; archived DOM is always checked above.'); return; } throw error; }
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), baseline.referenceSha256);
});
test('decimal entry, replacement and persistence through unrelated notice/side/tab renders', async t => {
  const page = await pageFor(t), price = page.locator(selectors.price), total = page.locator(selectors.total);
  for (const field of [price, total]) { assert.equal(await field.getAttribute('type'), 'number'); assert.equal(await field.isEditable(), true); }
  await price.pressSequentially('82196.59'); await total.pressSequentially('100.25');
  assert.equal(await price.inputValue(), '82196.59'); assert.equal(await total.inputValue(), '100.25');
  await price.press('ControlOrMeta+A'); await price.pressSequentially('42.75');
  await page.locator('[data-testid="deposit-button"]').click();
  assert.match(await notice(page), /Deposit has no connected service/);
  await page.getByRole('button', { name: 'Dismiss notice' }).click();
  await page.locator(selectors.sell).click(); await page.locator('#rc-tabs-4-tab-limit').click();
  assert.equal(await price.inputValue(), '42.75'); assert.equal(await total.inputValue(), '100.25');
  assert.equal(await page.locator('input[type="number"]').count(), 2);
});
test('Buy/Sell changes highlighting and deposit color, retaining the same Buy form', async t => {
  const page = await pageFor(t), buy = page.locator(selectors.buy), sell = page.locator(selectors.sell);
  const active = element => element.evaluate((el, name) => el.classList.contains(name), activeClass);
  assert.equal(await active(buy), true); assert.equal(await active(sell), false);
  await sell.click(); assert.equal(await active(sell), true); assert.equal(await active(buy), false);
  assert.equal(await page.locator(selectors.form).getAttribute('data-local-side'), 'sell');
  assert.equal(await page.locator('[data-testid="spot-trade-orderBuyBtn"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(240, 90, 112)');
  assert.equal(await page.locator(selectors.price).isVisible(), true);
  await buy.click(); assert.equal(await active(buy), true); assert.equal(await active(sell), false);
  assert.equal(await page.locator(selectors.form).getAttribute('data-local-side'), 'buy');
  assert.equal(await page.locator('[data-testid="spot-trade-orderBuyBtn"]').innerText(), 'Deposit');
});
test('slider midpoint click and keyboard clamp, resetting only Total to zero', async t => {
  const page = await pageFor(t), slider = page.locator(selectors.slider), rail = page.locator(selectors.rail);
  await page.locator(selectors.price).fill('12.34'); await page.locator(selectors.total).fill('56.78');
  const box = await rail.boundingBox(); assert.ok(box);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await percent(page, 50);
  await slider.focus();
  for (const [key, value] of [['ArrowRight',51],['ArrowLeft',50],['End',100],['ArrowRight',100],['Home',0],['ArrowLeft',0]]) {
    await slider.press(key); await percent(page, value);
  }
  assert.equal(await page.locator(selectors.price).inputValue(), '12.34');
});
test('known slider gap: movement alone does not update percentage or captured mark classes', async t => {
  const page = await pageFor(t), slider = page.locator(selectors.slider), rail = page.locator(selectors.rail);
  await slider.focus(); await slider.press('End');
  const classes = () => page.locator('.ant-slider-v2-mark-text,.ant-slider-v2-dot').evaluateAll(els => els.map(el => el.className));
  const before = await classes(), box = await rail.boundingBox(); assert.ok(box);
  await page.mouse.move(box.x + box.width, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2, { steps: 8 });
  assert.equal(await slider.getAttribute('aria-valuenow'), '100');
  await page.mouse.up(); assert.deepEqual(await classes(), before);
  // Release behavior depends on synthesized click hit target; no continuous drag contract is claimed.
});
test('checkbox native state toggles by click and Space, custom checkmark stays hidden', async t => {
  const page = await pageFor(t), checkbox = page.locator(selectors.checkbox);
  const visual = () => checkbox.evaluate(el => {
    const wrapper = el.closest('.ant-checkbox-v2-wrapper'), inner = wrapper.querySelector('.ant-checkbox-v2-inner');
    const css = getComputedStyle(inner, '::after');
    return { wrapper: wrapper.className, container: el.parentElement.className, opacity: css.opacity, transform: css.transform };
  });
  assert.equal(await checkbox.isChecked(), false); const before = await visual();
  await checkbox.click(); assert.equal(await checkbox.isChecked(), true); assert.deepEqual(await visual(), before);
  assert.equal(before.opacity, '0'); assert.match(before.transform, /^matrix\(0, 0, 0, 0,/);
  await checkbox.focus(); await checkbox.press('Space'); assert.equal(await checkbox.isChecked(), false);
});
test('inactive tabs only emit missing-content notices; selected tabs remain selected', async t => {
  const page = await pageFor(t);
  const selected = await page.locator('[role="tab"][aria-selected="true"]').evaluateAll(els => els.map(el => el.id));
  const inactive = await page.locator('[role="tab"][aria-selected="false"]').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height).map(el => ({ id: el.id, label: el.textContent.trim() })));
  assert.ok(inactive.length >= 10, 'all captured tab groups should be present');
  for (const tab of inactive) {
    await page.locator(`[id="${tab.id}"]`).click();
    assert.ok((await notice(page)).includes(`${tab.label} contents are not included in the saved HTML.`));
    assert.equal(await page.locator(`[id="${tab.id}"]`).getAttribute('aria-selected'), 'false');
    await page.getByRole('button', { name: 'Dismiss notice' }).click();
  }
  assert.deepEqual(await page.locator('[role="tab"][aria-selected="true"]').evaluateAll(els => els.map(el => el.id)), selected);
  await page.locator('#rc-tabs-4-tab-market').click(); assert.equal(await page.locator(selectors.notice).count(), 0);
  await page.locator('#rc-tabs-4-tab-limit').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator(selectors.notice).count(), 0, 'known gap: tab div has no Enter activation');
});
test('notices replace one another, dismiss, and expire after 5000ms without input loss', async t => {
  const page = await pageFor(t);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.locator(selectors.total).fill('7.125');
  await page.locator('[data-testid="deposit-button"]').click(); assert.match(await notice(page), /has no connected service/);
  await page.clock.runFor(2000); await page.locator('#rc-tabs-4-tab-limit').click();
  assert.match(await notice(page), /Limit contents are not included/); assert.equal(await page.locator(selectors.notice).count(), 1);
  await page.clock.runFor(4999); assert.equal(await page.locator(selectors.notice).count(), 1);
  await page.clock.runFor(1); assert.equal(await page.locator(selectors.notice).count(), 0);
  await page.locator('[data-testid="deposit-button"]').click(); await notice(page);
  await page.getByRole('button', { name: 'Dismiss notice' }).click(); assert.equal(await page.locator(selectors.notice).count(), 0);
  assert.equal(await page.locator(selectors.total).inputValue(), '7.125');
});
test('all approved tokens and computed application/input colors retain exact values', async t => {
  const page = await pageFor(t);
  assert.deepEqual(await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(['bg-primary','bg-secondary','color-primary','color-secondary','color-success','color-danger','text-primary','text-secondary'].map(key => [key, style.getPropertyValue(`--${key}`).trim().toUpperCase()]));
  }), { 'bg-primary':'#080808','bg-secondary':'#101014','color-primary':'#3D6BFF','color-secondary':'#5865F2','color-success':'#16B89A','color-danger':'#F05A70','text-primary':'#F4F6FA','text-secondary':'#929AAA' });
  for (const selector of ['html','body','#globalNav','.react-grid-layout']) assert.equal(await page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(8, 8, 8)', selector);
  for (const selector of [selectors.price, selectors.total]) {
    assert.deepEqual(await page.locator(selector).evaluate(el => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el).color, placeholder: getComputedStyle(el,'::placeholder').color })), { background:'rgb(16, 16, 20)', text:'rgb(244, 246, 250)', placeholder:'rgb(146, 154, 170)' });
  }
});
