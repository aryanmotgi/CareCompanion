import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient } from '../client'

const BASE_URL = 'https://carecompanion.app'

describe('createApiClient', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('attaches base URL to requests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    const client = createApiClient({ baseUrl: BASE_URL })
    await client.medications.list('profile-1')
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/medications?careProfileId=profile-1`,
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('attaches token as cookie when getToken is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    const client = createApiClient({
      baseUrl: BASE_URL,
      getToken: async () => 'test-session-token',
    })
    await client.medications.list('profile-1')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: '__Secure-authjs.session-token=test-session-token',
        }),
      })
    )
  })

  it('throws on non-2xx responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
    const client = createApiClient({ baseUrl: BASE_URL })
    await expect(client.medications.list('profile-1')).rejects.toThrow('API error 401')
  })
})
