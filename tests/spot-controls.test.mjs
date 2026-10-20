import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

// Regression contracts: supported local controls plus documented remaining gaps.
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

async function pageFor(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', ...options });
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
  // Native touch input may be delivered after the CDP command resolves.
  await page.waitForFunction(expected => document.querySelector('[role="slider"]')?.getAttribute('aria-valuenow') === String(expected), value);
  assert.equal(await page.locator(selectors.slider).getAttribute('aria-valuenow'), String(value));
  assert.equal(await page.locator(selectors.slider).evaluate(el => el.style.left), `${value}%`);
  assert.equal(await page.locator('.ant-slider-v2-track').evaluate(el => el.style.width), `${value}%`);
  assert.equal(await page.locator(selectors.total).inputValue(), '0');
  for (const [base, active] of [['ant-slider-v2-mark-text','ant-slider-v2-mark-text-active'],['ant-slider-v2-dot','ant-slider-v2-dot-active']]) {
    assert.deepEqual(await page.locator(`.${base}`).evaluateAll((els, activeClass) => els.map(el => el.classList.contains(activeClass)), active), [0,25,50,75,100].map(mark => mark <= value));
  }
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
test('Buy/Sell mouse, Enter and Space keep exactly one accessible and visual selection with input persistence', async t => {
  const page = await pageFor(t), group = page.getByRole('group', { name: 'Order side' });
  const buy = group.getByRole('button', { name: 'Buy', exact: true });
  const sell = group.getByRole('button', { name: 'Sell', exact: true });
  const state = async side => {
    assert.equal(await group.getByRole('button', { pressed: true }).count(), 1);
    assert.equal(await group.locator(`.${activeClass}`).count(), 1);
    for (const [name, control] of [['buy',buy],['sell',sell]]) {
      assert.equal(await control.getAttribute('aria-pressed'), String(name === side));
      assert.equal(await control.getAttribute('data-local-order-side'), name);
      assert.equal(await control.getAttribute('tabindex'), '0');
      assert.equal(await control.evaluate((el, active) => el.classList.contains(active), activeClass), name === side);
    }
    assert.equal(await page.locator(selectors.form).getAttribute('data-local-side'), side);
  };
  await state('buy');
  await page.locator(selectors.price).fill('82196.59125'); await page.locator(selectors.total).fill('125.0625');
  const priceNode = await page.locator(selectors.price).elementHandle();
  const totalNode = await page.locator(selectors.total).elementHandle();
  for (const [side, method] of [['sell','click'],['sell','Enter'],['buy','Space'],['buy','click'],['sell','Space'],['buy','Enter']]) {
    const control = side === 'buy' ? buy : sell;
    if (method === 'click') await control.click();
    else { await control.focus(); await control.press(method); assert.equal(await control.evaluate(el => el === document.activeElement), true); }
    await state(side);
    assert.equal(await page.locator(selectors.price).inputValue(), '82196.59125');
    assert.equal(await page.locator(selectors.total).inputValue(), '125.0625');
    assert.equal(await priceNode.evaluate(el => el === document.querySelector('[data-testid="spot-trade-buyPrice"]')), true);
    assert.equal(await totalNode.evaluate(el => el === document.querySelector('[data-testid="spot-trade-buyTotal"]')), true);
    assert.equal(await page.locator(selectors.notice).count(), 0);
  }
  // Both controls participate in the existing document's normal Tab order.
  await buy.focus(); await page.keyboard.press('Tab'); assert.equal(await sell.evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Shift+Tab'); assert.equal(await buy.evaluate(el => el === document.activeElement), true);
  const beforeScroll = await page.evaluate(() => scrollY); await buy.press('Space');
  assert.equal(await page.evaluate(() => scrollY), beforeScroll);
});
test('side selection preserves Phase 02C state, existing form geometry, appearance and Deposit action', async t => {
  const page = await pageFor(t), group = page.getByRole('group', { name: 'Order side' });
  const geometry = () => page.locator('[class*="__dirBtnWrapper"],[data-local-order-side],[class*="__chartWrapper"],[class*="__orderbookDealsWrapper"],[class*="__actionWrapper"],input[type="number"],.ant-slider-v2').evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect(), c = getComputedStyle(el);
    return { x:r.x,y:r.y,width:r.width,height:r.height,font:c.font,padding:c.padding,border:c.borderWidth,borderRadius:c.borderRadius };
  }));
  const before = await geometry();
  // Check the added semantics do not activate a layout-changing reference CSS rule.
  const semanticsGeometry = await group.evaluate(el => {
    const nodes = [el, ...el.querySelectorAll('[data-local-order-side]')];
    const rects = () => nodes.map(node => { const r = node.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; });
    const before = rects();
    const attributes = nodes.map(node => ['role','tabindex','aria-label','aria-pressed'].map(name => [name,node.getAttribute(name)]));
    nodes.forEach(node => ['role','tabindex','aria-label','aria-pressed'].forEach(name => node.removeAttribute(name)));
    const without = rects();
    nodes.forEach((node,i) => attributes[i].forEach(([name,value]) => { if (value !== null) node.setAttribute(name,value); }));
    return { before, without };
  });
  assert.deepEqual(semanticsGeometry.before, semanticsGeometry.without);
  const initialColors = await group.locator('[data-local-order-side]').evaluateAll(els => els.map(el => ({ bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color })));
  await page.locator(selectors.slider).focus(); await page.keyboard.press('End'); await percent(page, 100);
  await page.locator(selectors.checkbox).check();
  await page.locator(selectors.price).fill('12.875'); await page.locator(selectors.total).fill('6.125');
  await group.getByRole('button', { name: 'Sell', exact: true }).press('Enter');
  assert.equal(await page.locator(selectors.slider).getAttribute('aria-valuenow'), '100');
  assert.equal(await page.locator(selectors.checkbox).isChecked(), true);
  assert.equal(await page.locator('section[data-local-hide-other-pairs]').getAttribute('data-local-hide-other-pairs'), 'true');
  assert.equal(await page.locator(selectors.total).inputValue(), '6.125');
  await page.locator('[data-testid="spot-trade-orderBuyBtn"]').click(); assert.match(await notice(page), /Deposit has no connected service/);
  await page.getByRole('button', { name: 'Dismiss notice' }).click();
  assert.equal(await group.getByRole('button', { name: 'Sell', pressed: true }).count(), 1);
  await group.getByRole('button', { name: 'Buy', exact: true }).press('Space');
  assert.deepEqual(await geometry(), before);
  assert.deepEqual(await group.locator('[data-local-order-side]').evaluateAll(els => els.map(el => ({ bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color }))), initialColors);
  assert.equal(await page.locator(selectors.price).inputValue(), '12.875'); assert.equal(await page.locator(selectors.total).inputValue(), '6.125');
  // Existing slider interaction still writes mock zero after switching; checkbox still toggles.
  await page.locator(selectors.slider).press('Home'); await percent(page, 0);
  assert.equal(await page.locator(selectors.price).inputValue(), '12.875');
  await page.locator(selectors.checkbox).press('Space'); assert.equal(await page.locator(selectors.checkbox).isChecked(), false);
  assert.equal(await page.locator('input[type="number"]').count(), 2);
  assert.equal(await page.locator('[data-testid="spot-trade-orderBuyBtn"]').innerText(), 'Deposit');
});
test('side handlers use scoped element identity and detach/rebind without affecting unrelated controls', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const { attachSpotLocalControls } = await import('/src/spot-local-controls.ts');
    // Detached clone of existing DOM: no new form is rendered or user state changed.
    const root = document.createElement('div');
    root.append(document.querySelector('[class*="__actionBox"]').cloneNode(true));
    const dispose = attachSpotLocalControls(root);
    const form = root.querySelector('[class*="__buyWrapper"]');
    const buy = root.querySelector('[data-local-order-side="buy"]');
    const sell = root.querySelector('[data-local-order-side="sell"]');
    // Label changes must not determine event identity; nested clicks still work.
    sell.innerHTML = '<span>Localized label</span>'; sell.firstChild.click();
    const afterNestedClick = form.dataset.localSide;
    const unrelated = document.createElement('div'); unrelated.className = 'unrelated__sellBtn'; unrelated.textContent = 'Sell'; root.append(unrelated);
    buy.click(); unrelated.click(); const afterUnrelated = form.dataset.localSide;
    dispose(); sell.click(); sell.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter',bubbles:true }));
    const afterDispose = form.dataset.localSide;
    const disposeAgain = attachSpotLocalControls(root);
    sell.dispatchEvent(new KeyboardEvent('keydown', { key:' ',bubbles:true,cancelable:true }));
    const afterRebind = form.dataset.localSide; disposeAgain();
    return { afterNestedClick,afterUnrelated,afterDispose,afterRebind };
  });
  assert.deepEqual(result, { afterNestedClick:'sell',afterUnrelated:'buy',afterDispose:'buy',afterRebind:'sell' });
  assert.equal(await page.locator(selectors.form).getAttribute('data-local-side'), 'buy');
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
test('continuous mouse drag captures outside rail, clamps, releases, and preserves Price', async t => {
  const page = await pageFor(t), slider = page.locator(selectors.slider), rail = page.locator(selectors.rail);
  await page.locator(selectors.price).fill('78.125');
  const box = await rail.boundingBox(); assert.ok(box);
  await page.mouse.move(box.x, box.y + box.height / 2); await page.mouse.down();
  assert.equal(await slider.evaluate(el => el === document.activeElement), true);
  for (const value of [25,50,75,100,50,0]) {
    await page.mouse.move(box.x + box.width * value / 100, box.y + box.height / 2, { steps: 4 });
    await percent(page, value); // Verified while pointer is still down.
  }
  await page.mouse.move(box.x - 30, box.y - 50); await percent(page, 0);
  await page.mouse.move(box.x + box.width + 5, box.y - 50); await percent(page, 100);
  await page.mouse.up();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await percent(page, 100);
  await page.mouse.click(box.x + box.width / 4, box.y + box.height / 2); await percent(page, 25);
  assert.equal(await page.locator(selectors.price).inputValue(), '78.125');
});
test('pointer cancellation and lost capture stop updates and allow a subsequent drag', async t => {
  const page = await pageFor(t), rail = page.locator(selectors.rail), box = await rail.boundingBox(); assert.ok(box);
  await rail.evaluate(el => el.addEventListener('pointerdown', event => { el.dataset.testPointer = String(event.pointerId); }));
  for (const reason of ['pointercancel','lostpointercapture']) {
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2); await page.mouse.down();
    await rail.evaluate(el => {
      const pointerId = Number(el.dataset.testPointer) + 1;
      for (const type of ['pointermove','pointercancel','lostpointercapture']) el.dispatchEvent(new PointerEvent(type, { pointerId, bubbles: true, clientX: 0 }));
    });
    await percent(page, 25);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await percent(page, 50);
    await rail.evaluate((el, reason) => {
      const pointerId = Number(el.dataset.testPointer);
      if (reason === 'pointercancel') el.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true, clientX: 0 }));
      else el.releasePointerCapture(pointerId);
    }, reason);
    // Move outside before releasing, preventing an unrelated synthesized click.
    await page.mouse.move(box.x - 40, box.y - 50); await percent(page, 50);
    await page.mouse.up();
    assert.equal(await rail.evaluate(el => el.hasPointerCapture(Number(el.dataset.testPointer))), false);
  }
  await page.mouse.click(box.x + box.width * .75, box.y + box.height / 2); await percent(page, 75);
});
test('touch dragging updates continuously, cancellation retains value and next touch can finish', async t => {
  const page = await pageFor(t, { hasTouch: true }), rail = page.locator(selectors.rail), box = await rail.boundingBox(); assert.ok(box);
  const session = await page.context().newCDPSession(page);
  const touch = (type, value) => session.send('Input.dispatchTouchEvent', { type, touchPoints: value === null ? [] : [{ x: box.x + box.width * value / 100, y: box.y + box.height / 2, id: 1 }] });
  await page.locator(selectors.price).fill('9.875');
  assert.equal(await rail.evaluate(el => getComputedStyle(el).touchAction), 'none');
  await touch('touchStart', 0); await touch('touchMove', 50); await percent(page, 50);
  await touch('touchMove', 75); await percent(page, 75);
  await touch('touchCancel', null); await percent(page, 75);
  await touch('touchStart', 25); await touch('touchMove', 100); await percent(page, 100);
  await touch('touchEnd', null); await percent(page, 100);
  assert.equal(await page.locator(selectors.price).inputValue(), '9.875');
  await session.detach();
});
test('checkbox click, label and Space synchronize visuals and scoped local state without adding orders', async t => {
  const page = await pageFor(t), checkbox = page.locator(selectors.checkbox);
  const empty = page.locator('[class*="__L5K7Da__availableWrapper"]');
  const emptyContent = await empty.innerHTML();
  const scope = page.locator('section[data-local-hide-other-pairs]');
  const visual = () => checkbox.evaluate(el => {
    const wrapper = el.closest('.ant-checkbox-v2-wrapper'), inner = wrapper.querySelector('.ant-checkbox-v2-inner');
    const css = getComputedStyle(inner, '::after');
    return { wrapper: wrapper.className, container: el.parentElement.className, opacity: css.opacity, transform: css.transform };
  });
  assert.equal(await checkbox.isChecked(), false); const before = await visual();
  assert.equal(before.opacity, '0'); assert.match(before.transform, /^matrix\(0, 0, 0, 0,/);
  assert.equal(await scope.count(), 1); assert.equal(await scope.getAttribute('data-local-hide-other-pairs'), 'false');
  await checkbox.click(); assert.equal(await checkbox.isChecked(), true);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.ant-checkbox-v2-inner'),'::after').opacity === '1');
  const checked = await visual(); assert.ok(checked.wrapper.includes('ant-checkbox-v2-wrapper-checked')); assert.ok(checked.container.includes('ant-checkbox-v2-checked'));
  assert.doesNotMatch(checked.transform, /^matrix\(0, 0, 0, 0,/);
  assert.equal(await scope.getAttribute('data-local-hide-other-pairs'), 'true');
  await page.locator('[data-testid="deposit-button"]').click(); await notice(page);
  assert.equal(await checkbox.isChecked(), true); assert.equal(await scope.getAttribute('data-local-hide-other-pairs'), 'true');
  await page.getByRole('button', { name: 'Dismiss notice' }).click();
  await checkbox.focus(); await checkbox.press('Space'); assert.equal(await checkbox.isChecked(), false);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.ant-checkbox-v2-inner'),'::after').opacity === '0');
  assert.equal(await scope.getAttribute('data-local-hide-other-pairs'), 'false');
  await page.locator('.ant-checkbox-v2-wrapper').click(); assert.equal(await checkbox.isChecked(), true);
  assert.equal(await scope.getAttribute('data-local-hide-other-pairs'), 'true');
  assert.equal(await empty.innerHTML(), emptyContent); assert.equal(await empty.isVisible(), true);
});
test('local controls preserve surrounding geometry and checkbox preserves manually typed values', async t => {
  const page = await pageFor(t);
  const geometry = () => page.locator('[class*="__chartWrapper"],[class*="__orderbookDealsWrapper"],[class*="__actionWrapper"],section[data-local-hide-other-pairs],input[type="number"],.ant-slider-v2').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x:r.x,y:r.y,width:r.width,height:r.height,font:c.font,padding:c.padding }; }));
  const before = await geometry();
  await page.locator(selectors.price).fill('3.125'); await page.locator(selectors.total).fill('6.25');
  await page.locator(selectors.checkbox).click();
  assert.equal(await page.locator(selectors.total).inputValue(), '6.25');
  await page.locator(selectors.slider).focus(); await page.keyboard.press('End'); await percent(page, 100);
  assert.equal(await page.locator(selectors.price).inputValue(), '3.125'); assert.deepEqual(await geometry(), before);
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
