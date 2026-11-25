// @vitest-environment node
import { describe, expect, it } from 'vitest'
import schema from './schema'

// The stored shape is the contract the screens and the migration read, so the test
// asserts the field names a document may carry instead of the values it holds.
function fieldNames(table: 'shops' | 'paymentMethods') {
  const { fields } = schema.tables[table].validator as unknown as { fields: Record<string, unknown> }
  return Object.keys(fields).sort()
}

describe('Clerk-only application schema', () => {
  it('declares the shop table, the three catalogue tables and no legacy Convex Auth table', () => {
    expect(Object.keys(schema.tables)).toEqual(['shops', 'categories', 'paymentMethods', 'dialCodes'])
  })
})

describe('stored shapes the configuration screen depends on', () => {
  it('holds one datum per accepted payment method on the shop and no single Bre-B key', () => {
    expect(fieldNames('shops')).toEqual([
      'categorySlugs',
      'description',
      'name',
      'ownerId',
      'paymentData',
      'paymentMethodSlugs',
      'tiktokBotHandle',
      'updatedAt',
      'whatsapp',
      'whatsappBotNumber',
      'wizardCompletedAt',
    ])
  })

  it('describes each payment method datum with its kind, label and hint', () => {
    expect(fieldNames('paymentMethods')).toEqual([
      'dataHint',
      'dataKind',
      'dataLabel',
      'description',
      'label',
      'order',
      'slug',
    ])
  })
})