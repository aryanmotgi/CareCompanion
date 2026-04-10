import { NextResponse } from 'next/server'
import { logger } from './logger'

type RouteHandler = (req: Request) => Promise<NextResponse | Response>

export function withMetrics(routeName: string, handler: RouteHandler): RouteHandler {
  return async (req: Request) => {
    const start = Date.now()
    const method = req.method
    const url = new URL(req.url)

    try {
      const response = await handler(req)
      const duration = Date.now() - start
      const status = response instanceof NextResponse ? response.status : 200

      logger.info(`${method} ${routeName}`, {
        route: routeName,
        method,
        duration,
        status,
        path: url.pathname,
      })

      return response
    } catch (error) {
      const duration = Date.now() - start
      logger.error(`${method} ${routeName} failed`, {
        route: routeName,
        method,
        duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
