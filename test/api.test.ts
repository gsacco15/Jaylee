import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// Mock the Claude API: first a tool call, then her spoken reply.
const calls: any[] = [];
const replies = [
  { content: [{ type: 'text', text: 'Pool!' }, { type: 'tool_use', id: 'tu_1', name: 'go_swim', input: {} }], stop_reason: 'tool_use' },
  { content: [{ type: 'text', text: '*splash* Come swim with me!' }], stop_reason: 'end_turn' },
];
let POST: (r: Request) => Promise<Response>;

before(async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  globalThis.fetch = (async (_url: unknown, init: any) => {
    calls.push(JSON.parse(init.body));
    const r = replies[calls.length - 1]!;
    return new Response(JSON.stringify({ id: `msg_${calls.length}`, type: 'message', role: 'assistant', model: 'claude-opus-5-5',
      usage: { input_tokens: 1, output_tokens: 1 }, stop_sequence: null, ...r }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  ({ POST } = await import('../api/chat.ts'));
});

const req = (body: unknown) => new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify(body) });

test('chat returns her reply and the actions she chose', async () => {
  const res = await POST(req({
    messages: [{ role: 'user', text: 'want to go swimming?' }],
    state: { medium: 'land', mood: 'hot', needs: { energy: 0.8, heat: 0.9, boredom: 0.2, curiosity: 0.1, affection: 0.2 }, ball: 'none' },
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.intents, [{ kind: 'swim' }]);
  assert.match(data.reply, /Pool!.*Come swim/);

  const first = calls[0];
  assert.equal(first.model, 'claude-opus-5-5');
  assert.equal(first.fallbacks, 'default');
  assert.ok(first.tools.every((t: any) => t.strict === true));
  const last = first.messages.at(-1);
  assert.equal(last.role, 'system');
  assert.match(last.content, /heat 90%/);
  // Second round carries the tool result back.
  assert.equal(calls[1].messages.at(-1).content[0].type, 'tool_result');
});

test('rejects bad input', async () => {
  assert.equal((await POST(req({ messages: [] }))).status, 400);
  assert.equal((await POST(req({ messages: [{ role: 'assistant', text: 'hi' }] }))).status, 400);
});
