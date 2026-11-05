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
test('Extended IRC and ANSI foreground/background colors remain visible and reset independently',()=>{
 assert.equal(segments('\x0316dark').at(0).style.color,'#470000');assert.equal(segments('\x0398white').at(0).style.color,'#ffffff');assert.equal(segments('\x0399default').at(0).style.color,undefined);
 const truecolor=segments('\x1b[38;2;12;34;56;48;2;90;80;70mcolor\x1b[49mplain');assert.equal(truecolor[0].style.color,'#0c2238');assert.equal(truecolor[0].style.background,'#5a5046');assert.equal(truecolor[1].style.background,undefined);
 assert.equal(segments('\x1b[38;5;196;48;5;21mbright')[0].style.color,'#ff0000');assert.equal(segments('\x1b[38;5;196;48;5;21mbright')[0].style.background,'#0000ff');
});
