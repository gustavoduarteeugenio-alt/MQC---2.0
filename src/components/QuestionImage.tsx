import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageOff, ZoomIn } from "lucide-react";
import { urlDeExibicao } from "@/lib/imagens";

interface Props {
  /** O que está guardado na questão: caminho no bucket ou URL externa. */
  src: string;
  alt?: string;
  className?: string;
}

/** Imagem da questão, com zoom ao toque. A assinatura da URL acontece aqui,
 *  para quem exibe a questão não precisar saber que o bucket é privado. */
export const QuestionImage = ({ src, alt = "Imagem da questão", className }: Props) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setUrl(null);
    setFalhou(false);
    (async () => {
      const resolvida = await urlDeExibicao(src);
      if (cancelado) return;
      if (resolvida) setUrl(resolvida);
      else setFalhou(true);
    })();
    return () => { cancelado = true; };
  }, [src]);

  if (!src) return null;

  if (falhou) {
    return (
      <div className={`mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-4 text-xs text-muted-foreground ${className ?? ""}`}>
        <ImageOff className="w-4 h-4 shrink-0" />
        Não foi possível carregar a imagem desta questão.
      </div>
    );
  }

  if (!url) {
    return <div className={`mt-3 h-40 animate-pulse rounded-xl border border-border bg-muted ${className ?? ""}`} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative mt-3 block w-full overflow-hidden rounded-xl border border-border bg-muted ${className ?? ""}`}
        aria-label="Ampliar imagem"
      >
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setFalhou(true)}
          className="w-full h-auto max-h-72 object-contain"
        />
        <span className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
          <ZoomIn className="w-3.5 h-3.5" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2 bg-background">
          <img src={url} alt={alt} className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
};
