import { createMachine, transition, runEffects as run, cleanEffects as clean } from './core.js'

export function createService(machineDescription, context = {}, initialData = {}) {
  const machine = createMachine(machineDescription)

  // initial transition
  const initialState = { name: null, data: initialData }
  const initialEvent = { type: null }
  const [state, effects] = transition(machine, context, initialState, initialEvent)

  let cbs = []
  let running = true

  const service = {
    state,
    send,
    context,
    subscribe,
    machine,
    stop,
    pendingEffects: effects || [],
    runningEffects: [],
  }

  function runEffects() {
    service.runningEffects = clean(service.runningEffects)
    service.runningEffects = run(service.pendingEffects, context, service.state, service.send)
  }

  function stop() {
    running = false
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
    if (!running) return

    const [state, effects] = transition(service.machine, context, service.state, event)
    service.state = state
    if (effects) {
      service.pendingEffects = effects
      runEffects()
    }

    for (const cb of cbs) {
      cb(state)
    }
  }

  runEffects()

  return service
}
