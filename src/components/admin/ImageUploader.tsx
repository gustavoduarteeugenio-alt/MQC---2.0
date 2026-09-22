import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { BUCKET, urlDeExibicao } from "@/lib/imagens";

interface Props {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder?: string;
  label?: string;
}

export const ImageUploader = ({ value, onChange, folder = "questions", label }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // A pré-visualização também precisa da URL assinada.
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setPreview(null);
    if (!value) return;
    urlDeExibicao(value).then((u) => { if (!cancelado) setPreview(u); });
    return () => { cancelado = true; };
  }, [value]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB).");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    // Guardamos o caminho, não uma URL: o bucket é privado e o endereço de
    // exibição é assinado na hora de mostrar, com validade curta.
    onChange(path);
    setUploading(false);
    toast.success("Imagem enviada.");
  };

  const remove = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {label && <p className="stencil text-[10px]">{label}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
          {preview
            ? <img src={preview} alt="Pré-visualização" className="w-full h-auto max-h-56 object-contain" />
            : <div className="h-40 animate-pulse bg-muted" />}
          <button
            type="button"
            onClick={remove}
            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-md"
            aria-label="Remover imagem"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-20 border-dashed flex flex-col gap-1"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              <span className="text-xs">Selecionar imagem (opcional)</span>
            </>
          )}
        </Button>
      )}
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5 mr-1" /> Trocar imagem
        </Button>
      )}
    </div>
  );
};
