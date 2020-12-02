module.exports.createMachine = createMachine

// TODO
// - [ ] es6 modules
// - [ ] snowpack "good package mode"
// - [ ] release!
//
// - [ ] invoke
// - [ ] effect
// - [ ] set final: true somewhere
// - [ ] decide if invoke / effect will be options or functions
// - [x] immediate chains
// - [x] immediate chains with invokes/effects (??)
// - [ ] guards
// - [ ] introduce assign: true, assign: { error: null }, assign: data => data2 as a shortcut
// - [ ] why are errors thrown in effect dipose not handled?
// - [ ] add internal() transitions that transition to itself, useful for assign and other bits

const transformerNames = {
  guard: 'guards',
  reduce: 'reducers',
  action: 'actions',
  effect: 'effects',
  invoke: 'invokes',
}

function createMachine(cb, context = {}) {
  const machine = {
    current: { name: null, context },
    states: {},
    subscribe,
    subscriptions: [],
    activeEffects: [],
    pendingEffects: [],
    flushEffects,
    send,
  }

  const api = {
    state,
    transition,
    immediate,
    assign,
  }

  function assign(ctx, { type, ...data }) {
    return { ...ctx, ...data }
  }

  function merge(opts, { only = ['guard', 'reduce', 'action'] } = {}) {
    const merged = {}

    for (const transformer of only) {
      const name = transformerNames[transformer]
      merged[name] = []
    }

    function add(transformer, opt) {
      let bits = opt[transformer] || []
      bits = Array.isArray(bits) ? bits : [bits]
      const name = transformerNames[transformer]
      merged[name] = merged[name].concat(bits)
    }

    for (const opt of opts) {
      for (const type of only) {
        add(type, opt)
      }
    }

    return merged
  }

  function transition(event, target, ...opts) {
    return { type: 'transition', event, target, ...merge(opts) }
  }

  function immediate(target, ...opts) {
    return { type: 'immediate', target, ...merge(opts) }
  }

  function state(name, ...bits) {
    const transitions = {}
    const immediates = []
    const opts = []

    for (const bit of bits) {
      const { type, event } = bit
      if (type === 'transition') {
        if (!transitions[event]) {
          transitions[event] = []
        }
        transitions[event].push(bit)
      } else if (type === 'immediate') {
        immediates.push(bit)
      } else {
        opts.push(bit)
      }
    }

    const node = {
      name,
      transitions,
      immediates,
      ...merge(opts, { only: ['reduce', 'action', 'effect', 'invoke'] }),
    }
    machine.states[name] = node
  }

  function send(event) {
    event = typeof event === 'string' ? { type: event } : event
    // TODO find the right transition, apply, trigger subscribers
    const curr = machine.states[machine.current.name] || {}
    const transitions = curr.transitions || {}
    const candidates = transitions[event.type] || []
    for (const candidate of candidates) {
      if (
        candidate.guards.length &&
        candidate.guards.some((g) => !g(machine.current.context, event))
      ) {
        continue
      }

      // found the transition
      applyTransition(candidate, event)
      break
    }
  }

  function flushEffects() {
    const pendingEffects = machine.pendingEffects
    machine.pendingEffects = []
    for (const effect of pendingEffects) {
      // only run the effects of the current state
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

  function get() {
    return machine.current
  }

  function promiseEffect(name, fn) {
    return (get, send) => {
      Promise.resolve(fn())
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

  function applyTransition(transition, event, { silent = false } = {}) {
    // 1. - [x] update machine.current to the new name
    // 2. - [x] apply reducers
    // 3. - [x] fire actions
    // 4. - [x] apply state reducers
    // 5. - [x] fire state actions
    // 6. - [x] transition immediates
    // 7. - [ ] start invokes and effects
    // 8. - [x] trigger subscribers

    const activeEffects = machine.activeEffects
    machine.activeEffects = []
    for (const dispose of activeEffects) {
      dispose()
    }

    const curr = machine.current
    const next = { ...curr }
    next.name = transition.target

    for (const reduce of transition.reducers) {
      next.context = reduce(next.context, event)
    }

    for (const action of transition.actions) {
      action(next.context, event)
    }

    const nextState = machine.states[next.name]

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
        if (candidate.guards.length && candidate.guards.some((g) => !g(next.context, event))) {
          continue
        }

        // found the transition
        applyTransition(candidate, event)
        return
      }

      if (Object.keys(nextState.transitions).length === 0 && nextState.immediates.length === 0) {
        machine.current.final = true
      }

      for (const invoke of nextState.invokes) {
        machine.pendingEffects.push({
          name: nextState.name,
          start: promiseEffect(nextState.name, invoke),
        })
      }

      for (const effect of nextState.effects) {
        machine.pendingEffects.push({ name: nextState.name, start: () => effect(get, send) })
      }
    }

    for (const sub of machine.subscriptions) {
      sub(machine.current, machine)
    }
  }

  function subscribe(onChange) {
    machine.subscriptions.push(onChange)
    return () => {
      machine.subscriptions = machine.subscriptions.filter((s) => s !== onChange)
    }
  }

  cb(api)

  if (!machine.current.name) {
    const states = Object.keys(machine.states)
    if (states.length > 0) {
      const initial = states[0]
      applyTransition(immediate(initial), { type: null }, { silent: true })
    }
  }

  return machine
}
