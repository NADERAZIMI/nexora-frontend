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

test('all Order Book modes support mouse, Enter and Space with one selected mode and preserved row identity', async t => {
  const page = await pageFor(t), book = page.locator('[data-local-orderbook-mode]');
  const group = page.getByRole('group', { name: 'Order Book display mode' });
  const asks = book.locator('[class*="__asksWrapper"] [class*="__tableRow"]');
  const bids = book.locator('[class*="__bidsWrapper"] [class*="__tableRow"]');
  const rows = book.locator('[class*="__tableRow"]');
  const originalNodes = await book.evaluateHandle(el => [...el.querySelectorAll('[class*="__tableRow"]')]);
  const originalContent = await rows.evaluateAll(els => els.map(el => el.outerHTML));
  assert.equal(await asks.count(), 9); assert.equal(await bids.count(), 9);
  const verify = async mode => {
    assert.equal(await book.getAttribute('data-local-orderbook-mode'), mode);
    assert.equal(await group.getByRole('button', { pressed:true }).count(), 1);
    assert.equal(await group.locator('.index-module-scss-module__hVXrWq__active').count(), 1);
    for (const value of ['combined','buy','sell']) {
      const control = group.locator(`[data-local-orderbook-control="${value}"]`);
      assert.equal(await control.getAttribute('role'), 'button'); assert.equal(await control.getAttribute('tabindex'), '0');
      assert.equal(await control.getAttribute('aria-pressed'), String(value === mode));
      assert.equal(await control.evaluate(el => el.classList.contains('index-module-scss-module__hVXrWq__active')), value === mode);
    }
    assert.equal(await asks.filter({ visible:true }).count(), mode === 'buy' ? 0 : 9);
    assert.equal(await bids.filter({ visible:true }).count(), mode === 'sell' ? 0 : 9);
    assert.equal(await book.locator('[class*="__asksWrapper"]').getAttribute('aria-hidden'), String(mode === 'buy'));
    assert.equal(await book.locator('[class*="__bidsWrapper"]').getAttribute('aria-hidden'), String(mode === 'sell'));
    assert.deepEqual(await rows.evaluateAll(els => els.map(el => el.outerHTML)), originalContent);
    assert.equal(await originalNodes.evaluate(saved => {
      const current = [...document.querySelector('[data-local-orderbook-mode]').querySelectorAll('[class*="__tableRow"]')];
      return saved.length === current.length && saved.every((node,i) => node === current[i]);
    }), true);
    assert.equal(await page.locator(selectors.notice).count(), 0);
  };
  await verify('combined');
  for (const [mode,name,method] of [
    ['buy','Buy Only','click'],['sell','Sell Only','click'],['combined','Combined Buy + Sell','click'],
    ['buy','Buy Only','Enter'],['sell','Sell Only','Space'],['combined','Combined Buy + Sell','Enter'],
    ['sell','Sell Only','Enter'],['buy','Buy Only','Space'],['combined','Combined Buy + Sell','Space'],
    ['combined','Combined Buy + Sell','click'],
  ]) {
    const control = group.getByRole('button', { name, exact:true });
    if (method === 'click') await control.click(); else await control.press(method);
    await verify(mode);
  }
  const combined = group.getByRole('button', { name:'Combined Buy + Sell',exact:true });
  await combined.focus(); await page.keyboard.press('Tab');
  assert.equal(await group.getByRole('button', { name:'Buy Only',exact:true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await group.getByRole('button', { name:'Sell Only',exact:true }).evaluate(el => el === document.activeElement), true);
  const y = await page.evaluate(() => scrollY); await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => scrollY), y);
  await verify('sell');
});

test('Order Book display modes retain panel geometry, typography, prices and existing local control states', async t => {
  const page = await pageFor(t), group = page.getByRole('group', { name:'Order Book display mode' });
  const geometry = () => page.locator('[class*="__chartWrapper"],[class*="__orderbookDealsWrapper"],[class*="__actionWrapper"],[data-local-orderbook-control],input[type="number"]').evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect(), c = getComputedStyle(el);
    return { x:r.x,y:r.y,width:r.width,height:r.height,font:c.font,padding:c.padding,radius:c.borderRadius,border:c.borderWidth };
  }));
  const before = await geometry();
  const readouts = page.locator('[data-local-orderbook-mode] [class*="__newPrice"],[class*="__marketProportionWrapper"]');
  const originalReadouts = await readouts.allTextContents();
  await page.locator(selectors.slider).press('End'); await percent(page, 100);
  await page.locator(selectors.checkbox).check();
  await page.locator('[data-local-order-side="sell"]').press('Enter');
  await page.locator(selectors.price).fill('99.125'); await page.locator(selectors.total).fill('3.875');
  for (const name of ['Buy Only','Sell Only','Combined Buy + Sell']) {
    await group.getByRole('button', { name,exact:true }).click();
    assert.deepEqual(await geometry(), before);
    assert.deepEqual(await readouts.allTextContents(), originalReadouts);
    assert.equal(await page.locator(selectors.price).inputValue(), '99.125'); assert.equal(await page.locator(selectors.total).inputValue(), '3.875');
    assert.equal(await page.locator(selectors.slider).getAttribute('aria-valuenow'), '100');
    assert.equal(await page.locator(selectors.checkbox).isChecked(), true);
    assert.equal(await page.locator('section[data-local-hide-other-pairs]').getAttribute('data-local-hide-other-pairs'), 'true');
    assert.equal(await page.locator(selectors.form).getAttribute('data-local-side'), 'sell');
    assert.equal(await page.locator('#rc-tabs-4-tab-market').getAttribute('aria-selected'), 'true');
  }
  await group.getByRole('button', { name:'Buy Only',exact:true }).press('Space');
  await page.locator('#rc-tabs-1-tab-deals').click(); assert.match(await notice(page), /Market Trades contents are not included/);
  await page.getByRole('button', { name:'Dismiss notice' }).click();
  assert.equal(await page.locator('[data-local-orderbook-mode]').getAttribute('data-local-orderbook-mode'), 'buy');
  await group.getByRole('button', { name:'Combined Buy + Sell',exact:true }).press('Enter');
  // Book controls still do not fill fields or turn Deposit into an order action.
  await page.locator('[data-local-orderbook-mode] [class*="__asksWrapper"] [class*="__tableRow"]').first().click();
  assert.equal(await page.locator(selectors.price).inputValue(), '99.125'); assert.equal(await page.locator(selectors.total).inputValue(), '3.875');
  await page.locator('[data-testid="spot-trade-orderBuyBtn"]').click(); assert.match(await notice(page), /Deposit has no connected service/);
});

test('Order Book listeners are scoped, disposable and reattach to the existing mode without rewriting rows', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const { attachOrderBookDisplay } = await import('/src/orderbook-display.ts');
    const root = document.createElement('div');
    root.append(document.querySelector('[data-local-orderbook-mode]').cloneNode(true));
    const dispose = attachOrderBookDisplay(root), book = root.firstElementChild;
    const controls = mode => book.querySelector(`[data-local-orderbook-control="${mode}"]`);
    const originalRows = [...book.querySelectorAll('[class*="__tableRow"]')];
    controls('buy').querySelector('path').dispatchEvent(new MouseEvent('click', { bubbles:true }));
    const nested = book.dataset.localOrderbookMode;
    const unrelated = document.createElement('span'); unrelated.dataset.localOrderbookControl = 'sell'; root.append(unrelated); unrelated.click();
    const scoped = book.dataset.localOrderbookMode;
    dispose(); controls('sell').click(); controls('sell').dispatchEvent(new KeyboardEvent('keydown', { key:' ',bubbles:true,cancelable:true }));
    const disposed = book.dataset.localOrderbookMode;
    const disposeAgain = attachOrderBookDisplay(root); const restored = book.dataset.localOrderbookMode;
    controls('sell').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter',bubbles:true,cancelable:true }));
    const rebound = book.dataset.localOrderbookMode;
    const current = [...book.querySelectorAll('[class*="__tableRow"]')];
    const retained = originalRows.every((node,i) => node === current[i]); disposeAgain();
    return { nested,scoped,disposed,restored,rebound,retained };
  });
  assert.deepEqual(result, { nested:'buy',scoped:'buy',disposed:'buy',restored:'buy',rebound:'sell',retained:true });
  assert.equal(await page.locator('[data-local-orderbook-mode]').getAttribute('data-local-orderbook-mode'), 'combined');
});

test('single-side book rows start below headers with no opposite slot and a contiguous mid-price', async t => {
  const page = await pageFor(t), book = page.locator('[data-local-orderbook-mode]');
  const group = page.getByRole('group', { name:'Order Book display mode' });
  const measure = () => book.evaluate(el => {
    const rect = node => { const r = node.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom }; };
    const section = side => el.querySelector(`[class*="__${side}Wrapper"]`);
    return {
      panel:rect(el), header:rect(el.querySelector('[class*="__hVXrWq__tableHeader"]')),
      body:rect(el.querySelector('[class*="__hVXrWq__tableBody"]')),
      price:rect(el.querySelector('[class*="__newPrice"]')),
      children:[...el.querySelector('[class*="__hVXrWq__tableBody"]').children].map(node => ({className:node.className,...rect(node),display:getComputedStyle(node).display,order:getComputedStyle(node).order})),
      asks:rect(section('asks')), bids:rect(section('bids')),
      askDisplay:getComputedStyle(section('asks')).display, bidDisplay:getComputedStyle(section('bids')).display,
      rows:Object.fromEntries(['asks','bids'].map(side => [side,[...section(side).querySelectorAll('[class*="__tableRow"]')].map(node => {
        const style = getComputedStyle(node); return { ...rect(node),font:style.font,color:style.color,padding:style.padding };
      })])),
    };
  });
  const original = await measure();
  // Removing only the mode attribute proves Combined is still the captured CSS layout.
  const captured = await book.evaluate(el => {
    const targets = [el,...el.querySelectorAll('[class*="__asksWrapper"],[class*="__bidsWrapper"],[class*="__newPrice"],[class*="__tableRow"]')];
    const geometry = () => targets.map(node => { const r = node.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; });
    const combined = geometry(); el.removeAttribute('data-local-orderbook-mode');
    const reference = geometry(); el.dataset.localOrderbookMode = 'combined';
    return { combined,reference };
  });
  assert.deepEqual(captured.combined,captured.reference);
  for (const [mode,name,side,excluded] of [['buy','Buy Only','bids','asks'],['sell','Sell Only','asks','bids']]) {
    await group.getByRole('button', { name,exact:true }).press('Enter');
    const current = await measure();
    assert.deepEqual(current.panel,original.panel); assert.deepEqual(current.header,original.header);
    assert.equal(current.body.x,original.body.x); assert.equal(current.body.width,original.body.width);
    assert.equal(current.body.bottom,original.body.bottom);
    assert.equal(current[excluded].height,0); assert.equal(current[excluded].width,0);
    assert.equal(current[excluded === 'asks' ? 'askDisplay' : 'bidDisplay'],'none');
    assert.equal(current[side].y,current.body.y,'visible section starts at content top');
    assert.ok(current.body.y >= current.header.bottom - 1,`content does not overlap column headings: ${JSON.stringify({header:current.header,body:current.body})}`);
    assert.ok(current.body.y - current.header.bottom <= 2,'no reserved gap beneath headers');
    assert.equal(current.rows[side].length,9);
    assert.equal(current.rows[side][0].y-current[side].y,original.rows[side][0].y-original[side].y);
    for (let i=0;i<9;i++) {
      const row=current.rows[side][i], before=original.rows[side][i];
      for (const key of ['height','width','font','color','padding']) assert.equal(row[key],before[key]);
      if (i) assert.equal(row.y-current.rows[side][i-1].y,21,'original row pitch');
    }
    // Mid-price appears directly above the selected side in both single-side modes.
    assert.equal(await book.locator('[class*="__newPrice"]').isVisible(),true);
    assert.ok(current.price.height > 0,'mid-price has natural visible height');
    assert.equal(current.price.y,current.body.y,'mid-price starts below headers');
    assert.equal(current[side].y,current.price.bottom,'rows follow the mid-price without a gap');
    assert.equal(await book.locator('[class*="__marketProportionWrapper"]').isVisible(),false);
    await group.getByRole('button', { name:'Combined Buy + Sell',exact:true }).press('Space');
    assert.deepEqual(await measure(),original,'Combined restores exact captured placement');
  }
});

test('Order Book precision menu opens by mouse and keyboard without inventing ticks or changing rows', async t => {
  const page = await pageFor(t), book = page.locator('[data-local-orderbook-mode]');
  const trigger = book.getByRole('button', { name:'Order Book price precision' });
  const menu = book.getByRole('menu', { name:'Price precision options' });
  const originalRows = await book.locator('[class*="__tableRow"]').allTextContents();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await menu.isVisible(), true);
  assert.deepEqual(await menu.getByRole('menuitemradio').allTextContents(), ['0.01']);
  assert.equal(await menu.getByRole('menuitemradio').getAttribute('aria-checked'), 'true');
  await trigger.press('Escape');
  assert.equal(await menu.isVisible(), false);
  await trigger.press('Enter');
  assert.equal(await menu.isVisible(), true);
  await menu.getByRole('menuitemradio', { name:'0.01' }).click();
  assert.equal(await menu.isVisible(), false);
  await trigger.press('Space');
  assert.equal(await menu.isVisible(), true);
  await page.locator('[data-local-order-side="sell"]').click();
  assert.equal(await menu.isVisible(), false);
  assert.deepEqual(await book.locator('[class*="__tableRow"]').allTextContents(), originalRows);
  assert.equal(await page.locator('[data-testid="spot-trade-buyPrice"]').isVisible(), true);
});

test('price precision formatter preserves BTC, SHIDO and WOJAK exact decimal representations', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const p = await import('/src/price-precision.ts');
    return {
      btc:p.formatPrice('82106.17'),
      btcTick:p.tickForDecimals(2),
      shido:p.formatPrice('0.0000786'),
      shidoTick:p.tickForDecimals(7),
      wojak:p.formatPrice('0.00000004276'),
      wojakCompact:p.formatPrice('0.0{7}4276'),
      wojakPlain:p.decimalString('0.0{7}4276'),
      wojakTick:p.tickForDecimals(11),
      expanded:p.expandZeroRun('0.0{10}1'),
      grouped:p.formatPrice('1234567.001'),
      negative:p.formatPrice('-0.00000004276'),
      trailing:p.formatPrice('0.00007860'),
      invalid:(() => { try { p.formatPrice('1e-8'); return false; } catch { return true; } })(),
      invalidTick:(() => { try { p.tickForDecimals(31); return false; } catch { return true; } })(),
    };
  });
  assert.deepEqual(result, {
    btc:'82,106.17', btcTick:'0.01',
    shido:'0.0000786', shidoTick:'0.0000001',
    wojak:'0.0{7}4276', wojakCompact:'0.0{7}4276',
    wojakPlain:'0.00000004276', wojakTick:'0.00000000001',
    expanded:'0.00000000001', grouped:'1,234,567.001',
    negative:'-0.0{7}4276', trailing:'0.00007860',
    invalid:true, invalidTick:true,
  });
});
