const BLOCKED = ["admin", "moderator", "nigger", "fuck"] as const

export class NicknameError extends Error {
  constructor() {
    super("invalid nickname")
    this.name = "NicknameError"
  }
}

export const normalizeNickname = (input: string): string => {
  const value = input.normalize("NFKC").replace(/\s+/gu, " ").trim()
  const length = [...value].length
  const folded = value.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, "")
  if (length < 1 || length > 16 || BLOCKED.some((word) => folded.includes(word)))
    throw new NicknameError()
  return value
}
