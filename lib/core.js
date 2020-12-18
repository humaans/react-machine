const hookKeys = {
  guard: 'guards',
  reduce: 'reducers',
  action: 'actions',
  effect: 'effects',
  invoke: 'invokes',
}

const transitionHooks = ['assign', 'reduce', 'action', 'guard']
const enterHooks = ['assign', 'reduce', 'action', 'invoke', 'effect']
const exitHooks = ['assign', 'reduce', 'action']

const mappedHooks = {
  assign: ['reduce', assignToReduce],
}

export function runEffects(effects, state, send) {
  const disposes = []
  for (const effect of effects) {
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
  return { type: 'enter', ...merge(opts ? [opts] : [], enterHooks) }
}

function createExit(opts) {
  return { type: 'exit', ...merge(opts ? [opts] : [], exitHooks) }
}

function createTransition(event, target, opts) {
  return { type: 'transition', event, target, ...merge(opts ? [opts] : [], transitionHooks) }
}

function createInternal(event, opts) {
  return {
    type: 'transition',
    event,
    internal: true,
    ...merge(opts ? [opts] : [], transitionHooks),
  }
}

function createImmediate(target, opts) {
  return { type: 'immediate', target, ...merge(opts ? [opts] : [], transitionHooks) }
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
  const next = { ...curr }
  const target = transition.internal ? curr.name : transition.target
  const currState = machine[curr.name]
  const nextState = machine[target]
  const effects = transition.internal ? null : []

  if (!nextState) {
    throw new Error(`State '${transition.target}' does not exist`)
  }

  if (currState && !transition.internal) {
    for (const exit of currState.exit) {
      for (const reduce of exit.reducers) {
        next.context = reduce(next.context, event)
      }

      for (const action of exit.actions) {
        action(next.context, event)
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

  if (!transition.internal) {
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

  if (!transition.internal) {
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
      return { ...context, ...assign(context, data) }
    }

    return { ...context, ...assign }
  }
}

/**
 * We allow to pass in all of the following
 * transition(..., { reduce: fn })
 * transition(..., { reduce: [fn1, fn2] })
 * this normalizes all of those options into a single { reduce: [x, y, z] } list
 * for each specified transfors
 *
 * also, we special case assign, and convert it into a reducer
 */
function merge(opts, allowedHooks) {
  const merged = {}

  for (const hook of allowedHooks) {
    if (!mappedHooks[hook]) {
      const key = hookKeys[hook]
      merged[key] = []
    }
  }

  function add(hook, opt) {
    let t = opt[hook] || []
    t = Array.isArray(t) ? t : [t]

    if (mappedHooks[hook]) {
      const [newName, transform] = mappedHooks[hook]
      hook = newName
      t = t.map(transform)
    }

    const key = hookKeys[hook]
    merged[key] = merged[key].concat(t)
  }

  for (const opt of opts) {
    for (const type of allowedHooks) {
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
