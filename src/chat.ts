/**
 * Chat with the dogs: talks to /api/chat, shows each dog's reply, and feeds
 * the actions, feelings and habit changes they chose back into the game.
 */
import type { Game } from './game.js';
import type { Dog } from './dog.js';
import type { Emotion, Habit, Intent, Trick } from './types.js';

interface Msg { role: 'user' | 'assistant'; text: string }
interface ChatResponse { replies?: unknown; actions?: unknown; feelings?: unknown; habits?: unknown; error?: unknown }

const EMOTIONS: readonly Emotion[] = ['loved', 'excited', 'calm', 'curious', 'sad', 'hot'];
const FEELING_NOTE: Record<Emotion, (n: string) => string> = {
  loved: (n) => `${n} feels loved`, excited: (n) => `${n} is all wound up`, calm: (n) => `${n} settles down`,
  curious: (n) => `${n}’s ears perk up`, sad: (n) => `${n}’s ears droop`, hot: (n) => `${n} feels the heat`,
};
const HABIT_NOTE: Record<Habit, string> = {
  swimMore: 'swims more often', swimLess: 'swims less often',
  playMore: 'more playful', playLess: 'calmer',
  cuddleMore: 'comes to you more', cuddleLess: 'more independent',
  exploreMore: 'explores more', exploreLess: 'explores less',
  listenMore: 'listens better',
  friendlier: 'plays with friends more', moreIndependent: 'happier on their own',
};
const HABITS = Object.keys(HABIT_NOTE) as Habit[];

const TRICKS: readonly Trick[] = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'];
const SIMPLE = ['swim', 'leavePool', 'fetch', 'zoomies', 'wander', 'rest', 'seekAttention', 'playWith', 'greet', 'joinFriend'] as const;

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

/** `[{ dog, <key> }]` entries for dogs in the yard, with a valid value. */
function perDog<T>(raw: unknown, key: string, game: Game, parse: (v: unknown) => T | null): Array<[Dog, T]> {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 6).flatMap((e): Array<[Dog, T]> => {
    const dog = game.dogAt(String((e as { dog?: unknown })?.dog));
    const v = parse((e as Record<string, unknown>)?.[key]);
    return dog && v !== null ? [[dog, v]] : [];
  });
}
const oneOf = <T extends string>(opts: readonly T[]) => (v: unknown): T | null => ((opts as readonly unknown[]).includes(v) ? (v as T) : null);

export class Chat {
  private history: Msg[] = [];
  private queue: Array<[Dog, Intent]> = [];
  private sending = false;

  constructor(
    private readonly game: Game,
    private readonly log: HTMLElement,
    private readonly form: HTMLFormElement,
    private readonly input: HTMLInputElement,
    /** Called after chat changes a dog's habits (to save them). */
    private readonly onHabit: (dog: Dog) => void = () => {},
    private readonly endpoint = '/api/chat',
  ) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.send(input.value);
    });
  }

  /** The set of dogs in the yard changed. */
  modeChanged(initial = false): void {
    if (initial) {
      for (const d of this.game.dogs) this.bubble('assistant', `${d.profile.lines.hello}! *wags tail*`, d);
      return;
    }
    const dogs = this.game.dogs;
    this.bubble('note', dogs.length > 1 ? `${dogs.map((d) => d.name).join(' & ')} are both in the yard` : `Just ${dogs[0]!.name} now`);
    this.queue = [];
  }

  private bubble(role: Msg['role'] | 'note', text: string, dog?: Dog): HTMLElement {
    const li = document.createElement('li');
    li.className = `msg ${role}`;
    if (dog && role === 'assistant') {
      li.style.setProperty('--accent', dog.profile.accent);
      if (this.game.dogs.length > 1) {
        const who = document.createElement('b');
        who.textContent = dog.name;
        li.append(who);
      }
    }
    li.append(document.createTextNode(text));
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
    for (const d of this.game.dogs) d.hear();
    const typing = this.bubble('assistant', '•••');
    typing.classList.add('typing');

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: this.history.slice(-20),
          dogs: this.game.dogs.map((d) => ({ id: d.id, state: d.snapshot() })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ChatResponse;
      typing.remove();
      const replies = perDog(data.replies, 'text', this.game, (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 600) : null));
      if (!res.ok || !replies.length) {
        this.history.pop();
        this.bubble('note', typeof data.error === 'string' ? data.error : 'Nobody heard you. Try again?');
        return;
      }
      this.history.push({ role: 'assistant', text: replies.map(([d, t]) => `${d.name}: ${t}`).join('\n') });
      for (const [dog, t] of replies) {
        this.bubble('assistant', t, dog);
        dog.say(t.replace(/\*[^*]+\*/g, '').trim() || t);
      }
      for (const [dog, e] of perDog(data.feelings, 'emotion', this.game, oneOf(EMOTIONS))) {
        dog.sense(e);
        this.bubble('note', FEELING_NOTE[e](dog.name));
      }
      for (const [dog, h] of perDog(data.habits, 'habit', this.game, oneOf(HABITS))) {
        dog.brain.adjustHabit(h);
        this.onHabit(dog);
        this.bubble('note', `New habit for ${dog.name}: ${HABIT_NOTE[h]}`);
      }
      // Each dog's first action interrupts what they were doing; later ones wait their turn.
      const started = new Set<Dog>();
      for (const [dog, intent] of perDog(data.actions, 'intent', this.game, parseIntent)) {
        if (started.has(dog)) this.queue.push([dog, intent]);
        else { started.add(dog); this.run(dog, intent); }
      }
    } catch {
      typing.remove();
      this.history.pop();
      this.bubble('note', 'No connection to the yard right now.');
    } finally {
      this.sending = false;
      this.form.classList.remove('busy');
    }
  }

  /** Run queued actions one at a time per dog, whenever that dog is free. */
  tick(): void {
    const i = this.queue.findIndex(([dog]) => !dog.busy && this.game.dogs.includes(dog));
    if (i < 0) return;
    const [dog, intent] = this.queue.splice(i, 1)[0]!;
    this.run(dog, intent);
  }

  private run(dog: Dog, intent: Intent): void {
    const d = dog.request(intent, 'chat');
    if (!d.accept) this.bubble('note', `${dog.name}: “${d.line}”`);
  }
}
