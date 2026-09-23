import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Claro, escuro ou o que o aparelho estiver usando. "Sistema" é o padrão:
// quem já deixou o celular no escuro à noite ganha o app escuro sem pedir.

const OPCOES = [
  { valor: "light", rotulo: "Claro", Icone: Sun },
  { valor: "dark", rotulo: "Escuro", Icone: Moon },
  { valor: "system", rotulo: "Sistema", Icone: Monitor },
] as const;

export const SeletorDeTema = () => {
  const { theme, setTheme } = useTheme();
  // O tema só é conhecido no cliente; até montar, nenhuma opção fica marcada,
  // senão a primeira pintura mostraria a escolha errada.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  return (
    <div>
      <p className="font-display font-semibold">Aparência</p>
      <p className="text-[11px] text-muted-foreground">
        O modo escuro cansa menos a vista em ambiente com pouca luz.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Aparência do app">
        {OPCOES.map(({ valor, rotulo, Icone }) => {
          const ativo = montado && theme === valor;
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setTheme(valor)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-colors",
                ativo
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              <Icone className="h-4 w-4" />
              <span className="stencil text-[10px]">{rotulo}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
