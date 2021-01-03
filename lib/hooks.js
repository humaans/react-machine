import { useReducer, useEffect, useCallback, useMemo, useRef } from 'react'
import { createMachine, transition, applyEffects, cleanEffects } from './core.js'

function initial({ machine, context, initialData }) {
  const initialState = { name: null, data: initialData }
  const initialEvent = { type: null }

  const [state, effects] = transition(machine, context, initialState, initialEvent)

  const curr = {
    state,
    effects,
  }

  return curr
}

function reduce(curr, action) {
  if (action.type === 'send') {
    const { machine, contextRef, runningEffects, event, assign } = action
    const context = contextRef.current
    const [state, effects] = transition(machine, context, curr.state, event, { assign })

    if (state === curr.state) {
      return curr
    }

    if (state.name === curr.state.name && state.data === curr.state.data && !effects.length) {
      return curr
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

    return { ...curr, state, effects: nextEffects }
  }

  if (action.type === 'flushEffects') {
    return { ...curr, effects: [] }
  }

  return curr
}

export function useMachine(create, context = {}, initialData = {}, options = {}) {
  const { assign = 'assign', deps } = options

  const firstRender = useRef(true)
  const contextRef = useRef(context)
  const runningEffects = useRef()
  const machine = useMemo(() => createMachine(create), [create])
  const [curr, dispatch] = useReducer(reduce, { machine, context, initialData }, initial)
  const send = useCallback(
    (event) => dispatch({ type: 'send', machine, contextRef, runningEffects, event, assign }),
    [dispatch, machine, contextRef, assign]
  )

  const assignEffectDeps = [assign, send].concat(deps || (context ? Object.values(context) : []))

  useEffect(() => {
    contextRef.current = context

    if (firstRender.current) {
      firstRender.current = false
      return
    }

    if (assign) {
      send({ type: assign, ...context })
    }
  }, assignEffectDeps)

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
