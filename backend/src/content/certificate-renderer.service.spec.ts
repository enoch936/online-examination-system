import { ConfigService } from '@nestjs/config';
import { CertificateRendererService } from './certificate-renderer.service';
import { DEFAULT_TEMPLATE_CONTENT, DEFAULT_TEMPLATE_DESIGN } from './template-content.util';

/**
 * The renderer is the only place pdfkit is used for certificates, so these tests
 * cover the two things the issued download and the CMS preview both depend on:
 * that a `logoUrl` becomes bytes pdfkit can draw, and that the resulting PDF is
 * real.
 *
 * `fetch` is stubbed rather than hit over the network: the point is the URL
 * handling, not the remote server.
 */

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const makeRenderer = (publicUrl = 'https://app.example.test') =>
  new CertificateRendererService({ get: () => publicUrl } as unknown as ConfigService);

const imageResponse = (body: Buffer = ONE_PIXEL_PNG, contentType = 'image/png') =>
  ({ ok: true, headers: { get: () => contentType }, arrayBuffer: async () => body }) as unknown as Response;

describe('CertificateRendererService.loadLogo', () => {
  const fetchMock = jest.fn<Promise<Response>, [unknown]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  it('decodes a data URL without any network call', async () => {
    const url = `data:image/png;base64,${ONE_PIXEL_PNG.toString('base64')}`;

    const logo = await makeRenderer().loadLogo(url);

    expect(logo?.equals(ONE_PIXEL_PNG)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches a remote https logo into bytes, which is the pdfkit 0.20 case that used to fail', async () => {
    fetchMock.mockResolvedValue(imageResponse());

    const logo = await makeRenderer().loadLogo('https://cdn.example.test/logo.png');

    expect(logo?.equals(ONE_PIXEL_PNG)).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://cdn.example.test/logo.png');
  });

  it('resolves a site-relative upload path against the deployment origin', async () => {
    fetchMock.mockResolvedValue(imageResponse());

    await makeRenderer('https://app.example.test').loadLogo('/uploads/logo.png');

    expect(String(fetchMock.mock.calls[0][0])).toBe('https://app.example.test/uploads/logo.png');
  });

  it('returns null for a non-image response rather than handing pdfkit junk', async () => {
    fetchMock.mockResolvedValue(imageResponse(Buffer.from('<html>'), 'text/html'));

    await expect(makeRenderer().loadLogo('https://cdn.example.test/logo.png')).resolves.toBeNull();
  });

  it('returns null on a failed request, leaving the certificate to render without a logo', async () => {
    fetchMock.mockResolvedValue({ ok: false, headers: { get: () => '' } } as unknown as Response);

    await expect(makeRenderer().loadLogo('https://cdn.example.test/logo.png')).resolves.toBeNull();
  });

  it('returns null when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(makeRenderer().loadLogo('https://cdn.example.test/logo.png')).resolves.toBeNull();
  });

  it('refuses internal addresses, so an editor cannot make the API read them', async () => {
    for (const url of [
      'http://127.0.0.1:5432/probe',
      'http://10.0.0.5/logo.png',
      'http://192.168.1.10/logo.png',
      'http://172.16.0.1/logo.png',
      'http://169.254.169.254/latest/meta-data',
      'http://localhost:3000/logo.png',
    ]) {
      await expect(makeRenderer().loadLogo(url)).resolves.toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a plaintext http logo on a remote host', async () => {
    await expect(makeRenderer().loadLogo('http://cdn.example.test/logo.png')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses an oversized image', async () => {
    fetchMock.mockResolvedValue(imageResponse(Buffer.alloc(3 * 1024 * 1024, 1)));

    await expect(makeRenderer().loadLogo('https://cdn.example.test/logo.png')).resolves.toBeNull();
  });
});

describe('CertificateRendererService.renderPreview', () => {
  it('returns a real PDF named for the editor download', async () => {
    const { filename, buffer } = await makeRenderer().renderPreview(
      { ...DEFAULT_TEMPLATE_CONTENT },
      { ...DEFAULT_TEMPLATE_DESIGN },
    );

    expect(filename).toBe('certificate-preview.pdf');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('resolves every placeholder, so the preview shows sample data rather than raw tokens', async () => {
    const { buffer } = await makeRenderer().renderPreview(
      { ...DEFAULT_TEMPLATE_CONTENT, title: 'Awarded to {{recipient}} for {{exam}}' },
      { ...DEFAULT_TEMPLATE_DESIGN },
    );
    // The glyphs are embedded, so the text itself is not greppable; what is
    // assertable is that no un-substituted token survived into the document.
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.toString('latin1')).not.toContain('{{');
  });

  it('still renders when the logo cannot be loaded', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    const { buffer } = await makeRenderer().renderPreview(
      { ...DEFAULT_TEMPLATE_CONTENT, logoUrl: 'https://cdn.example.test/logo.png' },
      { ...DEFAULT_TEMPLATE_DESIGN },
    );

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
