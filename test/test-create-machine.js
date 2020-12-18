/* eslint-disable no-sequences */

import test from 'ava'
import { createService as createMachine } from '../lib/service.js'

test('empty machine', (t) => {
  const machine1 = createMachine()
  t.deepEqual(machine1.state, { name: null, context: {} })

  const machine2 = createMachine(() => {})
  t.deepEqual(machine2.state, { name: null, context: {} })

  const machine3 = createMachine(() => {}, { a: 1 })
  t.deepEqual(machine3.state, { name: null, context: { a: 1 } })
})

test('simple machine', (t) => {
  const machine = createMachine(({ state, transition }) => {
    state('initial', transition('go', 'final'))
    state('final')
  })

  // machine structure
  t.deepEqual(machine.machine, {
    initial: {
      name: 'initial',
      enter: [],
      exit: [],
      transitions: {
        go: [
          {
            type: 'transition',
            event: 'go',
            target: 'final',
            guards: [],
            reducers: [],
            actions: [],
          },
        ],
      },
      immediates: [],
    },
    final: {
      name: 'final',
      enter: [],
      exit: [],
      transitions: {},
      immediates: [],
    },
  })

  t.deepEqual(machine.runningEffects, [])
  t.deepEqual(machine.pendingEffects, [])
  t.is(typeof machine.subscribe, 'function')
  t.is(typeof machine.send, 'function')
  t.is(typeof machine.stop, 'function')

  t.deepEqual(Object.keys(machine), [
    'machine',
    'state',
    'prev',
    'pendingEffects',
    'runningEffects',
    'send',
    'subscribe',
    'stop',
  ])

  t.deepEqual(machine.state, {
    name: 'initial',
    context: {},
  })

  t.is(machine.state.name, 'initial')
  t.is(machine.state.final, undefined)

  machine.send('go')
  t.is(machine.state.name, 'final')
  t.is(machine.state.final, true)
})

test('complex machine', (t) => {
  const set = (key, val) => (ctx) => ((ctx[key] = val), ctx)
  const assign = (ctx, { type, ...data }) => ({ ...ctx, ...data })

  const machine = createMachine(({ state, transition, internal, immediate, enter, exit }) => {
    state('initial', transition('goToSecond', 'second', { reduce: assign }))
    state('second', immediate('third'))
    state(
      'third',
      immediate('final', { guard: () => false }),
      transition('goToFourth', 'fourth', { reduce: assign })
    )
    state(
      'fourth',
      enter({ effect: ping }),
      internal('assign', { reduce: assign }),
      transition('goToFinal', 'final', { reduce: assign }),
      exit({ assign: { fourthExited: 'pong' } })
    )
    state('final', enter({ reduce: set('y', 2) }))
  })

  function ping(context, send) {
    t.deepEqual(context, { x: 2 })
    send({ type: 'assign', fourthEntered: 'ping' })
    return () => {
      // we have stale context
      t.deepEqual(context, { x: 2 })
      // TODO - test send is not possible anymore
    }
  }

  t.is(machine.state.name, 'initial')
  t.deepEqual(machine.state.context, {})
  machine.send({ type: 'goToSecond', x: 1 })
  t.is(machine.state.name, 'third')
  t.deepEqual(machine.state.context, { x: 1 })

  machine.send({ type: 'goToFourth', x: 2 })
  t.is(machine.state.name, 'fourth')
  t.deepEqual(machine.state.context, { x: 2, fourthEntered: 'ping' })

  machine.send({ type: 'goToFinal', x: 3 })
  t.is(machine.state.name, 'final')
  t.deepEqual(machine.state.context, { x: 3, y: 2, fourthEntered: 'ping', fourthExited: 'pong' })
  t.is(machine.state.final, true)
})

test.skip('initial context', (t) => {})
test.skip('transition guard', (t) => {})
test.skip('transition reduce', (t) => {})
test.skip('transition action', (t) => {})
test.skip('transition assign', (t) => {})
test.skip('state assign', (t) => {})
test.skip('state reduce', (t) => {})
test.skip('state action', (t) => {})
test.skip('state effect', (t) => {})
test.skip('state exit', (t) => {})

test('assign', (t) => {
  const x = true
  const y = { z: 'foo' }
  const z = (ctx, d) => {
    for (const key of Object.keys(d)) {
      d[key] = 'prefix' + d[key]
    }
    return d
  }

  const machine = createMachine(({ state, transition, immediate }) => {
    state('a', transition('go', 'b', { assign: [x, y, z] }))
    state('b')
  })

  t.is(machine.state.name, 'a')
  t.deepEqual(machine.state.context, {})

  machine.send({ type: 'go', x: 1, y: 2 })
  t.is(machine.state.name, 'b')
  t.deepEqual(machine.state.context, { x: 'prefix1', y: 'prefix2', z: 'foo' })
})

test.skip('invoke', async (t) => {
  const machine = createMachine(({ state, transition, immediate }) => {
    state('a', transition('go', 'b'))
    state(
      'b',
      { invoke: save },
      transition('done', 'c', { assign: [true, { error: null }] }),
      transition('error', 'a', { assign: true })
    )
    state('c')
  })

  async function save(context) {
    if (context.error) return { id: 1, name: 'hello' }
    throw new Error('Fails the first time')
  }

  t.is(machine.state.name, 'a')
  t.deepEqual(machine.state.context, {})

  let tick = new Promise((resolve) => {
    const dispose = machine.subscribe((curr) => {
      resolve(curr)
      dispose()
    })

    machine.send('go')
  })

  t.is(await tick, machine.state)

  t.is(machine.state.name, 'b')
  t.deepEqual(machine.state.context, {})
  t.is(machine.state.context.error.message, 'Fails the first time')

  tick = new Promise((resolve) => {
    const dispose = machine.subscribe((curr) => {
      resolve(curr)
      dispose()
    })

    machine.send('go')
  })

  t.is(await tick, machine.state)
  t.is(machine.state.name, 'c')
  t.deepEqual(machine.state.context, { data: { id: 1, name: 'hello' }, error: null })
})
