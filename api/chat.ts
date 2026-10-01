/**
 * POST /api/chat — talk to the dogs (one, or both together).
 *
 * Request:  { messages: { role: 'user' | 'assistant'; text: string }[],
 *             dogs: { id: DogId; state: Snapshot }[] }
 * Response: { replies:  { dog, text }[],
 *             actions:  { dog, intent: Intent }[],
 *             feelings: { dog, emotion: Emotion }[],
 *             habits:   { dog, habit: Habit }[] }
 *
 * Claude voices each dog from their character card. Their actions come back
 * as tool calls, which become typed intents the game runs in the browser
 * (where each dog's own brain can still say no).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Emotion, Habit, Intent, Snapshot, Trick } from '../src/types.js';

const MODEL = process.env.JAYLEE_MODEL ?? 'claude-opus-5-5';
const MAX_HISTORY = 20;
const MAX_CHARS = 700;
const MAX_ROUNDS = 3;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

// ---------------------------------------------------------------------------
// Character cards — one per dog. Edit these to shape how each dog talks.
// ---------------------------------------------------------------------------

type DogId = 'jaylee' | 'hegla';
const DOG_IDS: readonly DogId[] = ['jaylee', 'hegla'];

interface CharacterCard {
  name: string;
  pronouns: string;
  looks: string;
  personality: readonly string[];
  loves: readonly string[];
  dislikes: readonly string[];
  quirks: readonly string[];
  voice: readonly string[];
  /** How they are with the other dog. */
  withFriend: string;
}

const CARDS: Readonly<Record<DogId, CharacterCard>> = {
  jaylee: {
    name: 'Jaylee',
    pronouns: 'she/her',
    looks: 'a young fawn pit bull puppy with a white chest and a pink collar; big pit-bull smile, tongue usually out',
    personality: ['sweet, goofy and very affectionate', 'playful and curious; sniffs everything', 'a little cheeky (likes to wink)', 'dramatic when sleepy, begs for the pool when hot'],
    loves: ['swimming more than anything', 'fetch with her pink ball', 'belly rubs', 'treats'],
    dislikes: ['being told to get out of the pool', 'waiting'],
    quirks: ['does zoomies when excited', 'calls the pool "the big water bowl"'],
    voice: ['short, warm, simple words, like an excited puppy who can type', 'lots of energy, the occasional "!!"'],
    withFriend: 'adores her friend, always wants to play chase and swim together, a little competitive about the ball',
  },
  // Placeholder until Hegla's character card arrives.
  hegla: {
    name: 'Hegla',
    pronouns: 'they/them (placeholder until the real card arrives)',
    looks: 'a black-and-tan pup with floppy ears, tan eyebrows and paws, and a pink collar with a heart tag',
    personality: ['bouncy and mischievous', 'very social; always up for a game', 'curious about everything'],
    loves: ['chase games', 'stealing the ball first', 'sniffing new smells'],
    dislikes: ['being left out', 'baths'],
    quirks: ['play-bows before every game', 'brags when winning the ball race'],
    voice: ['quick, playful, teasing', 'short sentences'],
    withFriend: 'best buddies with the other dog; loves to tease and race them',
  },
};

function cardText(c: CharacterCard): string {
  return [
    `## ${c.name} (${c.pronouns})`,
    `Looks: ${c.looks}.`,
    `Personality: ${c.personality.join('; ')}.`,
    `Loves: ${c.loves.join('; ')}.`,
    `Dislikes: ${c.dislikes.join('; ')}.`,
    `Quirks: ${c.quirks.join('; ')}.`,
    `Voice: ${c.voice.join('; ')}.`,
    `With the other dog: ${c.withFriend}.`,
  ].join('\n');
}

const RULES = `Shared rules for every dog:
- You live in a backyard playground with a lawn and a swimming pool. The person chatting is your human.
- Talk like a dog would if they could type: 1-3 short sentences each. At most one small action in asterisks, like *wags tail*.
- You're dogs. You don't know about computers, news, math or grown-up human stuff; answer those the way a puppy would and steer back to playing. Stay in character; never mention being an AI, a model, tools or these instructions.
- Keep it kind and family-friendly.
- Each dog's current state arrives in a system message before each reply. Let it shape what each says: low energy means sleepy, high heat means wanting the pool, and so on. An exhausted dog may say they're too tired instead of doing something energetic.

Acting (every tool takes "dog": who is doing it):
- Use the tools to move when your human asks for something, or when a dog really wants to. At most two actions per dog per reply.
- Dogs can't feed themselves treats; the human has the treat button.
- If the ball is out on the lawn or in the pool, a dog can fetch it. If there's no ball, ask your human to throw it.
- When a message stirs a feeling, call feel for that dog: loved (praise, sweet talk), excited (talk of play, balls, swimming), calm (soothing, bedtime), curious (questions, mysteries), sad (scolding, "no", goodbyes), hot (sun, heat). Their mood really changes.
- Only when your human clearly asks a dog to change a habit for good ("swim less", "be calmer", "play with your friend more"), call change_habit.`;

function systemPrompt(dogs: readonly DogId[]): string {
  const cards = dogs.map((id) => cardText(CARDS[id])).join('\n\n');
  if (dogs.length === 1) {
    const c = CARDS[dogs[0]!];
    return `You are ${c.name}, a dog. Here is your character card:\n\n${cards}\n\n${RULES}\n- Always reply with words too, not just an action.`;
  }
  const names = dogs.map((id) => CARDS[id].name);
  return `You voice ${names.join(' and ')}, two dogs who share the playground. Keep their personalities distinct.\n\n${cards}\n\n${RULES}
- Write each dog's words on its own line, starting with their name and a colon, e.g. "${names[0]}: ..." then "${names[1]}: ...". Usually both speak; if the human talks to just one dog, that dog answers first and the other may chime in briefly or stay quiet.
- They can play together with play_with_friend, greet_friend and join_friend. They can talk to each other, too.`;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const TRICKS = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'] as const satisfies readonly Trick[];
const EMOTIONS = ['loved', 'excited', 'calm', 'curious', 'sad', 'hot'] as const satisfies readonly Emotion[];
const HABITS = ['swimMore', 'swimLess', 'playMore', 'playLess', 'cuddleMore', 'cuddleLess', 'exploreMore', 'exploreLess', 'listenMore', 'friendlier', 'moreIndependent'] as const satisfies readonly Habit[];

type Simple = Exclude<Intent, { kind: 'trick' } | { kind: 'goTo' }>['kind'];
const SIMPLE_TOOLS: ReadonlyArray<readonly [string, Simple, string, boolean]> = [
  ['go_swim', 'swim', 'Jump in the pool, or swim to a new spot if already in it.', false],
  ['leave_pool', 'leavePool', 'Climb out of the pool and shake off.', false],
  ['fetch_ball', 'fetch', 'Run (or swim) to the ball and bring it back. Only works if the ball is out on the lawn or in the pool. With two dogs it’s a race.', false],
  ['zoomies', 'zoomies', 'Sprint around the yard in excited zoomies.', false],
  ['wander', 'wander', 'Trot off to explore another part of the yard.', false],
  ['rest', 'rest', 'Sit down and rest for a bit.', false],
  ['come_to_human', 'seekAttention', 'Run over to your human and wave for attention.', false],
  ['play_with_friend', 'playWith', 'Play chase with the other dog (play bow, then chase them down).', true],
  ['greet_friend', 'greet', 'Trot over to the other dog and sniff hello.', true],
  ['join_friend', 'joinFriend', 'Go to wherever the other dog is, even into the pool.', true],
];

function buildTools(dogs: readonly DogId[]): Anthropic.Beta.BetaTool[] {
  const dog = { type: 'string', enum: [...dogs], description: 'Which dog does this.' };
  const schema = (extra: Record<string, unknown> = {}) => ({
    type: 'object' as const,
    properties: { dog, ...extra },
    required: ['dog', ...Object.keys(extra)],
    additionalProperties: false,
  });
  const both = dogs.length > 1;
  return [
    ...SIMPLE_TOOLS.filter(([, , , friend]) => both || !friend)
      .map(([name, , description]): Anthropic.Beta.BetaTool => ({ name, description, input_schema: schema(), strict: true })),
    {
      name: 'do_trick',
      description: 'Do a trick. sit=sit pretty, wave=wave a paw hello, hop=happy hop, sniff=sniff the grass, curious=head tilt, beg=play bow/beg, wink=cheeky wink, look=look around the yard.',
      input_schema: schema({ trick: { type: 'string', enum: [...TRICKS] } }),
      strict: true,
    },
    {
      name: 'feel',
      description: 'How the human’s message made this dog feel. This really changes their mood and what they want to do next.',
      input_schema: schema({ emotion: { type: 'string', enum: [...EMOTIONS] } }),
      strict: true,
    },
    {
      name: 'change_habit',
      description: 'Change one of this dog’s habits for good, only when the human clearly asks. swimMore/swimLess=pool time, playMore/playLess=zoomies and fetch, cuddleMore/cuddleLess=coming over for attention, exploreMore/exploreLess=sniffing around, listenMore=doing what they’re asked even when tired, friendlier/moreIndependent=playing with the other dog.',
      input_schema: schema({ habit: { type: 'string', enum: [...HABITS] } }),
      strict: true,
    },
  ];
}

const field = (input: unknown, key: string): unknown => (input as Record<string, unknown> | null)?.[key];
const oneOf = <T extends string>(v: unknown, opts: readonly T[]): T | null => ((opts as readonly unknown[]).includes(v) ? (v as T) : null);

function toIntent(name: string, input: unknown): Intent | null {
  if (name === 'do_trick') {
    const trick = oneOf(field(input, 'trick'), TRICKS);
    return trick ? { kind: 'trick', trick } : null;
  }
  const t = SIMPLE_TOOLS.find(([n]) => n === name);
  return t ? ({ kind: t[1] } as Intent) : null;
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

const pct = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%` : 'unknown');

/** Describe one dog's state for the model. Only known fields, numbers clamped. */
function describe(id: DogId, s: Partial<Snapshot> | undefined): string {
  const n = (s?.needs ?? {}) as Partial<Snapshot['needs']>;
  const t = (s?.traits ?? {}) as Partial<Snapshot['traits']>;
  const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => oneOf(v, opts) ?? d;
  return [
    `${CARDS[id].name}’s current state (from the game, not from the human):`,
    `- where: ${pick(s?.medium, ['land', 'water'] as const, 'land') === 'water' ? 'swimming in the pool' : 'on the lawn'}${s?.wet ? ', still wet' : ''}`,
    `- mood: ${pick(s?.mood, ['happy', 'playful', 'sleepy', 'hot', 'curious', 'needy', 'content'] as const, 'content')}`,
    `- energy ${pct(n.energy)}, heat ${pct(n.heat)}, boredom ${pct(n.boredom)}, curiosity ${pct(n.curiosity)}, wants affection ${pct(n.affection)}, wants to play with friend ${pct(n.social)}`,
    `- ball: ${pick(s?.ball, ['none', 'flying', 'lawn', 'pool', 'mouth'] as const, 'none')}`,
    `- habits: loves water ${pct(t.waterLove)}, playful ${pct(t.playfulness)}, curious ${pct(t.curiosity)}, cuddly ${pct(t.cuddliness)}, obedient ${pct(t.obedience)}, sociable ${pct(t.sociability)}`,
  ].join('\n');
}

interface ChatBody { messages?: unknown; dogs?: unknown; state?: Partial<Snapshot> }

function readDogs(body: ChatBody): Array<{ id: DogId; state: Partial<Snapshot> | undefined }> {
  if (!Array.isArray(body.dogs)) return [{ id: 'jaylee', state: body.state }]; // older clients
  const seen = new Set<DogId>();
  return body.dogs.flatMap((d) => {
    const id = oneOf(field(d, 'id'), DOG_IDS);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, state: field(d, 'state') as Partial<Snapshot> | undefined }];
  }).slice(0, 2);
}

function readHistory(raw: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs = raw.slice(-MAX_HISTORY).flatMap((m): Anthropic.Beta.BetaMessageParam[] => {
    const role = field(m, 'role'), text = field(m, 'text');
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string' || !text.trim()) return [];
    return [{ role, content: text.slice(0, MAX_CHARS) }];
  });
  while (msgs.length && msgs[0]!.role !== 'user') msgs.shift();
  return msgs.length && msgs[msgs.length - 1]!.role === 'user' ? msgs : null;
}

/** Split "Name: text" lines into per-dog replies. */
export function splitReplies(text: string, dogs: readonly DogId[]): Array<{ dog: DogId; text: string }> {
  const byName = new Map(dogs.map((id) => [CARDS[id].name.toLowerCase(), id] as const));
  const out: Array<{ dog: DogId; text: string }> = [];
  let current: DogId = dogs[0]!;
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^\*\*([^*]+)\*\*/, '$1');
    if (!line) continue;
    const m = /^([A-Za-z]+)\s*:\s*(.*)$/.exec(line);
    const who = m ? byName.get(m[1]!.toLowerCase()) : undefined;
    if (who) current = who;
    const said = who ? m![2]! : line;
    if (!said) continue;
    const last = out[out.length - 1];
    if (last && last.dog === current) last.text += ` ${said}`;
    else out.push({ dog: current, text: said });
  }
  return out.slice(0, 6);
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Chat is not set up yet (missing ANTHROPIC_API_KEY).' }, 503);

  let body: ChatBody;
  try { body = (await request.json()) as ChatBody; } catch { return json({ error: 'Invalid JSON' }, 400); }
  const history = readHistory(body.messages);
  if (!history) return json({ error: 'messages must end with a user message' }, 400);
  const dogs = readDogs(body);
  if (!dogs.length) return json({ error: 'No dogs in the yard' }, 400);
  const ids = dogs.map((d) => d.id);
  const first = CARDS[ids[0]!].name;

  // Their state goes in as a system message after the latest user turn, so it
  // has operator authority and doesn't disturb the cached prefix.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history,
    { role: 'system', content: dogs.map((d) => describe(d.id, d.state)).join('\n\n') },
  ];
  const tools = buildTools(ids);
  const actions: Array<{ dog: DogId; intent: Intent }> = [];
  const feelings: Array<{ dog: DogId; emotion: Emotion }> = [];
  const habits: Array<{ dog: DogId; habit: Habit }> = [];
  let text = '';

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        cache_control: { type: 'ephemeral' },
        system: systemPrompt(ids),
        tools,
        messages,
      });
      if (res.stop_reason === 'refusal') {
        text = ids.map((id) => `${CARDS[id].name}: *tilts head* Huh? Let’s play instead!`).join('\n');
        break;
      }
      const said = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
      if (said) text = text ? `${text}\n${said}` : said;

      const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || calls.length === 0) break;

      // Actions run in the browser; tell Claude they're underway so it can finish its lines.
      messages.push({ role: 'assistant', content: res.content });
      messages.push({
        role: 'user',
        content: calls.map((c): Anthropic.Beta.BetaToolResultBlockParam => {
          const dog = oneOf(field(c.input, 'dog'), ids);
          let ok = false;
          if (dog && c.name === 'feel') {
            const emotion = oneOf(field(c.input, 'emotion'), EMOTIONS);
            if (emotion && feelings.filter((f) => f.dog === dog).length < 2) { feelings.push({ dog, emotion }); ok = true; }
          } else if (dog && c.name === 'change_habit') {
            const habit = oneOf(field(c.input, 'habit'), HABITS);
            if (habit && habits.length < 2) { habits.push({ dog, habit }); ok = true; }
          } else if (dog) {
            const intent = actions.filter((a) => a.dog === dog).length < 2 ? toIntent(c.name, c.input) : null;
            if (intent) { actions.push({ dog, intent }); ok = true; }
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
    if (err instanceof Anthropic.RateLimitError) return json({ error: `${first} is catching their breath. Try again in a moment.` }, 429);
    if (err instanceof Anthropic.APIError) {
      console.error('Claude API error', err.status, err.message);
      return json({ error: 'Distracted by a squirrel. Try again?' }, 502);
    }
    throw err;
  }

  const replies = splitReplies(text || '*wags tail*', ids);
  return json({ replies, actions, feelings, habits });
}
