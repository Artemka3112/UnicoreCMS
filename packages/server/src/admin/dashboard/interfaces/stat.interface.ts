export interface StatGroup {
  date: Date,
  count: number
  amount?: number
}

export interface StatInterface {
  days: StatGroup
  weeks: StatGroup
  mounths: StatGroup
}