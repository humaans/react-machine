import { useState, useEffect } from 'react'
import { createMachine } from './core'

module.exports.useMachine = useMachine

function useMachine(description, context, options = {}) {
  const { assign = 'assign' } = options

  const machine = useState(() => createMachine(description, context), [])
  const [state, setState] = useState(machine.current)
  const send = machine.send

  useEffect(() => {
    return machine.subscribe(setState(current))
  }, [machine])

  useEffect(() => {
    send({ type: assign, ...context })
  }, Object.values(context))

  useEffect(() => {
    machine.flushEffects()
  }, [state])

  useEffect(() => {
    return () => {
      machine.cleanEffects()
    }
  }, [])

  return {
    name: state.name,
    context: state.context,
    send,
  }
}
