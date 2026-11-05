const { test } = require('node:test');
const assert = require('node:assert/strict');
const { segments, plain } = require('../src/formatting');
test('IRC formatting preserves text and changes style without creating HTML', () => {
  const parts = segments('plain \x02bold\x02 \x0304red\x0f normal <script>');
  assert.equal(parts.map(p => p.text).join(''),'plain bold red normal <script>');
  assert.equal(parts.find(p => p.text === 'bold').style.bold,true);
  assert.equal(parts.find(p => p.text === 'red').style.color,'#ff0000');
  assert.equal(parts.at(-1).style.color,undefined);
});
test('ANSI and hex color parsing strips unsupported control characters safely', () => {
  assert.equal(segments('\x1b[31mred\x1b[0m')[0].style.color,'#cd5555');
  assert.equal(segments('\x04aabbcchex')[0].style.color,'#aabbcc');
  assert.equal(plain('\x02hello\x02\nworld\0'),'hello\nworld');
  assert.equal(plain('\x03x'),'x');
});
