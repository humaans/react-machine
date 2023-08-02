/* eslint-disable no-sequences */

import test from 'ava'
import { createService as createMachine } from '../lib/service'

test('empty machine', (t) => {
  const machine1 = createMachine()
  t.deepEqual(machine1.state, { name: null, data: {} })

  const machine2 = createMachine(() => {})
  t.deepEqual(machine2.state, { name: null, data: {} })
})

test('initial transition', (t) => {
  const machine1 = createMachine(({ initial, state, enter }) => {
    initial('bar')
    state('foo', enter({ assign: { foo: true } }))
    state('bar', enter({ assign: { bar: true } }))
  })
  t.deepEqual(machine1.state, {
    name: 'bar',
    data: { bar: true },
    final: true,
  })

  const machine2 = createMachine(({ initial, state, enter }) => {
    initial('bar', { baz: true })
    state('foo', enter({ assign: { foo: true } }))
    state('bar', enter({ assign: { bar: true } }))
  })
  t.deepEqual(machine2.state, {
    name: 'bar',
    data: { bar: true, baz: true },
    final: true,
  })

  const machine3 = createMachine(
    ({ initial, state, enter }) => {
      initial('bar', (ctx) => ({ baz: ctx.baz }))
      state('foo', enter({ assign: { foo: true } }))
      state('bar', enter({ assign: { bar: true } }))
    },
    { baz: 123 },
  )
  t.deepEqual(machine3.state, {
    name: 'bar',
    data: { bar: true, baz: 123 },
    final: true,
  })

  const machine4 = createMachine(
    ({ initial, state, enter }) => {
      initial((ctx) => ({ baz: ctx.baz }))
      state('foo', enter({ assign: { foo: true } }))
      state('bar', enter({ assign: { bar: true } }))
    },
    { baz: 123 },
  )
  t.deepEqual(machine4.state, {
    name: 'foo',
    data: { foo: true, baz: 123 },
    final: true,
  })
})

test('transition guard', (t) => {
  const machine = createMachine(({ state, transition }) => {
    state('a', transition('go', 'b', { guard: (ctx, data, event) => event.ok }))
    state('b')
  })

  t.deepEqual(machine.state, { name: 'a', data: {} })

  machine.send('go')
  t.deepEqual(machine.state, { name: 'a', data: {} })

  machine.send({ type: 'go', ok: true })
  t.deepEqual(machine.state, { name: 'b', data: {}, final: true })
})

test('transition reduce', (t) => {
  const machine = createMachine(
    ({ initial, state, transition }) => {
      initial({ a: 1, b: 2 })
      state(
        'a',
        transition('go', 'b', {
          reduce: (ctx, data, event) => ({ a: data.a + 5, c: ctx.c, d: event.value }),
        }),
      )
      state('b')
    },
    { c: 0 },
  )

  t.deepEqual(machine.state, { name: 'a', data: { a: 1, b: 2 } })

  machine.send({ type: 'go', value: 3 })
  t.deepEqual(machine.state, { name: 'b', data: { a: 6, c: 0, d: 3 }, final: true })
})

test('transition assign', (t) => {
  const x = true
  const y = { z: 'foo' }
  const z = (ctx, data, payload) => {
    for (const key of Object.keys(payload)) {
      payload[key] = 'prefix' + payload[key]
    }
    return payload
  }

  const machine = createMachine(({ state, transition, immediate }) => {
    state('a', transition('go', 'b', { assign: [x, y, z] }))
    state('b')
  })

  t.is(machine.state.name, 'a')
  t.deepEqual(machine.state.data, {})

  machine.send({ type: 'go', x: 1, y: 2 })
  t.is(machine.state.name, 'b')
  t.deepEqual(machine.state.data, { x: 'prefix1', y: 'prefix2', z: 'foo' })
})

test('transition effect', (t) => {
  let effectCalledWith = null

  const machine = createMachine(({ initial, state, transition }) => {
    initial({ a: 1, b: 2 })
    state(
      'a',
      transition('go', 'b', {
        effect: (ctx, data, event) => {
          effectCalledWith = event
          return { unused: 123 }
        },
      }),
    )
    state('b')
  })

  t.deepEqual(machine.state, { name: 'a', data: { a: 1, b: 2 } })

  machine.send({ type: 'go', value: 3 })
  t.deepEqual(machine.state, { name: 'b', data: { a: 1, b: 2 }, final: true })
  t.deepEqual(effectCalledWith, { type: 'go', value: 3 })
})

test('enter guard is ignored', (t) => {
  const machine = createMachine(({ state, transition, enter }) => {
    state('a', transition('go', 'b'))
    state('b', enter({ guard: (ctx, event) => event.ok }))
  })

  t.deepEqual(machine.state, { name: 'a', data: {} })

  machine.send({ type: 'go' })
  t.deepEqual(machine.state, { name: 'b', data: {}, final: true })
})

test('enter reduce', (t) => {
  const machine = createMachine(({ initial, state, transition, enter }) => {
    initial({ a: 1, b: 2 })
    state('a', transition('go', 'b'))
    state('b', enter({ reduce: (ctx, data, event) => ({ a: data.a, c: event.value }) }))
  })

  t.deepEqual(machine.state, { name: 'a', data: { a: 1, b: 2 } })

  machine.send({ type: 'go', value: 3 })
  t.deepEqual(machine.state, { name: 'b', data: { a: 1, c: 3 }, final: true })
})

test('enter assign', (t) => {
  const x = true
  const y = { z: 'foo' }
  const z = (ctx, data, p) => {
    for (const key of Object.keys(p)) {
      p[key] = 'prefix' + p[key]
    }
    return p
  }

  const machine = createMachine(({ state, transition, enter }) => {
    state('a', transition('go', 'b'))
    state('b', enter({ assign: [x, y, z] }))
  })

  t.is(machine.state.name, 'a')
  t.deepEqual(machine.state.data, {})

  machine.send({ type: 'go', x: 1, y: 2 })
  t.is(machine.state.name, 'b')
  t.deepEqual(machine.state.data, { x: 'prefix1', y: 'prefix2', z: 'foo' })
})

test('enter invoke', async (t) => {
  const machine = createMachine(({ state, transition, immediate, enter }) => {
    state('a', transition('go', 'b'))
    state(
      'b',
      enter({ invoke: save }),
      transition('done', 'c', { assign: [true, { error: null }] }),
      transition('error', 'a', { assign: true }),
    )
    state('c')
  })

  async function save(context, data) {
    if (data.error) return { id: 1, name: 'hello' }
    throw new Error('Fails the first time')
  }

  t.deepEqual(machine.state, { name: 'a', data: {} })

  machine.send('go')

  t.deepEqual(machine.state, { name: 'b', data: {} })

  let max = 50
  while (!machine.state.data.error) {
    await new Promise((resolve) => setTimeout(resolve), 4)
    if (max-- < 0) throw new Error('Failed to settle')
  }

  t.is(machine.state.name, 'a')
  t.is(machine.state.data.error.message, 'Fails the first time')

  machine.send('go')

  max = 50
  while (machine.state.data.error) {
    await new Promise((resolve) => setTimeout(resolve), 4)
    if (max-- < 0) throw new Error('Failed to settle')
  }

  t.is(machine.state.name, 'c')
  t.deepEqual(machine.state, {
    name: 'c',
    data: {
      result: { id: 1, name: 'hello' },
      error: null,
    },
    final: true,
  })
})

test('enter effect', async (t) => {
  const machine = createMachine(({ state, transition, immediate, enter }) => {
    state('a', transition('go', 'b'))
    state(
      'b',
      enter({ effect: save }),
      transition('done', 'c', { assign: [true, { error: null }] }),
      transition('error', 'a', { assign: true }),
    )
    state('c')
  })

  function save(context, data, event, send) {
    Promise.resolve('defer').then(() => {
      if (data.error) return send({ type: 'done', result: { id: 1, name: 'hello' } })
      send({ type: 'error', error: new Error('Fails the first time') })
    })
  }

  t.deepEqual(machine.state, { name: 'a', data: {} })

  machine.send('go')

  t.deepEqual(machine.state, { name: 'b', data: {} })

  while (!machine.state.data.error) {
    await new Promise((resolve) => setTimeout(resolve), 4)
  }

  t.is(machine.state.name, 'a')
  t.is(machine.state.data.error.message, 'Fails the first time')

  machine.send('go')

  while (machine.state.data.error) {
    await new Promise((resolve) => setTimeout(resolve), 4)
  }

  t.is(machine.state.name, 'c')
  t.deepEqual(machine.state, {
    name: 'c',
    data: {
      result: { id: 1, name: 'hello' },
      error: null,
    },
    final: true,
  })
})

test('exit guard is ignored', (t) => {
  const machine = createMachine(({ state, transition, exit }) => {
    state('a', transition('go', 'b'), exit({ guard: (ctx, event) => event.ok }))
    state('b')
  })

  t.deepEqual(machine.state, { name: 'a', data: {} })

  machine.send({ type: 'go' })
  t.deepEqual(machine.state, { name: 'b', data: {}, final: true })
})

test('exit reduce', (t) => {
  const machine = createMachine(({ initial, state, transition, exit }) => {
    initial({ a: 1, b: 2 })
    state(
      'a',
      transition('go', 'b'),
      exit({ reduce: (ctx, data, event) => ({ a: data.a, c: event.value }) }),
    )
    state('b')
  })

  t.deepEqual(machine.state, { name: 'a', data: { a: 1, b: 2 } })

  machine.send({ type: 'go', value: 3 })
  t.deepEqual(machine.state, { name: 'b', data: { a: 1, c: 3 }, final: true })
})

test('exit assign', (t) => {
  const x = true
  const y = { z: 'foo' }
  const z = (ctx, data, p) => {
    for (const key of Object.keys(p)) {
      p[key] = 'prefix' + p[key]
    }
    return p
  }

  const machine = createMachine(({ state, transition, exit }) => {
    state('a', transition('go', 'b'), exit({ assign: [x, y, z] }))
    state('b')
  })

  t.is(machine.state.name, 'a')
  t.deepEqual(machine.state.data, {})

  machine.send({ type: 'go', x: 1, y: 2 })
  t.is(machine.state.name, 'b')
  t.deepEqual(machine.state.data, { x: 'prefix1', y: 'prefix2', z: 'foo' })
})

test('simple machine', (t) => {
  const machine = createMachine(({ state, transition }) => {
    state('initial', transition('go', 'final'))
    state('final')
  })

  // machine structure
  t.deepEqual(machine.machine.nodes, {
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
            effects: [],
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
  t.is(typeof machine.subscribe, 'function')
  t.is(typeof machine.send, 'function')
  t.is(typeof machine.stop, 'function')

  t.deepEqual(Object.keys(machine), [
    'state',
    'send',
    'context',
    'subscribe',
    'machine',
    'stop',
    'runningEffects',
  ])

  t.deepEqual(machine.state, {
    name: 'initial',
    data: {},
  })

  t.is(machine.state.name, 'initial')
  t.is(machine.state.final, undefined)

  machine.send('go')
  t.is(machine.state.name, 'final')
  t.is(machine.state.final, true)
})

test('complex machine', (t) => {
  const set = (key, val) => (ctx, data) => ((data[key] = val), data)
  const assign = (ctx, data, { type, ...payload }) => ({ ...data, ...payload })

  const machine = createMachine(({ state, transition, internal, immediate, enter, exit }) => {
    state('initial', transition('goToSecond', 'second', { reduce: assign }))
    state('second', immediate('third'))
    state(
      'third',
      immediate('final', { guard: () => false }),
      transition('goToFourth', 'fourth', { reduce: assign }),
    )
    state(
      'fourth',
      enter({ effect: ping }),
      internal('assign', { reduce: assign }),
      transition('goToFinal', 'final', { reduce: assign }),
      exit({ assign: { fourthExited: 'pong' } }),
    )
    state('final', enter({ reduce: set('y', 2) }))
  })

  function ping(context, data, event, send) {
    t.deepEqual(data, { x: 2 })
    t.deepEqual(event, { type: 'goToFourth', x: 2 })
    send({ type: 'assign', fourthEntered: 'ping' })
    return () => {
      // check that we have stale context
      t.deepEqual(data, { x: 2 })

      const stubbed = stub(console, 'warn')
      send('ping')
      stubbed.restore()

      t.is(stubbed.calls.length, 1)
      t.deepEqual(stubbed.calls[0], [
        [
          "Can't send events in an effect after it has been cleaned up.",
          'This is a no-op, but indicates a memory leak in your application.',
          "To fix, cancel all subscriptions and asynchronous tasks in the effect's cleanup function.",
        ].join(' '),
      ])
    }
  }

  t.is(machine.state.name, 'initial')
  t.deepEqual(machine.state.data, {})
  machine.send({ type: 'goToSecond', x: 1 })
  t.is(machine.state.name, 'third')
  t.deepEqual(machine.state.data, { x: 1 })

  machine.send({ type: 'goToFourth', x: 2 })
  t.is(machine.state.name, 'fourth')
  t.deepEqual(machine.state.data, { x: 2, fourthEntered: 'ping' })

  machine.send({ type: 'goToFinal', x: 3 })
  t.is(machine.state.name, 'final')
  t.deepEqual(machine.state.data, { x: 3, y: 2, fourthEntered: 'ping', fourthExited: 'pong' })
  t.is(machine.state.final, true)
})

test('throw an error if state is passed an incorrect argument', (t) => {
  const err = t.throws(() =>
    createMachine(({ state, enter }) => {
      state('foo', { assign: { b: 2 } })
    }),
  )
  t.is(
    err.message,
    "State 'foo' should be passed one of enter(), exit(), transition(), immediate() or internal()",
  )
})

test('throw an error if transition specifies an invalid target', (t) => {
  const err1 = t.throws(() =>
    createMachine(({ state, transition }) => {
      state('foo', transition('next', 'bar'))
    }),
  )
  t.is(err1.message, "Invalid transition target 'bar'")

  const err2 = t.throws(() =>
    createMachine(({ state, immediate }) => {
      state('foo', immediate('bar'))
    }),
  )
  t.is(err2.message, "Invalid transition target 'bar'")
})

test('throw an error if transition arguments are incorrect', (t) => {
  const err1 = t.throws(() =>
    createMachine(({ state, transition }) => {
      state('foo', transition(1))
    }),
  )
  t.is(err1.message, 'First argument of the transition must be the name of the event')

  const err2 = t.throws(() =>
    createMachine(({ state, transition }) => {
      state('foo', transition('1', 2))
    }),
  )
  t.is(err2.message, 'Second argument of the transition must be the name of the target state')
})

test('service subscriptions', (t) => {
  let active = null

  const machine = createMachine(({ state, enter, internal }) => {
    state(
      'one',
      enter({
        effect: () => {
          active = true
          return () => {
            active = false
          }
        },
      }),
      internal('assign', { assign: true }),
    )
  })

  const subs = []

  const dispose = machine.subscribe((curr) => {
    subs.push({ sub: 'sub1', data: curr.data })
  })

  machine.subscribe((curr) => {
    subs.push({ sub: 'sub2', data: curr.data })
  })

  t.is(active, true)

  t.deepEqual(machine.state, { name: 'one', data: {} })

  machine.send({ type: 'assign', a: 1 })
  t.deepEqual(machine.state, { name: 'one', data: { a: 1 } })

  t.deepEqual(subs, [
    { sub: 'sub1', data: { a: 1 } },
    { sub: 'sub2', data: { a: 1 } },
  ])

  dispose()

  machine.send({ type: 'assign', a: 2 })
  t.deepEqual(machine.state, { name: 'one', data: { a: 2 } })

  t.deepEqual(subs, [
    { sub: 'sub1', data: { a: 1 } },
    { sub: 'sub2', data: { a: 1 } },
    { sub: 'sub2', data: { a: 2 } },
  ])

  machine.stop()

  machine.send({ type: 'assign', a: 3 })
  t.deepEqual(machine.state, { name: 'one', data: { a: 2 } })
})

function stub(obj, fn) {
  const original = obj[fn]
  const calls = []
  obj[fn] = (...args) => {
    calls.push(args)
  }
  return {
    restore: () => {
      obj[fn] = original
    },
    calls,
  }
}
