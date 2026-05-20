export class TestCaseGenerator {
  constructor(dslContent) {
    this.dslContent = dslContent
    this.states = []
    this.transitions = []
    this.initialState = null
    this.machineName = 'Unknown'
    this.parse()
  }

  parse() {
    const machineMatch = this.dslContent.match(/machine\s+(\w+)/)
    if (machineMatch) {
      this.machineName = machineMatch[1]
    }

    const initialMatch = this.dslContent.match(/initial:\s*(\w+)/)
    if (initialMatch) {
      this.initialState = initialMatch[1]
    }

    const stateRegex = /state\s+(\w+)\s*\{([^}]*)\}/g
    let match
    while ((match = stateRegex.exec(this.dslContent)) !== null) {
      const stateName = match[1]
      const stateBody = match[2]
      this.states.push(stateName)

      const transitionRegex = /on\s+(\w+)\s*->\s*(\w+)/g
      let transMatch
      while ((transMatch = transitionRegex.exec(stateBody)) !== null) {
        this.transitions.push({
          from: stateName,
          event: transMatch[1],
          to: transMatch[2]
        })
      }
    }
  }

  generateAllPaths(maxDepth = 10) {
    const paths = []
    const visited = new Set()

    const dfs = (currentState, path, visitedTransitions, depth) => {
      if (depth > maxDepth) return
      if (visitedTransitions.size === this.transitions.length) {
        paths.push([...path])
        return
      }

      const outgoingTransitions = this.transitions.filter(t => t.from === currentState)
      for (const transition of outgoingTransitions) {
        const transKey = `${transition.from}:${transition.event}:${transition.to}`
        if (!visitedTransitions.has(transKey)) {
          visitedTransitions.add(transKey)
          path.push(transition.event)
          dfs(transition.to, path, visitedTransitions, depth + 1)
          path.pop()
          visitedTransitions.delete(transKey)
        }
      }

      if (path.length > 0 && visitedTransitions.size > 0) {
        paths.push([...path])
      }
    }

    if (this.initialState) {
      dfs(this.initialState, [], new Set(), 0)
    }

    if (paths.length === 0) {
      return this.generateSimplePaths()
    }

    return this.optimizePaths(paths)
  }

  generateSimplePaths() {
    const paths = []
    for (const state of this.states) {
      const outgoing = this.transitions.filter(t => t.from === state)
      for (const transition of outgoing) {
        paths.push([transition.event])
      }
    }
    return paths
  }

  optimizePaths(paths) {
    const uniquePaths = []
    const seen = new Set()

    for (const path of paths) {
      const key = path.join('->')
      if (!seen.has(key)) {
        seen.add(key)
        uniquePaths.push(path)
      }
    }

    return uniquePaths.sort((a, b) => b.length - a.length)
  }

  generateTransitionCoverageTest() {
    const coverage = new Set()
    const testCases = []
    let currentState = this.initialState

    while (coverage.size < this.transitions.length) {
      const available = this.transitions.filter(
        t => t.from === currentState && !coverage.has(`${t.from}:${t.event}:${t.to}`)
      )

      if (available.length === 0) {
        const anyAvailable = this.transitions.filter(
          t => t.from === currentState
        )
        if (anyAvailable.length > 0) {
          const next = anyAvailable[0]
          testCases.push(next.event)
          currentState = next.to
        } else {
          break
        }
      } else {
        const next = available[0]
        coverage.add(`${next.from}:${next.event}:${next.to}`)
        testCases.push(next.event)
        currentState = next.to
      }
    }

    return testCases
  }

  generateStateCoverageTest() {
    const coveredStates = new Set([this.initialState])
    const testCases = []
    let currentState = this.initialState

    while (coveredStates.size < this.states.length) {
      const outgoing = this.transitions.filter(t => t.from === currentState)
      let found = false

      for (const transition of outgoing) {
        if (!coveredStates.has(transition.to)) {
          testCases.push(transition.event)
          coveredStates.add(transition.to)
          currentState = transition.to
          found = true
          break
        }
      }

      if (!found && outgoing.length > 0) {
        testCases.push(outgoing[0].event)
        currentState = outgoing[0].to
      } else if (!found) {
        break
      }
    }

    return testCases
  }

  generateRoundTripTest() {
    if (!this.initialState) return []

    const testCases = []
    let currentState = this.initialState
    const maxSteps = this.states.length * 3

    for (let i = 0; i < maxSteps; i++) {
      const outgoing = this.transitions.filter(t => t.from === currentState)
      if (outgoing.length === 0) break

      const next = outgoing[Math.floor(Math.random() * outgoing.length)]
      testCases.push(next.event)
      currentState = next.to

      if (currentState === this.initialState && testCases.length > 1) {
        break
      }
    }

    return testCases
  }

  generateAllTestSuites() {
    return {
      machineName: this.machineName,
      initialState: this.initialState,
      states: this.states,
      transitions: this.transitions,
      coverage: {
        transitionCoverage: this.generateTransitionCoverageTest(),
        stateCoverage: this.generateStateCoverageTest(),
        roundTrip: this.generateRoundTripTest(),
        allPaths: this.generateAllPaths()
      },
      statistics: {
        totalStates: this.states.length,
        totalTransitions: this.transitions.length,
        coveragePercent: Math.round(
          (new Set(this.generateTransitionCoverageTest()).size / this.transitions.length) * 100
        )
      }
    }
  }

  generateDSLTestScript(testCaseName, events) {
    const eventList = events.map(e => `    sendEvent("${e}")`).join('\n')
    return `# Test Case: ${testCaseName}
# Machine: ${this.machineName}
# Generated: ${new Date().toISOString()}
# Steps: ${events.length}

test ${testCaseName} {
    initial: ${this.initialState}
    steps: [
${eventList}
    ]
    expected: {
        finalState: "?"
    }
}

# Event sequence: ${events.join(' → ')}`
  }

  generateCompleteTestSuite() {
    const suites = this.generateAllTestSuites()
    const scripts = []

    scripts.push(this.generateDSLTestScript('Transition_Coverage', suites.coverage.transitionCoverage))
    scripts.push(this.generateDSLTestScript('State_Coverage', suites.coverage.stateCoverage))
    scripts.push(this.generateDSLTestScript('Round_Trip', suites.coverage.roundTrip))

    suites.coverage.allPaths.slice(0, 5).forEach((path, index) => {
      scripts.push(this.generateDSLTestScript(`Path_${index + 1}`, path))
    })

    return {
      suites,
      scripts,
      combinedScript: scripts.join('\n\n# ====================================\n\n')
    }
  }

  getStatistics() {
    const suites = this.generateAllTestSuites()
    return suites.statistics
  }
}

export function generateTestCases(dslContent) {
  const generator = new TestCaseGenerator(dslContent)
  return generator.generateCompleteTestSuite()
}

export function getTestStatistics(dslContent) {
  const generator = new TestCaseGenerator(dslContent)
  return generator.getStatistics()
}
