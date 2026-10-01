/**
 * Chat with the dogs: talks to /api/chat, shows each dog's reply, and feeds
 * the actions, feelings and habit changes they chose back into the game.
 */
import type { Game } from './game.js';
import type { Dog } from './dog.js';
import type { Intent } from './types.js';
/** Only accept intents the chat is allowed to trigger. */
export declare function parseIntent(v: unknown): Intent | null;
export declare class Chat {
    private readonly game;
    private readonly log;
    private readonly form;
    private readonly input;
    /** Called after chat changes a dog's habits (to save them). */
    private readonly onHabit;
    private readonly endpoint;
    private history;
    private queue;
    private sending;
    /** Who's chatting: 'gabby', 'shannah' or 'guest'. */
    human: string;
    constructor(game: Game, log: HTMLElement, form: HTMLFormElement, input: HTMLInputElement, 
    /** Called after chat changes a dog's habits (to save them). */
    onHabit?: (dog: Dog) => void, endpoint?: string);
    /** Someone else is at the keyboard: each dog reacts in their own way. */
    humanChanged(human: string, label: string): void;
    /** The set of dogs in the yard changed. */
    modeChanged(initial?: boolean): void;
    private bubble;
    send(raw: string): Promise<void>;
    /** Run queued actions one at a time per dog, whenever that dog is free. */
    tick(): void;
    private run;
}
