import { useProfile } from "./useProfile";

/**
 * Recursos liberados pelo plano Premium.
 * Centraliza as regras para que toda a UI consulte um único ponto.
 */
export const usePremiumFeatures = () => {
  const { isPremium, loading } = useProfile();

  return {
    loading,
    isPremium,
    // Treino
    unlimitedQuestions: isPremium,
    // Anúncios
    showAds: !isPremium,
    // Gabarito comentado completo (básicos veem só a letra correta)
    fullExplanations: isPremium,
    // Simulados completos no estilo IDECAN
    canRunSimulado: isPremium,
    // Estatísticas avançadas no Dashboard
    advancedStats: isPremium,
  };
};
