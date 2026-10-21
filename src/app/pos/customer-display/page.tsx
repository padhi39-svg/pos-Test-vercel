"use client";

import { useState, useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/regionalNumber";

type CustItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  modifier?: string | null;
  paketName?: string | null;
};

type SyncState = {
  type: "state";
  cart: CustItem[];
  subtotal: number;
  discountAmount: number;
  ppnAmount: number;
  serviceChargeAmt: number;
  total: number;
  count: number;
};

const PROMO_KEY = "pos_customer_promo_image";

export default function CustomerDisplayPage() {
  const [items, setItems] = useState<CustItem[]>([]);
  const [total, setTotal] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [ppnAmount, setPpnAmount] = useState(0);
  const [serviceChargeAmt, setServiceChargeAmt] = useState(0);
  const [connected, setConnected] = useState(false);
  const [promo, setPromo] = useState<string | null>(null);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    const loadPromo = () => {
      try {
        const saved = window.localStorage.getItem(PROMO_KEY);
        setPromo(saved || null);
      } catch {
        // ignore
      }
    };
    loadPromo();

    let bc: BroadcastChannel | null = null;
    let promoBc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("pos_customer_display");
      bc.onmessage = (ev) => {
        const data = ev.data;
        if (data && data.type === "state") {
          setConnected(true);
          if (tRef.current) window.clearTimeout(tRef.current);
          setItems(data.cart || []);
          setSubtotal(data.subtotal || 0);
          setDiscountAmount(data.discountAmount || 0);
          setPpnAmount(data.ppnAmount || 0);
          setServiceChargeAmt(data.serviceChargeAmt || 0);
          setTotal(data.total || 0);
        }
      };
      bc.postMessage({ type: "request" });
    } catch {
      // BroadcastChannel tidak didukung
    }

    try {
      promoBc = new BroadcastChannel("pos_customer_promo");
      promoBc.onmessage = (ev) => {
        if (ev.data && ev.data.type === "promo") {
          setPromo(ev.data.image || null);
        }
      };
    } catch {
      // ignore
    }

    tRef.current = window.setTimeout(() => {
      setConnected(false);
    }, 2500);

    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
      if (bc) bc.close();
      if (promoBc) promoBc.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasBreakdown =
    discountAmount > 0 || ppnAmount > 0 || serviceChargeAmt > 0;

  return (
    <div className="min-h-screen w-full bg-white text-slate-800 flex">
      <div className="flex-1 flex flex-col p-6 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Pesanan Anda</h1>
          <span
            className={`text-xs px-3 py-1 rounded-pill ${
              connected
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {connected ? "Live" : "Menunggu koneksi..."}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-lg">
              Belum ada pesanan
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between border-b border-slate-200 pb-2"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-semibold truncate text-slate-900">
                      {it.name}
                    </p>
                    {it.paketName ? (
                      <p className="text-xs text-slate-500">{it.paketName}</p>
                    ) : null}
                    {it.modifier ? (
                      <p className="text-xs text-slate-500">{it.modifier}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">
                      {formatCurrency(it.price)} &times; {it.quantity}
                    </p>
                  </div>
                  <p className="text-lg font-bold ml-4 text-slate-900">
                    {formatCurrency(it.total)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/70">Total yang harus dibayar</p>
            {hasBreakdown ? (
              <div className="text-xs text-white/60 mt-1 space-y-0.5">
                <p>Subtotal: {formatCurrency(subtotal)}</p>
                {discountAmount > 0 && (
                  <p>Diskon: {formatCurrency(discountAmount)}</p>
                )}
                {serviceChargeAmt > 0 && (
                  <p>Service: {formatCurrency(serviceChargeAmt)}</p>
                )}
                {ppnAmount > 0 && <p>PPN: {formatCurrency(ppnAmount)}</p>}
              </div>
            ) : null}
          </div>
          <p className="text-4xl font-extrabold">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="w-1/2 bg-slate-100 min-h-screen flex items-center justify-center overflow-hidden">
        {promo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={promo}
            alt="Promo"
            className="w-full h-full object-cover"
          />
        ) : (
          <p className="text-slate-400 text-sm text-center px-4">
            Gambar promo diatur di Menu Penjualan → Setting Nota
          </p>
        )}
      </div>
    </div>
  );
}
