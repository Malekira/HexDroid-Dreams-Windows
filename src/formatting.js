(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DreamsFormatting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const colors = ['#ffffff','#111111','#00007f','#009300','#ff0000','#7f0000','#9c009c','#fc7f00','#ffff00','#00fc00','#009393','#00ffff','#0000fc','#ff00ff','#7f7f7f','#d2d2d2'];
  function segments(value) {
    const text = String(value), output = []; let style = {}, buffer = '';
    const flush = () => { if (buffer) output.push({ text:buffer, style:{ ...style } }); buffer = ''; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (['\x02','\x1d','\x1f','\x1e','\x11','\x16'].includes(c)) {
        flush(); const key = { '\x02':'bold', '\x1d':'italic', '\x1f':'underline', '\x1e':'strike', '\x11':'mono', '\x16':'inverse' }[c]; style[key] = !style[key];
      } else if (c === '\x0f') { flush(); style = {}; }
      else if (c === '\x03' || c === '\x04') {
        flush(); const m = (c === '\x03' ? /^(\d{1,2})(?:,(\d{1,2}))?/ : /^([a-f\d]{6})(?:,([a-f\d]{6}))?/i).exec(text.slice(i + 1));
        if (!m) { delete style.color; delete style.background; }
        else { style.color = c === '\x04' ? '#' + m[1] : colors[Number(m[1])] || undefined; style.background = m[2] ? c === '\x04' ? '#' + m[2] : colors[Number(m[2])] || undefined : undefined; i += m[0].length; }
      } else if (c === '\x1b') {
        const m = /^\[([\d;]*)m/.exec(text.slice(i + 1));
        if (m) {
          flush(); i += m[0].length;
          for (const n of (m[1] || '0').split(';').map(Number)) {
            if (n === 0) style = {};
            else if (n === 1) style.bold = true; else if (n === 3) style.italic = true; else if (n === 4) style.underline = true;
            else if (n === 22) style.bold = false; else if (n === 23) style.italic = false; else if (n === 24) style.underline = false;
            else if (n >= 30 && n <= 37) style.color = ['#333333','#cd5555','#55aa55','#c4a84e','#6699ee','#bb77cc','#55b7bb','#eeeeee'][n - 30];
            else if (n === 39) delete style.color;
          }
        }
      } else if (c === '\n' || c === '\t' || c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127) buffer += c;
    }
    flush(); return output;
  }
  function plain(text) { return segments(text).map(s => s.text).join(''); }
  function render(node, text) {
    node.replaceChildren();
    for (const s of segments(text)) {
      const span = node.ownerDocument.createElement('span'); span.textContent = s.text;
      const v = s.style;
      if (v.bold) span.style.fontWeight = '700'; if (v.italic) span.style.fontStyle = 'italic';
      if (v.underline || v.strike) span.style.textDecoration = [v.underline ? 'underline' : '', v.strike ? 'line-through' : ''].join(' ').trim();
      if (v.mono) span.style.fontFamily = 'Consolas, monospace';
      if (v.color) span.style.color = v.color; if (v.background) span.style.backgroundColor = v.background;
      if (v.inverse) span.style.filter = 'invert(1)'; node.append(span);
    }
  }
  return { segments, plain, render };
});
