import { test } from 'node:test';
import assert from 'node:assert/strict';
import { widgetIntent,widgetRows } from '../src/analytics.mjs';
test('natural language only selects whitelisted read-only analytics fields',()=>{
  const intent=widgetIntent('Show daily spend this month');assert.equal(intent.metric,'spend_micro');assert.equal(intent.group_by,'day');assert.equal(intent.period,'month');
  assert.throws(()=>widgetIntent('DROP TABLE accounts'));
  assert.equal(widgetIntent('Failures by tool').metric,'released_calls');
});
test('analytics counts settled spend and released calls without billing failures',()=>{
  const rows=[{day:'2026-10-01',tool_name:'extract_entities',status:'SETTLED',calls:2,spend_micro:20_000},{day:'2026-10-01',tool_name:'extract_entities',status:'RELEASED',calls:1,spend_micro:10_000},{day:'2026-09-01',tool_name:'extract_entities',status:'SETTLED',calls:9,spend_micro:90_000}];
  const spend=widgetRows(rows,widgetIntent('Show daily spend this month'),'2026-10-24T00:00:00.000Z');assert.deepEqual(spend,[{label:'2026-10-01',value:20_000}]);
  assert.equal(widgetRows(rows,widgetIntent('Show failures by tool this month'),'2026-10-24T00:00:00.000Z')[0].value,1);
});
