declare module "mammoth" {
  interface ExtractRawTextOptions {
    buffer: Uint8Array;
  }

  interface ExtractRawTextResult {
    value: string;
  }

  interface MammothModule {
    extractRawText(
      options: ExtractRawTextOptions
    ): Promise<ExtractRawTextResult>;
  }

  const mammoth: MammothModule;
  export default mammoth;
}

declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
  }

  export default function pdfParse(data: Uint8Array): Promise<PdfParseResult>;
}
