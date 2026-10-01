import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// Mock the Claude API: first a tool call, then her spoken reply.
const calls: any[] = [];
const replies = [
  { content: [{ type: 'text', text: 'Pool!' }, { type: 'tool_use', id: 'tu_1', name: 'go_swim', input: { dog: 'jaylee' } },
    { type: 'tool_use', id: 'tu_2', name: 'feel', input: { dog: 'jaylee', emotion: 'excited' } },
    { type: 'tool_use', id: 'tu_3', name: 'change_habit', input: { dog: 'jaylee', habit: 'swimMore' } },
    { type: 'tool_use', id: 'tu_4', name: 'feel', input: { dog: 'jaylee', emotion: 'evil' } }], stop_reason: 'tool_use' },
  { content: [{ type: 'text', text: '*splash* Come swim with me!' }], stop_reason: 'end_turn' },
  // Both dogs in the yard
  { content: [{ type: 'text', text: 'Jaylee: Race you!\nHegla: You\'re on!' }, { type: 'tool_use', id: 'tu_5', name: 'play_with_friend', input: { dog: 'hegla' } },
    { type: 'tool_use', id: 'tu_6', name: 'go_swim', input: { dog: 'rex' } }], stop_reason: 'tool_use' },
  { content: [{ type: 'text', text: 'Hegla: Tag!' }], stop_reason: 'end_turn' },
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
    dogs: [{ id: 'jaylee', state: { medium: 'land', mood: 'hot', needs: { energy: 0.8, heat: 0.9, boredom: 0.2, curiosity: 0.1, affection: 0.2, social: 0 }, ball: 'none' } }],
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.actions, [{ dog: 'jaylee', intent: { kind: 'swim' } }]);
  assert.deepEqual(data.feelings, [{ dog: 'jaylee', emotion: 'excited' }]);
  assert.deepEqual(data.habits, [{ dog: 'jaylee', habit: 'swimMore' }]);
  assert.equal(data.replies.length, 1);
  assert.match(data.replies[0].text, /Pool!.*Come swim/);

  const first = calls[0];
  assert.equal(first.model, 'claude-opus-5-5');
  assert.equal(first.fallbacks, 'default');
  assert.ok(first.tools.every((t: any) => t.strict === true));
  const last = first.messages.at(-1);
  assert.equal(last.role, 'system');
  assert.match(last.content, /heat 90%/);
  // Second round carries the tool result back.
  const results = calls[1].messages.at(-1).content;
  assert.equal(results.length, 4);
  assert.equal(results[3].is_error, true); // unknown emotion rejected
});

test('both dogs: separate voices, friend tools, unknown dogs ignored', async () => {
  const res = await POST(req({
    messages: [{ role: 'user', text: 'who wants to play?' }],
    dogs: [{ id: 'jaylee', state: {} }, { id: 'hegla', state: {} }, { id: 'rex', state: {} }],
  }));
  const data = await res.json();
  assert.deepEqual(data.replies, [
    { dog: 'jaylee', text: 'Race you!' },
    { dog: 'hegla', text: "You're on! Tag!" },
  ]);
  assert.deepEqual(data.actions, [{ dog: 'hegla', intent: { kind: 'playWith' } }]);
  const req2 = calls[2];
  assert.match(req2.system, /You voice Jaylee and Hegla/);
  assert.ok(req2.tools.some((t: any) => t.name === 'play_with_friend'));
  assert.deepEqual(req2.tools[0].input_schema.properties.dog.enum, ['jaylee', 'hegla']);
  assert.ok(!calls[0].tools.some((t: any) => t.name === 'play_with_friend'), 'no friend tools when alone');
});

test('rejects bad input', async () => {
  assert.equal((await POST(req({ messages: [] }))).status, 400);
  assert.equal((await POST(req({ messages: [{ role: 'assistant', text: 'hi' }] }))).status, 400);
});
