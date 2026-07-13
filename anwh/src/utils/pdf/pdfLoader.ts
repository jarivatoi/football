// PDF loading and initialization utilities

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export class PDFLoader {
  private pdfjsLib: any = null;

  async initialize(): Promise<void> {
    if (this.pdfjsLib) return;

    try {
      // Load PDF.js dynamically
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      document.head.appendChild(script);

      // Wait for PDF.js to load
      await new Promise((resolve, reject) => {
        script.onload = () => {
          this.pdfjsLib = window.pdfjsLib;
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(undefined);
        };
        script.onerror = reject;
      });
    } catch (error) {
      throw new Error('Failed to load PDF.js library');
    }
  }

  async loadPDF(file: File): Promise<any> {
    await this.initialize();
    const arrayBuffer = await file.arrayBuffer();
    return await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  }

  async extractTextFromPage(page: any): Promise<Array<{text: string, x: number, y: number}>> {
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    
    console.log('📄 Text content info:', {
      itemCount: textContent.items.length,
      hasText: textContent.items.length > 0,
      viewportHeight: viewport.height,
      viewportWidth: viewport.width
    });
    
    // Log first few items for debugging
    if (textContent.items.length > 0) {
      console.log('📄 Sample text items:', textContent.items.slice(0, 5).map((item: any) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5]
      })));
    } else {
      console.warn('⚠️ NO TEXT ITEMS FOUND - This PDF may contain scanned images instead of selectable text');
    }
    
    // Convert text items to structured data with coordinates
    const items = textContent.items.map((item: any) => ({
      text: item.str.trim(),
      x: item.transform[4], // X coordinate
      y: viewport.height - item.transform[5], // Y coordinate (flip Y axis)
    })).filter((item: any) => item.text.length > 0);

    console.log(`📄 Extracted ${items.length} text items from page`);
    return items;
  }
}