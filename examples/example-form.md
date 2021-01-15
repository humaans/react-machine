## Example: Form

```js
import React from 'react'
import { useMutation } from 'some-api-client'
import { useMachine } from 'react-machine'

// guards
const isLoadingSuccess = (ctx) => ctx.item.status === 'success'
const isLoadingError = (ctx) => ctx.item.status === 'error'

// reducers
const assign = (key) => (ctx, data, event) => ({ [key]: event[key] })
const clear = (key) => () => ({ [key]: null })

// effects
const showLoadingError = (ctx) => ctx.showToast('Failed to load the item')
const save = (ctx, data, { values }) => ctx.save(ctx.item.id, values)
const remove = (ctx, data, { values }) => ctx.remove(ctx.item.id)
const close = (ctx) => ctx.onClose()

const machine = ({ state, transition, immediate, internal, enter }) => {
  state(
    'loading',
    immediate('edit', { guard: isLoadingSuccess }),
    immediate('closing', { guard: isLoadingError, effect: showLoadingError })
  )

  state(
    'edit',
    transition('save', 'saving', { assign: clear('error') }),
    transition('remove', 'remove', { assign: clear('error') }),
    transition('close', 'closing')
  )

  state(
    'saving',
    enter({ invoke: save }),
    transition('done', 'closing'),
    transition('error', 'edit', { assign: assign('error') }),
    transition('close', 'closing')
  )

  state(
    'remove',
    transition('confirm', 'removing'),
    transition('close', 'edit', { assign: clear('error') })
  )

  state(
    'removing',
    enter({ invoke: remove }),
    transition('done', 'closing'),
    transition('error', 'remove', { reduce: assign('error') })
  )

  state('closing', enter({ effect: close }))
}

export function EditForm({ item, showToast, onClose }) {
  const { save, remove } = useMutation('api/items')
  const { state, send } = useMachine(machine, { item, showToast, save, remove, onClose })

  const shared = { state, send }

  if (name === 'loading') return <Loading {...shared} />
  if (name === 'edit' || name === 'saving') return <Edit {...shared} />
  if (name === 'remove' || name === 'removing') return <Remove {...shared} />
  if (name === 'closing') return null
}

function Loading() {}
function Edit() {}
function Remove() {}
```
