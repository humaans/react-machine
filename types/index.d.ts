export type EventType = string;
export type MetaObject = Record<string, any>;

export interface EventObject {
  type: string;
}

export type Event<TEvent extends EventObject> = TEvent['type'] | TEvent;

export interface StateObject<TContext = any> {
  name: string
  context: TContext
  final?: true
}

export interface StateSchema<TContext = any> {
  meta?: any;
  context?: Partial<TContext>;
  states?: {
    [key: string]: StateSchema<TContext>;
  };
}

export function useMachine<TContext, TStateSchema extends StateSchema, TEvent extends EventObject>(
  description: MachineDescription<TContext, TStateSchema, TEvent>,
  context?: TContext,
  options?: MachineOptions
): [state: StateObject<TContext>, send: SendFunction<TEvent>]

export interface MachineOptions {
  assign: string | boolean,
  deps: string[]
}

export type MachineDescription<C, S, E> = ({ state, transition, immediate, internal, enter, exit }: {
  state: StateFunction
  transition: TransitionFunction<C, E>
  immediate: ImmediateFunction<C, E>
  internal: TransitionFunction<C, E>
  enter: EnterFunction<C, E>
  exit: ExitFunction<C, E>
}) => any

export type StateFunction = (
  name: string,
  ...opts: (Transition | Immediate | Internal | Enter | Exit)[]
) => MachineState

/**
 * A `transition` function is used to move from one state to another.
 *
 * @param event - This will give the name of the event that triggers this transition.
 * @param target - The name of the destination state.
 * @param opts - Transition hooks, one of reduce, assign, guard or action.
 */
export type TransitionFunction<C, E> = (
  event: string,
  target: string,
  opts: TransitionOptions<C, E>
) => Transition

/**
 * An `immediate` transition is triggered immediately upon entering the state.
 *
 * @param target - The name of the destination state.
 * @param opts - Transition hooks, one of reduce, assign, guard or action.
 */
export type ImmediateFunction<C, E> = (
  target: string,
  opts: TransitionOptions<C, E>
) => Immediate

/**
 * An `internal` transition will re-enter the same state, but without re-runing enter/exit hooks.
 *
 * @param event - This will give the name of the event that triggers this transition.
 * @param opts - Transition hooks, one of reduce, assign, guard or action.
 */
export type InternalFunction<C, E> = (
  target: string,
  opts: TransitionOptions<C, E>
) => Internal

export type EnterFunction<C, E> = (
  opts: EnterOptions<C, E>
) => Enter

export type ExitFunction<C, E> = (
  opts: ExitOptions<C, E>
) => Exit

export interface MachineState {
  name: string
  transitions: Map<string, Transition[]>
  immediates?: Map<string, Immediate[]>
  enter: any[]
  exit: any[]
  final?: true
}

export interface Transition {
  type: 'transition'
  event: string
  target: string
  guards: any[]
  reducers: any[]
}

export interface Immediate {
  type: 'transition'
  target: string
  guards: any[]
  reducers: any[]
}

export interface Internal {
  type: 'transition'
  internal: true
  event: string
  guards: any[]
  reducers: any[]
}

export interface Enter {
  type: 'enter'
  reducers: any[]
  effects: any[]
}

export interface Exit {
  type: 'enter'
  reducers: any[]
  effects: any[]
}

export interface TransitionOptions<C, E> {
  guard?: GuardFunction<C, E> | GuardFunction<C, E>[]
  reduce?: ReduceFunction<C, E> | ReduceFunction<C, E>[]
  assign?: Assign<C, E> | Assign<C, E>[]
  action?: ActionFunction<C, E> | ActionFunction<C, E>[]
}

export interface EnterOptions<C, E> {
  effect?: EffectFunction<C, E> | EffectFunction<C, E>[]
  invoke?: InvokeFunction<C, E> | InvokeFunction<C, E>[]
  reduce?: ReduceFunction<C, E> | ReduceFunction<C, E>[]
  assign?: Assign<C, E> | Assign<C, E>[]
  action?: ActionFunction<C, E> | ActionFunction<C, E>[]
}

export interface ExitOptions<C, E> {
  reduce?: ReduceFunction<C, E> | ReduceFunction<C, E>[]
  assign?: Assign<C, E> | Assign<C, E>[]
  action?: ActionFunction<C, E> | ActionFunction<C, E>[]
}

export type ReduceFunction<C, E> = (context: C, event: E) => C
export type ActionFunction<C, E> = (context: C, event: E) => unknown
export type GuardFunction<C, E> = (context: C, event: E) => boolean
export type Assign<C, E> = true | Partial<C> | ((context: C, event: E) => Partial<C>)
export type InvokeFunction<C, E> = (context: C, event: E) => Promise<any>
export type EffectFunction<C, E> = (context: C, event: E) => CleanupFunction | void
export type CleanupFunction = () => void

export type SendFunction<TEvent extends EventObject> = (event: TEvent) => void