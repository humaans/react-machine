import { useReducer, useEffect, useCallback, useMemo } from 'react'

const self = {}

const transformNames = {
  guard: 'guards',
  reduce: 'reducers',
  action: 'actions',
  effect: 'effects',
  invoke: 'invokes',
}

const transitionTransforms = ['assign', 'reduce', 'action', 'guard']
const stateTransforms = ['assign', 'reduce', 'action', 'invoke', 'effect']

function initial({ states, context }) {
  const curr = {
    name: null,
    context,
    states,
    pendingEffects: [],
    activeEffects: [],
  }

  const stateNames = Object.keys(states)
  if (stateNames.length > 0) {
    const initialState = stateNames[0]
    const initialEvent = { type: null }
    const initialTransition = immediate(initialState)
    return applyTransition(curr, initialTransition, initialEvent)
  }

  return curr
}

function reduce(curr, action) {
  if (action.type === 'send') {
    let { event } = action
    event = typeof event === 'string' ? { type: event } : event
    return applyEvent(curr, event)
  }

  if (action.type === 'statesUpdated') {
    return { ...curr, states: action.states }
  }

  if (action.type === 'activeEffects') {
    return { ...curr, activeEffects: action.activeEffects }
  }
}

export function useMachine(create, context = {}, options = {}) {
  const states = useMemo(() => createMachine(create), [create])
  const [state, dispatch] = useReducer(reduce, { states, context }, initial)
  const send = useCallback((event) => dispatch({ type: 'send', event }), [dispatch])

  useEffect(() => {
    if (state.pendingEffects.length) {
      const activeEffects = runPendingEffects(state, send)
      // TODO handle
      dispatch({ type: 'activeEffects', activeEffects })
    }
  }, [send, state.pendingEffects])

  useEffect(() => {
    return () => {
      cleanEffects(state)
    }
  }, [])

  useEffect(() => {
    dispatch({ type: 'statesUpdated', states })
  }, [states])

  return [state, send]
}

function runPendingEffects(curr, send) {
  const disposes = []
  for (const effect of curr.pendingEffects) {
    // TODO, don't need to do this, can just clear
    // if we've moved to a new state since the effects
    // have been queued, we no longer execute them
    // if (effect.name === curr.name) {
    const dispose = effect.start(curr, send)
    if (dispose) {
      disposes.push(dispose)
    }
  }
  return disposes
}

function cleanEffects(curr) {
  const activeEffects = curr.activeEffects
  for (const dispose of activeEffects) {
    dispose()
  }
}

function createMachine(create) {
  const states = {}

  function state(name, ...opts) {
    states[name] = createState(name, ...opts)
  }

  if (create) {
    create({ state, transition, immediate, internal })
  }

  return states
}

function createState(name, ...opts) {
  const transitions = {}
  const immediates = []
  const transforms = []

  for (const opt of opts) {
    const { type, event } = opt
    if (type === 'transition') {
      if (!transitions[event]) transitions[event] = []
      transitions[event].push(opt)
    } else if (type === 'immediate') {
      immediates.push(opt)
    } else {
      transforms.push(opt)
    }
  }

  return {
    name,
    transitions,
    immediates,
    ...merge(transforms, stateTransforms),
  }
}

function transition(event, target, ...opts) {
  return { type: 'transition', event, target, ...merge(opts, transitionTransforms) }
}

function immediate(target, ...opts) {
  return { type: 'immediate', target, ...merge(opts, transitionTransforms) }
}

function internal(event, ...opts) {
  return { type: 'transition', event, target: self, ...merge(opts, transitionTransforms) }
}

function applyEvent(curr, event) {
  const { states } = curr
  const currState = states[curr.name] || {}
  const transitions = currState.transitions || {}
  const candidates = transitions[event.type] || []
  console.log(event.type, { candidates })
  for (const candidate of candidates) {
    if (checkGuards(curr.context, event, candidate)) {
      console.log('Applying??')
      return applyTransition(curr, candidate, event)
    }
  }
  return curr
}

// apply a transition to the machine
function applyTransition(curr, transition, event) {
  const { states } = curr

  // TODO
  // machine.cleanEffects()

  const next = { ...curr }

  const target = transition.target === self ? curr.name : transition.target
  const nextState = states[target]

  if (!nextState) {
    throw new Error(`State '${transition.target}' does not exist`)
  }

  next.name = target

  for (const reduce of transition.reducers) {
    next.context = reduce(next.context, event)
  }

  for (const action of transition.actions) {
    action(next.context, event)
  }

  for (const reduce of nextState.reducers) {
    next.context = reduce(next.context, event)
  }

  for (const action of nextState.actions) {
    action(next.context, event)
  }

  // machine.current = next

  for (const candidate of nextState.immediates) {
    if (checkGuards(next.context, event, candidate)) {
      return applyTransition(next, candidate, event)
    }
  }

  if (Object.keys(nextState.transitions).length === 0 && nextState.immediates.length === 0) {
    next.final = true
  }

  // we do not rerun state level transforms in internal transitions
  if (curr.name !== nextState.name) {
    for (const invoke of nextState.invokes) {
      next.pendingEffects.push({
        name: nextState.name,
        start: promiseEffect(invoke),
      })
    }

    for (const effect of nextState.effects) {
      next.pendingEffects.push({ name: nextState.name, start: effect })
    }
  }

  return next
}

function checkGuards(context, event, transition) {
  return !transition.guards.length || transition.guards.every((g) => g(context, event))
}

/**
 * A common operation is to assign event payload
 * to the context, this allows to do in several ways:
 * true - assign the full event payload to context
 * fn - assign the result of the fn(data) to context
 * val - assign the constant value to context
 */
function assignToReduce(assign) {
  return (context, event) => {
    const { type, ...data } = event

    if (assign === true) {
      return { ...context, ...data }
    }

    if (typeof assign === 'function') {
      return { ...context, ...assign(data) }
    }

    return { ...context, ...assign }
  }
}

/**
 * We allow to pass in all of the following
 * transition(..., { reduce: fn })
 * transition(..., { reduce: [fn1, fn2] })
 * transition(..., { reduce: [fn1, fn2] }, { reduce: fn })
 * and so on
 * this normalizes all of those options into a single { reduce: [x, y, z] } list
 * for each specified transfors
 *
 * also, we special case assign, and convert it into a reducer
 */
function merge(opts, kinds) {
  const merged = {}

  for (const transform of kinds) {
    if (transform !== 'assign') {
      const name = transformNames[transform]
      merged[name] = []
    }
  }

  function add(transform, opt) {
    let t = opt[transform] || []
    t = Array.isArray(t) ? t : [t]

    if (transform === 'assign') {
      transform = 'reduce'
      t = t.map(assignToReduce)
    }

    const name = transformNames[transform]
    merged[name] = merged[name].concat(t)
  }

  for (const opt of opts) {
    for (const type of kinds) {
      add(type, opt)
    }
  }

  return merged
}

/**
 * Convert an async function into an effect
 * with 'done' and 'error' events
 */
function promiseEffect(fn) {
  return (curr, send) => {
    Promise.resolve(fn(curr))
      .then((data) => send({ type: 'done', data }))
      .catch((error) => send({ type: 'error', error }))
  }
}
