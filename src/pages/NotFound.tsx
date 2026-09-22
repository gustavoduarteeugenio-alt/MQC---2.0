import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: rota inexistente:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center bg-gradient-dark px-8 text-center text-white">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-brand shadow-brand">
        <Compass className="h-10 w-10 text-white" strokeWidth={2.5} />
      </div>
      <p className="stencil text-xs text-primary">Erro 404</p>
      <h1 className="mt-1 font-display text-2xl font-bold">Esta página não existe</h1>
      <p className="mt-2 max-w-xs text-sm text-white/70">
        O endereço que você acessou não faz parte do app. Pode ter sido um link antigo
        ou um erro de digitação.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-gradient-brand px-6 py-3 font-display stencil text-sm text-white shadow-brand"
      >
        Voltar ao início
      </Link>
    </div>
  );
};

export default NotFound;
