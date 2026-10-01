const EMOTIONS = ['loved', 'excited', 'calm', 'curious', 'sad', 'hot'];
const FEELING_NOTE = {
    loved: (n) => `${n} feels loved`, excited: (n) => `${n} is all wound up`, calm: (n) => `${n} settles down`,
    curious: (n) => `${n}’s ears perk up`, sad: (n) => `${n}’s ears droop`, hot: (n) => `${n} feels the heat`,
};
const HABIT_NOTE = {
    swimMore: 'swims more often', swimLess: 'swims less often',
    playMore: 'more playful', playLess: 'calmer',
    cuddleMore: 'comes to you more', cuddleLess: 'more independent',
    exploreMore: 'explores more', exploreLess: 'explores less',
    listenMore: 'listens better',
    friendlier: 'plays with friends more', moreIndependent: 'happier on their own',
};
const HABITS = Object.keys(HABIT_NOTE);
const TRICKS = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'];
const SIMPLE = ['swim', 'leavePool', 'fetch', 'zoomies', 'wander', 'rest', 'seekAttention', 'playWith', 'greet', 'joinFriend'];
/** Only accept intents the chat is allowed to trigger. */
export function parseIntent(v) {
    if (typeof v !== 'object' || v === null)
        return null;
    const kind = v.kind;
    if (SIMPLE.includes(kind))
        return { kind };
    if (kind === 'trick') {
        const trick = v.trick;
        if (TRICKS.includes(trick))
            return { kind: 'trick', trick: trick };
    }
    return null;
}
/** `[{ dog, <key> }]` entries for dogs in the yard, with a valid value. */
function perDog(raw, key, game, parse) {
    if (!Array.isArray(raw))
        return [];
    return raw.slice(0, 6).flatMap((e) => {
        const dog = game.dogAt(String(e?.dog));
        const v = parse(e?.[key]);
        return dog && v !== null ? [[dog, v]] : [];
    });
}
const oneOf = (opts) => (v) => (opts.includes(v) ? v : null);
export class Chat {
    game;
    log;
    form;
    input;
    onHabit;
    endpoint;
    history = [];
    queue = [];
    sending = false;
    constructor(game, log, form, input, 
    /** Called after chat changes a dog's habits (to save them). */
    onHabit = () => { }, endpoint = '/api/chat') {
        this.game = game;
        this.log = log;
        this.form = form;
        this.input = input;
        this.onHabit = onHabit;
        this.endpoint = endpoint;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            void this.send(input.value);
        });
    }
    /** The set of dogs in the yard changed. */
    modeChanged(initial = false) {
        if (initial) {
            for (const d of this.game.dogs)
                this.bubble('assistant', `${d.profile.lines.hello}! *wags tail*`, d);
            return;
        }
        const dogs = this.game.dogs;
        this.bubble('note', dogs.length > 1 ? `${dogs.map((d) => d.name).join(' & ')} are both in the yard` : `Just ${dogs[0].name} now`);
        this.queue = [];
    }
    bubble(role, text, dog) {
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
    async send(raw) {
        const text = raw.trim().slice(0, 500);
        if (!text || this.sending)
            return;
        this.sending = true;
        this.input.value = '';
        this.form.classList.add('busy');
        this.bubble('user', text);
        this.history.push({ role: 'user', text });
        for (const d of this.game.dogs)
            d.hear();
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
            const data = (await res.json().catch(() => ({})));
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
            const started = new Set();
            for (const [dog, intent] of perDog(data.actions, 'intent', this.game, parseIntent)) {
                if (started.has(dog))
                    this.queue.push([dog, intent]);
                else {
                    started.add(dog);
                    this.run(dog, intent);
                }
            }
        }
        catch {
            typing.remove();
            this.history.pop();
            this.bubble('note', 'No connection to the yard right now.');
        }
        finally {
            this.sending = false;
            this.form.classList.remove('busy');
        }
    }
    /** Run queued actions one at a time per dog, whenever that dog is free. */
    tick() {
        const i = this.queue.findIndex(([dog]) => !dog.busy && this.game.dogs.includes(dog));
        if (i < 0)
            return;
        const [dog, intent] = this.queue.splice(i, 1)[0];
        this.run(dog, intent);
    }
    run(dog, intent) {
        const d = dog.request(intent, 'chat');
        if (!d.accept)
            this.bubble('note', `${dog.name}: “${d.line}”`);
    }
}
