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
    const { machine, contextRef, event, assign } = action
    const context = contextRef.current
    const [state, effects] = transition(machine, context, curr.state, event, { assign })

    if (state === curr.state) {
      return curr
    }

    let nextEffects = []
    if (curr.effects) {
      nextEffects = nextEffects.concat(curr.effects)
    }
    if (effects) {
      nextEffects = nextEffects.concat(effects)
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
    (event) => dispatch({ type: 'send', machine, contextRef, event, assign }),
    [dispatch, machine, contextRef, assign]
  )

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

  const assignEffectDeps = [assign, send].concat(deps || (context ? Object.values(context) : []))

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    if (assign) {
      send({ type: assign, ...context })
    }
  }, assignEffectDeps)

  // if (contextValues !== curr.contextValues) {
  //   send({ type: assign, ...context })
  // }

  return { state: curr.state, send, context, machine }
}
