# Changelog

## 0.4.3

- Upgrade all dependencies to address security alerts.

## 0.4.2

- Fix the release, publish the right directory.

## 0.4.1

- Fix the release, publish the right directory.

## 0.4.0

- Upgrade all dependencies.

## 0.3.0

API refinements on the way to 1.0

#### Decomplecting machine context and state data

Often in machine logic, when reducing machine state or applying side effects, it is useful to have access to some props passed to the React component. For example, if you want to save an item as an effect of transitioning from `edit` to `saving` state, you might want to have acccess to this `item` to reference it's `id`.

Previously, to do this, your could pass this context as the second argument to the hook and it would get merged into machine's state. This however, meant there was no distinction between initial state, state managed by the reducers and the "static" props/context passed to the machine.

In this version, we separate context from the state data. The second argument to the `useMachine` hook is now always immutable context. React components get props, the machine reducers and effects get context.

Before:

```js
// component was receiving context (mixed in with state) and event
const guard = (ctx, event) => {}
const reduce = (ctx, event) => {}
const effect = (ctx, event) => {}
```

After:

```js
// component hooks now get context, state data and events
const guard = (ctx, data, event) => {}
const reduce = (ctx, data, event) => {}
const effect = (ctx, data, event) => {}
```

Introducing this separation optimised component re-rendering. For example, if component props change, and so the machine context changes, but the current machine state does not care about these changes, no extra component re-renders will get queued. Whereas before, because the context was stored as state, every change to the prop would cause double rendering of the entire subtree.

As a final note, in React, it is common to close over props inside the component function body, which works well when using `useReducer`, `useState`, or `useEffect` hooks. The `useMachine` hook is meant to help you extract some of the component business logic away from components into standalone reducer and effect functions as part of modelling the machine. Introducing `context` as the first class citizen, allows to create the component hook functions as pure functions that don't have to be kept inside component function body.

#### Reactive context

As part of separating the context from machine state data, we've made the machine context reactive. If new props are passed into the component, and `useMachine` hook is called with an udpated context, an event of tpye `assign` gets sent into the machine. This means that every immediate transition will get reevaluated with the new, updated context. And that optionally, a transition reacting to the `assign` event can be declared, for example, to transfer something from context into state, or similar.

Furthermore, this transition is done inside the function body (as opposed to an effect), ensuring best performance and avoiding incorrect/partial intermediate states when it comes to child components. The machine state will transition in response to the updated context before React will render the component children.

#### Updated useMachine return value

Before:

```js
const [state, send] = useMachine(machine, context)
const { name, context } = state
```

After:

```js
const { state, context, send, machine: m } = useMachine(machine, context)
const { name, data } = state
```

#### Removal of actions

Previously, `actions` were supposed to be used for effects that trigger immediately when machine is transitioning, where `effects` were queued up and were triggered in `useEffect`. This was a flawed / non Reacty idea. Mixing state transition and effects in one does not work well in React and is not compatible with the upcoming Concurrent Mode.

For example, say you wanted to trigger `props.onClose()` as an `action` in response to a user click event, and `onClose()` was causing a `setState` in a parent component. This would not work, because React does not allow updating state of other components in the middle of updating state of the current component. Instead, this should now be done as an `effect`.

Effects can now be added as part of `enter`, `transition` (any kind) or `exit`. They get queued up as part of transitioning and get executed all at once once in a `useEffect()`.

If multiple state updates get batched by React, all effects now get correctly collected and executed.

In Concurrent Mode, if the component is simultaneously transitioning into 2 divergent states, it's not longer a problem as the state transitions are independend (thanks to the use of `useReducer`) and only once React performs the render commits and executes effects, the right set of effects will get executed.

#### Replacing `deps` with `areEqual`

Now that the handling of `context` changed as described above, the `deps` option has been removed in favor of `areEqual`, which is now used to compare previous context with new context.

## 0.2.0

First release 🎉. Thanks to @tempname11 for the npm package name.
