import { ExternalLink, FileWarning, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PdfViewer({
  load,
  title = 'Resume PDF',
  className,
}: {
  load: () => Promise<Blob>;
  title?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setUrl(null);

    load()
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Could not render the PDF.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className={cn('flex h-[520px] flex-col items-center justify-center gap-3 rounded-2xl border border-ink-200 bg-ink-50', className)}>
        <Loader2 className="size-6 animate-spin text-brand-500" />
        <p className="text-sm text-ink-500">Rendering server PDF…</p>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={cn('flex h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center', className)}>
        <FileWarning className="size-6 text-rose-500" />
        <p className="text-sm font-medium text-rose-800">{error ?? 'PDF unavailable'}</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-ink-200 bg-ink-100', className)}>
      <div className="flex items-center justify-between border-b border-ink-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold text-ink-600">{title}</p>
        <Button variant="ghost" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink /> Open PDF
          </a>
        </Button>
      </div>
      <iframe src={url} title={title} className="h-[760px] w-full bg-white" />
    </div>
  );
}
