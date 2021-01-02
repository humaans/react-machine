import test from 'ava'
import React from 'react'
import { render } from 'react-dom'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'
import { useMachine } from '../lib/index.js'

test.serial('usage', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

  const machine = ({ state, transition, immediate }) => {
    state('initial', immediate('counter'))
    state(
      'counter',
      transition('increment', 'counter', { reduce: (ctx, data) => ({ ...data, a: data.a + 1 }) }),
      immediate('final', { guard: (ctx, data) => data.a >= 4 })
    )
    state('final')
  }

  function App() {
    const { state, send } = useMachine(machine, {}, { a: 1 })
    return (
      <>
        <div id='state'>State: {state.name}</div>
        <div id='count'>Count: {state.data.a}</div>
        <button id='increment' onClick={() => send('increment')} />
      </>
    )
  }

  act(() => {
    render(<App />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.is(document.querySelector('#count').innerHTML, 'Count: 1')

  click(dom, document.querySelector('#increment'))
  click(dom, document.querySelector('#increment'))

  act(() => {
    render(<App />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.is(document.querySelector('#count').innerHTML, 'Count: 3')

  click(dom, document.querySelector('#increment'))
  click(dom, document.querySelector('#increment'))

  act(() => {
    render(<App />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: final')
  t.is(document.querySelector('#count').innerHTML, 'Count: 4')
})

test.serial('changing props automatically send assign event', (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

  const machine = ({ state, transition, immediate, internal }) => {
    state('initial', immediate('counter'))
    state(
      'counter',
      internal('assign', { assign: (ctx, data) => ({ ...data, thang: ctx.thing + ctx.thing }) }),
      internal('changeThang', { assign: true })
    )
  }

  function App({ thing }) {
    const { state, context, send } = useMachine(machine, { thing }, { thang: '' })
    return (
      <>
        <div id='state'>Name: {state.name}</div>
        <div id='thing'>Thing: {context.thing}</div>
        <div id='thang'>Thang: {state.data.thang}</div>
        <button id='changeThing' onClick={() => send({ type: 'changeThang', thang: 'c', x: 1 })} />
      </>
    )
  }

  act(() => {
    render(<App thing='a' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'Name: counter')
  t.is(document.querySelector('#thing').innerHTML, 'Thing: a')
  t.is(document.querySelector('#thang').innerHTML, 'Thang: ')

  act(() => {
    render(<App thing='b' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'Name: counter')
  t.is(document.querySelector('#thing').innerHTML, 'Thing: b')
  t.is(document.querySelector('#thang').innerHTML, 'Thang: bb')

  click(dom, document.querySelector('#changeThing'))

  act(() => {
    render(<App thing='b' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'Name: counter')
  t.is(document.querySelector('#thing').innerHTML, 'Thing: b')
  t.is(document.querySelector('#thang').innerHTML, 'Thang: c')
})

test.serial('effects', (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

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
      })
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

  act(() => {
    render(<App thing='a' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.deepEqual(eff, ['started'])

  act(() => {
    render(<App thing='a' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.deepEqual(eff, ['started'])

  act(() => {
    render(null, root)
  })

  t.is(document.querySelector('#root').innerHTML, '')
  t.deepEqual(eff, ['started', 'finished'])
})

test.serial('internal transition effects', (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

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
      internal('increment', { effect: internalEffect })
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

  act(() => {
    render(<App />, root)
  })

  t.deepEqual(eff, ['enter effect started'])

  click(dom, document.querySelector('#increment'))

  act(() => {
    render(<App />, root)
  })

  t.deepEqual(eff, ['enter effect started', 'internal effect started'])

  click(dom, document.querySelector('#increment'))

  act(() => {
    render(<App />, root)
  })

  t.deepEqual(eff, [
    'enter effect started',
    'internal effect started',
    'internal effect finished',
    'internal effect started',
  ])
})

test.serial('all types of effects with cleanup', (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

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
      exit({ effect: effect('a.exit') })
    )

    state(
      'b',
      enter({ effect: effect('b.enter') }),
      internal('retry', { effect: effect('b.internal') }),
      transition('next', 'c', { effect: effect('b.transition') }),
      exit({ effect: effect('b.exit') })
    )

    state(
      'c',
      enter({ effect: effect('c.enter') }),
      immediate('d', { effect: effect('c.immediate') }),
      exit({ effect: effect('c.exit') })
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
    act(() => {
      render(<App />, root)
    })
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['a.enter started'])

  eff = []
  click(dom, document.querySelector('#next'))
  rerender()
  t.deepEqual(eff, ['a.enter stopped', 'a.exit started', 'a.transition started', 'b.enter started'])

  eff = []
  click(dom, document.querySelector('#retry'))
  rerender()
  t.deepEqual(eff, ['b.internal started'])

  eff = []
  click(dom, document.querySelector('#retry'))
  rerender()
  t.deepEqual(eff, ['b.internal stopped', 'b.internal started'])

  eff = []
  click(dom, document.querySelector('#next'))
  rerender()
  t.deepEqual(eff, [
    'b.internal stopped',
    'b.enter stopped',
    'a.transition stopped',
    'a.exit stopped',
    'b.exit started',
    'b.exit stopped',
    'b.transition started',
    'b.transition stopped',
    'c.enter started',
    'c.enter stopped',
    'c.exit started',
    'c.immediate started',
  ])

  t.is(document.querySelector('#state').innerHTML, 'State: d')
})

test.serial('all types of effects without cleanup', (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

  let eff = []

  const effect = (label) => (context, data, event, send) => {
    eff.push(`${label} started`)
  }

  const machine = ({ state, enter, exit, transition, internal, immediate }) => {
    state(
      'a',
      enter({ effect: effect('a.enter') }),
      transition('next', 'b', { effect: effect('a.transition') }),
      exit({ effect: effect('a.exit') })
    )

    state(
      'b',
      enter({ effect: effect('b.enter') }),
      internal('retry', { effect: effect('b.internal') }),
      transition('next', 'c', { effect: effect('b.transition') }),
      exit({ effect: effect('b.exit') })
    )

    state(
      'c',
      enter({ effect: effect('c.enter') }),
      immediate('d', { effect: effect('c.immediate') }),
      exit({ effect: effect('c.exit') })
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
    act(() => {
      render(<App />, root)
    })
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['a.enter started'])

  eff = []
  click(dom, document.querySelector('#next'))
  rerender()
  t.deepEqual(eff, ['a.exit started', 'a.transition started', 'b.enter started'])

  eff = []
  click(dom, document.querySelector('#retry'))
  rerender()
  t.deepEqual(eff, ['b.internal started'])

  eff = []
  click(dom, document.querySelector('#retry'))
  rerender()
  t.deepEqual(eff, ['b.internal started'])

  eff = []
  click(dom, document.querySelector('#next'))
  rerender()
  t.deepEqual(eff, [
    'b.exit started',
    'b.transition started',
    'c.enter started',
    'c.exit started',
    'c.immediate started',
  ])

  t.is(document.querySelector('#state').innerHTML, 'State: d')
})

test.serial('effect sending an event', (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

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
      transition('next', 'b')
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
    act(() => {
      render(<App />, root)
    })
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['enter1 started', 'enter2 started'])
  t.deepEqual(state, { name: 'a', data: { a: 1, b: 2 } })

  eff = []
  click(dom, document.querySelector('#next'))
  rerender()
  t.deepEqual(eff, ['enter2 stopped', 'enter1 stopped'])
  t.deepEqual(state, { name: 'b', data: { a: 1, b: 2 }, final: true })
})

test.serial('sending consecutive events', (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

  let eff = []
  let state

  const effect = (label, val) => (context, data, event, send) => {
    // all effects see the original state data
    // t.deepEqual(data, { a: 1 })

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
      enter({ effect: effect('a.enter', 11), assign: { a: 1 } }),
      internal('assign', { assign: true }),
      transition('next', 'b', { effect: effect('a.transition', 22) })
    )

    state('b', enter({ effect: effect('b.enter', 33), assign: { b: 2 } }), transition('next', 'c'))

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
    act(() => {
      render(<App />, root)
    })
  }

  eff = []
  rerender()
  t.deepEqual(eff, ['a.enter started'])
  t.deepEqual(state, { name: 'a', data: { a: 1, e: 11 } })

  eff = []
  click(dom, document.querySelector('#next'))
  rerender()

  t.deepEqual(eff, [
    'a.enter stopped',
    'a.transition started',
    'a.transition stopped',
    'b.enter started',
    'b.enter stopped',
  ])
  t.deepEqual(state, { name: 'c', data: { a: 1, b: 2, e: 11 }, final: true })
})

//
// Test
//  count renders of parent, machine component, child
//    when context changes
//    when context changes + guard is triggered

// Test
//  what happens with external self transitions

function click(dom, el) {
  return el.dispatchEvent(
    new dom.window.MouseEvent('click', {
      view: dom.window,
      bubbles: true,
      cancelable: true,
    })
  )
}
