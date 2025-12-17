import type {
  BrowserContext,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestFixture,
} from "@playwright/test";
import {
  type LifeCycleEventsMap,
  SetupApi,
  RequestHandler,
  WebSocketHandler,
  getResponse,
} from "msw";

export interface CreateNetworkFixtureArgs {
  initialHandlers: Array<RequestHandler | WebSocketHandler>;
}

/**
 * Creates a fixture that controls the network in your tests.
 *
 * @note The returned fixture already has the `auto` option set to `true`.
 *
 * **Usage**
 * ```ts
 * import { test as testBase } from '@playwright/test'
 * import { createNetworkFixture, type WorkerFixture } from '@msw/playwright'
 *
 * interface Fixtures {
 *  network: WorkerFixture
 * }
 *
 * export const test = testBase.extend<Fixtures>({
 *   network: createNetworkFixture()
 * })
 * ```
 */
export function createNetworkFixture(
  args?: CreateNetworkFixtureArgs,
  /** @todo `onUnhandledRequest`? */
): [
  TestFixture<
    NetworkFixture,
    PlaywrightTestArgs & PlaywrightTestOptions & PlaywrightWorkerArgs & PlaywrightWorkerOptions
  >,
  { auto: boolean },
] {
  return [
    async ({ context, baseURL }, use) => {
      const worker = new NetworkFixture({
        context,
        initialHandlers: args?.initialHandlers || [],
        baseUrl: baseURL || undefined,
      });

      await worker.start();
      await use(worker);
      await worker.stop();
    },
    { auto: true },
  ];
}

export class NetworkFixture extends SetupApi<LifeCycleEventsMap> {
  #context: BrowserContext;
  #baseUrl?: string;

  constructor(args: {
    context: BrowserContext;
    initialHandlers: Array<RequestHandler | WebSocketHandler>;
    baseUrl?: string;
  }) {
    super(...args.initialHandlers);
    this.#context = args.context;
    this.#baseUrl = args.baseUrl;
  }

  public async start() {
    // Handle HTTP requests.
    await this.#context.route(/.+/, async (route, request) => {
      const fetchRequest = new Request(request.url(), {
        method: request.method(),
        headers: new Headers(await request.allHeaders()),
        body: request.postDataBuffer(),
      });

      const response = await getResponse(
        this.handlersController.currentHandlers().filter((handler) => {
          return handler instanceof RequestHandler;
        }),
        fetchRequest,
        {
          baseUrl: this.getPageUrl(),
        },
      );

      if (response) {
        if (response.status === 0) {
          route.abort();
          return;
        }

        route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: response.body ? Buffer.from(await response.arrayBuffer()) : undefined,
        });
        return;
      }

      route.continue();
    });
  }

  public async stop() {
    super.dispose();
    await this.#context.unroute(/.+/);
  }

  private getPageUrl(): string | undefined {
    const url = this.#baseUrl;
    return url !== "about:blank" ? url : undefined;
  }
}
