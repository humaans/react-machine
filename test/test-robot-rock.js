/* eslint-disable no-sequences */

const test = require('ava')
const { createMachine } = require('..')

test('a simple machine', (t) => {
  const machine = createMachine(({ state, transition }) => {
    state('initial', transition('go', 'final'))
    state('final')
  })

  // machine structure
  t.deepEqual(machine.current, {
    name: 'initial',
    context: {},
  })
  t.deepEqual(machine.states, {
    initial: {
      name: 'initial',
      transitions: {
        go: [
          {
            type: 'transition',
            event: 'go',
            target: 'final',
            guards: [],
            actions: [],
            reducers: [],
          },
        ],
      },
      immediates: [],
      actions: [],
      reducers: [],
      effects: [],
      invokes: [],
    },
    final: {
      name: 'final',
      transitions: {},
      immediates: [],
      actions: [],
      reducers: [],
      effects: [],
      invokes: [],
    },
  })
  t.deepEqual(machine.subscriptions, [])
  t.is(typeof machine.subscribe, 'function')
  t.is(typeof machine.send, 'function')

  t.is(machine.current.name, 'initial')
  t.is(machine.current.final, undefined)

  machine.send('go')
  t.is(machine.current.name, 'final')
  t.is(machine.current.final, true)
})

test.only('a complex machine', (t) => {
  const set = (key, val) => (ctx) => ((ctx[key] = val), ctx)

  const machine = createMachine(({ state, transition, immediate, assign }) => {
    state('initial', transition('go', 'second', { reduce: assign }))
    state('second', immediate('third'))
    state(
      'third',
      immediate('final', { guard: () => false }),
      transition('go', 'fourth', { reduce: assign })
    )
    state(
      'fourth',
      { effect: pingPong },
      transition('assign', 'fourth', { reduce: assign }),
      transition('go', 'final', { reduce: assign })
    )
    state('final', { reduce: set('y', 2) })
  })

  function pingPong(get, send) {
    t.deepEqual(get().context, { x: 2 })
    send({ type: 'assign', entered: 'ping' })
    return () => {
      t.deepEqual(get().context, { x: 2, entered: 'ping' })
      send({ type: 'assign', exited: 'pong' })
    }
  }

  t.is(machine.current.name, 'initial')
  t.deepEqual(machine.current.context, {})
  machine.send({ type: 'go', x: 1 })
  t.is(machine.current.name, 'third')
  t.deepEqual(machine.current.context, { x: 1 })

  machine.send({ type: 'go', x: 2 })
  machine.flushEffects()
  t.is(machine.current.name, 'fourth')
  t.deepEqual(machine.current.context, { x: 2, entered: 'ping' })

  machine.send({ type: 'go', x: 3 })
  t.is(machine.current.name, 'final')
  t.deepEqual(machine.current.context, { x: 3, y: 2, entered: 'ping', exited: 'pong' })
  t.is(machine.current.final, true)
})

test.skip('empty machine', (t) => {})

// const machine = createMachine((machine) => {
//   const { state, transition, immediate, invoke } = machine

//   state('loading',
//     transition('assign', 'loading', { reduce: assign })
//     immediate('edit', { guard: isSuccess })
//     immediate('close', { guard: isError, action: showLoadingError })
//   )

//   state('edit',
//     transition('save', 'saving', { reduce: clearError })
//     transition('assign', 'edit', { reduce: assign })
//     transition('close', 'close'),
//     machine('x', () => {
//       state('1', transition())
//       state('2')
//     })
//   )

//   state('saving',
//     invoke(save)
//     transition('done', 'close', { reduce: storeTypes })
//     transition('error', 'edit', { reduce: assign })
//     transition('assign', 'saving', { reduce: assign })
//     transition('close', 'close')
//   )

//   state('close', invoke(close), { reduce: foo, action: bar })
// })
