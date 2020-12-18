import { useReducer, useEffect, useCallback, useMemo } from 'react'
import { createMachine, transition, runEffects, cleanEffects } from './core.js'

function initial({ context, machine }) {
  const initialState = { context }
  const initialEvent = { type: null }

  const [state, effects] = transition(machine, initialState, initialEvent)

  const curr = {
    machine,
    pendingEffects: effects,
    runningEffects: [],
    state,
    prev: null,
  }

  return curr
}

function reduce(curr, action) {
  if (action.type === 'send') {
    const { event, machine } = action
    const [state, effects] = transition(machine, curr.state, event)
    return { ...curr, state, prev: curr.state, pendingEffects: effects || curr.pendingEffects }
  }

  if (action.type === 'runningEffects') {
    return { ...curr, runningEffects: action.runningEffects }
  }
}

export function useMachine(create, context = {}, options = {}) {
  const { assign = 'assign' } = options

  const machine = useMemo(() => createMachine(create), [create])
  const [curr, dispatch] = useReducer(reduce, { context, machine }, initial)
  const send = useCallback((event) => dispatch({ type: 'send', event, machine }), [
    machine,
    dispatch,
  ])

  useEffect(() => {
    cleanEffects(curr.runningEffects)

    if (curr.pendingEffects.length) {
      const runningEffects = runEffects(curr.pendingEffects, curr.state, send)
      dispatch({ type: 'runningEffects', runningEffects })
      // TODO - need to clean here somehow in case dispatch was noop?
    }
  }, [send, curr.pendingEffects])

  useEffect(() => {
    return () => {
      cleanEffects(curr.runningEffects)
    }
  }, [])

  useEffect(() => {
    if (assign) {
      dispatch({ type: 'send', event: { type: assign, ...context } })
    }
  }, [dispatch].concat(dispatch ? Object.values(context) : []))

  return [curr.state, send, curr.machine, curr.prev]
}
