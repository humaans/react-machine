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
        <div id='count'>Effect: {eff.join(', ')}</div>
      </>
    )
  }

  act(() => {
    render(<App thing='a' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.is(document.querySelector('#count').innerHTML, 'Effect: ')
  t.deepEqual(eff, ['started'])

  act(() => {
    render(<App thing='a' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.is(document.querySelector('#count').innerHTML, 'Effect: started')
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

function click(dom, el) {
  return el.dispatchEvent(
    new dom.window.MouseEvent('click', {
      view: dom.window,
      bubbles: true,
      cancelable: true,
    })
  )
}
