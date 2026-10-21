const XLSX = require('xlsx');
const path = require('path');

const roundRp = v => Math.round(v || 0);

function calcItem(qty, price, discPct, d1, d2, d3, discNominal) {
  const gross = roundRp(qty * price);
  const dp = Math.min(Math.max(discPct||0,0),100);
  const p1 = Math.min(Math.max(d1||0,0),100);
  const p2 = Math.min(Math.max(d2||0,0),100);
  const p3 = Math.min(Math.max(d3||0,0),100);
  let r = gross;
  const da = roundRp(r*dp/100); r-=da;
  const d1a = roundRp(r*p1/100); r-=d1a;
  const d2a = roundRp(r*p2/100); r-=d2a;
  const d3a = roundRp(r*p3/100); r-=d3a;
  const dn = Math.min(Math.max(discNominal||0,0), Math.max(r,0));
  r-=dn;
  return {grossAmount:gross, discountAmount:da, disc1Amount:d1a, disc2Amount:d2a, disc3Amount:d3a, discNominal:dn, netAmount:Math.max(0,r)};
}

const barang = [
  {code:'TMU220',  name:'Epson Tmu 220',                hpp:2400000},
  {code:'KAV3 USER',name:'Kaspersky Antivirus 3 User',  hpp:250000},
  {code:'TX2PRO',   name:'Tenda Tx2 Pro',               hpp:500000},
  {code:'TAC6AC',   name:'Tenda Ac6 Ac 1200 Wall Killer',hpp:300000},
  {code:'TSG105',   name:'Tenda Sg105 Ethernet',        hpp:130000},
];

const suppCode = 'SUPP000';
const masterHeaders = ['TransactionCode','Tanggal','Supplier Code','Subtotal','Discount %','Discount Amount','PPN %','Total','Notes','Warehouse'];
const detailHeaders = ['TransactionCode','Kode Barang','Quantity','Unit','Harga Satuan','Disc%','Disc1%','Disc2%','Disc3%','DiscRp','Total'];
const masters = [masterHeaders];
const details = [detailHeaders];

const dates = ['2026-05-02','2026-05-07','2026-05-14','2026-05-20','2026-05-27'];
const discPatterns = [
  {discPct:10,d1:5, d2:3, d3:0, dn:2000},
  {discPct:5, d1:10,d2:0, d3:5, dn:5000},
  {discPct:8, d1:5, d2:5, d3:5, dn:3000},
  {discPct:15,d1:0, d2:8, d3:3, dn:0},
  {discPct:0, d1:10,d2:10,d3:5, dn:10000},
];

for (let i = 0; i < 5; i++) {
  const tx = 'SMPL' + String(i+1).padStart(3,'0');
  const tgl = dates[i];
  const ppnPct = 11;
  let itemsGross = 0, itemsNet = 0;
  const items = [];
  const numItems = 3 + i % 2;
  for (let j = 0; j < numItems; j++) {
    const brg = barang[(i*3+j) % barang.length];
    const qty = 3 + (i*2+j) % 8;
    const markup = 1.05 + (i+j) % 6 * 0.01;
    const price = brg.hpp > 0 ? roundRp(brg.hpp * markup) : 50000;
    const dp = discPatterns[(i+j) % discPatterns.length];
    const calc = calcItem(qty, price, dp.discPct, dp.d1, dp.d2, dp.d3, dp.dn);
    itemsGross += calc.grossAmount;
    itemsNet += calc.netAmount;
    items.push({code:brg.code, qty, unit:'pcs', price, discPct:dp.discPct, d1:dp.d1, d2:dp.d2, d3:dp.d3, discNominal:calc.discNominal, netAmount:calc.netAmount});
  }
  const headerDiscPct = 5;
  const headerDiscAmt = roundRp(itemsNet * headerDiscPct / 100);
  const dpp = itemsNet - headerDiscAmt;
  const ppn = roundRp(dpp * ppnPct / 100);
  const total = dpp + ppn;
  masters.push([tx, tgl, suppCode, itemsGross, headerDiscPct, headerDiscAmt, ppnPct, total, 'Sample pembelian #'+(i+1), 1]);
  for (const it of items) {
    details.push([tx, it.code, it.qty, it.unit, it.price, it.discPct, it.d1, it.d2, it.d3, it.discNominal, it.netAmount]);
  }
}

const wsM = XLSX.utils.aoa_to_sheet(masters);
const wsD = XLSX.utils.aoa_to_sheet(details);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, wsM, 'MASTER');
XLSX.utils.book_append_sheet(wb, wsD, 'DETAIL');
const fp = path.join(__dirname, '..', 'sample-pembelian-mei2026.xlsx');
XLSX.writeFile(wb, fp);
console.log('Created:', fp);
console.log('Transactions:', masters.length-1);
console.log('Detail rows:', details.length-1);
