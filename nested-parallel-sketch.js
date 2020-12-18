const machine = ({ state, enter, transition, immediate, internal, parallel }) => {
  state('open', () => {
    transition('close', 'closing')
    internal('assign', { assign: true })

    state('loading', () => {
      enter({ effect: 'longRunning' })

      state('a', () => {
        state('pending', transition('next', 'b'))
        // state('ready') // final of a, because can only transition internally with assign
      })

      state('b', () => {
        state('pending', transition('next', 'c'))
        // state('ready') // final of a, because can only transition internally with assign
      })

      state('c', transition('next', 'ready'))

      state('c', () => {
        transition('next', 'ready')
      })
    })

    state('ready')
  })

  state('closing', enter({ action }))
}

/*















































 */

const machine = ({ state, enter, transition, immediate, internal, parallel }) => {
  internal('assign', { assign: true })
  transition('close', 'closing')

  state(
    'loading',
    immediate('edit', { guard: isLoadingSuccess }),
    immediate('closing', { guard: isLoadingError, action: showLoadingError })
  )

  state(
    'edit',
    transition('save', 'saving', { assign: { error: null } }),
    transition('remove', 'remove', { assign: { error: null } })
  )

  state(
    'saving',
    enter({ invoke: save }),
    transition('done', 'closing'),
    transition('error', 'edit', { assign: true })
  )

  state(
    'remove',
    transition('confirm', 'removing'),
    transition('close', 'edit', { assign: { error: null } })
  )

  state(
    'removing',
    enter({ invoke: remove }),
    transition('done', 'closing'),
    transition('error', 'remove', { assign: true })
  )

  state('closing', enter({ action: close }))

  parallel('deeper', () => {
    state('a', () => {
      state('pending', transition('next', 'ready'))
      state('ready') // here
    })

    state('b', () => {
      state('pending', transition('next', 'ready')) // and here
      state('ready')
    })
  })

  state('example')
}

const value = {
  deeper: {
    a: {
      ready: true,
    },
    b: {
      pending: true,
    },
  },
}

matches(['deeper.a.ready', 'deeper.b.ready'])

const value2 = {
  example: true,
}
