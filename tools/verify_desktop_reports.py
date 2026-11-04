"""Fail delivery unless every desktop-specific test was actually executed and passed."""
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

root = Path('desktop/build/test-results')
cases = {}
for path in root.rglob('TEST-*.xml'):
    for case in ET.parse(path).getroot().iter('testcase'):
        name = case.get('classname', '') + '.' + case.get('name', '')
        success = not any(case.find(tag) is not None for tag in ('failure', 'error', 'skipped'))
        cases[name] = cases.get(name, True) and success
        if not success:
            failure = next((case.find(tag) for tag in ('failure', 'error', 'skipped') if case.find(tag) is not None), None)
            text = name + ': ' + ((failure.text or failure.get('message', '')) if failure is not None else '')
            print('::error::' + text[:5000].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A'))
required = []
for path in Path('desktop/src/test/kotlin').rglob('*Test.kt'):
    if path.stem == 'DesktopWindowsNativeTest' and '--without-windows' in sys.argv:
        continue
    for method in re.findall(r'@Test\s+fun\s+(\w+)\s*\(', path.read_text()):
        required.append(path.stem + '.' + method)
for identity in required:
    if not any(name.endswith(identity) and success for name, success in cases.items()):
        raise SystemExit('Required desktop test was not passed: ' + identity)
if not required or not cases or not all(cases.values()):
    raise SystemExit('Missing reports or non-passed test cases')
print(f'DESKTOP_TEST_GATE_OK: {len(required)} desktop-specific cases, {len(cases)} total distinct cases passed')
