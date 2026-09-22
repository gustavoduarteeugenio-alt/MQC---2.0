import { useExam } from "@/contexts/ExamContext";
import { examLabel } from "@/lib/exams";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsUpDown } from "lucide-react";

/**
 * Troca o concurso ativo. Só aparece para quem tem mais de uma matrícula —
 * com uma só, o rótulo do edital já é mostrado pela própria tela.
 */
export const ExamSwitcher = ({ className = "" }: { className?: string }) => {
  const { enrollments, exam, setExam } = useExam();
  if (enrollments.length < 2 || !exam) return null;

  return (
    <Select value={exam.id} onValueChange={setExam}>
      <SelectTrigger
        aria-label="Trocar de concurso"
        className={`h-8 w-auto gap-1.5 border-white/20 bg-white/10 px-2.5 text-[11px] text-white stencil ${className}`}
      >
        <SelectValue />
        <ChevronsUpDown className="h-3 w-3 opacity-70" />
      </SelectTrigger>
      <SelectContent>
        {enrollments.map(({ exam: e }) => (
          <SelectItem key={e.id} value={e.id} className="text-xs">
            {examLabel(e)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
