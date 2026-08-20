import type { Plugin, PluginInput, PluginModule } from "@opencode-ai/plugin"

declare const Bun: {
  spawnSync(command: string[], options?: { stdout?: "ignore" | "pipe"; stderr?: "ignore" }): {
    stdout?: unknown
  }
  spawn(command: string[], options?: { stdout?: "ignore"; stderr?: "ignore" }): unknown
}

declare const require: (id: string) => {
  appendFileSync: (path: string, data: string) => void
}
const nodeFs = require("node:fs")

const SCRIPTS = new URL("./scripts/", import.meta.url).pathname
const FOCUS_SCRIPT = `${SCRIPTS}opencode-focus.sh`
const NOTIFY_SCRIPT = `${SCRIPTS}opencode-notify.sh`
const DIAG_LOG = `${typeof process !== "undefined" && process.env.HOME ? process.env.HOME : "."}/.local/share/opencode/log/opencode-focus.log`

function diag(...args: unknown[]) {
  try {
    nodeFs.appendFileSync(DIAG_LOG, `[${new Date().toISOString()}] ${args.join(" ")}\n`)
  } catch {}
}

const titles = new Map<string, string>()
const directories = new Map<string, string>()
const notified = new Set<string>()
const errorMessages = new Set<string>()

let windowId = ""
let zellijTabId = ""

/** true se o terminal (e aba do Zellij, se aplicável) deste opencode está com foco agora. */
function terminalIsFocused(): boolean {
  try {
    const result = Bun.spawnSync([FOCUS_SCRIPT, "get-active"], {
      stdout: "pipe",
      stderr: "ignore",
    })
    const out = String(result.stdout ?? "").trim()
    const windowFocused = out !== "" && out === windowId
    if (!windowFocused) return false

    if (zellijTabId) {
      const zellijCheck = Bun.spawnSync([FOCUS_SCRIPT, "is-zellij-tab-focused", zellijTabId], {
        stdout: "ignore",
        stderr: "ignore",
      })
      if (
        (zellijCheck as { exitCode?: number; status?: number }).exitCode !== 0 &&
        (zellijCheck as { status?: number }).status !== 0
      ) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

function notify(summary: string, body: string, urgency: "low" | "normal" | "critical" = "normal") {
  if (terminalIsFocused()) {
    diag("terminal focado, notificação suprimida:", summary)
    return
  }
  try {
    Bun.spawn([NOTIFY_SCRIPT, summary, body, urgency, windowId, zellijTabId], {
      stdout: "ignore",
      stderr: "ignore",
    })
    diag("notificação enviada:", summary)
  } catch (err) {
    diag("spawn do notify falhou:", String(err))
  }
}

function short(text: string, max: number) {
  const t = text.trim().replace(/\s+/g, " ")
  return t.length > max ? t.slice(0, max) + "…" : t
}

function errorMessage(error: { data?: { message?: string } } | undefined) {
  return error?.data?.message ?? "erro desconhecido"
}

async function sessionTitle(client: PluginInput["client"], sessionID: string): Promise<string> {
  const cached = titles.get(sessionID)
  if (cached) return cached
  try {
    const result = await client.session.get({ path: { id: sessionID } })
    const session = result.data
    if (session?.title) titles.set(sessionID, session.title)
    if (session?.directory) directories.set(sessionID, session.directory)
    if (session?.title) return session.title
  } catch {}
  return `sessão ${sessionID.slice(0, 6)}`
}

async function bodyFor(client: PluginInput["client"], sessionID: string): Promise<string> {
  const title = await sessionTitle(client, sessionID)
  const dir = directories.get(sessionID)
  return dir ? `${title}\n${short(dir, 120)}` : title
}

function captureWindowId() {
  try {
    const result = Bun.spawnSync([FOCUS_SCRIPT, "get-active"], {
      stdout: "pipe",
      stderr: "ignore",
    })
    const out = String(result.stdout ?? "").trim()
    if (/^\d+$/.test(out)) windowId = out
  } catch {}
}

function captureZellijTabId() {
  try {
    const result = Bun.spawnSync([FOCUS_SCRIPT, "get-zellij-tab-id"], {
      stdout: "pipe",
      stderr: "ignore",
    })
    const out = String(result.stdout ?? "").trim()
    if (out) zellijTabId = out
  } catch {}
}

function extensionStatus() {
  try {
    const result = Bun.spawnSync([FOCUS_SCRIPT, "status"], {
      stdout: "ignore",
      stderr: "ignore",
    })
    return (result as { status?: number }).status === 0
  } catch {
    return false
  }
}

const server: Plugin = async ({ client }) => {
  captureWindowId()
  captureZellijTabId()
  if (!extensionStatus()) {
    diag("extensão GNOME opencode-focus ausente — supressão por foco desativada. Instale com: npx opencode-focus setup")
  }
  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.created":
        case "session.updated": {
          const info = event.properties.info
          if (info?.id && info?.title) titles.set(info.id, info.title)
          if (info?.id && info?.directory) directories.set(info.id, info.directory)
          break
        }
        case "session.idle": {
          const sessionID = event.properties.sessionID
          const key = `complete:${sessionID}`
          if (notified.has(key)) break
          notified.add(key)
          notify("opencode · tarefa concluída", await bodyFor(client, sessionID))
          break
        }
        case "message.updated": {
          const info = event.properties.info
          if (info.role !== "assistant" || !info.error) break
          const key = `${info.sessionID}:${info.id}`
          if (errorMessages.has(key)) break
          errorMessages.add(key)
          notify("opencode · erro", `${await bodyFor(client, info.sessionID)}\n${short(errorMessage(info.error), 300)}`, "critical")
          break
        }
        case "session.error": {
          const sessionID = event.properties.sessionID ?? ""
          notify("opencode · erro de sessão", `${await bodyFor(client, sessionID)}\n${short(errorMessage(event.properties.error), 300)}`, "critical")
          break
        }
        case "session.status": {
          if (event.properties.status.type === "retry") {
            notify(
              "opencode · retry",
              `${await bodyFor(client, event.properties.sessionID)}\n${short(event.properties.status.message, 200)}`,
              "low",
            )
          }
          break
        }
      }
    },
  }
}
export default {
  id: "opencode-focus-server",
  server,
} satisfies PluginModule