import { NextResponse } from 'next/server'
import { rawRun } from '@/db/raw'

export async function POST() {
  try {
    await rawRun(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value TEXT,
        setting_group TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.log('[Migration] Settings table created')

    const defaultSettings = [
      { key: 'company_name', value: '', group: 'company', description: 'Nama Perusahaan' },
      { key: 'company_address', value: '', group: 'company', description: 'Alamat Perusahaan' },
      { key: 'company_city', value: '', group: 'company', description: 'Kota' },
      { key: 'company_phone', value: '', group: 'company', description: 'No. Telepon' },
      { key: 'company_mobile', value: '', group: 'company', description: 'No. HP' },
      { key: 'company_email', value: '', group: 'company', description: 'Email' },
      { key: 'company_npwp', value: '', group: 'company', description: 'NPWP' },
      { key: 'company_npwp_address', value: '', group: 'company', description: 'Alamat NPWP' },
    ]

    for (const setting of defaultSettings) {
      await rawRun(
        'INSERT INTO settings (setting_key, setting_value, setting_group, description) VALUES ($1, $2, $3, $4) ON CONFLICT (setting_key) DO NOTHING',
        [setting.key, setting.value, setting.group, setting.description]
      )
    }

    console.log('[Migration] Default settings inserted')

    return NextResponse.json({
      success: true,
      message: 'Settings table created and default values inserted'
    })
  } catch (error: any) {
    console.error('[Migration] Error creating settings table:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create settings table', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
