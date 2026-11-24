// @vitest-environment node
import { describe, expect, it } from 'vitest'
import schema from './schema'

describe('Clerk-only application schema', () => {
  it('declares no application tables, including legacy Convex Auth tables', () => {
    expect(Object.keys(schema.tables)).toEqual([])
  })
})
