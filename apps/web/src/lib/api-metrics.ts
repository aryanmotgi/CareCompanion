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
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      logger.error(`${method} ${routeName} failed`, {
        route: routeName,
        method,
        duration,
        error: errorMessage,
        stack: errorStack,
        path: url.pathname,
      })

      return NextResponse.json(
        { error: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { detail: errorMessage } : {}) },
        { status: 500 }
      )
    }
  }
}
