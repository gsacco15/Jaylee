/** Chat with Jaylee: talks to /api/chat and feeds her chosen actions to the game. */
import type { Game } from './game.js';
import type { Intent } from './types.js';
/** Only accept intents the chat is allowed to trigger. */
export declare function parseIntent(v: unknown): Intent | null;
export declare class Chat {
    private readonly game;
    private readonly log;
    private readonly form;
    private readonly input;
    private readonly endpoint;
    private history;
    private queue;
    private sending;
    constructor(game: Game, log: HTMLElement, form: HTMLFormElement, input: HTMLInputElement, endpoint?: string);
    private bubble;
    send(raw: string): Promise<void>;
    /** Run queued actions one at a time, whenever she's free. */
    tick(): void;
}
