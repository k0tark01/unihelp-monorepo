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
                {source.fileUrl ? (
                  <Badge variant="secondary" className="gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    File available
                  </Badge>
                ) : null}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-3 text-sm text-muted-foreground">{source.snippet}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copySnippet(source.snippet)}>
                  Copy snippet
                </Button>
                {source.fileUrl ? (
                  <Button size="sm" variant="default" asChild>
                    <a href={source.fileUrl} target="_blank" rel="noopener noreferrer">
                      <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download file
                    </a>
                  </Button>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}