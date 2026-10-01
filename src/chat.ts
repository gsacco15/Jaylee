/** Chat with Jaylee: talks to /api/chat and feeds her chosen actions to the game. */
import type { Game } from './game.js';
import type { Emotion, Habit, Intent, Trick } from './types.js';

interface Msg { role: 'user' | 'assistant'; text: string }
interface ChatResponse { reply?: unknown; intents?: unknown; feelings?: unknown; habits?: unknown; error?: unknown }

const EMOTIONS: readonly Emotion[] = ['loved', 'excited', 'calm', 'curious', 'sad', 'hot'];
const FEELING_NOTE: Record<Emotion, string> = {
  loved: 'Jaylee feels loved', excited: 'Jaylee is all wound up', calm: 'Jaylee settles down',
  curious: 'Jaylee\u2019s ears perk up', sad: 'Jaylee\u2019s ears droop', hot: 'Jaylee feels the heat',
};
const HABIT_NOTE: Record<Habit, string> = {
  swimMore: 'New habit: swims more often', swimLess: 'New habit: swims less often',
  playMore: 'New habit: more playful', playLess: 'New habit: calmer',
  cuddleMore: 'New habit: comes to you more', cuddleLess: 'New habit: more independent',
  exploreMore: 'New habit: explores more', exploreLess: 'New habit: explores less',
  listenMore: 'New habit: listens better',
};
const pickList = <T extends string>(v: unknown, opts: readonly T[]): T[] =>
  Array.isArray(v) ? v.filter((x): x is T => (opts as readonly unknown[]).includes(x)).slice(0, 2) : [];

const TRICKS: readonly Trick[] = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'];
const SIMPLE = ['swim', 'leavePool', 'fetch', 'zoomies', 'wander', 'rest', 'seekAttention'] as const;

/** Only accept intents the chat is allowed to trigger. */
export function parseIntent(v: unknown): Intent | null {
  if (typeof v !== 'object' || v === null) return null;
  const kind = (v as { kind?: unknown }).kind;
  if ((SIMPLE as readonly unknown[]).includes(kind)) return { kind } as Intent;
  if (kind === 'trick') {
    const trick = (v as { trick?: unknown }).trick;
    if ((TRICKS as readonly unknown[]).includes(trick)) return { kind: 'trick', trick: trick as Trick };
  }
  return null;
}

export class Chat {
  private history: Msg[] = [];
  private queue: Intent[] = [];
  private sending = false;

  constructor(
    private readonly game: Game,
    private readonly log: HTMLElement,
    private readonly form: HTMLFormElement,
    private readonly input: HTMLInputElement,
    /** Called after chat changes one of her habits (to save it). */
    private readonly onHabit: () => void = () => {},
    private readonly endpoint = '/api/chat',
  ) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.send(input.value);
    });
    this.bubble('assistant', 'Hi hi hi! *wags tail* Wanna play?');
  }

  private bubble(role: Msg['role'] | 'note', text: string): HTMLElement {
    const li = document.createElement('li');
    li.className = `msg ${role}`;
    li.textContent = text;
    this.log.append(li);
    this.log.scrollTop = this.log.scrollHeight;
    return li;
  }

  async send(raw: string): Promise<void> {
    const text = raw.trim().slice(0, 500);
    if (!text || this.sending) return;
    this.sending = true;
    this.input.value = '';
    this.form.classList.add('busy');
    this.bubble('user', text);
    this.history.push({ role: 'user', text });
    this.game.hear();
    const typing = this.bubble('assistant', '•••');
    typing.classList.add('typing');

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: this.history.slice(-20), state: this.game.snapshot() }),
      });
      const data = (await res.json().catch(() => ({}))) as ChatResponse;
      typing.remove();
      if (!res.ok || typeof data.reply !== 'string') {
        this.history.pop();
        this.bubble('note', typeof data.error === 'string' ? data.error : 'Jaylee couldn’t hear you. Try again?');
        return;
      }
      this.history.push({ role: 'assistant', text: data.reply });
      this.bubble('assistant', data.reply);
      this.game.say(data.reply.replace(/\*[^*]+\*/g, '').trim() || data.reply);
      for (const e of pickList(data.feelings, EMOTIONS)) {
        this.game.sense(e);
        this.bubble('note', FEELING_NOTE[e]);
      }
      const habits = pickList(data.habits, Object.keys(HABIT_NOTE) as Habit[]);
      for (const h of habits) {
        this.game.brain.adjustHabit(h);
        this.bubble('note', HABIT_NOTE[h]);
      }
      if (habits.length) this.onHabit();
      const intents = Array.isArray(data.intents) ? data.intents.map(parseIntent).filter((i): i is Intent => i !== null) : [];
      // The first action interrupts whatever she was doing; a second one waits its turn.
      const [first, second] = intents;
      if (first) this.run(first);
      if (second) this.queue.push(second);
    } catch {
      typing.remove();
      this.history.pop();
      this.bubble('note', 'No connection to the yard right now.');
    } finally {
      this.sending = false;
      this.form.classList.remove('busy');
    }
  }

  /** Run queued actions one at a time, whenever she's free. */
  tick(): void {
    if (!this.queue.length || this.game.busy) return;
    this.run(this.queue.shift()!);
  }

  private run(intent: Intent): void {
    const d = this.game.request(intent, 'chat');
    if (!d.accept) this.bubble('note', `Jaylee: “${d.line}”`);
  }
}
