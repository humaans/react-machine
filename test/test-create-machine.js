/* eslint-disable no-sequences */

import test from 'ava'
import { createMachine } from '../lib/index.js'

test('empty machine', (t) => {
  const machine1 = createMachine()
  t.deepEqual(machine1.current, { name: null, context: {} })

  const machine2 = createMachine(() => {})
  t.deepEqual(machine2.current, { name: null, context: {} })
})

test('simple machine', (t) => {
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
            reducers: [],
            actions: [],
          },
        ],
      },
      immediates: [],
      reducers: [],
      actions: [],
      effects: [],
      invokes: [],
    },
    final: {
      name: 'final',
      transitions: {},
      immediates: [],
      reducers: [],
      actions: [],
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

test('complex machine', (t) => {
  const set = (key, val) => (ctx) => ((ctx[key] = val), ctx)
  const assign = (ctx, { type, ...data }) => ({ ...ctx, ...data })

  const machine = createMachine(({ state, transition, immediate }) => {
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
  const z = (d) => {
    for (const key of Object.keys(d)) {
      d[key] = 'prefix' + d[key]
    }
    return d
  }

  const machine = createMachine(({ state, transition, immediate }) => {
    state('a', transition('go', 'b', { assign: [x, y, z] }))
    state('b')
  })

  t.is(machine.current.name, 'a')
  t.deepEqual(machine.current.context, {})

  machine.send({ type: 'go', x: 1, y: 2 })
  t.is(machine.current.name, 'b')
  t.deepEqual(machine.current.context, { x: 'prefix1', y: 'prefix2', z: 'foo' })
})

test('invoke', async (t) => {
  const machine = createMachine(({ state, transition, immediate }) => {
    state('a', transition('go', 'b'))
    state(
      'b',
      { invoke: save },
      transition('done', 'c', { assign: true }, { assign: { error: null } }),
      transition('error', 'a', { assign: true })
    )
    state('c')
  })

  async function save(context) {
    if (context.error) return { id: 1, name: 'hello' }
    throw new Error('Fails the first time')
  }

  t.is(machine.current.name, 'a')
  t.deepEqual(machine.current.context, {})

  machine.send('go')
  t.is(machine.current.name, 'b')
  t.deepEqual(machine.current.context, {})

  let tick = new Promise((resolve) => {
    const dispose = machine.subscribe((curr) => {
      resolve(curr)
      dispose()
    })
  })

  machine.flushEffects()

  t.is(await tick, machine.current)
  t.is(machine.current.name, 'a')
  t.is(machine.current.context.error.message, 'Fails the first time')

  machine.send('go')

  tick = new Promise((resolve) => {
    const dispose = machine.subscribe((curr) => {
      resolve(curr)
      dispose()
    })
  })

  machine.flushEffects()

  t.is(await tick, machine.current)
  t.is(machine.current.name, 'c')
  t.deepEqual(machine.current.context, { data: { id: 1, name: 'hello' }, error: null })
})
