export function createMachine(create: any, context?: {}, options?: {}): {
    /** @private */
    states: {};
    /** @private */
    subscriptions: any[];
    /** @private */
    activeEffects: any[];
    /** @private */
    pendingEffects: any[];
    /** @private */
    get: () => {
        name: any;
        context: {};
    };
    /** @public */
    current: {
        name: any;
        context: {};
    };
    /** @public */
    subscribe: (onChange: any) => () => void;
    /** @public */
    flushEffects: () => void;
    /** @public */
    cleanEffects: () => void;
    /** @public */
    send: (event: any) => void;
};
