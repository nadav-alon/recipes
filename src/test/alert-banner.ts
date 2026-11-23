import { expect } from 'vitest'

/** Asserts the element is household-ui's AlertBanner; the only place that knows its class name. */
export function expectAlertBanner(element: HTMLElement): void {
  expect(element).toHaveClass('ui-alert-banner')
}
