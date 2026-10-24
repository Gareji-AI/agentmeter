// Timing is a rehearsal estimate; the exported video's measured duration is decisive.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const plan=JSON.parse(readFileSync(new URL('../docs/demo-timeline.json',import.meta.url)));
assert.equal(readFileSync(new URL('../docs/demo-voiceover.txt',import.meta.url),'utf8'),plan.scenes.map(scene=>scene.narration).join('\n\n')+'\n','Prompter copy must match the timed narration');
let end=0;let totalWords=0;
for(const scene of plan.scenes){
  assert.equal(scene.start,end,'Scene boundaries must be continuous');
  assert.ok(scene.end>scene.start&&scene.narration&&scene.action);
  const words=scene.narration.trim().split(/\s+/).length;totalWords+=words;
  assert.ok(words*60/(scene.end-scene.start)<=plan.max_words_per_minute,`Shorten narration for ${scene.screen}`);
  end=scene.end;
}
assert.equal(end,plan.target_seconds);assert.ok(end<180,'The complete plan must be under three minutes');
const estimatedSpeech=totalWords*60/130;const actionTime=end-estimatedSpeech;
assert.ok(actionTime>=plan.minimum_action_seconds,'Leave room for clicks, model response and screen changes');
console.log(`PASS: ${end}s plan; ${totalWords} words; about ${Math.ceil(estimatedSpeech)}s at 130 wpm; ${Math.floor(actionTime)}s for actions. Measure the final export separately.`);
