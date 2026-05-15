import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils";

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "u", "mark", "sub", "sup"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] || []), "className"],
  },
};

interface Props {
  content: string;
  className?: string;
}

export const RichText = ({ content, className }: Props) => {
  return (
    <div className={cn("rich-text", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          p: ({ node, ...props }) => <span {...props} />,
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
};
