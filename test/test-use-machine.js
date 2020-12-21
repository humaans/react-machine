import test from 'ava'
import React from 'react'
import { render } from 'react-dom'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'
import { useMachine } from '../lib/hooks.js'

test.serial('usage', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

  const machine = ({ state, transition, immediate }) => {
    state('initial', immediate('counter'))
    state(
      'counter',
      transition('increment', 'counter', { reduce: (ctx) => ({ ...ctx, a: ctx.a + 1 }) }),
      immediate('final', { guard: (ctx) => ctx.a >= 4 })
    )
    state('final')
  }

  function App() {
    const [{ name, context }, send] = useMachine(machine, { a: 1 })
    return (
      <>
        <div id='state'>State: {name}</div>
        <div id='count'>Count: {context.a}</div>
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
      internal('assign', { assign: true }),
      internal('changeThing', { assign: true })
    )
  }

  function App({ thing }) {
    const [{ name, context }, send] = useMachine(machine, { thing })
    return (
      <>
        <div id='state'>State: {name}</div>
        <div id='count'>Thing: {context.thing}</div>
        <button id='changeThing' onClick={() => send({ type: 'changeThing', thing: 'c', x: 1 })} />
      </>
    )
  }

  act(() => {
    render(<App thing='a' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.is(document.querySelector('#count').innerHTML, 'Thing: a')

  act(() => {
    render(<App thing='b' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.is(document.querySelector('#count').innerHTML, 'Thing: b')

  click(dom, document.querySelector('#changeThing'))

  act(() => {
    render(<App thing='b' />, root)
  })

  t.is(document.querySelector('#state').innerHTML, 'State: counter')
  t.is(document.querySelector('#count').innerHTML, 'Thing: c')
})

test.serial('effects', (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>')
  global.window = dom.window
  global.document = dom.window.document
  const root = document.getElementById('root')

  const eff = []

  const machine = ({ state, enter, internal }) => {
    state(
      'counter',
      internal('assign', { assign: true }),
      enter({
        effect: (context, event, send) => {
          eff.push('started')
          return () => {
            eff.push('finished')
          }
        },
      })
    )
  }

  function App({ thing }) {
    const [{ name }] = useMachine(machine, { thing })
    return (
      <>
        <div id='state'>State: {name}</div>
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

function click(dom, el) {
  return el.dispatchEvent(
    new dom.window.MouseEvent('click', {
      view: dom.window,
      bubbles: true,
      cancelable: true,
    })
  )
}
