function interpret(machine) {
  const configuration = []
  const statesToInvoke = []
  const internalQueue = []
  const externalQueue = []
  const context = {}

  let running = true

  enterStates([doc.initial.transition])

  mainEventLoop()
}

// function mainEventLoop() {
//   while running:
//       enabledTransitions = null
//       macrostepDone = false
//       # Here we handle eventless transitions and transitions
//       # triggered by internal events until macrostep is complete
//       while running and not macrostepDone:
//           enabledTransitions = selectEventlessTransitions()
//           if enabledTransitions.isEmpty():
//               if internalQueue.isEmpty():
//                   macrostepDone = true
//               else:
//                   internalEvent = internalQueue.dequeue()
//                   datamodel["_event"] = internalEvent
//                   enabledTransitions = selectTransitions(internalEvent)
//           if not enabledTransitions.isEmpty():
//               microstep(enabledTransitions.toList())
//       # either we're in a final state, and we break out of the loop
//       if not running:
//           break
//       # or we've completed a macrostep, so we start a new macrostep by waiting for an external event
//       # Here we invoke whatever needs to be invoked. The implementation of 'invoke' is platform-specific
//       for state in statesToInvoke.sort(entryOrder):
//           for inv in state.invoke.sort(documentOrder):
//               invoke(inv)
//       statesToInvoke.clear()
//       # Invoking may have raised internal error events and we iterate to handle them
//       if not internalQueue.isEmpty():
//           continue
//       # A blocking wait for an external event.  Alternatively, if we have been invoked
//       # our parent session also might cancel us.  The mechanism for this is platform specific,
//       # but here we assume it’s a special event we receive
//       externalEvent = externalQueue.dequeue()
//       if isCancelEvent(externalEvent):
//           running = false
//           continue
//       datamodel["_event"] = externalEvent
//       for state in configuration:
//           for inv in state.invoke:
//               if inv.invokeid == externalEvent.invokeid:
//                   applyFinalize(inv, externalEvent)
//               if inv.autoforward:
//                   send(inv.id, externalEvent)
//       enabledTransitions = selectTransitions(externalEvent)
//       if not enabledTransitions.isEmpty():
//           microstep(enabledTransitions.toList())
//   # End of outer while running loop.  If we get here, we have reached a top-level final state or have been cancelled
//   exitInterpreter()
// }

function selectTransitions(machine, event) {
  const enabledTransitions = []
  const atomicStates = toList(machine).filter(isAtomicState)
  for (const state of atomicStates) {
    for (const s in [state].append(getProperAncestors(state, null))) {
      for (const t of s.transition) {
        if (t.event && nameMatch(t.event, event.type) && guardMatch(t)) {
          enabledTransitions.add(t)
          break // break loop one above...
        }
      }
    }
  }
  enabledTransitions = removeConflictingTransitions(enabledTransitions)
  return enabledTransitions
}

function removeConflictingTransitions(enabledTransitions) {
  const filteredTransitions = []
  // toList sorts the transitions in the order of the states that selected them
  for t1 in enabledTransitions.toList():
      t1Preempted = false
      transitionsToRemove = new OrderedSet()
      for t2 in filteredTransitions.toList():
          if computeExitSet([t1]).hasIntersection(computeExitSet([t2])):
              if isDescendant(t1.source, t2.source):
                  transitionsToRemove.add(t2)
              else: 
                  t1Preempted = true
                  break
      if not t1Preempted:
          for t3 in transitionsToRemove.toList():
              filteredTransitions.delete(t3)
          filteredTransitions.add(t1)
         
  return filteredTransitions
}