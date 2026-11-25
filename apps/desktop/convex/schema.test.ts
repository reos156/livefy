// @vitest-environment node
import { describe, expect, it } from 'vitest'
import schema from './schema'

describe('Clerk-only application schema', () => {
  it('declares the shop table and no legacy Convex Auth table', () => {
    expect(Object.keys(schema.tables)).toEqual(['shops'])
  })
})
