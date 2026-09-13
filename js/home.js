'use strict';
/* Homepage interactions and shared modal accessibility. No gameplay/save ownership. */
(() => {
  const gameUrl = 'https://vibecodingmatt.github.io/dino-defense/';
  const byId = id => document.getElementById(id);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  function syncSceneMotion() {
    menuScenePaused = save.settings.homeMotion === undefined ? motionPreference.matches : !save.settings.homeMotion;
    byId('optSceneMotion').checked = !menuScenePaused;
    byId('menu').classList.toggle('scene-paused', menuScenePaused);
  }
  byId('optSceneMotion').onchange = event => { save.settings.homeMotion = event.target.checked; persist(); syncSceneMotion(); };
  motionPreference.addEventListener('change', syncSceneMotion);
  syncSceneMotion();
  let statusTimer;
  function announce(message) {
    clearTimeout(statusTimer);
    byId('shareStatus').textContent = message;
    statusTimer = setTimeout(() => { byId('shareStatus').textContent = ''; }, 5000);
  }
  function shareFallback() {
    byId('shareDialog').classList.remove('hidden');
    byId('copyLinkStatus').textContent = '';
    byId('shareUrl').value = gameUrl;
  }
  byId('btnShare').onclick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({title: 'Dino Defense — The fences are down. Now what?', text: '33 dinosaurs. Nine weapons. 100 waves. How long can you hold the line?', url: gameUrl});
        return;
      } catch (error) { if (error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(gameUrl); announce('Game link copied. Send in reinforcements.'); }
    catch (_) { shareFallback(); }
  };
  byId('copyGameLink').onclick = async () => {
    try { await navigator.clipboard.writeText(gameUrl); byId('copyLinkStatus').textContent = 'Game link copied.'; }
    catch (_) {
      byId('shareUrl').focus(); byId('shareUrl').select();
      byId('copyLinkStatus').textContent = 'Select and copy this link using your browser’s copy command.';
    }
  };
  byId('shareUrl').onclick = event => event.target.select();
  const difficulty = byId('diffPick');
  document.addEventListener('click', event => { if (!difficulty.contains(event.target)) difficulty.open = false; });
  difficulty.addEventListener('keydown', event => {
    if (event.key === 'Escape') { difficulty.open = false; difficulty.querySelector('summary').focus(); event.stopPropagation(); }
  });
  byId('diffInput').addEventListener('blur', () => setDiff(selDiff, true));

  const dialogs = [...document.querySelectorAll('.modal')];
  const openStack = [];
  const previousFocus = new Map();
  const visible = el => !el.classList.contains('hidden');
  const focusable = modal => [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.getClientRects().length && !el.closest('[inert]'));
  for (const modal of dialogs) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('tabindex', '-1');
    const title = modal.querySelector('h2');
    const headingIcon = {lab:'dna',achievements:'trophy',stickers:'cards',studio:'palette',tips:'book',settings:'settings',changelog:'book',iosInstall:'download',shareDialog:'share'}[modal.id];
    if (title && headingIcon) {
      const text = title.textContent.replace(/^[^a-zA-Z]+/, '');
      title.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="icons/interface.svg#${headingIcon}"></use></svg>`;
      title.append(document.createTextNode(text));
    }
    if (title) { title.id ||= modal.id + 'Title'; modal.setAttribute('aria-labelledby', title.id); }
    else modal.setAttribute('aria-label', modal.id === 'stickCard' ? 'Dinosaur trading card' : 'Game dialog');
    const close = modal.querySelector('.modalX');
    if (close) close.setAttribute('aria-label', 'Close ' + (title?.textContent.replace(/^[^a-zA-Z]+/, '') || 'dialog'));
    modal.addEventListener('click', event => { if (event.target === modal && close) close.click(); });
  }
  function syncDialogs() {
    syncSceneMotion();
    let restore;
    for (let i = openStack.length - 1; i >= 0; i--) {
      const modal = openStack[i];
      if (!visible(modal)) { restore = previousFocus.get(modal); previousFocus.delete(modal); openStack.splice(i, 1); modal.inert = false; }
    }
    for (const modal of dialogs) {
      if (visible(modal) && !openStack.includes(modal)) {
        previousFocus.set(modal, document.activeElement); openStack.push(modal);
      }
    }
    const top = openStack.at(-1);
    byId('menu').inert = byId('app').inert = !!top;
    for (const modal of dialogs) {
      modal.setAttribute('aria-hidden', String(!visible(modal)));
      modal.inert = visible(modal) && modal !== top;
      modal.style.zIndex = String(20 + Math.max(0, openStack.indexOf(modal)));
    }
    if (top && !top.contains(document.activeElement)) (focusable(top)[0] || top).focus({preventScroll: true});
    else if (!top && restore?.isConnected && restore.getClientRects().length) restore.focus({preventScroll: true});
  }
  const observer = new MutationObserver(syncDialogs);
  for (const modal of dialogs) observer.observe(modal, {attributes: true, attributeFilter: ['class']});
  syncDialogs();
  window.addEventListener('keydown', event => {
    const top = openStack.at(-1);
    if (!top) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') {
      const close = top.querySelector('.modalX');
      if (close) { event.preventDefault(); close.click(); }
    }
    if (event.key === 'Tab') {
      const targets = focusable(top), first = targets[0], last = targets.at(-1);
      if (!first) { event.preventDefault(); top.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === top)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
})();
