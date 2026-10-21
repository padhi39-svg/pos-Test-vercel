const http = require('http')

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/reports/jurnal-harian?startDate=2026-05-01&endDate=2026-06-15',
  method: 'GET'
}

const req = http.request(options, (res) => {
  let data = ''
  res.on('data', (chunk) => { data += chunk })
  res.on('end', () => {
    console.log('Status:', res.statusCode)
    console.log('Response:', data)
  })
})

req.on('error', (e) => console.error('Error:', e.message))
req.end()
