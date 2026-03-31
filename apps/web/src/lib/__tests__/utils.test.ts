import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('spaja klase', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('uklanja duplikate Tailwind klasa', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('ignoriše false/null/undefined', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('podržava uslovne klase', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('vraća prazan string za prazne argumente', () => {
    expect(cn()).toBe('')
  })
})
