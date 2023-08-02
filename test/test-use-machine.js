import test from 'ava'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'
import { useMachine } from '../lib/index'

global.IS_REACT_ACT_ENVIRONMENT = true

function dom() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  const domNode = dom.window.document.getElementById('root')
  const root = createRoot(domNode)

  function render(el) {
    act(() => {
      root.render(el)
    })
  }

  function click(el) {
    act(() => {
      el.dispatchEvent(
        new dom.window.MouseEvent('click', {
          view: dom.window,
          bubbles: true,
          cancelable: true,
        }),
      )
    })
  }

  function $(sel) {
    return dom.window.document.querySelector(sel)
  }

  return { root, render, click, $ }
}

test.serial('usage', async (t) => {
  const { render, click, $ } = dom()

  const machine = ({ initial, state, transition, immediate }) => {
    initial({ a: 1 })
    state('initial', immediate('counter'))
    state(
      'counter',
      transition('increment', 'counter', { reduce: (ctx, data) => ({ ...data, a: data.a + 1 }) }),
      immediate('final', { guard: (ctx, data) => data.a >= 4 }),
    )
    state('final')
  }

  function App() {
    const { state, send } = useMachine(machine, {})
    return (
      <>
        <div id='state'>State: {state.name}</div>
        <div id='count'>Count: {state.data.a}</div>
        <button id='increment' onClick={() => send('increment')} />
      </>
    )
  }

  render(<App />)

  t.is($('#state').innerHTML, 'State: counter')
  t.is($('#count').innerHTML, 'Count: 1')

  click($('#increment'))
  click($('#increment'))

  t.is($('#state').innerHTML, 'State: counter')
  t.is($('#count').innerHTML, 'Count: 3')

  click($('#increment'))
  click($('#increment'))

  t.is($('#state').innerHTML, 'State: final')
  t.is($('#count').innerHTML, 'Count: 4')
})

test.serial('changing props automatically send assign event', (t) => {
  const { render, click, $ } = dom()

  const machine = ({ initial, state, transition, immediate, internal }) => {
    initial({ thang: 'x' })
    state('initial', immediate('counter'))
    state(
      'counter',
      internal('assign', { assign: (ctx, data) => ({ ...data, thang: ctx.thing + ctx.thing }) }),
      internal('changeThang', { assign: true }),
    )
  }

  function App({ thing }) {
    const { state, context, send } = useMachine(machine, { thing })
    return (
      <>
        <div id='state'>Name: {state.name}</div>
        <div id='props-thing'>Props thing: {thing}</div>
        <div id='context-thing'>Context thing: {context.thing}</div>
        <div id='derived-thang'>Derived thang: {state.data.thang}</div>
        <button id='changeThing' onClick={() => send({ type: 'changeThang', thang: 'c', x: 1 })} />
      </>
    )
  }

  render(<App thing='a' />)

  t.is($('#state').innerHTML, 'Name: counter')
  t.is($('#props-thing').innerHTML, 'Props thing: a')
  t.is($('#context-thing').innerHTML, 'Context thing: a')
  t.is($('#derived-thang').innerHTML, 'Derived thang: x')

  render(<App thing='b' />)

  t.is($('#state').innerHTML, 'Name: counter')
  t.is($('#props-thing').innerHTML, 'Props thing: b')
  t.is($('#context-thing').innerHTML, 'Context thing: b')
  t.is($('#derived-thang').innerHTML, 'Derived thang: bb')

  click($('#changeThing'))

  t.is($('#state').innerHTML, 'Name: counter')
  t.is($('#props-thing').innerHTML, 'Props thing: b')
  t.is($('#context-thing').innerHTML, 'Context thing: b')
  t.is($('#derived-thang').innerHTML, 'Derived thang: c')
})

test.serial('effects', (t) => {
  const { render, $ } = dom()

  const eff = []

  const machine = ({ state, enter }) => {
    state(
      'counter',
      enter({
        effect: (context, data, event, send) => {
          eff.push('started')
          return () => {
            eff.push('finished')
          }
        },
      }),
    )
  }

  function App({ thing }) {
    const { state } = useMachine(machine, { thing })
    return (
      <>
        <div id='state'>State: {state.name}</div>
        <Child />
      </>
    )
  }

  function Child() {
    return <div />
  }

  render(<App thing='a' />)

  t.is($('#state').innerHTML, 'State: counter')
  t.deepEqual(eff, ['started'])

  render(<App thing='a' />)

  t.is($('#state').innerHTML, 'State: counter')
  t.deepEqual(eff, ['started'])

  render(null)

  t.is($('#root').innerHTML, '')
  t.deepEqual(eff, ['started', 'finished'])
})

test.serial('internal transition effects', (t) => {
  const { render, click, $ } = dom()

  const eff = []

  function enterEffect(context, data, event, send) {
    eff.push('enter effect started')
    return () => {
      eff.push('enter effect finished')
    }
  }

  function internalEffect(context, data, event, send) {
    eff.push('internal effect started')
    return () => {
      eff.push('internal effect finished')
    }
  }

  const machine = ({ state, enter, internal }) => {
    state(
      'counter',
      enter({ effect: enterEffect }),
      internal('increment', { effect: internalEffect }),
    )
  }

  function App() {
    const { state, send } = useMachine(machine)
    return (
      <>
        <div id='state'>State: {state.name}</div>
        <button id='increment' onClick={() => send('increment')} />
      </>
    )
  }

  render(<App />)

  t.deepEqual(eff, ['enter effect started'])

  click($('#increment'))

  render(<App />)

  t.deepEqual(eff, ['enter effect started', 'internal effect started'])

  click($('#increment'))

  render(<App />)

  t.deepEqual(eff, [
    'enter effect started',
    'internal effect started',
    'internal effect finished',
    'internal effect started',
  ])
})

test.serial('all types of effects with cleanup', (t) => {
  const { render, click, $ } = dom()

  let eff = []

  const effect = (label) => (context, data, event, send) => {
    eff.push(`${label} started`)
    return () => {
      eff.push(`${label} stopped`)
    }
  }

  const machine = ({ state, enter, exit, transition, internal, immediate }) => {
    state(
      'a',
      enter({ effect: effect('a.enter') }),
      transition('next', 'b', { effect: effect('a.transition') }),
      exit({ effect: effect('a.exit') }),
    )

    state(
      'b',
      enter({ effect: effect('b.enter') }),
      internal('retry', { effect: effect('b.internal') }),
      transition('next', 'c', { effect: effect('b.transition') }),
      exit({ effect: effect('b.exit') }),
    )

    state(
      'c',
      enter({ effect: effect('c.enter') }),
      immediate('d', { effect: effect('c.immediate') }),
      exit({ effect: effect('c.exit') }),
    )

    state('d')
  }

  function App() {
    const { state, send } = useMachine(machine)
    return (
      <>
        <div id='state'>State: {state.name}</div>
        <button id='next' onClick={() => send('next')} />
        <button id='retry' onClick={() => send('retry')} />
      </>
    )
  }

  const rerender = () => {
    render(<App />)
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['a.enter started'])

  eff = []
  click($('#next'))
  rerender()
  t.deepEqual(eff, ['a.enter stopped', 'a.exit started', 'a.transition started', 'b.enter started'])

  eff = []
  click($('#retry'))
  rerender()
  t.deepEqual(eff, ['b.internal started'])

  eff = []
  click($('#retry'))
  rerender()
  t.deepEqual(eff, ['b.internal stopped', 'b.internal started'])

  eff = []
  click($('#next'))
  rerender()
  t.deepEqual(eff, [
    'b.internal stopped',
    'b.enter stopped',
    'a.transition stopped',
    'a.exit stopped',
    'b.exit started',
    'b.transition started',
    'c.enter started',
    'c.enter stopped',
    'b.transition stopped',
    'b.exit stopped',
    'c.exit started',
    'c.immediate started',
  ])

  t.is($('#state').innerHTML, 'State: d')
})

test.serial('all types of effects without cleanup', (t) => {
  const { render, click, $ } = dom()

  let eff = []

  const effect = (label) => (context, data, event, send) => {
    eff.push(`${label} started`)
  }

  const machine = ({ state, enter, exit, transition, internal, immediate }) => {
    state(
      'a',
      enter({ effect: effect('a.enter') }),
      transition('next', 'b', { effect: effect('a.transition') }),
      exit({ effect: effect('a.exit') }),
    )

    state(
      'b',
      enter({ effect: effect('b.enter') }),
      internal('retry', { effect: effect('b.internal') }),
      transition('next', 'c', { effect: effect('b.transition') }),
      exit({ effect: effect('b.exit') }),
    )

    state(
      'c',
      enter({ effect: effect('c.enter') }),
      immediate('d', { effect: effect('c.immediate') }),
      exit({ effect: effect('c.exit') }),
    )

    state('d')
  }

  function App() {
    const { state, send } = useMachine(machine)
    return (
      <>
        <div id='state'>State: {state.name}</div>
        <button id='next' onClick={() => send('next')} />
        <button id='retry' onClick={() => send('retry')} />
      </>
    )
  }

  const rerender = () => {
    render(<App />)
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['a.enter started'])

  eff = []
  click($('#next'))
  rerender()
  t.deepEqual(eff, ['a.exit started', 'a.transition started', 'b.enter started'])

  eff = []
  click($('#retry'))
  rerender()
  t.deepEqual(eff, ['b.internal started'])

  eff = []
  click($('#retry'))
  rerender()
  t.deepEqual(eff, ['b.internal started'])

  eff = []
  click($('#next'))
  rerender()
  t.deepEqual(eff, [
    'b.exit started',
    'b.transition started',
    'c.enter started',
    'c.exit started',
    'c.immediate started',
  ])

  t.is($('#state').innerHTML, 'State: d')
})

test.serial('effect sending an event', (t) => {
  const { render, click, $ } = dom()

  let eff = []
  let state

  const effect = (label) => (context, data, event, send) => {
    // both effects see the original state data
    t.deepEqual(data, { a: 1 })

    eff.push(`${label} started`)

    // further state updates are queued, not executed immediately
    send({ type: 'assign', b: 2 })

    return () => {
      eff.push(`${label} stopped`)
    }
  }

  const machine = ({ state, enter, exit, transition, internal, immediate }) => {
    state(
      'a',
      enter({ effect: effect('enter1'), assign: { a: 1 } }),
      enter({ effect: effect('enter2') }),
      internal('assign', { assign: true }),
      transition('next', 'b'),
    )

    state('b')
  }

  function App() {
    const { state: _state, send } = useMachine(machine)
    state = _state
    return (
      <>
        <div id='state'>State: {state.name}</div>
        <button id='next' onClick={() => send('next')} />
      </>
    )
  }

  const rerender = () => {
    render(<App />)
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['enter1 started', 'enter2 started'])
  t.deepEqual(state, { name: 'a', data: { a: 1, b: 2 } })

  eff = []
  click($('#next'))
  rerender()
  t.deepEqual(eff, ['enter2 stopped', 'enter1 stopped'])
  t.deepEqual(state, { name: 'b', data: { a: 1, b: 2 }, final: true })
})

test.serial('sending consecutive events', (t) => {
  const { render, click, $ } = dom()

  let eff = []
  let state

  const effect = (label, val, expectedData) => (context, data, event, send) => {
    // all effects see the original state data
    t.deepEqual(data, expectedData)

    eff.push(`${label} started`)

    // further state updates are queued, not executed immediately
    send({ type: 'assign', e: val })

    return () => {
      eff.push(`${label} stopped`)
    }
  }

  const machine = ({ state, enter, exit, transition, internal, immediate }) => {
    state(
      'a',
      enter({ effect: effect('a.enter', 11, { a: 1 }), assign: { a: 1 } }),
      internal('assign', { assign: true }),
      transition('next', 'b', {
        effect: effect('a.transition', 22, { a: 1, e: 11, b: 2 }),
        assign: { b: 2 },
      }),
    )

    state(
      'b',
      enter({ effect: effect('b.enter', 33, { a: 1, e: 11, b: 2, c: 3 }), assign: { c: 3 } }),
      transition('next', 'c'),
    )

    state('c')
  }

  function App() {
    const { state: _state, send } = useMachine(machine)
    state = _state

    const doubleSend = () => {
      send('next')
      send('next')
    }

    return (
      <>
        <div id='state'>State: {state.name}</div>
        <button id='next' onClick={doubleSend} />
      </>
    )
  }

  const rerender = () => {
    render(<App />)
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['a.enter started'])
  t.deepEqual(state, { name: 'a', data: { a: 1, e: 11 } })

  eff = []
  click($('#next'))
  rerender()

  t.deepEqual(eff, [
    'a.enter stopped',
    'a.transition started',
    'b.enter started',
    'b.enter stopped',
    'a.transition stopped',
  ])
  t.deepEqual(state, { name: 'c', data: { a: 1, b: 2, c: 3, e: 11 }, final: true })
})

test.serial('external self transition', (t) => {
  const { render, click, $ } = dom()

  let eff = []
  let state

  const effect = (label, val) => (context, data, event, send) => {
    eff.push(`${label} started`)
    return () => {
      eff.push(`${label} stopped`)
    }
  }

  const machine = ({ state, enter, exit, transition, internal, immediate }) => {
    state(
      'a',
      enter({ effect: effect('a.enter', 11), assign: { a: 1 } }),
      transition('assign', 'a', { assign: true, effect: effect('a.transition') }),
      transition('next', 'b'),
    )

    state('b')
  }

  function App() {
    const { state: _state, send } = useMachine(machine)
    state = _state

    return (
      <>
        <div id='state'>State: {state.name}</div>
        <button id='next' onClick={() => send('next')} />
        <button id='assign' onClick={() => send('assign')} />
      </>
    )
  }

  const rerender = () => {
    render(<App />)
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['a.enter started'])
  t.deepEqual(state, { name: 'a', data: { a: 1 } })

  eff = []
  click($('#assign'))
  rerender()
  t.deepEqual(eff, ['a.enter stopped', 'a.transition started', 'a.enter started'])

  eff = []
  click($('#next'))
  rerender()
  t.deepEqual(eff, ['a.enter stopped', 'a.transition stopped'])
  t.deepEqual(state, { name: 'b', data: { a: 1 }, final: true })
})

test.serial('context changes are handled efficiently', (t) => {
  const { render, $ } = dom()

  const fooIsLarge = (ctx, data) => ctx.foo >= 3
  const barIsLarge = (ctx, data) => ctx.bar >= 3
  const multiplyBar = (ctx, data) => ({ ...data, derivedBar: ctx.bar * 2 })

  const machine = ({ state, enter, exit, transition, internal, immediate }) => {
    state(
      'a',
      transition('next', 'b'),
      internal('assign', { guard: barIsLarge, reduce: multiplyBar }),
      immediate('b', { guard: fooIsLarge }),
    )
    state('b')
  }

  let state

  const renderCounts = {
    app: 0,
    componentWithMachine: 0,
    child: 0,
  }

  function App({ foo, bar }) {
    renderCounts.app++
    return <ComponentWithMachine foo={foo} bar={bar} />
  }

  function ComponentWithMachine({ foo, bar }) {
    renderCounts.componentWithMachine++

    const { state: _state } = useMachine(machine, { foo, bar })

    state = _state

    return <Child foo={foo} bar={bar} derivedBar={state.data.derivedBar} />
  }

  function Child({ foo, bar, derivedBar }) {
    renderCounts.child++
    return (
      <>
        <div id='foo'>{foo}</div>
        <div id='bar'>{bar}</div>
        <div id='derivedBar'>{derivedBar}</div>
      </>
    )
  }

  const rerender = ({ foo, bar }) => {
    render(<App foo={foo} bar={bar} />)
  }

  rerender({ foo: 1, bar: 2 })
  t.deepEqual(state, { name: 'a', data: {} })
  t.deepEqual(renderCounts, {
    app: 1,
    componentWithMachine: 1,
    child: 1,
  })

  t.is($('#foo').innerHTML, '1')
  t.is($('#bar').innerHTML, '2')
  t.is($('#derivedBar').innerHTML, '')

  rerender({ foo: 2, bar: 2 })
  t.deepEqual(state, { name: 'a', data: {} })
  t.deepEqual(renderCounts, {
    app: 2,
    componentWithMachine: 3,
    child: 2,
  })

  t.is($('#foo').innerHTML, '2')
  t.is($('#bar').innerHTML, '2')
  t.is($('#derivedBar').innerHTML, '')

  rerender({ foo: 2, bar: 3 })
  t.deepEqual(state, { name: 'a', data: { derivedBar: 6 } })
  t.deepEqual(renderCounts, {
    app: 3,
    componentWithMachine: 5,
    child: 3,
  })

  t.is($('#foo').innerHTML, '2')
  t.is($('#bar').innerHTML, '3')
  t.is($('#derivedBar').innerHTML, '6')

  rerender({ foo: 3, bar: 3 })
  t.deepEqual(state, { name: 'b', data: { derivedBar: 6 }, final: true })
  t.deepEqual(renderCounts, {
    app: 4,
    componentWithMachine: 7,
    child: 4,
  })

  t.is($('#foo').innerHTML, '3')
  t.is($('#bar').innerHTML, '3')
  t.is($('#derivedBar').innerHTML, '6')

  // rerender with the same props, everything re-renders only once
  rerender({ foo: 3, bar: 3 })
  t.deepEqual(state, { name: 'b', data: { derivedBar: 6 }, final: true })
  t.deepEqual(renderCounts, {
    app: 5,
    componentWithMachine: 8,
    child: 5,
  })
})

//
// Test
//  count renders of parent, machine component, child
//    when context changes
//    when context changes + guard is triggered
