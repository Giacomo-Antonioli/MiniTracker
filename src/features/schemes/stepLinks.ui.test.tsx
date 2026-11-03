// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { PaintScheme } from '../../domain/schemes/types'
import { RecipeCard } from './RecipeCard'
import { SchemeView } from './SchemeView'

const scheme = {
  id: 'lib/x', name: 'Library', description: '', origin: 'community', stage: 'final', tags: [], tips: '', tutorials: [], createdAt: '', updatedAt: '',
  sections: [{ id: 's', area: 'Armour', steps: [{ id: 't', technique: 'basecoat', paints: [], note: '', links: [{ url: 'https://youtu.be/abc' }, { url: 'javascript:alert(1)', title: 'bad' }, { url: 'https://x.io/v', title: 'Video' }] }] }],
} as unknown as PaintScheme

it('shows only http(s) step links as links, in the view and on the card', () => {
  render(<SchemeView scheme={scheme} onOpen={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('link', { name: '▶ youtu.be' })).toHaveAttribute('href', 'https://youtu.be/abc')
  expect(screen.getByRole('link', { name: '▶ Video' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: /bad/ })).toBeNull()
  expect(screen.getByText('bad')).toBeTruthy()
  render(<RecipeCard scheme={scheme} onDone={() => {}} />)
  expect(screen.getAllByText(/▶ Video: https:\/\/x.io\/v/).length).toBeGreaterThan(0)
})
