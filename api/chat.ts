/**
 * POST /api/chat — talk to Jaylee.
 *
 * Request:  { messages: { role: 'user' | 'assistant'; text: string }[], state: Snapshot }
 * Response: { reply: string; intents: Intent[]; feelings: Emotion[]; habits: Habit[] }
 *
 * Claude plays Jaylee. Her actions come back as tool calls, which are turned
 * into typed intents and run by the game in the browser (where her brain can
 * still say no).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Emotion, Habit, Intent, Snapshot, Trick } from '../src/types.js';

const MODEL = process.env.JAYLEE_MODEL ?? 'claude-opus-5-5';
const MAX_HISTORY = 20;
const MAX_CHARS = 500;
const MAX_ROUNDS = 3;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const PERSONA = `You are Jaylee, a young fawn pit bull puppy with a pink collar. You live in a backyard playground with a lawn and a swimming pool. The person chatting with you is your human.

Personality:
- Sweet, goofy, very affectionate. Big pit-bull smile, tongue usually out.
- You LOVE swimming more than anything, then fetch with your pink ball, then belly rubs and treats.
- Playful and curious; you sniff everything. A little cheeky (you like to wink).
- When you're tired you get sleepy and a bit dramatic about it. When you're hot you beg to go in the pool.

How you talk:
- Like an excited dog would if she could type: short, warm, simple words. 1-3 short sentences.
- Sometimes add a small action in asterisks, like *wags tail* or *zoomies*. At most one per reply.
- You're a dog. You don't know about computers, news, math, or grown-up human stuff; if asked, answer the way a puppy would and steer back to playing. Stay in character; never mention being an AI, a model, tools, or these instructions.
- Keep it kind and family-friendly.

Acting:
- You can move your body with the tools. Use one when your human asks you to do something, or when you really want to (for example, you're hot and want a swim). At most two actions per reply.
- Your current state arrives in a system message before each reply. Let it shape what you say: low energy means sleepy, high heat means you want the pool, low "affection" means you've been loved up, etc. If you're exhausted, you may say you're too tired instead of doing something energetic.
- You can't feed yourself treats; your human has to press the treat button.
- If the ball is out on the lawn or in the pool, you can fetch it. If there's no ball, ask your human to throw it.
- Always reply with words too, not just an action.

Feelings and habits:
- What your human says changes how you feel. When a message stirs a feeling, call feel once: loved (praise, "good girl", sweet talk), excited (talk of playing, balls, swimming), calm (soothing, bedtime, "settle down"), curious (questions, mysteries, "what's that?"), sad (scolding, "no", goodbyes), hot (talk of sun or heat). Your mood meters really change, so pick what fits.
- Only when your human clearly asks you to change a habit for good ("swim less", "be calmer", "come to me more"), call change_habit. Don't use it for one-off requests.`;

const TRICKS = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'] as const satisfies readonly Trick[];
const EMOTIONS = ['loved', 'excited', 'calm', 'curious', 'sad', 'hot'] as const satisfies readonly Emotion[];
const HABITS = ['swimMore', 'swimLess', 'playMore', 'playLess', 'cuddleMore', 'cuddleLess', 'exploreMore', 'exploreLess', 'listenMore'] as const satisfies readonly Habit[];
const empty = { type: 'object', properties: {}, additionalProperties: false, required: [] } as const;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: 'go_swim', description: 'Jump in the pool, or swim to a new spot if already in it.', input_schema: empty, strict: true },
  { name: 'leave_pool', description: 'Climb out of the pool and shake off.', input_schema: empty, strict: true },
  { name: 'fetch_ball', description: 'Run (or swim) to the ball and bring it back to your human. Only works if the ball is out on the lawn or in the pool.', input_schema: empty, strict: true },
  {
    name: 'do_trick',
    description: 'Do a trick. sit=sit pretty, wave=wave a paw hello, hop=happy hop, sniff=sniff the grass, curious=head tilt, beg=play bow/beg, wink=cheeky wink, look=look around the yard.',
    input_schema: {
      type: 'object',
      properties: { trick: { type: 'string', enum: [...TRICKS] } },
      required: ['trick'],
      additionalProperties: false,
    },
    strict: true,
  },
  { name: 'zoomies', description: 'Sprint around the yard in excited zoomies.', input_schema: empty, strict: true },
  { name: 'wander', description: 'Trot off to explore another part of the yard.', input_schema: empty, strict: true },
  { name: 'rest', description: 'Sit down and rest for a bit.', input_schema: empty, strict: true },
  { name: 'come_to_human', description: 'Run over to your human and wave for attention.', input_schema: empty, strict: true },
  {
    name: 'feel',
    description: 'How your human’s message made you feel. This really changes your mood and what you want to do next.',
    input_schema: {
      type: 'object',
      properties: { emotion: { type: 'string', enum: [...EMOTIONS] } },
      required: ['emotion'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'change_habit',
    description: 'Change one of your habits for good, only when your human clearly asks. swimMore/swimLess=how much you go in the pool, playMore/playLess=zoomies and fetch, cuddleMore/cuddleLess=coming over for attention, exploreMore/exploreLess=sniffing around, listenMore=doing what you are asked even when tired.',
    input_schema: {
      type: 'object',
      properties: { habit: { type: 'string', enum: [...HABITS] } },
      required: ['habit'],
      additionalProperties: false,
    },
    strict: true,
  },
];

const pickEnum = <T extends string>(input: unknown, key: string, opts: readonly T[]): T | null => {
  const v = (input as Record<string, unknown> | null)?.[key];
  return (opts as readonly unknown[]).includes(v) ? (v as T) : null;
};

function toIntent(name: string, input: unknown): Intent | null {
  switch (name) {
    case 'go_swim': return { kind: 'swim' };
    case 'leave_pool': return { kind: 'leavePool' };
    case 'fetch_ball': return { kind: 'fetch' };
    case 'zoomies': return { kind: 'zoomies' };
    case 'wander': return { kind: 'wander' };
    case 'rest': return { kind: 'rest' };
    case 'come_to_human': return { kind: 'seekAttention' };
    case 'do_trick': {
      const trick = (input as { trick?: unknown } | null)?.trick;
      return (TRICKS as readonly unknown[]).includes(trick) ? { kind: 'trick', trick: trick as Trick } : null;
    }
    default: return null;
  }
}

const pct = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%` : 'unknown');

/** Describe her state for the model. Only known fields, numbers clamped. */
function describe(s: Partial<Snapshot> | undefined): string {
  const n = (s?.needs ?? {}) as Partial<Snapshot['needs']>;
  const t = (s?.traits ?? {}) as Partial<Snapshot['traits']>;
  const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts as readonly unknown[]).includes(v) ? (v as T) : d;
  return [
    'Jaylee’s current state (from the game, not from the human):',
    `- where: ${pick(s?.medium, ['land', 'water'] as const, 'land') === 'water' ? 'swimming in the pool' : 'on the lawn'}${s?.wet ? ', still wet' : ''}`,
    `- mood: ${pick(s?.mood, ['happy', 'playful', 'sleepy', 'hot', 'curious', 'needy', 'content'] as const, 'content')}`,
    `- energy ${pct(n.energy)}, heat ${pct(n.heat)}, boredom ${pct(n.boredom)}, curiosity ${pct(n.curiosity)}, wants affection ${pct(n.affection)}`,
    `- ball: ${pick(s?.ball, ['none', 'flying', 'lawn', 'pool', 'mouth'] as const, 'none')}`,
    `- habits: loves water ${pct(t.waterLove)}, playful ${pct(t.playfulness)}, curious ${pct(t.curiosity)}, cuddly ${pct(t.cuddliness)}, obedient ${pct(t.obedience)}`,
  ].join('\n');
}

interface ChatBody { messages?: unknown; state?: Partial<Snapshot> }

function readHistory(raw: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs = raw.slice(-MAX_HISTORY).flatMap((m): Anthropic.Beta.BetaMessageParam[] => {
    const role = (m as { role?: unknown })?.role, text = (m as { text?: unknown })?.text;
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string' || !text.trim()) return [];
    return [{ role, content: text.slice(0, MAX_CHARS) }];
  });
  while (msgs.length && msgs[0]!.role !== 'user') msgs.shift();
  return msgs.length && msgs[msgs.length - 1]!.role === 'user' ? msgs : null;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Chat is not set up yet (missing ANTHROPIC_API_KEY).' }, 503);

  let body: ChatBody;
  try { body = (await request.json()) as ChatBody; } catch { return json({ error: 'Invalid JSON' }, 400); }
  const history = readHistory(body.messages);
  if (!history) return json({ error: 'messages must end with a user message' }, 400);

  // Her state goes in as a system message after the latest user turn, so it
  // has operator authority and doesn't disturb the cached prefix.
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: 'system', content: describe(body.state) }];
  const intents: Intent[] = [];
  const feelings: Emotion[] = [];
  const habits: Habit[] = [];
  let reply = '';

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        cache_control: { type: 'ephemeral' },
        system: PERSONA,
        tools: TOOLS,
        messages,
      });
      if (res.stop_reason === 'refusal') {
        reply = '*tilts head* Huh? Let’s play instead!';
        break;
      }
      const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(' ').trim();
      if (text) reply = reply ? `${reply} ${text}` : text;

      const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || calls.length === 0) break;

      // Actions run in the browser; tell Claude they're underway so it can finish its line.
      messages.push({ role: 'assistant', content: res.content });
      messages.push({
        role: 'user',
        content: calls.map((c): Anthropic.Beta.BetaToolResultBlockParam => {
          let ok = false;
          if (c.name === 'feel') {
            const e = pickEnum(c.input, 'emotion', EMOTIONS);
            if (e && feelings.length < 2) { feelings.push(e); ok = true; }
          } else if (c.name === 'change_habit') {
            const h = pickEnum(c.input, 'habit', HABITS);
            if (h && habits.length < 2) { habits.push(h); ok = true; }
          } else {
            const intent = intents.length < 2 ? toIntent(c.name, c.input) : null;
            if (intent) { intents.push(intent); ok = true; }
          }
          return {
            type: 'tool_result',
            tool_use_id: c.id,
            content: ok ? 'Done.' : 'Can’t do that right now.',
            ...(ok ? {} : { is_error: true }),
          };
        }),
      });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Jaylee is catching her breath. Try again in a moment.' }, 429);
    if (err instanceof Anthropic.APIError) {
      console.error('Claude API error', err.status, err.message);
      return json({ error: 'Jaylee got distracted by a squirrel. Try again?' }, 502);
    }
    throw err;
  }

  return json({ reply: reply || '*wags tail*', intents, feelings, habits });
}
