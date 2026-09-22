import { supabase } from "@/integrations/supabase/client";

// O bucket question-images é privado: a imagem só abre com uma URL assinada,
// emitida para quem tem acesso ativo. Este módulo traduz o que está guardado
// em questions.image_url para um endereço que o <img> consegue carregar.

export const BUCKET = "question-images";

/** Uma hora: tempo de sobra para responder a questão, curto para vazar link. */
const VALIDADE_SEGUNDOS = 60 * 60;

/**
 * Caminho do objeto dentro do bucket, ou null se o valor não for uma imagem
 * nossa. Aceita as duas formas que existem no banco:
 *   - caminho puro, gravado depois que o bucket virou privado
 *   - URL pública completa, gravada enquanto o bucket era aberto
 */
export const caminhoNoBucket = (valor: string): string | null => {
  const v = valor.trim();
  if (!v) return null;

  if (!/^https?:\/\//i.test(v)) {
    // Caminho puro. Tolera uma barra à toa e o nome do bucket repetido.
    const limpo = v.replace(/^\/+/, "");
    return limpo.startsWith(`${BUCKET}/`) ? limpo.slice(BUCKET.length + 1) : limpo;
  }

  // URL do Storage do Supabase, pública ou assinada.
  const m = v.match(new RegExp(`/storage/v1/object/(?:public|sign)/${BUCKET}/([^?]+)`));
  if (!m) return null;                    // imagem de fora: fica como está
  return decodeURIComponent(m[1]);
};

/**
 * Endereço para exibir. Devolve o valor intacto quando a imagem é externa
 * (enunciado importado pode apontar para outro servidor), e null quando a
 * assinatura falha — sem acesso, por exemplo.
 */
export async function urlDeExibicao(valor: string | null | undefined): Promise<string | null> {
  if (!valor?.trim()) return null;
  const caminho = caminhoNoBucket(valor);
  if (!caminho) return valor;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, VALIDADE_SEGUNDOS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
