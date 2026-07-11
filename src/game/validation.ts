export class InvalidGameValueError extends RangeError {
  readonly field: string
  readonly value: number

  constructor(field: string, value: number) {
    super(`${field} must be a non-negative safe integer`)
    this.name = "InvalidGameValueError"
    this.field = field
    this.value = value
  }
}

export const requireNatural = (field: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new InvalidGameValueError(field, value)
  return value
}

export const requireUint32 = (field: string, value: number): number => {
  requireNatural(field, value)
  if (value > 0xffff_ffff) throw new InvalidGameValueError(field, value)
  return value
}

export const requireSafeProduct = (field: string, left: number, right: number): number => {
  const product = left * right
  return requireNatural(field, product)
}

export const requireSafeSum = (field: string, values: readonly number[]): number => {
  let sum = 0
  for (const value of values) sum = requireNatural(field, sum + value)
  return sum
}
