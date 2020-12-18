const self = {}

const transformNames = {
  guard: 'guards',
  reduce: 'reducers',
  action: 'actions',
  effect: 'effects',
  invoke: 'invokes',
}

const transitionTransforms = ['assign', 'reduce', 'action', 'guard']
const enterTransforms = ['assign', 'reduce', 'action', 'invoke', 'effect']
const exitTransforms = ['assign', 'reduce', 'action']

export function runEffects(effects, state, send) {
  const disposes = []
  for (const effect of effects) {
    // TODO, don't need to do this, can just clear
    // if we've moved to a new state since the effects
    // have been queued, we no longer execute them
    // if (effect.name === curr.name) {
    const dispose = effect.run(state.context, send)
    if (dispose) {
      disposes.push(dispose)
    }
  }
  return disposes
}

export function cleanEffects(runningEffects) {
  for (const dispose of runningEffects) {
    dispose()
  }
  return []
}

export function createMachine(create) {
  const machine = {}

  if (create) {
    create({
      state: (name, ...opts) => {
        machine[name] = createState(name, ...opts)
      },
      enter: createEnter,
      exit: createExit,
      transition: createTransition,
      immediate: createImmediate,
      internal: createInternal,
    })
  }

  return machine
}

function createState(name, ...opts) {
  const enter = []
  const exit = []
  const transitions = {}
  const immediates = []

  for (const opt of opts) {
    const { type, event } = opt
    if (type === 'transition') {
      if (!transitions[event]) transitions[event] = []
      transitions[event].push(opt)
    } else if (type === 'immediate') {
      immediates.push(opt)
    } else if (type === 'enter') {
      enter.push(opt)
    } else if (type === 'exit') {
      exit.push(opt)
    }
  }

  return {
    name,
    enter,
    exit,
    transitions,
    immediates,
  }
}

function createEnter(opts) {
  return { type: 'enter', ...merge(opts ? [opts] : [], enterTransforms) }
}

function createExit(opts) {
  return { type: 'exit', ...merge(opts ? [opts] : [], exitTransforms) }
}

function createTransition(event, target, opts) {
  return { type: 'transition', event, target, ...merge(opts ? [opts] : [], transitionTransforms) }
}

function createImmediate(target, opts) {
  return { type: 'immediate', target, ...merge(opts ? [opts] : [], transitionTransforms) }
}

function createInternal(event, opts) {
  return {
    type: 'transition',
    event,
    target: self,
    ...merge(opts ? [opts] : [], transitionTransforms),
  }
}

export function transition(machine = {}, state = {}, event) {
  event = typeof event === 'string' ? { type: event } : event

  // initial transition
  if (!state.name && event && event.type === null) {
    const stateNames = Object.keys(machine)
    if (stateNames.length > 0) {
      const initialStateName = stateNames[0]
      const initialTransition = createImmediate(initialStateName)
      return applyTransition(machine, state, event, initialTransition)
    }
  }

  const currState = machine[state.name] || {}
  const transitions = currState.transitions || {}
  const candidates = transitions[event.type] || []
  for (const candidate of candidates) {
    if (checkGuards(state.context, event, candidate)) {
      return applyTransition(machine, state, event, candidate)
    }
  }

  return [state, null]
}

// apply a transition to the machine
function applyTransition(machine, curr, event, transition) {
  const effects = []

  const next = { ...curr }

  // TODO - only push events if we had an external transition, else return null for internal transitions
  // TODO - handle hierarchical effects, only push effects when leaving nodes, etc.

  const target = transition.target === self ? curr.name : transition.target
  const currState = machine[curr.name]
  const nextState = machine[target]

  if (!nextState) {
    throw new Error(`State '${transition.target}' does not exist`)
  }

  if (currState) {
    if (curr.name !== nextState.name) {
      for (const exit of currState.exit) {
        for (const reduce of exit.reducers) {
          next.context = reduce(next.context, event)
        }

        for (const action of exit.actions) {
          action(next.context, event)
        }
      }
    }
  }

  next.name = target

  for (const reduce of transition.reducers) {
    next.context = reduce(next.context, event)
  }

  for (const action of transition.actions) {
    action(next.context, event)
  }

  if (curr.name !== nextState.name) {
    for (const enter of nextState.enter) {
      for (const reduce of enter.reducers) {
        next.context = reduce(next.context, event)
      }

      for (const action of enter.actions) {
        action(next.context, event)
      }
    }

    for (const candidate of nextState.immediates) {
      if (checkGuards(next.context, event, candidate)) {
        return applyTransition(machine, next, event, candidate)
      }
    }
  }

  if (Object.keys(nextState.transitions).length === 0 && nextState.immediates.length === 0) {
    next.final = true
  }

  // we do not rerun state level transforms
  // in internal transitions
  if (curr.name !== nextState.name) {
    for (const enter of nextState.enter) {
      for (const invoke of enter.invokes) {
        effects.push({ run: promiseEffect(invoke) })
      }

      for (const effect of enter.effects) {
        effects.push({ run: effect })
      }
    }
  }

  return [next, effects]
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
    let disposed = false
    Promise.resolve(fn(curr))
      .then((data) => {
        if (!disposed) {
          send({ type: 'done', data })
        }
      })
      .catch((error) => {
        if (!disposed) {
          send({ type: 'error', error })
        }
      })
    return () => {
      disposed = true
    }
  }
}
