<p align="center">
  <img width="360" src="https://user-images.githubusercontent.com/324440/102810325-6ce7ad80-43bb-11eb-9a72-9eead02fc71f.png" alt="react machine logo, a man with an open head with a state chart inside" title="react-machine">
</p>


<h4 align="center">Finite state machine hook for React featuring context, reducers, actions and effects.</h4>
<br />

When `useState` or `useReducer` is not enough, the `useMachine` hook can be used to express more complex component state and business logic. Machines are especially useful in handling asynchronouse effects in your components (for example, saving a form). In fact, you can think of `useMachine` as `useReducer` with native support for asynchronous logic.

Features include:

- a single `useMachine` hook for declaratively describing state machines
- define `states` and `transitions` between those states
- `immediate` transitions with `guards`
- `internal` transitions, useful for updating context based on changing props
- a variety of transition hooks available - `reduce`, `assign`, `action`, `guard`
- state `enter` and `exit` hooks - `reduce`, `assign`, `action`, `invoke`, `effect`
- out of the box support for async functions with `invoke`
- custom side effects with `effect`
- `useReducer` used for storing state internally, with transitions applied using `dispatch` and effects using `useEffect`, making this a native React state machine implementation, built with concurrent mode in mind
- extend machines with hierarchical and parallel states _(coming in V2 in 2021)_
- semantics modelled inline with the [SCXML](https://www.w3.org/TR/scxml/) spec _(coming in V2 in 2021)_

### Example

```js
import React from 'react'
import { useMachine } from 'react-machine'

const isSuccess = (ctx) => ctx.status === 'success'
const isError = (ctx) => ctx.status === 'error'
const increment = (ctx) => ({ ...ctx, count: ctx.count + 1 })
const retry = (ctx) => ctx.retry()

function machine({ state, transition, immediate, internal, enter }) {
  state(
    'loading',
    internal('assign', { assign: true }),
    immediate('counter', { guard: isSuccess }),
    immediate('error', { guard: isError })
  )

  state('error',
    internal('assign', { assign: true }),
    transition('retry', 'loading', { action: retry })
  )

  state(
    'counter',
    enter({ assign: { count: 0 } }),
    internal('assign', { assign: true }),
    internal('increment', { reduce: increment })
  )
}

export function Component({ status, retry }) {
  const [{ name, context }, send] = useMachine(machine, { status, retry })

  if (name === 'loading') return <div>Loading</div>
  if (name === 'error') return <button onClick={() => send('retry')}>Retry</button>
  return <button onClick={() => send('increment')}>{context.count}</button>
}
```

Also see:

  * [Example: Form](examples/example-form.md)

## Acknowledgements

`react-machine` is very much inspired by [XState](https://xstate.js.org/) and [Robot](https://thisrobot.life/) - thank you for really great libraries 🙏

### Comparison to [Robot](https://thisrobot.life/)

Robot is a great little Finite State Machine library with integrations into React, Preact, Svelte and more. It has a neat API that inspired the API of `react-machine` and boasts a lightweight implementation. Here are some differences:

- Robot requires every helper function to be imported individually (e.g. `state`, `transition`, `action`, `reducer` and so on) in every module you need to create machines. `react-machine` uses a very similar DSL for declaring machines, but passes helpers as arguments to the machine creation function (e.g. `state`, `transition`), and takes hooks as options (e.g. `action`, `reduce`). This means you only ever need to import `useMachine`, which is more akin to how you'd use `useState` or `useReducer` for managing state.
- Robot has some support for nesting machines, but `react-machine` (in the upcoming V2) will support arbitrarily nested and parallel states, adhering more closely to the [SCXML](https://www.w3.org/TR/scxml/) spec.
- Robot does not support internal transitions, making it difficult to update machine context mid promise invocation.
- Robot does not have `enter` and `exit` hooks, and does not allow custom effect implementations.

### Comparison to [XState](https://xstate.js.org/):

XState is the most powerful modern state chart / state machine implementation for JavaScript. It's rich in features and supports React and Vue out of the box. Here are some differences:

- `react-machine` strives to create a smaller surface area, less features, less options, less packages - all intended to help with writability and readability of the machines, for example you will not find Actors, machine inter messaging, delayed events, support for observables (although you can easily hook into them in a custom effect), history states in `react-machine`
- related to the point above, full compatibility / serialisation to SCXML is a non goal for `react-machine`, SCXML (and it's interpration algorithm in particular) is only used to guide the implementation of `react-machine`
- `react-machine` uses a more functional machine declaration DSL that is closer to that found in Robot, whereas XState declares machines using a deeply nested object notation, this might well be a personal preference, give both a try, and also XState might gain new optional DSL adapters in the future
- XState provides visualisation of it's state charts, a feature that could be added to `react-machine` in the future (wanna work on it?)

## API

### `useMachine(description, context, options)`

- `description` - the machine description function, see examples for usage, description function is invoked with `{ state, transition, immediate, internal, enter, exit }`
- `context` - the context to be used within the machine, since it's common to pass props and other computed data via context, whenever any of the values of the context change, the hook will send an event of type `assign` with the context object spread onto the event object, this event can be renamed or disabled in options
- `options` - hook options
  - `assign` - default: `assign`, the name of the event to be sent when context values change, set this to `false` to disable sending the event altogether
  - `deps` - default: `undefined`, by default all context values are checked for changes, customize the dependency array to be used for checking when to send the `assign` event

**Returns** `[state, send, machine]`:

- `state` - current state of shape `{ name, context }`
- `send` - send an event, e.g. `send('save')` or `send({ type: 'save', item: 'x' })`
- `machine` - the stateless machine description object that can be used to inspect the machine or transition to new states

Machines are constructed using the api passed into the machine description function. Below is the documentation for every available function for constructing machines.

### `state(name, ...transitions)`

Used to declare all of the possible states of the state machine.

- `name` - name of the state
- `transitions` - any number of available: `transition()`, `immediate()`, `internal()`, `enter()`, `exit()`

### `transition(event, target, options)`

When an event is sent, the first transition that matches the event type declared in the transition is applied to transition the machine to the next state.

- `event` - the name of the event that will trigger this transition
- `target` - the name of the target state
- `options` - in the shape of `{ reduce, assign, action, guard }`

### `immediate(target, options)`

A special type of transition that is executed after every transition into the state (including internal transitions). If no `guard` option is used, the transition will always immediately be applied and move the machine to a new state. If the `guard` option is used, the transition will only be applied if the `guard` condition passes. Note that, when immediate transitions take place, all of the intermediate transition hooks and intermediate state enter/exit hooks are triggered, however the effects (including `invoke`) are only executed for the final state, not any of the intermediate states.

- `target` - the name of the target state
- `options` - in the shape of `{ reduce, assign, action, guard }`

### `internal(event, options)`

A special type of transition that does not leave the state and does not trigger any enter/exit hooks. Useful for performing actions or updating context without leaving the state. Note: this transition does re-evaluate all immediate transitions of the state.

- `event` - the name of the event that will trigger this transition
- `options` - in the shape of `{ reduce, assign, action, guard }`

### `enter(options)`

Hooks to run when entering the state.

- `options` - in the shape of `{ reduce, assign, action, invoke, effect }`

### `exit(options)`

Hooks to run when leaving the state.

- `options` - in the shape of `{ reduce, assign, action }`

And finally, a set of hooks that can be executed upon `transition` or state `enter`/`exit`. Note that `reduce`, `assign` and `action` hooks will be executed in the order provided. Whereas `invoke` and `effect` will only get executed after rerendering the component, in a `useEffect` React hook.

### `reduce`

Examples:

```js
{ reduce: (context, event) => nextContext }
{ reduce: (context, { type, ...payload }) => nextContext }
{ reduce: [reduce1, reduce2] }
```

Return the new context.

### `assign`

Examples:

```js
{ assign: (context, { type, ...payload }) => ({ ...context , ...payload }) }
{ assign: true } // same as above
{ assign: { static: 'value' } }
{ assign: [assign1, assign2] }
```

Return a partial context update object, that will be immutably assigned to the current context. A commonly useful shortcut for assigning event paylods to the context.

### `action`

Examples:

```js
{ action: (context, event) => context.onClose() }
{ action: [action1, action2] }
```

A fire and forget action executed immediately (synchronously) upon sending an event.

### `invoke`

Examples:

```js
state('save',
  enter({ invoke: async (context, event) => context.save() }),
  transition('done', 'show', { assign: (ctx, event) => ({ item: event.data }) }),
  transition('error', 'edit', { assign: (ctx, event) => ({ error: event.error }) }),
)
```

A way to invoke async functions as part of entering a state. If the promise is fulfilled, an event of shape `{ type: 'done', data }` is sent, and if the promise rejects, an event of `{ type: 'error', error }` is sent. Note, if the machine exits the state while the promise is pending, the results will be ignored and no event will get sent. Note, internally, `invoke` is turned into an `effect`.

### `effect`

Examples:

```js
const addPing = (ctx, event) => ({ pings: ctx.pings.concat(event.ping) })
const listenToPings = (context, event, send) => {
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

A way of handling side effects, async effects, subscriptions or activities. Once the state is entered, the effect gets started (in `useEffect` and only after finalising all of the immediate transitions) and can send any number of events. Note that `context` will be valid when initially running the effect, but will get stale afterwards, and is best read in subsequent internal transitions. Also note that `send` will be ignored after the effect is cleaned up, and similarly `send` can not be used in the cleanup function of the effect.

### `guard`

Examples:

```js
{ guard: (context, event) => context.status === 'success' }
```

If the guard condition fails, the transition is skipped when matching against the event and selection proceeds to the next transition.

### Roadmap

#### V1

- [x] es6 modules
- [x] snowpack "good package mode"
- [x] invoke
- [x] effect
- [x] set final: true somewhere
- [x] decide if invoke / effect will be options or functions: options 🙌
- [x] immediate chains
- [x] immediate chains with invokes/effects (??)
- [x] guards
- [x] introduce assign: true, assign: { error: null }, assign: data => data2 as a shortcut
- [x] separate machine (currently called states) from state
- [x] fix tests with the new structure
- [x] introduce enter/exit
- [x] rename applyEvent to transition
- [x] reuse applyEvent instead of applyTransition in initialisation
- [x] pass context to assign
- [x] add internal() transitions that transition to itself, useful for assign and other bits
- [x] find a better name for "transforms"
- [x] protect promises from sending events if they were cleaned up
- [x] store running effects in a ref
- [x] write a thorough readme
- [x] complete the tests
- [x] effects should get event passed in
- [x] convert actions into reducers, so they're applied in order
- [ ] add debug logging option
- [ ] write proper typings
- [ ] release!

#### V2

- [ ] add hierarchical and parallel states
- [ ] only new effects are run, old ones can stay running
- [ ] change from state.name string to state.value object
- [ ] introduce state.matches() api
