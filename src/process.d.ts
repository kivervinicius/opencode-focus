declare const process: {
  env: Record<string, string | undefined>
  stdout?: { write: (str: string) => void }
}