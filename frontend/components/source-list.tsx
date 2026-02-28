"use client";

import { toast } from "sonner";
import { RetrievalSource } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SourceListProps = {
  sources: RetrievalSource[];
};

export function SourceList({ sources }: SourceListProps) {
  const copySnippet = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Snippet copied");
    } catch {
      toast.error("Could not copy snippet");
    }
  };

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">Sources</p>
      <Accordion type="multiple" className="w-full">
        {sources.map((source) => (
          <AccordionItem key={source.chunkId} value={source.chunkId}>
            <AccordionTrigger>
              <div className="flex w-full flex-wrap items-center gap-2 text-left">
                <span className="font-medium">{source.docTitle}</span>
                {source.page ? <Badge variant="secondary">Page {source.page}</Badge> : null}
                {typeof source.confidence === "number" ? (
                  <Badge variant="outline">Confidence {(source.confidence * 100).toFixed(0)}%</Badge>
                ) : null}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-2 text-sm text-muted-foreground">{source.snippet}</p>
              <Button size="sm" variant="outline" onClick={() => copySnippet(source.snippet)}>
                Copy snippet
              </Button>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}