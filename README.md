<p align="center">
  <img width="360" src="https://user-images.githubusercontent.com/324440/102810325-6ce7ad80-43bb-11eb-9a72-9eead02fc71f.png" alt="react machine logo, a man with an open head with a state chart inside" title="react-machine">
</p>


<h4 align="center">Finite state machine hook for React</h4>
<br />

When `useState` or `useReducer` is not enough, `useMachine` hook can be used to express more complex component state and business logic. Machines are especially useful for handling asynchronous effects in your components, for example, saving a form.

Features include:

- a single `useMachine` hook for declaratively describing state machines
- define `states` and `transitions` between states
- apply `reducers` and queue `effects` when transitioning
- `immediate` transitions with `guards`
- `internal` transitions for updating state data or queuing effects
- first class support for promises with the `invoke` effects
- internally implemented using `useReducer` and `useEffect` hooks
- hierarchical and parallel states _(coming in V2 in 2021)_
- semantics guided by the [SCXML](https://www.w3.org/TR/scxml/) spec _(coming in V2 in 2021)_

### Example

```js
import React from 'react'
import { useMachine } from 'react-machine'

const isSuccess = ctx => ctx.item.status === 'success'
const isError = ctx => ctx.item.status === 'error'
const increment = (ctx, data) => ({ ...data, count: data.count + 1 })
const retry = ctx => ctx.retry()

const machine = ({ state, transition, immediate, internal, enter }) => {
  state(
    'loading',
    immediate('counter', { guard: isSuccess }),
    immediate('error', { guard: isError })
  )

  state('error',
    transition('retry', 'loading', { effect: retry })
  )

  state(
    'counter',
    enter({ assign: { count: 0 } }),
    internal('increment', { reduce: increment })
  )
}

export function Component({ item, retry }) {
  const { state, send } = useMachine(machine, { item, retry })

  if (state.name === 'loading') return <div>Loading</div>
  if (state.name === 'error') return <button onClick={() => send('retry')}>Retry</button>
  return <button onClick={() => send('increment')}>{state.data.count}</button>
}
```

Also see:

  * [Example: Form](examples/example-form.md)

## Motivation

`react-machine` is very much inspired by [XState](https://xstate.js.org/) and [Robot](https://thisrobot.life/) - thank you for really great libraries 🙏

### Comparison to [Robot](https://thisrobot.life/)

Robot is a great Finite State Machine library with integrations into React, Preact, Svelte and more. It has a neat succint API that inspired the API of `react-machine` and boasts a lightweight implementation. Here are some differences:

- Robot requires every helper function to be imported individually. `react-machine` uses a similar DSL, but passes helpers as arguments to the machine creation function or takes them as options. This means you only ever need to import `useMachine`, which is more akin to how you'd use `useState` or `useReducer` for managing state.
- Robot has some support for nesting machines, but `react-machine` (_in the upcoming V2_) will support arbitrarily nested and parallel states, adhering more closely to the [SCXML](https://www.w3.org/TR/scxml/) spec.
- Robot does not support internal transitions, making it difficult to update machine context in the middle of an async function invocation.
- Robot does not clean up promise invocations in between transitions.
- Robot does not have `enter` and `exit` hooks, and does not allow custom effect implementations.
- Since `react-machine` is built with React in mind, it has a special ability to react to context (or prop) changes to drive machine transitions.

### Comparison to [XState](https://xstate.js.org/):

XState is the most powerful modern state chart / state machine implementation for JavaScript. It's rich in features and supports React and Vue out of the box. Here are some differences:

- `react-machine` strives to create a smaller surface area, less features, less options, less packages. This could be seen as a good or a bad thing depending on your perspective and your requirements. For example, you will not find actors, machine inter messaging, delayed events or history states in `react-machine`.
- related to the point above, full compatibility / serialisation to SCXML is a non goal for `react-machine`, SCXML (and it's interpration algorithm in particular) is only used to guide the implementation of `react-machine`.
- `react-machine` uses a more functional machine declaration DSL that is closer to that found in Robot, whereas XState declares machines using a deeply nested object notation, this might well be a personal preference, give both a try, and also XState might gain new optional DSL adapters in the future.
- XState provides visualisation of it's state charts, a feature that could be added to `react-machine` in the future.
- Since `react-machine` is built with React in mind, it has a special ability to react to context (or prop) changes to drive machine transitions.

### Conclusion

In summary, `react-machine` is an experiment in creating a lightweight and flexible solution for component level state management in React. The core machine logic is pure and stateless, which allows for delegating the state storage to `useReducer` and effect execution to `useEffect`, done so with concurrent mode compatibility in mind.

## API

Machines are created using the API passed into machine description function, here's an exhaustive example showing all possible types of transitions and hooks:

```js
const { state, send, context, machine } = useMachine(({ state, transition, immediate, internal, enter, exit }) => {
    state(stateName,
      enter({ reduce, assign, invoke, effect }),
      transition(event, target, { guard, reduce, assign, effect }),
      immediate(target, { guard, reduce, assign, effect }),
      internal(event, { guard, reduce, assign, effect }),
      exit({ reduce, assign, effect }),
    )
}, context, options)
```

### Concepts

When you invoke the `useMachine` hook it returns machine state, send, context and the constructed machine itself. Typically you'll use state, send and you could use context in case you're passing it down to other components.

**State** - state consists of `name` and `data` (state data). Name is the name of the current state node the machine is in. State data is any data that has been computed using reducers (and assigners) as part of transitioning between states.

**Send** - this is the main way you will transition machine from one state to another. Send can take the event name, or an event object with key `type` and arbitrary other keys as payload.

**Context** - context is passed as the second argument to `useMachine` and is not to be confused with machine state or machine state data. Context is a little bit like React component props. It's some immutable data that gets passed into every machine hook (such as guard, reduce or effect). Context provides the best way for your machine to utilise component props in machine's business logic. If context changes (or more specifically, any of value of the context object changes), an event of type `assign` and no payload will be sent into the machine, which will evaluate any guarded immediated transitions and any transitions listening to `assign` event. This is very useful if you want your machine to change states or update it's state data based on changing context. It is also efficient, since context changes that are not relevant to the current machine state will not trigger any re-renders.

#### Hook

* [useMachine](#usemachinedescription-context-options)

#### State machine description

* [state](#statename-transitions)
* [transition](#transitionevent-target-options)
* [immediate](#immediatetarget-options)
* [internal](#internalevent-options)
* [enter](#enteroptions)
* [exit](#exitoptions)
* [initial](#initialoptions)

#### Transition hooks

* [guard](#guard)
* [reduce](#reduce)
* [assign](#assign)
* [invoke](#invoke)
* [effect](#effect)

### `useMachine(description, context, options)`

Create and initialise the machine.

- `description` - the machine description function invoked with `state`, `transition`, `immediate`, `internal`, `enter`, `exit` and `initial` as arguments.
- `context` - the context to be assigned to the machine's state. Since it's common to pass props and other computed data via context, by default, whenever any of the values of the context change, the hook will send an event of type `assign` with the context object spread onto the event object, this event can be renamed or disabled in options.
- `options` - hook options

Available options:

- `assign` (default: `"assign"`) - the name of the event to be sent when context changes. Set this to `false` to disable sending the event altogether.
- `areEqual` (default: compare object values) - by default all context values are checked for changes on each render. Use this option to customize how equality is computed when comparing the previous context with the new context.

Returns `{ state, send, context, machine }`:

- `state` - current state of shape `{ name, data, final }`
- `send` - send an event, e.g. `send('save')` or `send({ type: 'save', item: 'x' })`
- `context` - the same value that was passed in as the context argument to the hook
- `machine` - a stateless machine description that is used internally to compute transitions

```js
const myMachine = useCallback(({ state, transition, initial }) => {
  initial({ x: 0 })
  state('a', transition('next', 'b'))
  state('b', transition('next', 'c'))
  state('c')
}, [])
const  {state, send, context, machine } = useMachine(myMachine, { close: props.close })
const { name, data, final } = state
```

### `state(name, ...transitions)`

Declare a state.

- `name` - name of the state
- `transitions` - any number of available: `transition()`, `immediate()`, `internal()`, `enter()`, `exit()`

```js
state('loading')
state('loading', transition('go', 'ready'))
state('loading', immediate('ready', { guard: ctx => ctx.loaded }))
```

### `transition(event, target, options)`

Declare a transition between states.

- `event` - the name of the event that will trigger this transition
- `target` - the name of the target state
- `options` - in the shape of `{ reduce, assign, invoke, effect, guard }`

```js
transition('save', 'saving')
transition('reset', 'edit', { reduce: (ctx, data) => ({ ...data, value: null }) })
transition('close', 'closing', { effect: ctx => ctx.onClose() })
```

### `immediate(target, options)`

A special type of transition that is executed immediately upon entering (or re-entering a state with an internal transition). If no `guard` option is used, the transition will always immediately be applied and move the machine to a new state. If the `guard` option is used, the transition will only be applied if the `guard` condition passes. Note that, when immediate transitions take place, all of the intermediate transition hooks and intermediate state enter/exit hooks are triggered, however the effects (including `invoke`) are only executed for the final state, not any of the intermediate states.

- `target` - the name of the target state
- `options` - in the shape of `{ reduce, assign, invoke, effect, guard }`

```js
immediate('ready')
immediate('ready', { guard: { guard: ctx => ctx.loaded } })
```

### `internal(event, options)`

A special type of transition that does not leave the state and does not trigger any enter/exit hooks. Useful for performing effects or updating context without leaving the state. Note: this transition does re-evaluate all immediate transitions of the state.

- `event` - the name of the event that will trigger this transition
- `options` - in the shape of `{ reduce, assign, invoke, effect, guard }`

```js
internal('assign', { assign: true })
internal('reset', { assign: { count: 0 } })
```

### `enter(options)`

Hooks to run when entering a state.

- `options` - in the shape of `{ reduce, assign, invoke, effect }`

```js
enter({ effect: ctx => ctx.start() })
enter({ invoke: (ctx, data) => ctx.fetch('/item/' + data.id) })
enter({ assign: { count: 0 } })
```

### `exit(options)`

Hooks to run when leaving the state.

- `options` - in the shape of `{ reduce, assign, effect }`

```js
exit({ effect: ctx => ctx.stop() })
exit({ assign: { error: null } })
```

### `initial(...)`

A hook for setting initial state and/or initial state data. If initial state name is omitted, the first state node will be used as the initial state. The initial data can be a static object (or any kind of data structure) or a function that takes context and returns the initial data.

```js
initial('loading')
initial('loading', { item: null })
initial('loading', (ctx) => ({ item: ctx.item }))
initial('loading', (ctx) => { item: ctx.item })
initial({ item: null })
initial((ctx) => ({ item: ctx.item }))
initial((ctx) => { item: ctx.item })
```

### `guard`

If the guard condition fails, the transition is skipped when matching against the event and selection proceeds to the next transition. Commonly used with `immediate` transitions, but works with any type of transition.

```js
{ guard: (context, data, event) => context.status === 'success' }
```

### `reduce`

Updated context based on current context and the incoming event.

```js
{ reduce: (context, data, event) => nextData }
{ reduce: (context, data, { type, ...payload }) => nextData }
{ reduce: [reduce1, reduce2] }
```

### `assign`

Return a partial context update object, that will be immutably assigned to the current context. A commonly useful shortcut for assigning event paylods to the context.

```js
{ assign: (context, data, { type, ...payload }) => ({ ...data , ...payload }) }
{ assign: true } // same as above
{ assign: { some: 'value' } }
{ assign: [assign1, assign2] }
```

### `invoke`

A way to invoke async functions as part of entering a state. If the promise is fulfilled, an event of shape `{ type: 'done', result }` is sent, and if the promise rejects, an event of `{ type: 'error', error }` is sent. Note, if the machine exits the state while the promise is pending, the results will be ignored and no event will get sent. Note, internally, `invoke` is turned into an `effect`.

```js
state('save',
  enter({ invoke: async (context, data, event) => context.save() }),
  transition('done', 'show', { assign: (ctx, data, event) => ({ item: event.result }) }),
  transition('error', 'edit', { assign: (ctx, data, event) => ({ error: event.error }) }),
)
```

### `effect`

A way of handling side effects, async effects, subscriptions or activities. Once the state is entered, the effect gets started (in `useEffect` and only after finalising all of the immediate transitions) and can send any number of events. Note that `context` will be valid when initially running the effect, but will get stale afterwards. Also note that `send` will be ignored after the effect is cleaned up, and similarly `send` can not be used in the cleanup function of the effect.

```js
const addPing = (ctx, data, event) => ({ pings: data.pings.concat(event.ping) })
const listenToPings = (context, data, event, send) => {
  const cancel = context.ponger.subscribe((ping) => {
    send({ type: 'ping', ping })
  })
  return () => cancel()
}

state('save',
  enter({ assign: { pings: [] }, effect: listenToPings }),
  internal('ping', { assign: addPing })
)
```

### Roadmap

#### V1

- [x] decomplect machine context from state data (see [Changelog](CHANGELOG.md))
- [x] remove the concept of actions in favor of effects (see [Changelog](CHANGELOG.md))
- [ ] add an option to enable debug logging
- [ ] write proper TypeScript type definitions

#### V2

- [ ] add hierarchical and parallel states
- [ ] introduce initial and final states
- [ ] change from state.name string to state.value object
- [ ] introduce matches() api

#### V3

- [ ] add compatibility with XState visualiser, serialize into compatible JSON
