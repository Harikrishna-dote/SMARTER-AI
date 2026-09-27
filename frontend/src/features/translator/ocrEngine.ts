// OCR engine for camera, images, PDFs, and documents.

import type { OCRResponse, OCRBox, LanguageOption } from '../../lib/types';

export interface OCREngineOptions {
  default_language?: string;
  detect_language?: boolean;
  extract_tables?: boolean;
  extract_handwriting?: boolean;
  enhance_image?: boolean;
}

export class OCREngine {
  private options: OCREngineOptions;
  private processing: boolean = false;
  private abortController: AbortController | null = null;

  constructor(options: OCREngineOptions = {}) {
    this.options = {
      default_language: 'eng',
      detect_language: true,
      extract_tables: true,
      extract_handwriting: true,
      enhance_image: true,
      ...options,
    };
  }

  async processImage(file: File | Blob, options?: { language?: string; enhance?: boolean }): Promise<OCRResponse> {
    if (this.processing) {
      throw new Error('OCR is already processing');
    }

    this.processing = true;
    this.abortController = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', options?.language || this.options.default_language || 'eng');
      formData.append('detect_language', String(this.options.detect_language ?? true));
      formData.append('extract_tables', String(this.options.extract_tables ?? true));
      formData.append('enhance', String(options?.enhance ?? this.options.enhance_image ?? true));

      const response = await fetch('/api/v1/vision/ocr', {
        method: 'POST',
        body: formData,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'OCR failed' }));
        throw new Error(error.detail || 'OCR processing failed');
      }

      const data = await response.json();
      return this.normalizeOCRResult(data);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('OCR was cancelled');
      }
      throw error;
    } finally {
      this.processing = false;
      this.abortController = null;
    }
  }

  async processCameraFrame(
    imageData: ImageData | Blob,
    options?: { language?: string }
  ): Promise<OCRResponse> {
    let blob: Blob;

    if (imageData instanceof Blob) {
      blob = imageData;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      ctx.putImageData(imageData, 0, 0);
      blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve as BlobCallback, 'image/jpeg', 0.9));
    }

    return this.processImage(blob, { language: options?.language });
  }

  async processPDF(file: File): Promise<OCRResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', this.options.default_language || 'eng');
    formData.append('extract_tables', 'true');
    formData.append('pdf', 'true');

    const response = await fetch('/api/v1/vision/ocr', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'PDF OCR failed' }));
      throw new Error(error.detail || 'PDF OCR failed');
    }

    const data = await response.json();
    return this.normalizeOCRResult(data);
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  isProcessing(): boolean {
    return this.processing;
  }

  async detectTextRegions(image: File | Blob): Promise<OCRBox[]> {
    const result = await this.processImage(image);
    return result.boxes;
  }

  async translateSelectedRegion(
    image: File | Blob,
    box: OCRBox,
    targetLanguage: string
  ): Promise<{ original: string; translated: string; box: OCRBox }> {
    const result = await this.processImage(image);
    const selectedBox = result.boxes.find((b) => this.boxContains(b, box)) || box;

    return {
      original: selectedBox.text,
      translated: `[Translated to ${targetLanguage}] ${selectedBox.text}`,
      box: selectedBox,
    };
  }

  private boxContains(outer: OCRBox, inner: OCRBox): boolean {
    return (
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height
    );
  }

  private normalizeOCRResult(data: unknown): OCRResponse {
    const result = data as Record<string, unknown>;
    return {
      text: (result.text as string) || '',
      boxes: (result.boxes as OCRBox[]) || [],
      detected_language: (result.detected_language as string) || 'unknown',
      confidence: (result.confidence as number) || 0,
      processing_time_ms: (result.processing_time_ms as number) || 0,
      word_count: (result.word_count as number) || 0,
    };
  }
}

export const ocrEngine = new OCREngine();
