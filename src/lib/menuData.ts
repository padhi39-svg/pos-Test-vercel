// Placeholder image untuk menu items
// Dalam implementasi production, ganti dengan URL gambar yang sesuai
export const MENU_PLACEHOLDER_IMAGE = '/images/menu-placeholder.jpg'

// Contoh data menu untuk testing (nantinya akan diambil dari database)
export const SAMPLE_MENU_ITEMS = [
  {
    id: 1,
    code: 'BRG001',
    name: 'Nasi Gudeg Jogja',
    price: 25000,
    description: 'Nasi gudeg dengan ayam kampung, telur, dan sambal krecek khas Jogja',
    image: '/images/nasi-gudeg.jpg',
    category: 'Makanan Utama',
    isActive: true,
    isMenu: true
  },
  {
    id: 2,
    code: 'BRG002',
    name: 'Ayam Bakar Madu',
    price: 35000,
    description: 'Ayam kampung bakar dengan saus madu dan bumbu rahasia',
    image: '/images/ayam-bakar.jpg',
    category: 'Makanan Utama',
    isActive: true,
    isMenu: true
  },
  {
    id: 3,
    code: 'BRG003',
    name: 'Es Teh Manis',
    price: 8000,
    description: 'Teh premium dengan gula aren alami, segar dan berkualitas',
    image: '/images/es-teh.jpg',
    category: 'Minuman',
    isActive: true,
    isMenu: true
  },
  {
    id: 4,
    code: 'BRG004',
    name: 'Mie Ayam Kampung',
    price: 20000,
    description: 'Mie kuning dengan topping ayam kampung dan kuah kaldu bening',
    image: '/images/mie-ayam.jpg',
    category: 'Makanan Utama',
    isActive: true,
    isMenu: true
  },
  {
    id: 5,
    code: 'BRG005',
    name: 'Bakso Malang',
    price: 18000,
    description: 'Bakso daging sapi dengan kuah kaldu dan mie kuning',
    image: '/images/bakso.jpg',
    category: 'Makanan Ringan',
    isActive: true,
    isMenu: true
  },
  {
    id: 6,
    code: 'BRG006',
    name: 'Es Jeruk Nipis',
    price: 10000,
    description: 'Jeruk nipis segar dengan madu dan es batu, menyegarkan',
    image: '/images/es-jeruk.jpg',
    category: 'Minuman',
    isActive: true,
    isMenu: true
  }
]

export const MENU_CATEGORIES = [
  'Semua',
  'Makanan Utama',
  'Makanan Ringan',
  'Minuman',
  'Dessert',
  'Lainnya'
]
