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

const machine = ({ state, transition, immediate, internal, enter }) => {
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

Machines are created using the API passed into machine description function, here's an exhaustive example showing all possible types of transitions and hooks:

```js
const [state, send] = useMachine(({ state, transition, immediate, internal, enter, exit }) => {
  state(stateName,
    enter({ reduce, assign, action, invoke, effect }),
    transition(event, target, { guard, reduce, assign, action }),
    immediate(target, { guard, reduce, assign, action }),
    internal(event, { guard, reduce, assign, action }),
    exit({ reduce, assign, action }),
  )
}, context)
```

See below for the documentation of every function and option:

Hook:

* [useMachine](#usemachinedescription-context-options)

State machine description:

* [state](#statename-transitions)
* [transition](#transitionevent-target-options)
* [immediate](#immediatetarget-options)
* [internal](#internalevent-options)
* [enter](#enteroptions)
* [exit](#exitoptions)

Transition hooks:

* [guard](#guard)
* [reduce](#reduce)
* [assign](#assign)
* [action](#action)
* [invoke](#invoke)
* [effect](#effect)

### `useMachine(description, context, options)`

Create and initialise the machine.

- `description` - the machine description function invoked with `state`, `transition`, `immediate`, `internal`, `enter`, `exit` as arguments.
- `context` - the context to be assigned to the machine's state. Since it's common to pass props and other computed data via context, by default, whenever any of the values of the context change, the hook will send an event of type `assign` with the context object spread onto the event object, this event can be renamed or disabled in options.
- `options` - hook options

Available options:

- `assign` (default: `"assign"`) - the name of the event to be sent when context values change. Set this to `false` to disable sending the event altogether.
- `deps` - by default all context values are checked for changes in between hook invocations. Use this option to customize the dependency array.

Returns `[state, send, machine]`:

- `state` - current state of shape `{ name, context }`
- `send` - send an event, e.g. `send('save')` or `send({ type: 'save', item: 'x' })`
- `machine` - a stateless machine description that could be used to transition to new states

```js
const myMachine = useCallback(({ state, transition }) => {
  state('a', transition('next', 'b'))
  state('b', transition('next', 'c'))
  state('c')
})
const [state, send, machine] = useMachine(myMachine, { x: 0 })
const { name, context, final } = state
```

### `state(name, ...transitions)`

Declare a state.

- `name` - name of the state
- `transitions` - any number of available: `transition()`, `immediate()`, `internal()`, `enter()`, `exit()`

```js
state('loading')
state('loading', transition('go', 'ready'))
state('loading', immediate('ready', { guard: (ctx) => ctx.loaded }))
```

### `transition(event, target, options)`

Declare a transition between states.

- `event` - the name of the event that will trigger this transition
- `target` - the name of the target state
- `options` - in the shape of `{ reduce, assign, action, guard }`

```js
transition('save', 'saving')
transition('reset', 'edit', { reduce: ctx => ({ ...ctx, data: null }) })
transition('close', 'closing', { action: ctx => ctx.onClose() })
```

### `immediate(target, options)`

A special type of transition that is executed immediately upon entering (or re-entering a state with an internal transition). If no `guard` option is used, the transition will always immediately be applied and move the machine to a new state. If the `guard` option is used, the transition will only be applied if the `guard` condition passes. Note that, when immediate transitions take place, all of the intermediate transition hooks and intermediate state enter/exit hooks are triggered, however the effects (including `invoke`) are only executed for the final state, not any of the intermediate states.

- `target` - the name of the target state
- `options` - in the shape of `{ reduce, assign, action, guard }`

```js
immediate('ready')
immediate('ready', { guard: { guard: (ctx) => ctx.loaded } })
```

### `internal(event, options)`

A special type of transition that does not leave the state and does not trigger any enter/exit hooks. Useful for performing actions or updating context without leaving the state. Note: this transition does re-evaluate all immediate transitions of the state.

- `event` - the name of the event that will trigger this transition
- `options` - in the shape of `{ reduce, assign, action, guard }`

```js
internal('assign', { assign: true })
internal('reset', { assign: { count: 0 } })
```

### `enter(options)`

Hooks to run when entering a state.

- `options` - in the shape of `{ reduce, assign, action, invoke, effect }`

```js
enter({ action: ctx => ctx.start() })
enter({ invoke: ctx => ctx.fetch('/data') })
enter({ assign: { count: 0 } })
```

### `exit(options)`

Hooks to run when leaving the state.

- `options` - in the shape of `{ reduce, assign, action }`

```js
exit({ action: ctx => ctx.stop() })
exit({ assign: { error: null } })
```

### `guard`

If the guard condition fails, the transition is skipped when matching against the event and selection proceeds to the next transition. Commonly used with `immediate` transitions, but works with any type of transition.

```js
{ guard: (context, event) => context.status === 'success' }
```

### `reduce`

Updated context based on current context and the incoming event.

```js
{ reduce: (context, event) => nextContext }
{ reduce: (context, { type, ...payload }) => nextContext }
{ reduce: [reduce1, reduce2] }
```

### `assign`

Return a partial context update object, that will be immutably assigned to the current context. A commonly useful shortcut for assigning event paylods to the context.

```js
{ assign: (context, { type, ...payload }) => ({ ...context , ...payload }) }
{ assign: true } // same as above
{ assign: { static: 'value' } }
{ assign: [assign1, assign2] }
```

### `action`

A fire and forget action executed immediately (synchronously) upon sending an event.

```js
{ action: (context, event) => context.onClose() }
{ action: [action1, action2] }
```

### `invoke`

A way to invoke async functions as part of entering a state. If the promise is fulfilled, an event of shape `{ type: 'done', data }` is sent, and if the promise rejects, an event of `{ type: 'error', error }` is sent. Note, if the machine exits the state while the promise is pending, the results will be ignored and no event will get sent. Note, internally, `invoke` is turned into an `effect`.

```js
state('save',
  enter({ invoke: async (context, event) => context.save() }),
  transition('done', 'show', { assign: (ctx, event) => ({ item: event.data }) }),
  transition('error', 'edit', { assign: (ctx, event) => ({ error: event.error }) }),
)
```

### `effect`

A way of handling side effects, async effects, subscriptions or activities. Once the state is entered, the effect gets started (in `useEffect` and only after finalising all of the immediate transitions) and can send any number of events. Note that `context` will be valid when initially running the effect, but will get stale afterwards, and is best read in subsequent internal transitions. Also note that `send` will be ignored after the effect is cleaned up, and similarly `send` can not be used in the cleanup function of the effect.

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
- [ ] validate all transition targets
- [ ] 100% test coverage
- [ ] add debug logging option
- [ ] write proper typings

#### V2

- [ ] add hierarchical and parallel states
- [ ] only new effects are run, old ones can stay running
- [ ] change from state.name string to state.value object
- [ ] introduce state.matches() api
