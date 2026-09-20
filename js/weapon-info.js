'use strict';
/* Touch descriptions share the shop's data and leave buying to map placement. */
const WeaponInfo = (() => {
  const dialog = document.getElementById('weaponInfo'), byId = id => document.getElementById(id);
  let pending = null, session = null, heldPointer = null, swallowClick = false, outsideDown = false;

  function cancelHold(abort = false) {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.card.classList.remove('info-holding');
    if (abort) pending.release();
    pending = null;
  }
  function show(key, card) {
    cancelHold();
    if (session || G.state !== 'playing' || G.over || G.victoryPending) return;
    const def = TOWERS[key], cost = towerCost(key), unlocked = towerUnlocked(key);
    session = {key, card, paused: G.paused};
    byId('wiName').textContent = def.name;
    byId('wiDescription').textContent = def.desc;
    byId('wiPrice').textContent = '$' + cost.toLocaleString();
    byId('wiTargets').textContent = def.air ? 'Ground + air' : 'Ground only';
    byId('wiUpgrades').textContent = def.maxUp + (def.maxUp === 1 ? ' upgrade' : ' upgrades');
    byId('wiStatus').textContent = !unlocked ? 'Unlocks at wave ' + def.unlock : G.cash < cost ? '$' + (cost-G.cash).toLocaleString() + ' more needed' : 'Ready to build';
    byId('wiSelect').disabled = !unlocked || G.cash < cost;
    byId('wiSelect').textContent = !unlocked ? 'Available at wave ' + def.unlock : 'Select weapon';
    byId('wiPause').textContent = G.paused ? 'Your game will stay paused.' : 'Game paused while you read.';
    dialog.style.setProperty('--weapon-accent', def.color);
    Arsenal.preview(byId('wiModel'), key, 0);
    card.focus({preventScroll: true});
    G.paused = true;
    soundFX?.stop();
    dialog.showModal();
    byId('wiClose').focus({preventScroll: true});
    updateHUD();
  }
  function close(reset = false) {
    // A scene change can put a home button under the finger that began a hold.
    // Consume that finger's release and compatibility click in the new scene.
    if (reset && pending) { heldPointer = pending.id; swallowClick = true; }
    cancelHold(true);
    const previous = session;
    session = null;
    if (dialog.open) dialog.close();
    outsideDown = false;
    if (!previous) return;
    if (G.state === 'playing' && !G.over) G.paused = previous.paused;
    if (reset) return;
    updateHUD();
    if (previous.card.isConnected) previous.card.focus({preventScroll: true});
  }
  function hold(card, key, event, release) {
    cancelHold(true);
    if (!['touch', 'pen'].includes(event.pointerType)) return;
    const id = event.pointerId;
    pending = {card, id, release, timer: setTimeout(() => {
      if (!pending || pending.id !== id) return;
      release();
      heldPointer = id;
      swallowClick = true;
      show(key, card);
    }, 480)};
    card.classList.add('info-holding');
  }

  // The finger that opens the sheet must not select a weapon or dismiss it
  // when released, even when a browser retargets the compatibility click.
  window.addEventListener('pointerdown', event => {
    swallowClick = false;
    if (pending && pending.id !== event.pointerId) cancelHold(true);
  }, true);
  window.addEventListener('pointerup', event => {
    if (event.pointerId !== heldPointer) return;
    heldPointer = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener('pointercancel', event => { if (event.pointerId === heldPointer) heldPointer = null; }, true);
  window.addEventListener('click', event => {
    if (!swallowClick || event.detail === 0) return;
    swallowClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener('resize', () => cancelHold(true));
  document.addEventListener('scroll', () => cancelHold(true), true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelHold(true); });

  const outside = event => {
    const r = dialog.getBoundingClientRect();
    return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
  };
  dialog.addEventListener('pointerdown', event => { outsideDown = event.target === dialog && outside(event); });
  dialog.addEventListener('click', event => { if (outsideDown && event.target === dialog && outside(event)) close(); outsideDown = false; });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const first = byId('wiClose'), last = byId('wiSelect').disabled ? first : byId('wiSelect');
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', () => { if (session && !dialog.open) close(); });
  byId('wiClose').onclick = () => close();
  byId('wiSelect').onclick = () => {
    const key = session?.key;
    if (!key || !towerUnlocked(key) || G.cash < towerCost(key)) return;
    close();
    G.placing = key; G.pendingTap = null; G.targeting = null;
    selectTower(null); updateHUD();
    byId('game').scrollIntoView({block: 'nearest', behavior: 'instant'});
  };
  return {hold, cancelHold, show, close, get isOpen() { return dialog.open; }};
})();
