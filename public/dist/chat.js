const EMOTIONS = ['loved', 'excited', 'calm', 'curious', 'sad', 'hot'];
const FEELING_NOTE = {
    loved: 'Jaylee feels loved', excited: 'Jaylee is all wound up', calm: 'Jaylee settles down',
    curious: 'Jaylee\u2019s ears perk up', sad: 'Jaylee\u2019s ears droop', hot: 'Jaylee feels the heat',
};
const HABIT_NOTE = {
    swimMore: 'New habit: swims more often', swimLess: 'New habit: swims less often',
    playMore: 'New habit: more playful', playLess: 'New habit: calmer',
    cuddleMore: 'New habit: comes to you more', cuddleLess: 'New habit: more independent',
    exploreMore: 'New habit: explores more', exploreLess: 'New habit: explores less',
    listenMore: 'New habit: listens better',
};
const pickList = (v, opts) => Array.isArray(v) ? v.filter((x) => opts.includes(x)).slice(0, 2) : [];
const TRICKS = ['sit', 'wave', 'hop', 'sniff', 'curious', 'beg', 'wink', 'look'];
const SIMPLE = ['swim', 'leavePool', 'fetch', 'zoomies', 'wander', 'rest', 'seekAttention'];
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
    /** Called after chat changes one of her habits (to save it). */
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
        this.bubble('assistant', 'Hi hi hi! *wags tail* Wanna play?');
    }
    bubble(role, text) {
        const li = document.createElement('li');
        li.className = `msg ${role}`;
        li.textContent = text;
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
        this.game.hear();
        const typing = this.bubble('assistant', '•••');
        typing.classList.add('typing');
        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messages: this.history.slice(-20), state: this.game.snapshot() }),
            });
            const data = (await res.json().catch(() => ({})));
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
            const habits = pickList(data.habits, Object.keys(HABIT_NOTE));
            for (const h of habits) {
                this.game.brain.adjustHabit(h);
                this.bubble('note', HABIT_NOTE[h]);
            }
            if (habits.length)
                this.onHabit();
            const intents = Array.isArray(data.intents) ? data.intents.map(parseIntent).filter((i) => i !== null) : [];
            // The first action interrupts whatever she was doing; a second one waits its turn.
            const [first, second] = intents;
            if (first)
                this.run(first);
            if (second)
                this.queue.push(second);
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
    /** Run queued actions one at a time, whenever she's free. */
    tick() {
        if (!this.queue.length || this.game.busy)
            return;
        this.run(this.queue.shift());
    }
    run(intent) {
        const d = this.game.request(intent, 'chat');
        if (!d.accept)
            this.bubble('note', `Jaylee: “${d.line}”`);
    }
}
