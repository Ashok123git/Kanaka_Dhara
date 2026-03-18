/**
 * Image compression and utility functions for attachment handling
 */

export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 JPEG with quality compression
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Mutable facade for Cypress stubbing.
 * Use `cy.stub(imageUtilsApi, 'compressImage')` / `cy.stub(imageUtilsApi, 'isImageFile')`.
 */
export const imageUtilsApi = {
  compressImage,
  isImageFile,
  formatFileSize,
};
