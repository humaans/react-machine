## Example: Form

```js
import React from 'react'
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
