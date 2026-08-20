import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { Event } from "@opencode-ai/sdk/v2"

declare const require: (id: string) => {
  appendFileSync: (path: string, data: string) => void
}
declare const Bun: {
  spawn(command: string[], options?: { stdout?: "ignore"; stderr?: "ignore" }): unknown
  spawnSync(command: string[], options?: { stdout?: "ignore" | "pipe"; stderr?: "ignore" }): {
    stdout?: unknown
  }
}
const nodeFs = require("node:fs")

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

const SCRIPTS = new URL("./scripts/", import.meta.url).pathname
const FOCUS_SCRIPT = `${SCRIPTS}opencode-focus.sh`
const NOTIFY_SCRIPT = `${SCRIPTS}opencode-notify.sh`
const DIAG_LOG = `${typeof process !== "undefined" && process.env.HOME ? process.env.HOME : "."}/.local/share/opencode/log/opencode-focus.log`

function diag(...args: unknown[]) {
  try {
    nodeFs.appendFileSync(DIAG_LOG, `[${new Date().toISOString()}] ${args.join(" ")}\n`)
  } catch {}
}

const OWNER_KEY = "opencode_focus_title_owner"
const HEARTBEAT_MS = 2000
const STALE_MS = 5000

export default {
  id: "opencode-status-title",
  tui: (async (api) => {
    const { renderer, event, state, kv, route, command, lifecycle, attention } = api

    const INSTANCE = `opencode-status-title-${Math.random().toString(36).slice(2, 10)}`
    const PROCESS_ID =
      typeof process !== "undefined" &&
      typeof (process as unknown as { pid?: number }).pid === "number"
        ? (process as unknown as { pid: number }).pid
        : -1

    function acquireTitleLock(): boolean {
      try {
        const owner = kv.get(OWNER_KEY, undefined)
        const now = Date.now()
        if (owner && typeof owner === "object") {
          const rec = owner as { instance?: string; pid?: number; ts?: number }
          if (
            typeof rec.instance === "string" &&
            rec.instance !== INSTANCE &&
            rec.pid === PROCESS_ID &&
            typeof rec.ts === "number" &&
            now - rec.ts < STALE_MS
          ) {
            diag("título já controlado por outra instância:", rec.instance)
            return false
          }
        }
        kv.set(OWNER_KEY, { instance: INSTANCE, pid: PROCESS_ID, ts: now })
        return true
      } catch (err) {
        diag("acquireTitleLock falhou:", String(err))
        return true
      }
    }

    if (!acquireTitleLock()) return

    let heartbeat: ReturnType<typeof setInterval> | undefined
    heartbeat = setInterval(() => {
      try {
        kv.set(OWNER_KEY, { instance: INSTANCE, ts: Date.now() })
      } catch {}
    }, HEARTBEAT_MS)

    if (kv.get("terminal_title_enabled", true)) {
      command?.trigger("terminal.title.toggle")
    }

    let status: "busy" | "idle" | "error" | "waiting" = "idle"
    let spinnerIndex = 0
    let spinnerTimer: ReturnType<typeof setInterval> | undefined
    let windowId = ""
    const notifiedDecisions = new Set<string>()

    const isZellij = Boolean(
      typeof process !== "undefined" &&
        process.env &&
        (process.env.ZELLIJ || process.env.ZELLIJ_SESSION_NAME),
    )
    let lastZellijTitle = ""

    function captureWindowId() {
      try {
        const result = Bun.spawnSync([FOCUS_SCRIPT, "get-active"], {
          stdout: "pipe",
          stderr: "ignore",
        })
        const out = String(result.stdout ?? "").trim()
        if (/^\d+$/.test(out)) windowId = out
      } catch (err) {
        diag("captureWindowId falhou:", String(err))
      }
      diag("windowId capturado:", windowId || "(vazio — extensão GNOME inativa?)")
    }

    function notifyDecision(key: string, body: string) {
      if (notifiedDecisions.has(key)) return
      notifiedDecisions.add(key)
      let out = ""
      try {
        const active = Bun.spawnSync([FOCUS_SCRIPT, "get-active"], {
          stdout: "pipe",
          stderr: "ignore",
        })
        out = String(active.stdout ?? "").trim()
      } catch (err) {
        diag("get-active falhou:", String(err))
      }
      let isFocused = out !== "" && out === windowId
      if (isFocused && isZellij && lastZellijTitle) {
        try {
          const zCheck = Bun.spawnSync([FOCUS_SCRIPT, "is-zellij-tab-focused", lastZellijTitle], {
            stdout: "ignore",
            stderr: "ignore",
          })
          if (
            (zCheck as { exitCode?: number; status?: number }).exitCode !== 0 &&
            (zCheck as { status?: number }).status !== 0
          ) {
            isFocused = false
          }
        } catch {}
      }
      if (isFocused) {
        diag("terminal focado, notificação de decisão suprimida:", key)
        return
      }
      diag("notificando decisão:", key, "| windowId=", windowId || "(vazio)", "| ativo=", out || "(sem extensão)")
      const title = "opencode · precisa de você"
      try {
        attention?.notify({
          title,
          message: body,
        }).catch(() => {})
      } catch (err) {
        diag("attention.notify falhou:", String(err))
      }
      try {
        Bun.spawn([NOTIFY_SCRIPT, title, body, "normal", windowId, lastZellijTitle], {
          stdout: "ignore",
          stderr: "ignore",
        })
      } catch (err) {
        diag("spawn do notify falhou:", String(err))
      }
    }

    function truncate(text: string, max: number) {
      const t = text.trim().replace(/\s+/g, " ")
      return t.length > max ? t.slice(0, max) + "…" : t
    }

    function currentSessionID(): string | undefined {
      const current = route.current
      if (current?.name !== "session") return undefined
      const id = current.params?.sessionID
      return typeof id === "string" ? id : undefined
    }

    function sessionTitle(): string {
      const sessionID = currentSessionID()
      const session = sessionID ? state.session.get(sessionID) : undefined
      if (session?.title && !session.title.startsWith("New session")) return session.title
      return sessionID ?? "opencode"
    }

    function waitingReason(): string | undefined {
      const sessionID = currentSessionID()
      if (!sessionID) return undefined
      if (state.session.permission(sessionID).length > 0) return "permissão"
      if (state.session.question(sessionID).length > 0) return "sua resposta"
      return undefined
    }

    function derivedStatus(): typeof status {
      const sessionID = currentSessionID()
      if (sessionID) {
        if (state.session.permission(sessionID).length > 0) return "waiting"
        if (state.session.question(sessionID).length > 0) return "waiting"
        const s = state.session.status(sessionID)
        if (s?.type === "busy" || s?.type === "retry") return "busy"
      }
      return "idle"
    }

    function render() {
      const sessionID = currentSessionID()
      const session = sessionID ? state.session.get(sessionID) : undefined
      const base = session?.title && !session.title.startsWith("New session") ? session.title : "opencode"

      let prefix = "✓"
      if (status === "busy") prefix = SPINNER[spinnerIndex]
      else if (status === "error") prefix = "✗"
      else if (status === "waiting") prefix = "◉"

      const parts = [`${prefix} ${truncate(base, 40)}`]
      if (status === "waiting") {
        const reason = waitingReason()
        parts.push(`⏸ esperando ${reason ?? "decisão"}`)
      }
      if (sessionID) {
        const todo = state.session.todo(sessionID).find((item) => item.status === "in_progress")
        if (todo) parts.push(`▶ ${truncate(todo.content, 40)}`)
      }
      const titleText = truncate(parts.join(" · "), 90)
      renderer.setTerminalTitle(titleText)
      if (isZellij && titleText !== lastZellijTitle) {
        lastZellijTitle = titleText
        try {
          Bun.spawn([FOCUS_SCRIPT, "rename-zellij-tab", titleText], {
            stdout: "ignore",
            stderr: "ignore",
          })
        } catch (err) {
          diag("zellij rename-tab spawn falhou:", String(err))
        }
      }
    }

    function startSpinner() {
      if (spinnerTimer) return
      spinnerIndex = 0
      spinnerTimer = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % SPINNER.length
        render()
      }, 120)
    }

    function stopSpinner() {
      if (spinnerTimer) {
        clearInterval(spinnerTimer)
        spinnerTimer = undefined
      }
    }

    function setStatus(next: typeof status) {
      status = next
      if (next === "busy") startSpinner()
      else stopSpinner()
      render()
    }

    const on = <Type extends Event["type"]>(
      type: Type,
      handler: (event: Extract<Event, { type: Type }>) => void,
    ) => event.on(type, handler)

    on("session.status", () => setStatus(derivedStatus()))
    on("session.idle", () => setStatus(derivedStatus()))
    on("session.error", () => setStatus("error"))
    on("todo.updated", () => render())
    on("session.created", () => render())
    on("session.updated", () => render())
    on("session.deleted", () => render())
    on("permission.asked", (e) => {
      setStatus("waiting")
      notifyDecision(
        `permission:${e.properties.id}`,
        `${sessionTitle()}\nPermissão: ${truncate(e.properties.permission, 160)}`,
      )
    })
    on("permission.replied", () => setStatus(derivedStatus()))
    on("question.asked", (e) => {
      setStatus("waiting")
      const question = e.properties.questions[0]?.question ?? "pergunta pendente"
      notifyDecision(`question:${e.properties.id}`, `${sessionTitle()}\n${truncate(question, 200)}`)
    })
    on("question.replied", () => setStatus(derivedStatus()))
    on("question.rejected", () => setStatus(derivedStatus()))

    lifecycle.onDispose(() => {
      stopSpinner()
      renderer.setTerminalTitle("")
      if (isZellij) {
        try {
          Bun.spawnSync([FOCUS_SCRIPT, "undo-rename-zellij-tab"], {
            stdout: "ignore",
            stderr: "ignore",
          })
        } catch {}
      }
      if (heartbeat) clearInterval(heartbeat)
      try {
        const owner = kv.get(OWNER_KEY, undefined)
        if (owner && typeof owner === "object" && (owner as { instance?: string }).instance === INSTANCE) {
          kv.set(OWNER_KEY, undefined)
        }
      } catch {}
    })

    captureWindowId()
    render()
  }),
} satisfies TuiPluginModule