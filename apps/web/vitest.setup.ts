import { vi } from "vitest";

// bun's jsdom integration doesn't provide a complete localStorage implementation
const localStorageStore: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  writable: true,
  value: {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => {
      localStorageStore[key] = value;
    },
    removeItem: (key: string) => {
      delete localStorageStore[key];
    },
    clear: () => {
      for (const key of Object.keys(localStorageStore)) {
        delete localStorageStore[key];
      }
    },
  },
});

// jsdom does not implement ResizeObserver; provide a minimal stub
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverStub,
});

// jsdom does not implement matchMedia; provide a minimal stub
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
