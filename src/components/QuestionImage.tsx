import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ZoomIn } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

/** Responsive question image with click-to-zoom lightbox. */
export const QuestionImage = ({ src, alt = "Imagem da questão", className }: Props) => {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative mt-3 block w-full overflow-hidden rounded-xl border border-border bg-muted ${className ?? ""}`}
        aria-label="Ampliar imagem"
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-auto max-h-72 object-contain"
        />
        <span className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
          <ZoomIn className="w-3.5 h-3.5" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2 bg-background">
          <img src={src} alt={alt} className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
};
