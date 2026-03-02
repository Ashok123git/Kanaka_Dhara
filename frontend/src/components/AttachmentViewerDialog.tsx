import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface AttachmentViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  attachments: string[];
  initialIndex?: number;
}

const AttachmentViewerDialog = ({
  isOpen,
  onClose,
  attachments,
  initialIndex = 0,
}: AttachmentViewerDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Reset to initial index when opened
  useState(() => {
    setCurrentIndex(initialIndex);
  });

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
  };

  if (attachments.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-black/95 border-none">
        <VisuallyHidden>
          <DialogTitle>Attachment Viewer</DialogTitle>
        </VisuallyHidden>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Close viewer"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Image container */}
        <div className="flex items-center justify-center h-full w-full px-4">
          <img
            src={attachments[currentIndex]}
            alt={`Attachment ${currentIndex + 1}`}
            className="max-w-full max-h-[85vh] object-contain"
          />
        </div>

        {/* Navigation arrows (show only if multiple attachments) */}
        {attachments.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Indicator dots */}
        {attachments.length > 1 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {attachments.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-white' : 'bg-white/40'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Image counter */}
        <div className="absolute top-4 left-4 text-white/70 text-sm">
          {currentIndex + 1} / {attachments.length}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentViewerDialog;
