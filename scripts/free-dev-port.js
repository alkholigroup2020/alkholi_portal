// Runs before `npm run dev` (see "predev" in package.json).
// Nuxt silently falls back to a random port when 3000 is busy, so we free it first:
// a leftover dev server of this project is killed, anything else aborts the start.
/* eslint-disable no-console */
const { execSync } = require('child_process')
const path = require('path')

const PORT = 3000
const projectDir = path.resolve(__dirname, '..').toLowerCase()
const isWindows = process.platform === 'win32'

function run(command) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

function pidsListeningOn(port) {
  const pids = isWindows
    ? // no `-p tcp`: that lists IPv4 only, and `localhost` binds to [::1] on recent Node
      run('netstat -ano')
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .filter(
          (cols) =>
            cols[0] === 'TCP' &&
            cols[3] === 'LISTENING' &&
            cols[1].endsWith(`:${port}`)
        )
        .map((cols) => Number(cols[4]))
    : run(`lsof -ti tcp:${port} -sTCP:LISTEN`).split('\n').filter(Boolean).map(Number)
  return [...new Set(pids)].filter((pid) => pid > 0)
}

function commandLineOf(pid) {
  return isWindows
    ? run(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`
      ).trim()
    : run(`ps -o command= -p ${pid}`).trim()
}

function kill(pid) {
  if (isWindows) run(`taskkill /PID ${pid} /T /F`)
  else process.kill(pid, 'SIGTERM')
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

const pids = pidsListeningOn(PORT)
if (pids.length === 0) process.exit(0)

for (const pid of pids) {
  const commandLine = commandLineOf(pid)
  const isOurDevServer =
    commandLine.toLowerCase().includes(projectDir) && commandLine.includes('nuxt')

  if (!isOurDevServer) {
    console.error(
      `\nPort ${PORT} is used by another program (PID ${pid}):\n  ${commandLine || 'unknown'}\n` +
        `Stop it and run "npm run dev" again.\n`
    )
    process.exit(1)
  }

  console.log(`Stopping previous dev server on port ${PORT} (PID ${pid})...`)
  kill(pid)
}

for (let i = 0; i < 20 && pidsListeningOn(PORT).length > 0; i++) sleep(250)

if (pidsListeningOn(PORT).length > 0) {
  console.error(`\nCould not free port ${PORT}. Stop the process using it and try again.\n`)
  process.exit(1)
}
