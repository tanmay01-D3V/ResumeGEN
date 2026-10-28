import { cn } from '@/lib/utils';
import type { ResumeDocument } from '@shared/types';

function contactLine(contact: ResumeDocument['contact']): string[] {
  return [contact.location, contact.phone, contact.email].filter(Boolean);
}

export function ResumePreview({
  document,
  className,
}: {
  document: ResumeDocument;
  className?: string;
}) {
  const classic = document.template === 'classic';
  const compact = document.template === 'compact';
  const centered = classic;

  return (
    <div className={cn('overflow-x-auto', className)}>
      <article
        data-testid="resume-preview"
        className={cn(
          'resume-sheet mx-auto flex min-h-[1123px] w-[794px] flex-col bg-white text-ink-900 shadow-[0_10px_40px_-12px_rgb(15_23_42_/_0.25)] ring-1 ring-ink-200',
          compact ? 'px-[48px] pb-[52px] pt-[40px]' : 'px-[56px] pb-[56px] pt-[44px]',
          classic ? 'font-serif' : 'font-sans',
        )}
      >
        <header className={cn(centered ? 'text-center' : 'text-left')}>
          <h1
            className={cn(
              'font-bold leading-tight tracking-[-0.01em] text-slate-900',
              compact ? 'text-[24px]' : 'text-[27px]',
            )}
          >
            {document.name || 'Candidate'}
          </h1>
          {document.headline ? (
            <p className={cn('mt-1 text-slate-600', compact ? 'text-[11px]' : 'text-[12.5px]')}>
              {document.headline}
            </p>
          ) : null}
          {contactLine(document.contact).length ? (
            <p className={cn('mt-1 text-slate-600', compact ? 'text-[10px]' : 'text-[11px]')}>
              {contactLine(document.contact).join('  •  ')}
            </p>
          ) : null}
          {document.contact.links.length ? (
            <p className={cn('mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-blue-700', centered && 'justify-center', compact ? 'text-[10px]' : 'text-[11px]')}>
              {document.contact.links.map((link) => (
                <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  {link.label}
                </a>
              ))}
            </p>
          ) : null}
          <div className="mt-3 border-t border-slate-300" />
        </header>

        {document.summary ? (
          <section className={compact ? 'mt-3.5' : 'mt-4'}>
            <SectionTitle compact={compact}>Professional Summary</SectionTitle>
            <p className={cn('mt-1.5 leading-[1.5] text-slate-800', compact ? 'text-[10.5px]' : 'text-[11px]')}>
              {document.summary}
            </p>
          </section>
        ) : null}

        {document.sections
          .filter((section) => section.key !== 'summary')
          .map((section) => {
            const items = section.items.filter(
              (item) => item.heading || item.subheading || item.bullets.length || item.links.length,
            );
            if (!items.length) return null;
            return (
              <section key={section.key} className={compact ? 'mt-3.5' : 'mt-4'}>
                <SectionTitle compact={compact}>{section.title}</SectionTitle>
                <div className={compact ? 'mt-1.5 space-y-2' : 'mt-2 space-y-2.5'}>
                  {items.map((item, index) => (
                    <div key={`${section.key}-${item.recordId || index}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        {item.heading ? (
                          <h3 className={cn('font-bold text-slate-900', compact ? 'text-[11px]' : 'text-[11.5px]')}>
                            {item.heading}
                          </h3>
                        ) : null}
                        {item.meta ? (
                          <span className={cn('text-slate-500', compact ? 'text-[9.5px]' : 'text-[10px]')}>
                            {item.meta}
                          </span>
                        ) : null}
                      </div>
                      {item.subheading ? (
                        <p className={cn('italic text-slate-600', compact ? 'text-[9.8px]' : 'text-[10.5px]')}>
                          {item.subheading}
                        </p>
                      ) : null}
                      {item.bullets.length ? (
                        <ul className={cn('mt-1 list-disc space-y-0.5 pl-4 leading-[1.45] text-slate-800', compact ? 'text-[10px]' : 'text-[10.5px]')}>
                          {item.bullets.map((bullet, bulletIndex) => (
                            <li key={`${item.recordId}-${bulletIndex}`}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                      {item.links.length ? (
                        <p className={cn('mt-1 flex flex-wrap gap-x-3 text-blue-700', compact ? 'text-[9.5px]' : 'text-[10px]')}>
                          {item.links.map((link) => (
                            <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                              {link.label}
                            </a>
                          ))}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

        <footer className="mt-auto border-t border-slate-200 pt-2 text-center text-[8px] text-slate-500">
          {document.name || 'Resume'} · Preview
        </footer>
      </article>
    </div>
  );
}

function SectionTitle({ children, compact }: { children: React.ReactNode; compact: boolean }) {
  return (
    <h2
      className={cn(
        'border-b border-slate-400 pb-1 font-bold uppercase tracking-[0.09em] text-slate-900',
        compact ? 'text-[9.5px]' : 'text-[10px]',
      )}
    >
      {children}
    </h2>
  );
}
