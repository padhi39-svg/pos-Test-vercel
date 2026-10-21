"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/regionalNumber";
import { DEFAULT_SELF_PAY } from "../../config";

type OrderItem = {
  id: number;
  barang_id: number;
  barang_name: string;
  price: number;
  qty: number;
  subtotal: number;
};

type Order = {
  uid: string;
  order_number: number;
  total_price: number;
  payment_status: string;
  status: string;
  notes: string | null;
  created_at: string;
  meja_id: number | null;
  meja_name: string | null;
  items: OrderItem[];
};

const statusLabel: Record<string, { text: string; color: string }> = {
  unpaid: { text: "Belum Bayar", color: "bg-amber-100 text-amber-700" },
  paid: { text: "Lunas", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { text: "Dibatalkan", color: "bg-red-100 text-red-700" },
};

export default function SelfOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState("+7");
  const [selfPay, setSelfPay] = useState(DEFAULT_SELF_PAY);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    (async () => {
      try {
        const [orderRes, tzRes] = await Promise.all([
          fetch(`/api/self-order/order/${params.uid}`),
          fetch("/api/self-order/settings"),
        ]);
        const orderData = orderRes.ok ? await orderRes.json() : null;
        if (orderData) setOrder(orderData);

        let selfPayVal = DEFAULT_SELF_PAY;
        if (tzRes.ok) {
          const tzData = await tzRes.json();
          if (tzData.timezone) setTimezone(tzData.timezone);
          if (tzData.selfPay !== undefined) {
            selfPayVal = tzData.selfPay;
            setSelfPay(tzData.selfPay);
          }
        }

        // Start SSE immediately if order is unpaid
        if (orderData && orderData.payment_status === "unpaid") {
          eventSource = new EventSource(`/api/self-order/stream/${params.uid}`);
          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === "paid") {
                setOrder((prev) => prev ? { ...prev, payment_status: "paid" } : prev);
                eventSource?.close();
              } else if (data.type === "failed" || data.type === "timeout") {
                eventSource?.close();
              }
            } catch {}
          };

          // Auto-create QRIS if selfPay enabled
          if (selfPayVal) {
            try {
              const qrRes = await fetch("/api/self-order/qris/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderUid: orderData.uid }),
              });
              const qrData = await qrRes.json();
              if (qrRes.ok && qrData.ok) {
                setQrCodeUrl(qrData.qrCodeUrl);
              } else {
                setQrError(qrData.error || "Gagal membuat QRIS");
              }
            } catch {
              setQrError("Gagal terhubung ke server");
            }
          }
        }
      } catch (e) {
        console.error("Error loading order:", e);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      eventSource?.close();
    };
  }, [params.uid]);

  const formatWithTimezone = (date: Date) => {
    const offset = parseFloat(timezone) * 60;
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const local = new Date(utc + offset * 60000);
    const d = local.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const hh = String(local.getUTCHours()).padStart(2, "0");
    const mm = String(local.getUTCMinutes()).padStart(2, "0");
    const ss = String(local.getUTCSeconds()).padStart(2, "0");
    return `${d}, ${hh}:${mm}:${ss}`;
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Memuat...</div>;
  }

  if (!order) {
    return (
      <div className="p-6 text-center text-slate-500">
        Pesanan tidak ditemukan
      </div>
    );
  }

  const badge = statusLabel[order.payment_status] || statusLabel.unpaid;

  return (
    <div className="space-y-4 m-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Detail Pesanan</h1>
        <p className="text-slate-500 text-xs mt-1">Status pesanan self order</p>
      </div>

      {/* Order info card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Nomor Pesanan</span>
          <span className="text-sm font-semibold text-slate-800">
            #{order.order_number}
          </span>
        </div>
        {order.meja_name && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Meja</span>
            <span className="text-sm font-semibold text-slate-800">
              {order.meja_name}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Status Pembayaran</span>
          <span
            className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${badge.color}`}
          >
            {badge.text}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Waktu</span>
          <span className="text-xs text-slate-600">
            {formatWithTimezone(new Date(order.created_at))}
          </span>
        </div>
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Total</span>
          <span className="text-lg font-bold text-teal-primary">
            {formatCurrency(order.total_price)}
          </span>
        </div>
      </div>

      {/* Payment reminder - pay at cashier */}
      {!selfPay && order.payment_status === "unpaid" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-amber-500 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-amber-700">
            Silahkan bayar di kasir
          </span>
        </div>
      )}

      {/* QRIS payment */}
      {selfPay && order.payment_status === "unpaid" && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col items-center gap-3">
          {qrCodeUrl ? (
            <>
              <div className="bg-white p-3 border border-slate-200 rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeUrl}
                  alt="QRIS"
                  className="w-48 h-48"
                />
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-slate-800">
                  Scan QRIS untuk bayar
                </div>
                <div className="text-lg font-bold text-teal-primary mt-1">
                  {formatCurrency(order.total_price)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Menunggu pembayaran...
                </div>
              </div>
              <a
                href={qrCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={`QRIS-${order.order_number}.png`}
                className="px-4 py-1.5 rounded-pill border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Download QRIS
              </a>
            </>
          ) : qrError ? (
            <div className="text-sm text-red-600 text-center">{qrError}</div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="w-8 h-8 border-2 border-teal-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-sm text-slate-500">Membuat QR...</div>
            </div>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100">
          <span className="text-xs font-medium text-slate-500">
            Menu yang Dipesan
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {item.barang_name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {formatCurrency(item.price)} x {item.qty}
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-800 ml-3">
                {formatCurrency(item.subtotal)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="w-full py-2.5 rounded-pill border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Kembali
      </button>
    </div>
  );
}
