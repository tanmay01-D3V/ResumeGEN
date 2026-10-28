import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PdfViewer } from '@/components/resume/PdfViewer';

describe('PdfViewer', () => {
  it('shows a loading state before the PDF resolves', async () => {
    let resolve!: (blob: Blob) => void;
    const load = vi.fn(
      () =>
        new Promise<Blob>((done) => {
          resolve = done;
        }),
    );

    render(<PdfViewer load={load} />);

    expect(screen.getByText('Rendering server PDF…')).toBeInTheDocument();

    resolve(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
    await waitFor(() => expect(screen.getByTitle('Resume PDF')).toBeInTheDocument());
  });

  it('renders the PDF in an iframe with an open link once loaded', async () => {
    const load = vi.fn().mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));

    render(<PdfViewer load={load} title="Ada Lovelace · Resume" />);

    const frame = await screen.findByTitle('Ada Lovelace · Resume');
    expect(frame.tagName).toBe('IFRAME');
    const src = frame.getAttribute('src');
    expect(src).toMatch(/^blob:/);
    expect(screen.getByRole('link', { name: /Open PDF/i })).toHaveAttribute('href', src);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shows the failure message when the PDF request rejects', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Resume not found.'));

    render(<PdfViewer load={load} />);

    expect(await screen.findByText('Resume not found.')).toBeInTheDocument();
    expect(screen.queryByTitle('Resume PDF')).not.toBeInTheDocument();
  });

  it('shows a generic failure message for non-Error rejections', async () => {
    const load = vi.fn().mockRejectedValue('nope');

    render(<PdfViewer load={load} />);

    expect(await screen.findByText('Could not render the PDF.')).toBeInTheDocument();
  });
});
