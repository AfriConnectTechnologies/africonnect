declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string | Buffer | ArrayBuffer | ArrayBufferView);
    window: Window & typeof globalThis;
  }
}
