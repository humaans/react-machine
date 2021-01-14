import { useReducer, useEffect, useCallback, useMemo, useRef } from 'react'
import { createMachine, transition, applyEffects, cleanEffects } from './core.js'

function defaultAreEqual(prev, next) {
  if (prev === next) {
    return true
  }
  for (const i in prev) {
    if (prev[i] !== next[i]) return false
  }
  for (const i in next) {
    if (!(i in prev)) return false
  }
  return true
}

function initial({ machine, context, initialData }) {
  const initialState = { name: null, data: initialData }
  const initialEvent = { type: null }

  let [state, effects] = transition(machine, context, initialState, initialEvent)

  // minor optimisation to avoid a re-render if no effects have been queued
  if (!effects.some((eff) => eff.op === 'effect')) {
    effects = []
  }

  const curr = {
    state,
    effects,
    context,
  }

  return curr
}

function reduce(curr, action) {
  if (action.type === 'send') {
    const { machine, context, runningEffects, event, options } = action
    const { assign, areEqual } = options

    const [state, effects] = transition(machine, context, curr.state, event, { assign })

    if (
      state === curr.state ||
      (state.name === curr.state.name && state.data === curr.state.data && !effects.length)
    ) {
      if (areEqual(curr.context, context)) {
        return curr
      } else {
        return { ...curr, context }
      }
    }

    let nextEffects = []
    if (curr.effects) {
      nextEffects = nextEffects.concat(curr.effects)
    }
    if (effects) {
      nextEffects = nextEffects.concat(effects)
    }

    // minor optimisation to avoid a re-render if no effects are running
    if (!runningEffects.current || !runningEffects.current.length) {
      if (!nextEffects.some((eff) => eff.op === 'effect')) {
        nextEffects = []
      }
    }

    return { ...curr, state, effects: nextEffects, context }
  }

  if (action.type === 'flushEffects') {
    if (curr.effects.length) {
      return { ...curr, effects: [] }
    } else {
      return curr
    }
  }

  return curr
}

export function useMachine(create, context = {}, initialData = {}, options = {}) {
  const { assign = 'assign', areEqual = defaultAreEqual } = options

  const contextRef = useRef(context)
  const runningEffects = useRef()
  const machine = useMemo(() => createMachine(create), [create])
  const [curr, dispatch] = useReducer(reduce, { machine, context, initialData }, initial)
  const send = useCallback(
    (event) =>
      dispatch({
        type: 'send',
        context: contextRef.current,
        machine,
        runningEffects,
        event,
        options: { assign, areEqual },
      }),
    [dispatch, machine, contextRef, assign, areEqual]
  )

  // if context changed, we will transition
  // the machine if necessary
  if (assign && !areEqual(curr.context, context)) {
    dispatch({
      type: 'send',
      machine,
      context,
      runningEffects,
      event: { type: assign },
      options: { assign, areEqual },
    })
  }

  useEffect(() => {
    contextRef.current = context
  })

  useEffect(() => {
    if (!curr.effects.length) return

    runningEffects.current = applyEffects(
      runningEffects.current,
      curr.effects,
      contextRef.current,
      send
    )

    dispatch({ type: 'flushEffects' })
  }, [contextRef, dispatch, send, curr.effects])

  useEffect(() => {
    return () => {
      runningEffects.current = cleanEffects(runningEffects.current)
    }
  }, [])

  return { state: curr.state, send, context, machine }
}
