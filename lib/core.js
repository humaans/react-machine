let nextEffectId

const hookKeys = {
  guard: 'guards',
  reduce: 'reducers',
  effect: 'effects',
}

const transitionHooks = ['assign', 'reduce', 'invoke', 'effect', 'guard']
const enterHooks = ['assign', 'reduce', 'invoke', 'effect']
const exitHooks = ['assign', 'reduce', 'effect']

const mappedHooks = {
  assign: ['reduce', assignToReduce],
  invoke: ['effect', invokeToEffect],
}

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
  const machine = { initial: defaultInitial, nodes: {} }

  if (create) {
    // restart the auto incrementing id
    nextEffectId = 1

    create({
      state: (name, ...opts) => {
        machine.nodes[name] = createStateNode(name, ...opts)
      },
      initial: (...opts) => {
        machine.initial = createInitial(...opts)
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
  for (const [, node] of Object.entries(machine.nodes)) {
    for (const transition of node.immediates) {
      if (!machine.nodes[transition.target]) {
        throw new Error(`Invalid transition target '${transition.target}'`)
      }
    }
    for (const transitions of Object.values(node.transitions)) {
      for (const transition of transitions) {
        if (!transition.internal && !machine.nodes[transition.target]) {
          throw new Error(`Invalid transition target '${transition.target}'`)
        }
      }
    }
  }
}

/**
 * Create a state node.
 */
function createStateNode(name, ...opts) {
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

function defaultInitial(opts) {
  return { data: {} }
}

function createInitial(name, initialData) {
  return (context) => {
    const initial = {}

    if (typeof name === 'string') {
      initial.name = name
    } else {
      initialData = name
    }

    if (typeof initialData === 'function') {
      initial.data = initialData(context)
    } else {
      initial.data = initialData
    }

    return initial
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
 * Transition the given machine from the provided state
 * to the next state based on the event. Returns the tuple
 * of the next state and any events to execute. In case effects
 * did not change, return null for effects, to indicate that the
 * active effects should continue running.
 */
export function transition(machine = {}, context = {}, state = {}, event, { assign } = {}) {
  event = typeof event === 'string' ? { type: event } : event

  // initial transition
  if (!state.name && event && event.type === null) {
    let { name, data } = machine.initial(context)
    const curr = { ...state, data }

    if (!name) {
      const nodeNames = Object.keys(machine.nodes)
      if (nodeNames.length > 0) {
        name = nodeNames[0]
      }
    }

    if (name) {
      const initialTransition = createImmediate(name)
      return applyTransition(machine, context, curr, event, initialTransition)
    }

    return [curr, []]
  }

  const currNode = machine.nodes[state.name] || {}
  const transitions = currNode.transitions || {}
  const candidates = transitions[event.type] || []

  for (const candidate of candidates) {
    if (checkGuards(context, state, event, candidate)) {
      return applyTransition(machine, context, state, event, candidate)
    }
  }

  // did not find any explicit assign transition, construct a dynamic transition
  // so that we re-trigger all of the immediate transitions every time the context
  // changes
  if (event.type === assign) {
    return applyTransition(machine, context, state, event, createInternal(assign))
  }

  return [state, []]
}

/**
 * The logic of applying a transition to the machine. Exit active state nodes,
 * apply transition hooks, enter target state nodes and collect any effects. Do this
 * recursively until all immediate transitions settle.
 */
function applyTransition(machine, context, curr, event, transition, effects = []) {
  const next = { ...curr }
  const target = transition.internal ? curr.name : transition.target
  const currNode = machine.nodes[curr.name]
  const nextNode = machine.nodes[target]

  if (currNode && !transition.internal) {
    effects.push({ op: 'exit', name: currNode.name })
    for (const exit of currNode.exit) {
      applyReducers(exit, context, next, event)
      queueEffects(exit, effects, next, event, target)
    }
  }

  next.name = target

  applyReducers(transition, context, next, event)
  queueEffects(transition, effects, next, event, target)

  if (!transition.internal) {
    for (const enter of nextNode.enter) {
      applyReducers(enter, context, next, event)
      queueEffects(enter, effects, next, event, target)
    }
  }

  for (const candidate of nextNode.immediates) {
    if (checkGuards(context, next, event, candidate)) {
      return applyTransition(machine, context, next, event, candidate, effects)
    }
  }

  if (Object.keys(nextNode.transitions).length === 0 && nextNode.immediates.length === 0) {
    next.final = true
  }

  return [next, effects]
}

function checkGuards(context, state, event, transition) {
  return !transition.guards.length || transition.guards.every((g) => g(context, state.data, event))
}

function applyReducers({ reducers }, context, next, event) {
  for (const reduce of reducers) {
    next.data = reduce(context, next.data, event)
  }
}

function queueEffects({ effects }, effectQueue, state, event, target) {
  for (const effect of effects) {
    effectQueue.push({ ...effect, op: 'effect', data: state.data, event, target })
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
  return (context, data, event) => {
    const { type, ...payload } = event

    if (assign === true) {
      return { ...data, ...payload }
    }

    if (typeof assign === 'function') {
      return { ...data, ...assign(context, data, payload) }
    }

    return { ...data, ...assign }
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

    if (hook === 'effect') {
      t = t.map((run) => ({ id: nextEffectId++, run }))
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
function invokeToEffect(fn) {
  return (context, data, event, send) => {
    let disposed = false
    Promise.resolve(fn(context, data, event))
      .then((result) => {
        if (!disposed) {
          send({ type: 'done', result })
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
 * transitioning the machine to the next state node, the caller must apply
 * the new set of effects atop of the currently running ones. This stops
 * any effects as necessary and starts any new ones.
 */
export function applyEffects(runningEffects = [], effectQueue, context, send) {
  let nextRunningEffects = runningEffects

  for (const effect of effectQueue) {
    if (effect.op === 'exit') {
      for (let i = runningEffects.length - 1; i >= 0; i--) {
        const eff = runningEffects[i]

        if (eff.disposed) {
          continue
        }

        if (effect.name === eff.target) {
          eff.dispose()
        }
      }
      continue
    }

    for (let i = runningEffects.length - 1; i >= 0; i--) {
      const eff = runningEffects[i]

      if (eff.disposed) {
        continue
      }

      if (effect.id === eff.id) {
        eff.dispose()
      }
    }

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

    effect.executed = true
    const dispose = effect.run(context, effect.data, effect.event, safeSend)

    if (dispose && dispose.then) {
      warn(
        [
          'Effect function must return a cleanup function or nothing.',
          'Use invoke instead of effect for async functions, or call the async function inside the synchronous effect function.',
        ].join(' ')
      )
    }

    effect.dispose = () => {
      effect.disposed = true
      if (dispose) {
        return dispose()
      }
    }

    nextRunningEffects.push(effect)
  }

  nextRunningEffects = nextRunningEffects.filter((eff) => !eff.disposed)

  return nextRunningEffects
}

export function cleanEffects(runningEffects = []) {
  for (const effect of runningEffects) {
    effect.dispose()
  }
  return []
}
