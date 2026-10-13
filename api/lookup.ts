// Reputation + domain-age lookups for links, domains and attachment hashes.
// Only indicators reach this function, never email bodies or headers; nothing is logged or stored.
import { handleLookup } from '../server/handler'

const deps = () => ({ fetch: (input: string, init?: RequestInit) => fetch(input, init), env: process.env })

export function POST(request: Request): Promise<Response> {
  return handleLookup(request, deps())
}

export function GET(request: Request): Promise<Response> {
  return handleLookup(request, deps())
}
