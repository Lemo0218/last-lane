type Environment = Readonly<Record<string, string | undefined>>

export type RankingSecrets = Readonly<{ ticket: string; ipHash: string }>

export const rankingSecrets = (environment: Environment): RankingSecrets | undefined => {
  const ticket = environment["RUN_TICKET_SECRET"]
  const ipHash = environment["IP_HASH_SECRET"]
  if (ticket === undefined || ipHash === undefined) return undefined
  return { ticket, ipHash }
}
