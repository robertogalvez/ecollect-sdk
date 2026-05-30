import { SessionModule } from '../src/modules/session';
import { HttpClient } from '../src/utils/http';
import { SessionExpiredException, AuthenticationException } from '../src/errors/index';
import type { EcollectConfig } from '../src/config';

jest.mock('../src/utils/http');

const mockConfig: EcollectConfig = {
  apiKey: 'test-api-key',
  etyCode: 12345,
  environment: 'test',
};

function makeMockHttp(postFn: jest.Mock) {
  const inst = new (HttpClient as unknown as new (o: unknown) => { post: jest.Mock })({});
  inst.post = postFn;
  return inst as unknown as HttpClient;
}

describe('SessionModule', () => {
  it('creates a new session token successfully', async () => {
    const postMock = jest.fn().mockResolvedValue({
      ReturnCode: 'SUCCESS',
      SessionToken: 'tok_abc123',
      LifetimeSecs: 1800,
    });
    const http = makeMockHttp(postMock);
    const session = new SessionModule(mockConfig, http);

    const result = await session.create();
    expect(result.token).toBe('tok_abc123');
    expect(result.lifetimeSecs).toBe(1800);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('throws AuthenticationException on FAIL_ACCESSDENIED', async () => {
    const postMock = jest.fn().mockResolvedValue({
      ReturnCode: 'FAIL_ACCESSDENIED',
    });
    const http = makeMockHttp(postMock);
    const session = new SessionModule(mockConfig, http);

    await expect(session.create()).rejects.toThrow(AuthenticationException);
  });

  it('returns cached token when sufficient time remains', async () => {
    const postMock = jest.fn().mockResolvedValue({
      ReturnCode: 'SUCCESS',
      SessionToken: 'tok_fresh',
      LifetimeSecs: 1800,
    });
    const http = makeMockHttp(postMock);
    const session = new SessionModule(mockConfig, http);

    await session.create();
    const token1 = await session.getActive();
    const token2 = await session.getActive();

    expect(token1).toBe('tok_fresh');
    expect(token2).toBe('tok_fresh');
    // Should only have called create once + getActive twice (no re-fetch)
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes token when less than 300s remain', async () => {
    const postMock = jest
      .fn()
      .mockResolvedValueOnce({
        ReturnCode: 'SUCCESS',
        SessionToken: 'tok_old',
        LifetimeSecs: 299, // nearly expired
      })
      .mockResolvedValueOnce({
        ReturnCode: 'SUCCESS',
        SessionToken: 'tok_new',
        LifetimeSecs: 1800,
      });

    const http = makeMockHttp(postMock);
    const session = new SessionModule(mockConfig, http);

    await session.create(); // creates tok_old with 299s lifetime
    const activeToken = await session.getActive(); // should refresh because < 300s

    expect(activeToken).toBe('tok_new');
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('invalidate() clears the cache', async () => {
    const postMock = jest.fn().mockResolvedValue({
      ReturnCode: 'SUCCESS',
      SessionToken: 'tok_abc',
      LifetimeSecs: 1800,
    });
    const http = makeMockHttp(postMock);
    const session = new SessionModule(mockConfig, http);

    await session.create();
    session.invalidate();
    await session.getActive();

    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('throws with correct error for FAIL_INVALIDENTITYCODE', async () => {
    const postMock = jest.fn().mockResolvedValue({
      ReturnCode: 'FAIL_INVALIDENTITYCODE',
    });
    const http = makeMockHttp(postMock);
    const session = new SessionModule(mockConfig, http);

    await expect(session.create()).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });
});
