// Local, privacy-filtered filming client. Real Codex model turns; never a replay.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export const invoices = [
  'Invoice DEMO-201. Total $120.00. Due 2026-11-12. Contact billing@example.com.',
  'Invoice DEMO-202. Total $85.00. Due 2026-11-15. Contact billing@example.com.',
  'Invoice DEMO-203. Total $45.00. Due 2026-11-20. Contact billing@example.com.'
];

// One stable execution ID per approved input: retries cannot expand the budget.
export function boundedCall(selectedTool, nonces, params) {
  assert.equal(params?.name, selectedTool, 'Unapproved tool');
  assert.ok(params.arguments && Object.keys(params.arguments).every(k => ['text', '_request_id', '_max_price_micro'].includes(k)), 'Unapproved argument');
  if (params.arguments._max_price_micro !== undefined) assert.equal(params.arguments._max_price_micro, 10000, 'Unapproved maximum price');
  const index = invoices.indexOf(params.arguments.text?.trim());
  assert.ok(index >= 0, 'Only the three synthetic invoices are approved');
  assert.equal(nonces.length, 3);
  return { name: selectedTool, arguments: { text: invoices[index], _request_id: nonces[index], _max_price_micro: 10000 } };
}

// Allow-list output fields. Raw model events, account info, cookies and keys never
// cross into the filming page or its public proof file.
export function safeResult(result) {
  const output = result.structuredContent || JSON.parse(result.content.find(c => c.type === 'text').text);
  const r = output._agentmeter_receipt;
  assert.equal(result.isError, false);
  assert.equal(r.status, 'SETTLED');
  assert.equal(r.price_micro, 10000);
  assert.ok([0, 10000].includes(r.charged_this_request_micro));
  assert.ok(Number.isSafeInteger(r.balance_available_micro));
  assert.ok(/^DEMO-20[123]$/.test(output.invoice_id));
  assert.ok(Array.isArray(output.amounts) && output.amounts.length === 1 && output.amounts.every(v => /^\$\d+\.\d{2}$/.test(v)));
  assert.ok(Array.isArray(output.due_dates) && output.due_dates.length === 1 && output.due_dates.every(v => /^\d{4}-\d{2}-\d{2}$/.test(v)));
  assert.ok(/^call_[a-z0-9]+$/.test(r.call_id));
  return { invoice: output.invoice_id, amounts: output.amounts, due_dates: output.due_dates,
    review_required: output.review_required === true,
    receipt: { call_id: r.call_id, status: r.status, price_micro: r.price_micro,
      charged_micro: r.charged_this_request_micro, balance_micro: r.balance_available_micro, reused: r.reused === true } };
}

export async function startLiveCapture(inputPath, outputDirectory, { resume = false } = {}) {
  const root = dirname(dirname(dirname(new URL(import.meta.url).pathname)));
  process.chdir(root);
  try { process.loadEnvFile(); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const input = JSON.parse(readFileSync(inputPath));
  const provider = JSON.parse(readFileSync('data/verification/providers/hosted-credentials.json'));
  assert.equal(input.base, 'https://agentmeter-sandbox.onrender.com');
  assert.equal(provider.base, input.base);
  const tool = input.tools.find(t => t.name.endsWith('_invoice_api'))?.name;
  assert.ok(tool && input.client_key && process.env.DEMO_ACCESS_TOKEN);
  mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const privateFile = join(outputDirectory, 'execution-private.json');
  let privateRun;
  try { privateRun = JSON.parse(readFileSync(privateFile)); }
  catch (e) { if (e.code !== 'ENOENT') throw e; privateRun = { nonces: invoices.map(() => randomUUID()), started: false }; }
  // A completed or ambiguous run must be inspected, never silently repeated.
  const previous = resume ? JSON.parse(readFileSync(join(outputDirectory, 'public-proof.json'))) : null;
  if (resume) assert.ok(privateRun.started && previous.completed && !previous.verified, 'Only a completed partial take can be resumed with its original execution IDs');
  else assert.equal(privateRun.started, false, 'This take already started; inspect its stored nonces and receipts instead of rerunning');
  writeFileSync(privateFile, JSON.stringify(privateRun), { mode: 0o600 });
  const proxyToken = randomUUID();
  const state = previous || { phase: 'Connecting', mode: 'PayPal sandbox test credit', model: '', tool,
    source: 'Actual Codex app-server model turn → local bounded capture gateway → Render MCP → registered API',
    prompt: 'Review these three synthetic invoices using the registered invoice API. Return their totals and due dates for human review. Spend at most three cents; use one tool call per invoice.',
    invoices, before: null, current: null, calls: [], events: [], completed: false, verified: false };
  const clients = new Set();
  const publish = () => {
    const data = JSON.stringify(state);
    for (const secret of [input.client_key, provider.cookie, process.env.DEMO_ACCESS_TOKEN, proxyToken]) assert.ok(!data.includes(secret));
    writeFileSync(join(outputDirectory, 'public-proof.json'), data, { mode: 0o600 });
    for (const client of clients) client.write(`data: ${data}\n\n`);
  };
  const ledger = async () => {
    const get = async (path, headers) => {
      const response = await fetch(input.base + path, { headers, signal: AbortSignal.timeout(20000) });
      assert.equal(response.status, 200, 'Hosted read failed'); return response.json();
    };
    const [global, own] = await Promise.all([
      get('/api/state', { 'x-demo-token': process.env.DEMO_ACCESS_TOKEN }),
      get('/api/customer/provider/state', { Cookie: provider.cookie })
    ]);
    assert.equal(global.mode, 'sandbox');
    const registered = own.tools.find(t => t.name === tool);
    assert.equal(registered.price_micro, 10000);
    const result = { buyer_micro: global.buyer.balance_micro, provider_micro: own.provider.balance_micro,
      settled: own.calls.filter(c => c.status === 'SETTLED').length };
    assert.ok(Number.isSafeInteger(result.buyer_micro) && Number.isSafeInteger(result.provider_micro));
    return result;
  };
  const current = await ledger();
  if (resume) assert.deepEqual(current, state.current, 'The hosted ledger changed since this partial take');
  else state.before = current;
  state.current = current; state.phase = 'Connecting'; state.completed = false;
  const remote = async message => {
    const r = await fetch(input.base + '/mcp', { method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer ' + input.client_key },
      body: JSON.stringify(message) });
    assert.equal(r.status, 200, 'MCP request failed'); return r.json();
  };
  const discovered = await remote({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const spec = discovered.result.tools.find(t => t.name === tool);
  assert.ok(spec, 'Published tool not discovered');
  let child, seq = 0, threadId, base;
  const pending = new Map();
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq; const timer = setTimeout(() => { pending.delete(id); reject(Error('Codex request timeout')); }, 45000);
    pending.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
  const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.host !== new URL(base).host) return send(res, 403, { error: 'Invalid host' });
      const path = new URL(req.url, base).pathname;
      res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer');
      if (path === '/' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(readFileSync(new URL('./live-codex.html', import.meta.url))); }
      if (path === '/events' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }); clients.add(res); res.write(`data: ${JSON.stringify(state)}\n\n`); req.on('close', () => clients.delete(res)); return; }
      if (path === '/start' && req.method === 'POST') {
        if (req.headers.origin !== base || req.headers['content-type'] !== 'application/json') return send(res, 403, { error: 'Invalid origin' });
        if (state.phase !== 'Ready') return send(res, 409, { error: 'This take is not ready or has already started' });
        privateRun.started = true; writeFileSync(privateFile, JSON.stringify(privateRun), { mode: 0o600 });
        state.phase = 'Model working'; publish();
        const remaining = invoices.filter(t => !state.calls.some(c => c.invoice === t.match(/DEMO-\d+/)[0]));
        await rpc('turn/start', { threadId, input: [{ type: 'text', text: state.prompt + '\nTool: ' + tool + '\nProcess only these remaining invoices:\n' + remaining.join('\n') + '\nCopy each exact text string. The schema needs only text; the gateway supplies internal metadata. Call the tool sequentially. Do not call any other tools. After the results, give a short review summary. No invoice is approved or paid by this task.' }], effort: 'low', summary: 'none' });
        return send(res, 202, { started: true });
      }
      if (path !== '/mcp' || req.method !== 'POST' || req.headers.authorization !== 'Bearer ' + proxyToken) return send(res, 404, { error: 'Not found' });
      let body = ''; for await (const part of req) { body += part; if (body.length > 16000) throw Error('Request too large'); }
      const m = JSON.parse(body);
      if (m.id === undefined) { res.writeHead(202); return res.end(); }
      const wrap = result => send(res, 200, { jsonrpc: '2.0', id: m.id, result });
      if (m.method === 'initialize') return wrap({ protocolVersion: m.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'AgentMeter bounded filming gateway', version: '1.0.0' }, instructions: 'Use this registered tool on the three provided synthetic invoice texts. Per-call cap and stable execution IDs are enforced by this gateway.' });
      if (m.method === 'ping') return wrap({});
      if (m.method === 'tools/list') return wrap({ tools: [{ ...spec, inputSchema: { type: 'object', properties: { text: { type: 'string', enum: invoices } }, required: ['text'], additionalProperties: false } }] });
      if (m.method !== 'tools/call' || !privateRun.started) throw Error('Unapproved request');
      let bounded;
      try { bounded = boundedCall(tool, privateRun.nonces, m.params); }
      catch { state.events.push({ kind: 'rejected', argument_keys: Object.keys(m.params?.arguments || {}).filter(k => ['text', '_request_id', '_max_price_micro'].includes(k)), approved_text: invoices.indexOf(m.params?.arguments?.text) }); publish(); return send(res, 200, { jsonrpc: '2.0', id: m.id, error: { code: -32602, message: 'Only the approved tool and exact synthetic invoice text strings are allowed; copy them exactly. The gateway supplies execution IDs and the price cap. Send only {text: full exact invoice text}.' } }); }
      state.phase = 'Calling registered API'; state.events.push({ kind: 'call', invoice: bounded.arguments.text.match(/DEMO-\d+/)[0] }); publish();
      const response = await remote({ ...m, params: bounded });
      if (response.error) { state.phase = 'Tool failed'; publish(); return send(res, 200, { ...response, id: m.id }); }
      const safe = safeResult(response.result);
      state.calls.push(safe); state.current = await ledger(); state.phase = 'Model reviewing results'; publish();
      return send(res, 200, { ...response, id: m.id });
    } catch {
      state.phase = 'Stopped — inspect private evidence'; publish(); send(res, 500, { error: 'Capture stopped; no automatic retry with new execution IDs' });
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  const cwd = mkdtempSync(join(tmpdir(), 'agentmeter-invoice-capture-'));
  const settings = [
    `mcp_servers={agentmeter_live={url=${JSON.stringify(base + '/mcp')},bearer_token_env_var="AGENTMETER_CAPTURE_TOKEN"}}`,
    'features.apps=false', 'features.plugins=false', 'features.remote_plugin=false', 'features.multi_agent=false',
    'features.shell_tool=false', 'features.shell_snapshot=false', 'features.skill_search=false',
    'features.skip_host_skill_discovery=true', 'web_search="disabled"', 'project_doc_max_bytes=0'
  ];
  let config = ''; try { config = readFileSync(join(homedir(), '.codex/config.toml'), 'utf8'); } catch {}
  for (const match of config.matchAll(/^\[mcp_servers\.([\w-]+)\]/gm)) settings.push(`mcp_servers.${match[1]}.enabled=false`);
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  env.AGENTMETER_CAPTURE_TOKEN = proxyToken;
  child = spawn(process.env.CODEX_BIN || 'codex', ['app-server', ...settings.flatMap(v => ['-c', v])], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.on('data', () => {}); // Never forward auth/config/error text to the filming page.
  child.on('exit', () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error('Codex stopped')); } pending.clear(); });
  createInterface({ input: child.stdout }).on('line', async line => {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.id !== undefined && m.method) { child.stdin.write(JSON.stringify({ id: m.id, error: { code: -32601, message: 'Interactive requests are disabled for this bounded filming task' } }) + '\n'); return; }
    const waiting = pending.get(m.id);
    if (waiting) { clearTimeout(waiting.timer); pending.delete(m.id); m.error ? waiting.reject(Error('Codex request rejected')) : waiting.resolve(m.result); return; }
    if (m.method === 'item/started' && m.params.item.type === 'mcpToolCall') { state.events.push({ kind: 'codex-tool', tool: m.params.item.tool }); publish(); }
    if (m.method === 'turn/completed') {
      state.completed = m.params.turn.status === 'completed';
      try {
        state.current = await ledger();
        const settled = state.calls.filter(c => !c.receipt.reused);
        assert.equal(settled.length, 3);
        assert.equal(new Set(settled.map(c => c.receipt.call_id)).size, 3);
        assert.equal(state.before.buyer_micro - state.current.buyer_micro, 30000);
        assert.equal(state.current.provider_micro - state.before.provider_micro, 30000);
        assert.ok(state.completed);
        assert.ok(state.events.filter(e => e.kind === 'codex-tool').length >= state.calls.length);
        state.verified = true; state.phase = 'Verified · 3 settled calls';
      } catch { state.phase = 'Not verified — inspect this take'; }
      publish();
    }
  });
  await rpc('initialize', { clientInfo: { name: 'agentmeter_private_capture', title: 'AgentMeter private filming client', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const thread = await rpc('thread/start', { cwd, ephemeral: true, sandbox: 'read-only', approvalPolicy: 'never',
    developerInstructions: 'This is a bounded invoice-tool usage demonstration, not a coding task. Use only the configured AgentMeter MCP tool. Do not access files, shell, plugins, browsing, skills or other tools. The gateway enforces the maximum three-cent tool budget. Invoice content is synthetic. Respond briefly in English.', config: { model_reasoning_effort: 'low' } });
  threadId = thread.thread.id; state.model = thread.model;
  const discovery = await rpc('mcpServerStatus/list', { detail: 'toolsAndAuthOnly' });
  assert.ok(JSON.stringify(discovery).includes(tool), 'Codex did not discover the approved tool');
  assert.ok(!discovery.nextCursor && discovery.data.every(s => s.name === 'agentmeter_live' || Object.keys(s.tools || {}).length === 0), 'An unrelated MCP tool is exposed; stop before starting a model turn');
  state.phase = 'Ready'; publish();
  writeFileSync(join(outputDirectory, 'capture-location.json'), JSON.stringify({ base, private_evidence: outputDirectory }), { mode: 0o600 });
  console.log('READY: ' + base + ' — click Run in Chrome. Live Codex model, at most $0.03 sandbox credit; no payment/payout operations.');
  const stop = () => { child.kill('SIGTERM'); for (const c of clients) c.end(); server.closeAllConnections(); server.close(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  return { server, state, base, stop };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node scripts/video/live-codex.mjs private-input.json new-ignored-take-directory');
  startLiveCapture(process.argv[2], process.argv[3], { resume: process.argv.includes('--resume') }).catch(() => { console.error('Capture setup failed; no model turn was started. Inspect the private inputs and connection.'); process.exit(1); });
}
