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

function click(dom, el) {
  return el.dispatchEvent(
    new dom.window.MouseEvent('click', {
      view: dom.window,
      bubbles: true,
      cancelable: true,
    })
  )
}
