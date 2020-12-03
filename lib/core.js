// TODO
// - [ ] es6 modules
// - [ ] snowpack "good package mode"
// - [ ] release!
//
// - [x] invoke
// - [x] effect
// - [x] set final: true somewhere
// - [x] decide if invoke / effect will be options or functions: options 🙌
// - [x] immediate chains
// - [x] immediate chains with invokes/effects (??)
// - [x] guards
// - [x] introduce assign: true, assign: { error: null }, assign: data => data2 as a shortcut
// - [ ] why are errors thrown in effect dipose not handled?
// - [ ] add internal() transitions that transition to itself, useful for assign and other bits
// - [ ] possibly convert assigns and actions into reducers, so they're applied in order
// - [ ] dispose effects on component unmount
// - [ ] possibly add exit(), to complement the rest of on entry transforms
// - [ ] possibly move the code into standalone functions and pass machine every time
// - [ ] add React tests
// - [ ] complete the tests
// - allow debug option

const transformNames = {
  guard: 'guards',
  reduce: 'reducers',
  action: 'actions',
  effect: 'effects',
  invoke: 'invokes',
}

const self = {}

const transitionTransforms = ['assign', 'reduce', 'action', 'guard']
const stateTransforms = ['assign', 'reduce', 'action', 'invoke', 'effect']

export function createMachine(create, context = {}, options = {}) {
  const machine = {
    /** @private */
    states: {},
    /** @private */
    subscriptions: [],
    /** @private */
    activeEffects: [],
    /** @private */
    pendingEffects: [],
    /** @private */
    get,

    /** @public */
    current: { name: null, context },
    /** @public */
    subscribe,
    /** @public */
    flushEffects,
    /** @public */
    cleanEffects,
    /** @public */
    send,
  }

  function get() {
    return machine.current
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

  function state(name, ...opts) {
    machine.states[name] = createState(name, ...opts)
  }

  function send(event) {
    event = typeof event === 'string' ? { type: event } : event
    const curr = machine.states[machine.current.name] || {}
    const transitions = curr.transitions || {}
    const candidates = transitions[event.type] || []
    for (const candidate of candidates) {
      if (checkGuards(machine.current.context, event, candidate)) {
        applyTransition(machine, candidate, event)
        break
      }
    }
  }

  function flushEffects() {
    const pendingEffects = machine.pendingEffects
    machine.pendingEffects = []
    for (const effect of pendingEffects) {
      // if we've moved to a new state since the effects
      // have been queued, we no longer execute them
      if (effect.name === machine.current.name) {
        const dispose = effect.start()
        if (dispose) {
          machine.activeEffects.push(dispose)
        }
      }
    }
  }

  function cleanEffects() {
    const activeEffects = machine.activeEffects
    machine.activeEffects = []
    for (const dispose of activeEffects) {
      dispose()
    }
  }

  function subscribe(onChange) {
    machine.subscriptions.push(onChange)
    return () => {
      machine.subscriptions = machine.subscriptions.filter((s) => s !== onChange)
    }
  }

  if (create) {
    create({ state, transition, immediate, internal })
  }

  const states = Object.keys(machine.states)
  if (states.length > 0) {
    const initial = states[0]
    const initialEvent = { type: null }
    const initialTransition = immediate(initial)
    applyTransition(machine, initialTransition, initialEvent, { silent: true })
  }

  return machine
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

// apply a transition to the machine
function applyTransition(machine, transition, event, { silent = false } = {}) {
  const { get, send } = machine

  machine.cleanEffects()

  const curr = machine.current
  const next = { ...curr }

  const target = transition.target === self ? curr.name : transition.target
  const nextState = machine.states[target]

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

  machine.current = next

  // we do not rerun state level transforms in internal transitions
  if (curr.name !== nextState.name) {
    for (const candidate of nextState.immediates) {
      if (checkGuards(next.context, event, candidate)) {
        applyTransition(machine, candidate, event)
        return
      }
    }

    if (Object.keys(nextState.transitions).length === 0 && nextState.immediates.length === 0) {
      machine.current.final = true
    }

    for (const invoke of nextState.invokes) {
      machine.pendingEffects.push({
        name: nextState.name,
        start: () => promiseEffect(nextState.name, invoke)(get, send),
      })
    }

    for (const effect of nextState.effects) {
      machine.pendingEffects.push({ name: nextState.name, start: () => effect(get, send) })
    }
  }

  if (!silent) {
    for (const sub of machine.subscriptions) {
      sub(machine.current, machine)
    }
  }
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
 * Converts an async function
 * into an effect with 'done'
 * and 'error' events for success
 * and failure
 */
function promiseEffect(name, fn) {
  return (get, send) => {
    Promise.resolve(fn(get().context))
      .then((data) => {
        if (get().name === name) {
          send({ type: 'done', data })
        }
      })
      .catch((error) => {
        if (get().name === name) {
          send({ type: 'error', error })
        }
      })
  }
}
