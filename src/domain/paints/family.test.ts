import { expect, it } from 'vitest'
import { colourFamily } from './family'

it('names the colour family of a hex colour', () => {
  expect(colourFamily('#000000')).toBe('black')
  expect(colourFamily('#ffffff')).toBe('white')
  expect(colourFamily('#808080')).toBe('grey')
  expect(colourFamily('#c01010')).toBe('red')
  expect(colourFamily('#e07010')).toBe('orange')
  expect(colourFamily('#e0d020')).toBe('yellow')
  expect(colourFamily('#20a030')).toBe('green')
  expect(colourFamily('#20a0a0')).toBe('teal')
  expect(colourFamily('#2040c0')).toBe('blue')
  expect(colourFamily('#7020c0')).toBe('purple')
  expect(colourFamily('#e040a0')).toBe('pink')
  expect(colourFamily('#5a3a1a')).toBe('brown')
  expect(colourFamily('#e0d0b0')).toBe('bone')
  expect(colourFamily('#f2aa82')).toBe('skin')
  expect(colourFamily('#d1928d')).toBe('skin')
  expect(colourFamily('#123456', 'metallic')).toBe('metallic')
})
