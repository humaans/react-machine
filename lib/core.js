const hookKeys = {
  guard: 'guards',
  reduce: 'reducers',
  effect: 'effects',
  invoke: 'invokes',
}

const transitionHooks = ['assign', 'reduce', 'action', 'guard']
const enterHooks = ['assign', 'reduce', 'action', 'invoke', 'effect']
const exitHooks = ['assign', 'reduce', 'action']

const mappedHooks = {
  assign: ['reduce', assignToReduce],
  action: ['reduce', actionToReduce],
}

const ACTION = {}

const env = (process && process.env && process.env.NODE_ENV) || 'development'

function warn(msg) {
  if (env !== 'production') {
    console.warn(msg)
  }
}

function arg(argument, type, error) {
  if (type === 'string') {
    if (typeof argument !== 'string') {
      throw new Error(error)
    }
  }
}

/**
 * Parse the machine DSL into a machine object.
 */
export function createMachine(create) {
  const machine = { states: {} }

  if (create) {
    create({
      state: (name, ...opts) => {
        machine.states[name] = createState(name, ...opts)
      },
      enter: createEnter,
      exit: createExit,
      transition: createTransition,
      immediate: createImmediate,
      internal: createInternal,
    })
  }

  validate(machine)

  return machine
}

function validate(machine) {
  for (const [, state] of Object.entries(machine.states)) {
    for (const transition of state.immediates) {
      if (!machine.states[transition.target]) {
        throw new Error(`Invalid transition target '${transition.target}'`)
      }
    }
    for (const transitions of Object.values(state.transitions)) {
      for (const transition of transitions) {
        if (!transition.internal && !machine.states[transition.target]) {
          throw new Error(`Invalid transition target '${transition.target}'`)
        }
      }
    }
  }
}

/**
 * Create a state node.
 */
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
    } else {
      throw new Error(
        `State '${name}' should be passed one of enter(), exit(), transition(), immediate() or internal()`
      )
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
  return { type: 'enter', ...merge(opts, enterHooks) }
}

function createExit(opts) {
  return { type: 'exit', ...merge(opts, exitHooks) }
}

function createTransition(event, target, opts) {
  arg(event, 'string', 'First argument of the transition must be the name of the event')
  arg(target, 'string', 'Second argument of the transition must be the name of the target state')
  return { type: 'transition', event, target, ...merge(opts, transitionHooks) }
}

function createInternal(event, opts) {
  arg(event, 'string', 'First argument of the internal transition must be the name of the event')
  return {
    type: 'transition',
    event,
    internal: true,
    ...merge(opts, transitionHooks),
  }
}

function createImmediate(target, opts) {
  arg(
    target,
    'string',
    'First argument of the immediate transition must be the name of the target state'
  )
  return { type: 'immediate', target, ...merge(opts, transitionHooks) }
}

/**
 * Transition the given machine, with the given state
 * to the next state based on the event. Returns the tuple
 * of the next state and any events to execute. In case no external
 * transition took place, return null as effects, to indicate
 * that the active effects should continue running.
 */
export function transition(machine = {}, state = {}, event) {
  event = typeof event === 'string' ? { type: event } : event

  // initial transition
  if (!state.name && event && event.type === null) {
    const stateNames = Object.keys(machine.states)
    if (stateNames.length > 0) {
      const initialStateName = stateNames[0]
      const initialTransition = createImmediate(initialStateName)
      return applyTransition(machine, state, event, initialTransition)
    }
  }

  const currState = machine.states[state.name] || {}
  const transitions = currState.transitions || {}
  const candidates = transitions[event.type] || []

  for (const candidate of candidates) {
    if (checkGuards(state.context, event, candidate)) {
      return applyTransition(machine, state, event, candidate)
    }
  }

  return [state, null]
}

/**
 * The logic of applying a transition to the machine. Exit states,
 * apply transition hooks, enter states and collect any events. Do this
 * recursively untill all immediate transitions settle.
 */
function applyTransition(machine, curr, event, transition) {
  const next = { ...curr }
  const target = transition.internal ? curr.name : transition.target
  const currState = machine.states[curr.name]
  const nextState = machine.states[target]
  const effects = transition.internal ? null : []

  if (currState && !transition.internal) {
    for (const exit of currState.exit) {
      applyReducers(next, event, exit.reducers)
    }
  }

  next.name = target

  applyReducers(next, event, transition.reducers)

  if (!transition.internal) {
    for (const enter of nextState.enter) {
      applyReducers(next, event, enter.reducers)
    }
  }

  for (const candidate of nextState.immediates) {
    if (checkGuards(next.context, event, candidate)) {
      return applyTransition(machine, next, event, candidate)
    }
  }

  if (Object.keys(nextState.transitions).length === 0 && nextState.immediates.length === 0) {
    next.final = true
  }

  if (!transition.internal) {
    for (const enter of nextState.enter) {
      for (const invoke of enter.invokes) {
        effects.push({ run: promiseEffect(invoke), event })
      }

      for (const effect of enter.effects) {
        effects.push({ run: effect, event })
      }
    }
  }

  return [next, effects]
}

function checkGuards(context, event, transition) {
  return !transition.guards.length || transition.guards.every((g) => g(context, event))
}

function applyReducers(next, event, reducers) {
  for (const reduce of reducers) {
    const result = reduce(next.context, event)
    if (result !== ACTION) {
      next.context = result
    }
  }
}

/**
 * A common operation is to assign event payload
 * to the context, this allows to do in several ways:
 * true - assign the full event payload to context
 * fn - assign the result of the fn(context, data) to context
 * val - assign the constant provided value to context
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

function actionToReduce(action) {
  return (context, event) => {
    action(context, event)
    return ACTION
  }
}

/**
 * Allow to pass each hook as a function, or a list of functions
 *   transition(..., { reduce: fn })
 *   transition(..., { reduce: [fn1, fn2] })
 * Convert both of those into arrays, and also remap some of the
 * hooks to different hooks (i.e. assign -> reduce)
 */
function merge(opts = {}, allowedHooks) {
  const merged = {}

  for (const hook of allowedHooks) {
    add(hook)
  }

  function add(hook) {
    let t = opts[hook] || []
    t = Array.isArray(t) ? t : [t]

    if (mappedHooks[hook]) {
      const [newName, transform] = mappedHooks[hook]
      hook = newName
      t = t.map(transform)
    }

    const key = hookKeys[hook]
    merged[key] = merged[key] || []
    merged[key] = merged[key].concat(t)
  }

  return merged
}

/**
 * Convert an async function into an effect
 * that sends 'done' and 'error' events
 */
function promiseEffect(fn) {
  return (curr, event, send) => {
    let disposed = false
    Promise.resolve(fn(curr, event))
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

/**
 * createMachine and transition are pure, stateless functions. After
 * transitioning the machine to the next state, the caller must clean
 * up all of the running effects, and then run the newly provided effects.
 */
export function runEffects(effects = [], state, send) {
  const runningEffects = []

  for (const effect of effects) {
    const safeSend = (...args) => {
      if (effect.disposed) {
        warn(
          [
            "Can't send events in an effect after it has been cleaned up.",
            'This is a no-op, but indicates a memory leak in your application.',
            "To fix, cancel all subscriptions and asynchronous tasks in the effect's cleanup function.",
          ].join(' ')
        )
      } else {
        return send(...args)
      }
    }

    const dispose = effect.run(state.context, effect.event, safeSend)
    if (dispose && dispose.then) {
      warn(
        [
          'Effect function must return a cleanup function or nothing.',
          'Use invoke instead of effect for async functions, or call the async function inside the synchronous effect function.',
        ].join(' ')
      )
    } else if (dispose) {
      effect.dispose = () => {
        effect.disposed = true
        return dispose()
      }
      runningEffects.push(effect)
    }
  }

  return runningEffects
}

export function cleanEffects(runningEffects = []) {
  for (const effect of runningEffects) {
    effect.dispose()
  }
  return []
}
