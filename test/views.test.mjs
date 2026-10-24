import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { snapshot } from '../src/server.mjs';
import { renderPage } from '../src/views/index.mjs';
test('all SSR workspaces render English navigation and accessible controls',t=>{
  const db=fixture();t.after(()=>db.close());const data={...snapshot(db,{mode:'mock'}),authenticated:true,mode:'mock',query:{}};
  for(const path of ['/','/app','/provider','/reconcile','/grid']) {
    const html=renderPage(path,data);assert.match(html,/<html lang="en">/);assert.match(html,/Skip to content/);assert.match(html,/MOCK · SIMULATED FUNDS/);
    for(const link of ['/app','/provider','/reconcile','/grid'])assert.ok(html.includes(`href="${link}"`));
  }
});
test('SSR escapes untrusted fields and script-embedded configuration',t=>{
  const db=fixture();t.after(()=>db.close());db.prepare("UPDATE tools SET name='<img src=x onerror=alert(1)>' WHERE id='extract-entities'").run();
  const html=renderPage('/app',{...snapshot(db,{mode:'mock'}),authenticated:true,mode:'mock',studioLicense:'</script><script>alert(1)</script>',query:{}});
  assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('</script><script>alert(1)'));
  assert.ok(html.includes('&lt;img'));assert.ok(html.includes('\\u003c/script>'));
});
test('unauthenticated sandbox page never renders account keys',()=>{
  const html=renderPage('/app',{authenticated:false,mode:'sandbox',buyer:{api_key:'do-not-render'}});
  assert.ok(!html.includes('do-not-render'));assert.ok(html.includes('login-form'));
});
