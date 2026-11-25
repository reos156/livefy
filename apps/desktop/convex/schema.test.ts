// @vitest-environment node
import { describe, expect, it } from 'vitest'
import schema from './schema'

describe('Clerk-only application schema', () => {
  it('declares the shop table, the three catalogue tables and no legacy Convex Auth table', () => {
    expect(Object.keys(schema.tables)).toEqual(['shops', 'categories', 'paymentMethods', 'dialCodes'])
  })
})