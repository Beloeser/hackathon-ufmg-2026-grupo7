import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..', '..')
const repoRoot = path.resolve(backendRoot, '..')

const FALLBACK_SPAWN_ERROR_CODES = new Set(['ENOENT', 'EACCES', 'EPERM'])

const resolvePythonCandidates = () => {
  const configured = String(process.env.PYTHON_BIN || '').trim()
  if (configured) {
    return [configured]
  }

  if (process.platform === 'win32') {
    return ['python', 'python3', 'py']
  }

  return ['python3', 'python']
}

const buildPythonArgs = ({ pythonBin, pythonPath, scriptArgs }) => {
  if (pythonBin === 'py') {
    return ['-3', pythonPath, ...scriptArgs]
  }

  return [pythonPath, ...scriptArgs]
}

export const runPythonScript = (scriptName, args = []) => {
  return new Promise((resolve, reject) => {
    const pythonPath = path.resolve(backendRoot, 'ml', scriptName)
    const pythonCandidates = resolvePythonCandidates()

    const runAttempt = (index) => {
      const pythonBin = pythonCandidates[index]
      const pythonArgs = buildPythonArgs({
        pythonBin,
        pythonPath,
        scriptArgs: args,
      })
      let python = null
      try {
        python = spawn(pythonBin, pythonArgs, { cwd: repoRoot })
      } catch (spawnError) {
        const shouldFallback =
          index < pythonCandidates.length - 1 &&
          spawnError &&
          FALLBACK_SPAWN_ERROR_CODES.has(String(spawnError.code || ''))

        if (shouldFallback) {
          runAttempt(index + 1)
          return
        }

        reject(spawnError)
        return
      }

      let output = ''
      let error = ''
      let settled = false

      const failOrFallback = (spawnError) => {
        if (settled) return

        const shouldFallback =
          index < pythonCandidates.length - 1 &&
          spawnError &&
          FALLBACK_SPAWN_ERROR_CODES.has(String(spawnError.code || ''))

        if (shouldFallback) {
          settled = true
          runAttempt(index + 1)
          return
        }

        settled = true
        reject(spawnError || new Error(`Falha ao executar script Python '${scriptName}'.`))
      }

      python.stdout.on('data', (data) => {
        output += data.toString()
      })

      python.stderr.on('data', (data) => {
        error += data.toString()
      })

      python.on('error', (spawnError) => {
        failOrFallback(spawnError)
      })

      python.on('close', (code) => {
        if (settled) return

        if (code !== 0) {
          settled = true
          reject(new Error(error || `Script falhou com codigo ${code}`))
          return
        }

        settled = true
        try {
          resolve(JSON.parse(output))
        } catch {
          resolve(output)
        }
      })
    }

    runAttempt(0)
  })
}
