import { httpRouter } from 'convex/server'

// No legacy Convex Auth HTTP routes: Clerk is the sole authentication issuer.
export default httpRouter()
