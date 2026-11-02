import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// Most UI tests start on the Backlog; the Home tests switch this back.
beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('startPage', 'backlog')
})

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})

// jsdom lacks modal dialogs: emulate showModal/close well enough for tests.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
