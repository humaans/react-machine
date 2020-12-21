import { useReducer, useEffect, useCallback, useMemo, useRef } from 'react'
import { createMachine, transition, runEffects, cleanEffects } from './core.js'

function initial({ context, machine }) {
  const initialState = { context }
  const initialEvent = { type: null }

  const [state, effects] = transition(machine, initialState, initialEvent)

  const curr = {
    machine,
    effects: effects || [],
    state,
  }

  return curr
}

function reduce(curr, action) {
  if (action.type === 'send') {
    const { event, machine } = action
    const [state, effects] = transition(machine, curr.state, event)
    return { ...curr, state, effects: effects || curr.effects }
  }
}

export function useMachine(create, context = {}, options = {}) {
  const { assign = 'assign', deps } = options

  const runningEffects = useRef()
  const firstRender = useRef(true)
  const machine = useMemo(() => createMachine(create), [create])
  const [curr, dispatch] = useReducer(reduce, { context, machine }, initial)
  const send = useCallback((event) => dispatch({ type: 'send', event, machine }), [
    machine,
    dispatch,
  ])

  useEffect(() => {
    runningEffects.current = cleanEffects(runningEffects.current)

    if (curr.effects.length) {
      runningEffects.current = runEffects(curr.effects, curr.state, send)
    }
  }, [send, curr.effects])

  useEffect(() => {
    return () => {
      runningEffects.current = cleanEffects(runningEffects.current)
    }
  }, [])

  const assignEffectDeps = [send].concat(deps || (context ? Object.values(context) : []))

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    if (assign) {
      send({ type: assign, ...context })
    }
  }, assignEffectDeps)

  return [curr.state, send, curr.machine]
}
