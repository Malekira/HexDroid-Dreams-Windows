"use strict";
// Only explicitly marked text controls use this palette. Theme controls stay native.
(() => {
  const selector = 'input[data-irc-color], #setting-ownNickColor, #profile-ownNickColor, #profile-textColor';
  document.addEventListener('click', event => {
    const input = event.target.closest(selector);
    if (!input || input.disabled) return;
    event.preventDefault();
    const picker = document.createElement('dialog');
    picker.className = 'irc-color-picker';
    picker.setAttribute('aria-label', 'Paleta de colores IRC');
    DreamsFormatting.colors.slice(0, 16).forEach((color, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.style.backgroundColor = color;
      button.setAttribute('aria-label', 'Color IRC ' + String(index).padStart(2, '0'));
      button.title = button.getAttribute('aria-label');
      button.setAttribute('aria-pressed', String(input.value.toLowerCase() === color));
      button.onclick = () => {
        input.value = color;
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
        picker.close();
      };
      picker.append(button);
    });
    picker.addEventListener('close', () => { picker.remove(); if (input.isConnected) input.focus(); });
    picker.addEventListener('click', e => { if (e.target === picker) picker.close(); });
    document.body.append(picker);
    picker.showModal();
    picker.querySelector('[aria-pressed="true"]')?.focus();
  }, true);
})();
