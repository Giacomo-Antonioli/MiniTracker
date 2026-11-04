// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], supplies: [], shopItems: [], shopLists: [], paintStock: new Map(), homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE })
})

describe('Supplies', () => {
  it('tracks stock, alerts when low and adds it to the shopping list; Home shows it', async () => {
    await appDb.units.put(createUnit({ customName: 'Squad', groups: [{ count: 1, status: 'built' }] }, { now: 't', newId: () => 'u1' }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Workshop pages' }))
    await user.click(screen.getByRole('button', { name: 'Supplies' }))
    expect(screen.getByText(/No supplies yet/)).toBeInTheDocument()
    const form = screen.getByRole('form', { name: 'New supply' })
    await user.click(within(form).getByRole('button', { name: '+ Add' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('needs a name')
    await user.type(within(form).getByLabelText('Name'), 'Black primer')
    await user.clear(within(form).getByLabelText('How many'))
    await user.type(within(form).getByLabelText('How many'), '2')
    await user.clear(within(form).getByLabelText('Alert at'))
    await user.type(within(form).getByLabelText('Alert at'), '1')
    await user.click(within(form).getByRole('button', { name: '+ Add' }))
    expect(await screen.findByRole('listitem', { name: 'Supply Black primer' })).toBeInTheDocument()
    expect(useStore.getState().shopItems).toEqual([])

    await user.click(screen.getByRole('button', { name: 'One less Black primer' }))
    expect(await screen.findByText('⚠ Low · on shopping list')).toBeInTheDocument()
    expect(useStore.getState().shopItems.map((x) => [x.name, x.sources])).toEqual([['Black primer', ['Running low']]])
    expect(screen.getByRole('button', { name: 'Supplies ⚠1' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'One less Black primer' }))
    expect(useStore.getState().shopItems).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'One more Black primer' }))
    await user.click(screen.getByRole('button', { name: '▸ Black primer' }))
    await user.clear(screen.getByLabelText('Alert level for Black primer'))
    expect(useStore.getState().supplies[0]).toMatchObject({ quantity: 1, lowAt: 0 })

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.queryByRole('region', { name: 'Running low' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Supplies' }))
    await user.click(screen.getByRole('button', { name: 'One less Black primer' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))
    const card = await screen.findByRole('region', { name: 'Running low' })
    expect(card).toHaveTextContent('⚠ Black primer (0 left)Primer · on list')

    await user.click(screen.getByRole('button', { name: 'Supplies ⚠1' }))
    await user.click(screen.getByRole('button', { name: 'Delete Black primer' }))
    expect(screen.getByText(/No supplies yet/)).toBeInTheDocument()
    expect((await appDb.settings.get('supplies'))!.value).toEqual([])
  })

  it('puts a paint marked running low on the shopping list, once', async () => {
    render(<App />)
    await waitFor(() => expect(useStore.getState().ready).toBe(true))
    const stock = { paintId: 'p1', stage: 'in-use', quantity: 1, favourite: false, notes: '', updatedAt: 't' }
    await useStore.getState().saveStock(stock)
    expect(useStore.getState().shopItems).toEqual([])
    await useStore.getState().saveStock({ ...stock, stage: 'low' })
    await useStore.getState().saveStock({ ...stock, stage: 'low', quantity: 2 })
    expect(useStore.getState().shopItems.map((x) => [x.kind, x.refId, x.sources])).toEqual([['paint', 'p1', ['Running low']]])
  })
})
