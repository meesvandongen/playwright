# `@mvd/playwright-msw`

[Mock Service Worker](https://mswjs.io) binding for [Playwright](https://playwright.dev/).

This version (`@mvd/playwright-msw`) is a fork with support for multiple pages, (e.g. popups).

## Usage

```ts
// playwright.setup.ts
import { test as testBase } from '@playwright/test'
import { createNetworkFixture, type NetworkFixture } from '@mvd/playwright-msw'
import { handlers } from '../mocks/handlers.js'

interface Fixtures {
  network: NetworkFixture
}

export const test = testBase.extend<Fixtures>({
  // Create a fixture that will control the network in your tests.
  network: createNetworkFixture({
    initialHandlers: handlers,
  }),
})
```

```ts
import { http, HttpResponse } from 'msw'
import { test } from './playwright.setup.js'

test('displays the user dashboard', async ({ network, page }) => {
  // Access the network fixture and use it as the `setupWorker()` API.
  // No more disrupted context between processes.
  network.use(
    http.get('/user', () => {
      return HttpResponse.json({
        id: 'abc-123',
        firstName: 'John',
        lastName: 'Maverick',
      })
    }),
  )

  await page.goto('/dashboard')
})
```
