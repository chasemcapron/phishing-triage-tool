/** 'flag' = a scam that should come back Suspicious or High; 'clean' = legitimate, should be "No red flags". */
export type Expect = 'flag' | 'clean'

export interface EvalCase {
  id: string
  category: string
  expect: Expect
  text: string
}
