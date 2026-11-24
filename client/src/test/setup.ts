import { JSDOM } from "jsdom";

if (typeof document === "undefined") {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");

  Object.defineProperties(window.HTMLElement.prototype, {
    attachEvent: {
      configurable: true,
      value: () => undefined,
    },
    detachEvent: {
      configurable: true,
      value: () => undefined,
    },
  });

  Object.assign(globalThis, {
    document: window.document,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    InputEvent: window.InputEvent,
    HTMLElement: window.HTMLElement,
    HTMLImageElement: window.HTMLImageElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLCollection: window.HTMLCollection,
    NodeList: window.NodeList,
    navigator: window.navigator,
    window,
  });
}
