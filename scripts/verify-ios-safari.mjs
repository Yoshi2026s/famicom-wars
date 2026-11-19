import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const viaAppium = process.env.IOS_DRIVER === 'appium';
const driver = viaAppium ? 'http://127.0.0.1:4723' : 'http://127.0.0.1:4444';
const elementKey = 'element-6066-11e4-a52e-4f735466cecf';
const gameUrl = new URL(process.env.GAME_URL);
gameUrl.hash = 'battle';

async function command(method, path, body) {
  const response = await fetch(driver + path, {
    method, headers: {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) {
    throw new Error(`${method} ${path}: ${payload.value?.message ?? JSON.stringify(payload)}`);
  }
  return payload.value;
}

const platform = viaAppium ? {
  'appium:automationName': 'XCUITest', 'appium:udid': process.env.SIM_UDID,
  'appium:initialDeeplinkUrl': gameUrl.href, 'appium:nativeWebTap': true, 'appium:wdaLaunchTimeout': 120_000,
} : {'safari:useSimulator': true, 'safari:deviceUDID': process.env.SIM_UDID};
const session = await command('POST', '/session', {capabilities: {alwaysMatch: {
  browserName: 'Safari', platformName: 'iOS', ...platform,
}}}).catch(error => {
  console.error(error);
  process.exit(viaAppium ? 1 : 3);
});
console.log('Simulator Safari session', JSON.stringify(session.capabilities));
const path = '/session/' + session.sessionId;
const script = (code, ...args) => command('POST', path + '/execute/sync', {script: code, args});
const selector = (value) => command('POST', path + '/element', {using: 'css selector', value});
class InputNotDelivered extends Error {}

async function tap(value) {
  const element = await selector(value);
  const input = await script(`
    const el=arguments[0];
    el.scrollIntoView({block:'nearest',inline:'nearest'});
    window.verificationTarget=el;
    const rect=el.getBoundingClientRect();
    return {x:Math.round(rect.x+rect.width/2),y:Math.round(rect.y+rect.height/2),events:window.inputVerification.length};
  `, element);
  try {
    if (viaAppium) {
      await command('POST', `${path}/element/${element[elementKey]}/click`, {});
    } else {
      await command('POST', path + '/actions', {actions: [{type:'pointer', id:'finger', parameters:{pointerType:'touch'}, actions:[
        {type:'pointerMove', duration:0, origin:'viewport', x:input.x, y:input.y},
        {type:'pointerDown', button:0}, {type:'pause', duration:70}, {type:'pointerUp', button:0},
      ]}]});
    }
  } catch (error) {
    throw new InputNotDelivered(value + ': ' + error.message);
  }
  for (let i = 0; i < 7; i++) {
    const events = await script('return window.inputVerification.slice(arguments[0]);', input.events);
    if (events.some(event => event.type === 'click' && event.matches && event.trusted)) return;
    await delay(100);
  }
  const observed = await script('return window.inputVerification.slice(arguments[0]);', input.events);
  throw new InputNotDelivered(value + ': no DOM click at ' + JSON.stringify({input, observed}));
}

async function waitFor(label, code, ...args) {
  const deadline = Date.now() + 22_000;
  do {
    const state = await script(code, ...args);
    if (state) return state;
    await delay(110);
  } while (Date.now() < deadline);
  const state = await script(`
    const a=document.querySelector('#bgm-player'), d=document.querySelector('#combat-screen');
    return {title:document.title, visibility:document.visibilityState, open:d?.open, phase:d?.dataset.phase,
      outcome:d?.dataset.outcome, loaded:a?.currentSrc, time:a?.currentTime, ready:a?.readyState, paused:a?.paused,
      ended:a?.ended, error:a?.error?.message, music:document.querySelector('main [data-bgm]')?.getAttribute('aria-pressed'),
      events:window.mediaVerification?.slice(-16), input:window.inputVerification?.slice(-14)};
  `);
  throw new Error(label + ': ' + JSON.stringify(state));
}

const tile = (column, row) => tap('#board button:nth-child(' + ((row - 1) * 5 + column) + ')');
const audioOnMap = (after) => waitFor('map music', `
  const a=document.getElementById('bgm-player');
  return !a.paused && a.loop && a.currentSrc.includes('bgm-map') && a.currentTime > arguments[0] ? a.currentTime : 0;
`, after);

async function dismiss() {
  await waitFor('map returns', `
    const dialog=document.getElementById('combat-screen');
    if (dialog.open && dialog.dataset.outcome) throw new Error('Unexpected early decision');
    return !dialog.open;
  `);
}

async function verify(outcome) {
  await command('POST', path + '/url', {url: gameUrl.href});
  await waitFor('mission loads', `return document.querySelectorAll('#board button').length === 25;`);
  await script(`
    window.mediaVerification = [];
    window.inputVerification = [];
    for (const type of ['pointerdown','touchstart','touchend','click']) {
      document.addEventListener(type,event=>window.inputVerification.push({type, trusted:event.isTrusted,
        id:event.target.id, text:event.target.closest?.('button')?.textContent.trim(), active:navigator.userActivation?.isActive,
        matches:window.verificationTarget?.contains(event.target)}),true);
    }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(...args) {
      const entry = {source:this.src, active:navigator.userActivation?.isActive};
      window.mediaVerification.push(entry);
      const result = play.apply(this,args);
      result.then(() => { entry.played=true; }, error => { entry.rejection=error.name + ': ' + error.message; });
      return result;
    };
  `);
  if (await script(`return document.querySelector('main [data-bgm]').getAttribute('aria-pressed') === 'true';`)) {
    await tap('main [data-bgm]');
  }
  await tap('main [data-bgm]');
  const previousPosition = await audioOnMap(.1);
  console.log(outcome, 'map BGM started', previousPosition);
  if (outcome === 'victory') {
    await tile(2,4); await tile(3,4); await tap('#end');
    await waitFor('enemy moves', `return !document.getElementById('end').disabled;`);
    await tile(3,4); await tile(4,4); await tile(4,3); await dismiss();
    for (let i = 0; i < 4; i++) { await tap('#end'); await dismiss(); }
    await tile(4,3);
  } else {
    await tile(2,4); await tile(4,4); await tap('#end'); await dismiss();
    for (let i = 0; i < 2; i++) { await tap('#end'); await dismiss(); }
    await tap('#end');
  }
  const finale = await waitFor(outcome + ' panel', `
    const d=document.getElementById('combat-screen'), panel=document.getElementById('combat-outcome');
    const button=document.getElementById('combat-advance').getBoundingClientRect();
    if(!d.open || panel.hidden) return null;
    return {outcome:d.dataset.outcome, title:document.getElementById('combat-outcome-title').textContent,
      player:document.getElementById('combat-player-hp').textContent, enemy:document.getElementById('combat-enemy-hp').textContent,
      fits:d.scrollWidth<=innerWidth, buttonHeight:button.height, ua:navigator.userAgent};
  `);
  assert.equal(finale.outcome, outcome);
  assert.equal(finale.title, outcome === 'victory' ? '勝利' : '敗北');
  assert.equal(finale[outcome === 'victory' ? 'enemy' : 'player'], '0/10');
  assert.ok(finale.fits && finale.buttonHeight >= 48);
  assert.match(finale.ua, /iPhone.*Mobile.*Safari/);
  const [low, high] = outcome === 'victory' ? [5.3, 5.8] : [6.4, 6.9];
  const media = await waitFor(outcome + ' BGM', `
    const a=document.getElementById('bgm-player');
    return !a.loop && !a.paused && a.currentTime>.08 && a.duration>arguments[0] && a.duration<arguments[1]
      ? {duration:a.duration, time:a.currentTime, source:a.currentSrc.startsWith('blob:')?'prefetched':a.currentSrc} : null;
  `, low, high);
  await waitFor('one-shot track ends', `return document.getElementById('bgm-player').ended;`);
  await tap('#combat-outcome-title');
  assert.ok(await script(`return document.getElementById('bgm-player').ended && document.getElementById('combat-screen').open;`));
  await tap('#combat-advance');
  await audioOnMap(previousPosition);
  await tap('#replay');
  assert.ok(await script(`return document.getElementById('player-hp-text').textContent === '10/10' && document.getElementById('enemy-hp-text').textContent === '10/10';`));
  console.log(outcome, 'panel, one-shot BGM, map resume and replay passed', JSON.stringify({finale, media}));
}

try {
  await verify('victory');
  await verify('defeat');
} catch (error) {
  if (!(error instanceof InputNotDelivered) || viaAppium) throw error;
  console.error(error);
  process.exitCode = 3;
} finally {
  await command('DELETE', path);
}
