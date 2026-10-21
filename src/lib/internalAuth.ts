export const INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_API_SECRET && process.env.INTERNAL_API_SECRET.length > 0
    ? process.env.INTERNAL_API_SECRET
    : 'pos-qr-internal-9f3a7c2b'
