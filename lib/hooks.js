import { useReducer, useEffect, useCallback, useMemo, useRef } from 'react'
import { createMachine, transition, runEffects, cleanEffects } from './core.js'

function initial({ context, machine }) {
  const initialState = { context }
  const initialEvent = { type: null }

  const [state, effects] = transition(machine, initialState, initialEvent)

  const curr = {
    machine,
    effects,
    state,
    prev: null,
  }

  return curr
}

function reduce(curr, action) {
  if (action.type === 'send') {
    const { event, machine } = action
    const [state, effects] = transition(machine, curr.state, event)
    return { ...curr, state, prev: curr.state, effects: effects || curr.effects }
  }
}

export function useMachine(create, context = {}, options = {}) {
  const { assign = 'assign' } = options

  const runningEffects = useRef()
  const machine = useMemo(() => createMachine(create), [create])
  const [curr, dispatch] = useReducer(reduce, { context, machine }, initial)
  const send = useCallback((event) => dispatch({ type: 'send', event, machine }), [
    machine,
    dispatch,
  ])

  useEffect(() => {
    runningEffects.current = cleanEffects(runningEffects.current)

    if (curr.current && curr.current.length) {
      runningEffects.current = runEffects(curr.effects, curr.state, send)
    }
  }, [send, curr.effects])

  useEffect(() => {
    return () => {
      cleanEffects(runningEffects.current)
    }
  }, [])

  useEffect(() => {
    if (assign) {
      dispatch({ type: 'send', event: { type: assign, ...context } })
    }
  }, [dispatch].concat(dispatch ? Object.values(context) : []))

  return [curr.state, send, curr.machine, curr.prev]
}
