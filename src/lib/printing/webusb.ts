// WebUSB printer - kirim ESC/POS langsung dari browser ke USB printer
// Tanpa install app, cukup Chrome/Edge modern

const WEBUSB_FILTERS = [
  { classCode: 7 },           // USB printer class
  { classCode: 255 },         // Vendor-specific (banyak thermal printer)
]

interface WebUSBDevice {
  device: USBDevice
  vendorId: number
  productId: number
  productName: string
}

let connectedDevice: WebUSBDevice | null = null

function getEp(iface: USBInterface, dir: 'out' | 'in'): USBEndpoint | null {
  for (const alt of iface.alternates) {
    for (const ep of alt.endpoints) {
      if (ep.direction === dir) return ep
    }
  }
  return null
}

export async function connectUSBPrinter(): Promise<WebUSBDevice> {
  if (!navigator.usb) throw new Error('WebUSB tidak didukung browser ini. Pakai Chrome/Edge.')
  const device = await navigator.usb.requestDevice({ filters: WEBUSB_FILTERS })
  await device.open()
  // Cari interface yang bisa di-claim
  for (const iface of device.configuration?.interfaces || []) {
    try {
      await device.claimInterface(iface.interfaceNumber)
    } catch {}
  }
  const dev: WebUSBDevice = {
    device,
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName || `USB Printer (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
  }
  connectedDevice = dev
  return dev
}

export async function disconnectUSBPrinter(): Promise<void> {
  if (!connectedDevice) return
  try {
    await connectedDevice.device.close()
  } catch {}
  connectedDevice = null
}

export function getConnectedUSBPrinter(): WebUSBDevice | null {
  return connectedDevice
}

export function isWebUSBSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

export async function printUSB(text: string, cut: boolean): Promise<void> {
  if (!connectedDevice) throw new Error('Printer USB belum terhubung')
  const device = connectedDevice.device

  // Cari endpoint OUT
  let outEp: USBEndpoint | null = null
  for (const iface of device.configuration?.interfaces || []) {
    outEp = getEp(iface, 'out')
    if (outEp) break
  }
  if (!outEp) throw new Error('Tidak ditemukan endpoint output')

  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const chunkSize = 512

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.subarray(offset, offset + chunkSize)
    await device.transferOut(outEp.endpointNumber, chunk)
  }

  // Cut
  if (cut) {
    const cutCmd = new Uint8Array([0x1D, 0x56, 0x00])
    await device.transferOut(outEp.endpointNumber, cutCmd)
  }
}

// Simpan device info ke client_settings agar otomatis reconnect
export function saveUSBDeviceInfo(dev: WebUSBDevice, saveSetting: (key: string, value: string) => void): void {
  saveSetting('webusb_vendor_id', String(dev.vendorId))
  saveSetting('webusb_product_id', String(dev.productId))
  saveSetting('webusb_product_name', dev.productName)
}

export function loadUSBDeviceInfo(loadSetting: (key: string) => string | null): { vendorId: number; productId: number; productName: string } | null {
  const vendorId = loadSetting('webusb_vendor_id')
  const productId = loadSetting('webusb_product_id')
  const productName = loadSetting('webusb_product_name')
  if (vendorId && productId) {
    return {
      vendorId: parseInt(vendorId, 10),
      productId: parseInt(productId, 10),
      productName: productName || '',
    }
  }
  return null
}

export async function reconnectUSBPrinter(info: { vendorId: number; productId: number }): Promise<boolean> {
  if (!navigator.usb) return false
  try {
    const devices = await navigator.usb.getDevices()
    const dev = devices.find(d => d.vendorId === info.vendorId && d.productId === info.productId)
    if (!dev) return false
    await dev.open()
    for (const iface of dev.configuration?.interfaces || []) {
      try { await dev.claimInterface(iface.interfaceNumber) } catch {}
    }
    connectedDevice = {
      device: dev,
      vendorId: dev.vendorId,
      productId: dev.productId,
      productName: dev.productName || '',
    }
    return true
  } catch {
    return false
  }
}

export async function autoConnectFromRemembered(): Promise<boolean> {
  if (!navigator.usb) return false
  try {
    const devices = await navigator.usb.getDevices()
    // Cari device USB printer class atau vendor-specific
    const target = devices.find(d => d.deviceClass === 7 || d.deviceClass === 255)
    if (!target) return false
    await target.open()
    for (const iface of target.configuration?.interfaces || []) {
      try { await target.claimInterface(iface.interfaceNumber) } catch {}
    }
    connectedDevice = {
      device: target,
      vendorId: target.vendorId,
      productId: target.productId,
      productName: target.productName || '',
    }
    return true
  } catch {
    return false
  }
}
