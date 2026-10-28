import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom does not implement object URLs, which the PDF viewer relies on.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:test-pdf';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => undefined;
}
