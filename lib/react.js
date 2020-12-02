import { useState, useEffect } from 'react'
import { createMachine } from './core'

module.exports.useMachine = useMachine

function useMachine(description, context, options = {}) {
  const machine = useState(() => createMachine(description, context), [])
  const [state, setState] = useState(machine.current)
  const { send } = machine

  const { assign = 'assign' } = options

  useEffect(() => {
    return machine.subscribe(setState)
  }, [machine])

  useEffect(() => {
    send({ type: assign, ...context })
  }, Object.values(context))

  return {
    name: state.name,
    context: state.context,
    send,
  }
}
