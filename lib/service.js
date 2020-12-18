import { createMachine, transition, runEffects as run, cleanEffects as clean } from './core.js'

export function createService(machineDescription, context = {}) {
  const machine = createMachine(machineDescription)

  // initial transition
  const [state, effects] = transition(machine, { name: null, context }, { type: null })

  let cbs = []

  const service = {
    machine,
    state,
    prev: null,
    pendingEffects: effects,
    runningEffects: [],
    send,
    subscribe,
    stop,
  }

  function runEffects() {
    service.runningEffects = clean(service.runningEffects)
    service.runningEffects = run(service.pendingEffects, service.state, service.send)
  }

  function stop() {
    cbs = []
    service.pendingEffects = []
    service.runningEffects = clean(service.runningEffects)
  }

  function subscribe(fn) {
    cbs.push(fn)
    return () => {
      cbs = cbs.filter((f) => f !== fn)
    }
  }

  function send(event) {
    service.prev = service.state
    const [state, effects] = transition(service.machine, service.state, event)
    service.state = state
    if (effects) {
      service.pendingEffects = effects
      runEffects()
    }

    for (const cb of cbs) {
      cb(state)
    }
  }

  return service
}
