import { expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRegistrationAdapter } from './registration'

it('fails closed when the registration adapter is missing', () => {
  expect(() => renderHook(() => useRegistrationAdapter())).toThrow('Registration adapter unavailable')
})
