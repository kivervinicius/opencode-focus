#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const installScript = path.join(root, "scripts", "install-gnome.sh")
const focusSh = path.join(root, "src", "scripts", "opencode-focus.sh")

const [sub] = process.argv.slice(2)

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: "inherit", shell: false })
}

switch (sub) {
  case "setup": {
    console.log("Instalando a extensão GNOME Shell do opencode-focus...")
    run("bash", [installScript])
    break
  }
  case "status": {
    try {
      execFileSync(focusSh, ["status"], { stdio: "ignore" })
      console.log("Extensão GNOME opencode-focus: ATIVA")
      process.exit(0)
    } catch {
      console.log("Extensão GNOME opencode-focus: INATIVA (rode 'npx opencode-focus setup' + relogin)")
      process.exit(1)
    }
  }
  default: {
    console.log("Uso: opencode-focus <comando>")
    console.log("  setup    instala e habilita a extensão GNOME Shell (exige relogin)")
    console.log("  status   verifica se a extensão GNOME está ativa")
    process.exit(sub ? 2 : 0)
  }
}