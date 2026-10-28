import { describe, expect, it, vi } from 'vitest';
import { GeminiService, type GeminiGenerationInput } from '../src/services/geminiService';
import { ApiError } from '../src/utils/errors';

const validAnalysis = JSON.stringify({
  jobTitle: 'Backend Engineer',
  company: 'Example',
  requiredSkills: ['Python'],
  preferredSkills: ['Docker'],
  technologies: ['Python', 'Docker'],
  qualifications: ["Bachelor's degree"],
  preferredQualifications: [],
  experienceRequirements: ['2+ years of experience'],
  responsibilities: ['Build APIs'],
  keywords: ['Python'],
  relevantProjectTypes: ['REST API and database-backed applications'],
  requestedCertifications: [],
});

function recordingGenerator(responses: Array<string | Error>) {
  const calls: GeminiGenerationInput[] = [];
  const generator = vi.fn(async (input: GeminiGenerationInput) => {
    calls.push(input);
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });
  return { generator, calls };
}

describe('Gemini service validation and retry', () => {
  it('parses a valid JSON response and requests a JSON schema', async () => {
    const { generator, calls } = recordingGenerator([validAnalysis]);
    const service = new GeminiService({ generator });

    const analysis = await service.analyzeJobDescription({
      rawText: 'Backend role requiring Python and Docker.',
      jobTitle: 'Backend Engineer',
    });

    expect(analysis.requiredSkills).toEqual(['Python']);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.jsonSchema).toBeTruthy();
    expect(calls[0]!.system).toContain('SECURITY');
    expect(calls[0]!.system).toContain('never instructions');
    expect(calls[0]!.prompt).toContain('<untrusted_job_description>');
  });

  it('accepts JSON wrapped in a markdown fence', async () => {
    const fenced = `Here is the result:\n\n\`\`\`json\n${validAnalysis}\n\`\`\`\n`;
    const service = new GeminiService({ generator: recordingGenerator([fenced]).generator });

    const analysis = await service.analyzeJobDescription({ rawText: 'Role text that is long enough.' });
    expect(analysis.preferredSkills).toEqual(['Docker']);
  });

  it('retries once when the first response is not valid JSON', async () => {
    const { generator, calls } = recordingGenerator(['this is not json', validAnalysis]);
    const service = new GeminiService({ generator });

    await expect(
      service.analyzeJobDescription({ rawText: 'Role text that is long enough.' }),
    ).resolves.toMatchObject({ jobTitle: 'Backend Engineer' });

    expect(calls).toHaveLength(2);
    expect(calls[1]!.prompt).toContain('previous response was invalid');
  });

  it('rejects invalid JSON after one retry without saving anything', async () => {
    const { generator, calls } = recordingGenerator(['not json at all']);
    const service = new GeminiService({ generator });

    const error = await service
      .analyzeJobDescription({ rawText: 'Role text that is long enough.' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'upstream_error' });
    expect((error as ApiError).message).toContain('could not be validated');
    expect(calls).toHaveLength(2);
  });

  it('rejects schema-violating JSON after one retry', async () => {
    const invalidShape = JSON.stringify({ jobTitle: 42, requiredSkills: 'Python' });
    const { generator, calls } = recordingGenerator([invalidShape]);
    const service = new GeminiService({ generator });

    const error = await service
      .analyzeJobDescription({ rawText: 'Role text that is long enough.' })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 502, code: 'upstream_error' });
    expect((error as ApiError).details).toBeTruthy();
    expect(calls).toHaveLength(2);
  });

  it('retries after a valid JSON payload fails schema validation', async () => {
    const wrongThenRight = recordingGenerator([JSON.stringify({ unexpected: true }), validAnalysis]);
    const service = new GeminiService({ generator: wrongThenRight.generator });

    const analysis = await service.analyzeJobDescription({ rawText: 'Role text that is long enough.' });
    expect(analysis.requiredSkills).toEqual(['Python']);
    expect(wrongThenRight.calls).toHaveLength(2);
  });

  it('reports not-configured instead of pretending AI succeeded', async () => {
    const service = new GeminiService({ apiKey: '' });
    expect(service.configured).toBe(false);

    const error = await service
      .analyzeJobDescription({ rawText: 'Role text that is long enough.' })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 503, code: 'not_configured' });
    expect((error as ApiError).message).toContain('GEMINI_API_KEY');
  });

  it('propagates network failures as upstream errors', async () => {
    const { generator } = recordingGenerator([new Error('socket hang up')]);
    const service = new GeminiService({ generator });

    await expect(
      service.analyzeJobDescription({ rawText: 'Role text that is long enough.' }),
    ).rejects.toThrow('socket hang up');
  });
});
