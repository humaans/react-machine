<p align="center">
  <img src="https://user-images.githubusercontent.com/324440/102627697-77e2d980-4140-11eb-9a57-60826ce2ee43.png" alt="react machine logo, a man with an open head with a state chart inside" title="react-machine">
</p>

<h4 align="center">State machines with reducers, actions, effects, hierarchy and parallel states for React</h4>
<br />

A state machine hook for React applications. When `useState` or `useReducer` is not enough, use `useMachine` to express more complex component state including async effects.

Very much inspired by [Robot](https://thisrobot.life/) and [XState](https://xstate.js.org/) - thank you for great libraries 🙏.

Differences from the above libraries:

// TODO expand

- API similar to Robot, but instead of importing every helper they are either passed in to the machine factory function or are passed as options.
- Behaviour closer to XState with enter/exit reducers and actions and effects (activities in XState), things not available in Robot.
- All transitions are internal, which means re-entering the state (e.g. after a component rerenders with new props, which are passed to context) does not trigger enter actions, reducers, invokes and effects.

## Example

This example demonstratates many of the benefits of using a state machine in React:

- loading and error states are handled
- processing states such as saving and removing are handled
- when the form is closing, in case of animation, we can no longer submit the form, etc.
- we separate all of the business logic from the components keeping them more readable
- we can handle async imperative effects with ease, e.g. can't double submit the form, we handle both error and success, and so on, it makes you handle all of the edge cases

```js
import { useMutation } from 'some-api-client'
import { useMachine } from 'react-machine'

const isLoadingSuccess = (ctx) => ctx.item.status === 'success'
const isLoadingError = (ctx) => ctx.item.status === 'error'
const showLoadingError = (ctx) => ctx.showToast('Failed to load the item')
const save = (ctx, { values }) => ctx.save(ctx.item.id, values)
const remove = (ctx, { values }) => ctx.remove(ctx.item.id)
const close = (ctx) => ctx.onClose()

const machine = ({ state, enter, transition, immediate, internal, assign }) => {
  state(
    'loading',
    immediate('edit', { guard: isLoadingSuccess }),
    immediate('closing', { guard: isLoadingError, action: showLoadingError }),
    internal('assign', { reduce: assign })
  )

  state(
    'edit',
    transition('save', 'saving', { assign: { error: null } }),
    transition('remove', 'remove', { assign: { error: null } }),
    transition('close', 'closing'),
    internal('assign', { reduce: assign })
  )

  state(
    'saving',
    enter({ invoke: save }),
    transition('done', 'closing'),
    transition('error', 'edit', { reduce: assign }),
    transition('close', 'closing'),
    internal('assign', { reduce: assign })
  )

  state(
    'remove',
    transition('confirm', 'removing'),
    transition('close', 'edit', { assign: { error: null } }),
    internal('assign', { reduce: assign })
  )

  state(
    'removing',
    enter({ invoke: remove }),
    transition('done', 'closing'),
    transition('error', 'remove', { reduce: assign }),
    internal('assign', { reduce: assign })
  )

  state('closing', enter({ action: close }))
}

export function EditForm({ item, showToast, onClose }) {
  const { save, remove } = useMutation('api/items')
  const [state, send] = useMachine(machine, { item, showToast, save, remove, onClose })

  const shared = { state, send }

  const { prev } = state
  const name = state.name === 'closing' ? prev.name : state.name

  if (name === 'loading') return <Loading {...shared} />
  if (name === 'edit' || name === 'saving') return <Edit {...shared} />
  if (name === 'remove' || name === 'removing') return <Remove {...shared} />
}

function Loading() {}
function Edit() {}
function Remove() {}
```

### TODO

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
- [x] add prev state (aka history)
- [x] protect promises from sending events if they were cleaned up

- [ ] experiment with hierarchy (!!!!!!!!!!!)

- [ ] convert actions into reducers, so they're applied in order
- [ ] complete the tests
- [ ] add debug logging option
- [ ] write proper typings
- [ ] why are errors thrown in effect dipose not handled?
- [ ] write a thorough readme
- [ ] release!
