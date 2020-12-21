export function useMachine<C, E extends Event>(description: MachineDescription<C, E>, context?: C, options?: {}): any

export type MachineDescription<C, E> = ({ state, transition }: { state: StateFunction, transition: TransitionFunction<C, E> }) => any

/**
 * The `state` function declares a state object.
 *
 * @param opts - Any argument needs to be of type Enter, Exit, Transition, Immediate or Internal.
 */
// export function state(name: string, ...opts: (Transition | Immediate)[]): MachineState

export type StateFunction = (name: string, ...opts: (Transition | Immediate)[]) => MachineState
export type TransitionFunction<C, E> = (event: string, target: string, opts: TransitionOptions<C, E>) => Transition

/**
 * A `transition` function is used to move from one state to another.
 *
 * @param event - This will give the name of the event that triggers this transition.
 * @param state - The name of the destination state.
 * @param args - Any extra argument will be evaluated to check if they are one of Reducer, Guard or Action.
 */
// export function transition<C, E>(
//   event: string,
//   state: string,
//   ...opts: (Reducer<C, E> | Guard<C, E> | Action<C, E>)[]
// ): Transition

export interface MachineState {
  transitions: Map<string, Transition[]>
  immediates?: Map<string, Immediate[]>
  enter?: any
  final: boolean
}

export interface Transition {
  from: string | null
  to: string
  guards: any[]
  reducers: any[]
}

export interface TransitionOptions<C, E> {
  reduce?: ReduceFunction<C, E> | ReduceFunction<C, E>[],
  action?: ActionFunction<C, E> | ActionFunction<C, E>[],
  
}

export type ReduceFunction<C, E> = (context: C, event: E) => C
export type ActionFunction<C, E> = (context: C, event: E) => unknown
export type GuardFunction<C, E> = (context: C, event: E) => boolean

export type Immediate = Transition

interface EventObject {
  type: string
}

type Event = string | EventObject