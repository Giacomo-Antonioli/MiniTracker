// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { StorageGuide } from './StorageGuide'

it('works out the hole size and the cells for a tray', async () => {
  const user = userEvent.setup()
  render(<StorageGuide />)
  expect(screen.getByRole('status').textContent).toContain('33.5 mm')
  expect(screen.getByRole('status').textContent).toContain('28 cells')
  await user.selectOptions(screen.getByLabelText('Base (mm)'), '50')
  expect(screen.getByRole('status').textContent).toContain('51.5 mm')
})
