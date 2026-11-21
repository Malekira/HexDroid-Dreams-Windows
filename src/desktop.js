'use strict';
window.DreamsDesktop = {
  ContextMenu: class {
    constructor(node, onError) {
      this.node = node; this.onError = onError;
      document.addEventListener('pointerdown', e => { if (!node.contains(e.target)) this.close(); });
      document.addEventListener('keydown', e => {
        if (node.hidden) return;
        const buttons = [...node.querySelectorAll('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(true); }
        if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
          e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }
      });
      window.addEventListener('resize', () => this.close());
    }
    close(restore = false) { this.node.hidden = true; if (restore && this.trigger?.isConnected) this.trigger.focus(); }
    show(event, title, items) {
      event.preventDefault(); event.stopPropagation(); this.trigger = event.target.closest?.('button,[tabindex]') || event.currentTarget;
      this.node.replaceChildren(); const heading = document.createElement('div'); heading.className = 'context-label'; heading.textContent = title; this.node.append(heading);
      for (const item of items) {
        if (!item) { this.node.append(document.createElement('hr')); continue; }
        const button = document.createElement('button'); button.setAttribute('role','menuitem'); button.textContent = item.label; button.disabled = item.disabled === true;if(item.color&&/^#[a-f\d]{6}$/i.test(item.color)){const swatch=document.createElement('span');swatch.className='color-swatch';swatch.style.backgroundColor=item.color;swatch.setAttribute('aria-hidden','true');button.prepend(swatch);}
        button.onclick = () => { this.close(); Promise.resolve().then(item.action).catch(this.onError); }; this.node.append(button);
      }
      this.node.hidden = false;
      const trigger = this.trigger?.getBoundingClientRect?.();
      const x = event.clientX || trigger?.left || 0, y = event.clientY || trigger?.bottom || 0;
      this.node.style.left = Math.max(4,Math.min(x,innerWidth - this.node.offsetWidth - 4)) + 'px';
      this.node.style.top = Math.max(4,Math.min(y,innerHeight - this.node.offsetHeight - 4)) + 'px';
      this.node.querySelector('button:not(:disabled)')?.focus();
    }
  },
  bindResizer(node, { min, max, read, write, apply, save, fromPointer }) {
    let dragging = false;
    const finish = () => { if (!dragging) return; dragging = false; document.body.classList.remove('dragging'); save(); };
    node.addEventListener('pointerdown', e => { dragging = true; node.setPointerCapture(e.pointerId); document.body.classList.add('dragging'); });
    node.addEventListener('pointermove', e => { if (dragging) { write(Math.round(Math.max(min,Math.min(max,fromPointer(e))))); apply(); } });
    for (const event of ['pointerup','pointercancel','lostpointercapture']) node.addEventListener(event,finish);
    node.addEventListener('keydown', e => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault(); write(e.key === 'Home' ? min : e.key === 'End' ? max : Math.max(min,Math.min(max,read() + (e.key === 'ArrowLeft' ? -10 : 10)))); apply(); save();
    });
  }
};
