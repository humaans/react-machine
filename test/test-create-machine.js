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

  t.deepEqual(machine.runningEffects, [])
  t.deepEqual(machine.pendingEffects, [])
  t.is(typeof machine.subscribe, 'function')
  t.is(typeof machine.send, 'function')
  // t.is(typeof machine.runEffects, 'function')
  t.is(typeof machine.stop, 'function')

  t.deepEqual(Object.keys(machine), [
    'machine',
    'state',
    'pendingEffects',
    'runningEffects',
    'send',
    // 'runEffects',
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

  function pingPong(context, send) {
    t.deepEqual(context, { x: 2 })
    send({ type: 'assign', entered: 'ping' })
    return () => {
      // we have stale context
      t.deepEqual(context, { x: 2 })
      // TODO - test send is not possible anymore
    }
  }

  t.is(machine.state.name, 'initial')
  t.deepEqual(machine.state.context, {})
  machine.send({ type: 'go', x: 1 })
  t.is(machine.state.name, 'third')
  t.deepEqual(machine.state.context, { x: 1 })

  machine.send({ type: 'go', x: 2 })
  t.is(machine.state.name, 'fourth')
  t.deepEqual(machine.state.context, { x: 2, entered: 'ping' })

  machine.send({ type: 'go', x: 3 })
  t.is(machine.state.name, 'final')
  t.deepEqual(machine.state.context, { x: 3, y: 2, entered: 'ping' })
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
      transition('done', 'c', { assign: true }, { assign: { error: null } }),
      transition('error', 'a', { assign: true })
    )
    state('c')
  })

  async function save(context) {
    if (context.error) return { id: 1, name: 'hello' }
    console.log('Calling save about to fail!')
    throw new Error('Fails the first time')
  }

  t.is(machine.state.name, 'a')
  t.deepEqual(machine.state.context, {})

  console.log(machine)

  // let tick = new Promise((resolve) => {
  //   const dispose = machine.subscribe((curr) => {
  //     console.log('Resolved!', curr)
  //     resolve(curr)
  //     dispose()
  //   })

  //   machine.send('go')
  // })

  // t.is(await tick, machine.state)

  // t.is(machine.state.name, 'b')
  // t.deepEqual(machine.state.context, {})
  // t.is(machine.state.context.error.message, 'Fails the first time')

  // tick = new Promise((resolve) => {
  //   const dispose = machine.subscribe((curr) => {
  //     resolve(curr)
  //     dispose()
  //   })

  //   machine.send('go')
  // })

  // t.is(await tick, machine.state)
  // t.is(machine.state.name, 'c')
  // t.deepEqual(machine.state.context, { data: { id: 1, name: 'hello' }, error: null })
})
