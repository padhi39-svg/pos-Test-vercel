"use client";

import { useState, useEffect, useRef } from "react";
import { CubeIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@/lib/regionalNumber";
import { getTodayDate } from "@/lib/date-utils";
import SelfOrderDialog from "./SelfOrderDialog";

type CartItem = {
  id: number;
  code: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  kategoriId?: number | null;
  modifier?: string | null;
  locked?: boolean;
  paketId?: number | null;
  paketName?: string | null;
  selfOrderUid?: string | null;
  selfOrderNumber?: number | null;
};

type Customer = {
  id: number;
  code: string;
  name: string;
  discountPercent: number;
  jenisCustomerId?: number | null;
};

type POSRestoPageProps = {
  restoTableLabel?: string;
  tableId?: number;
  hasSavedBefore?: boolean;
  initialTempItems?: any[];
  tempOrderId?: number;
  openPayOnLoad?: boolean;
  skipCaptionOnPay?: boolean;
  billModeOnLoad?: boolean;
  isTakeAway?: boolean;
};

type PaymentRowType = {
  method: "cash" | "transfer" | "Debit Card" | "Credit Card";
  amount: number;
  amountDisplay: string;
  bankId: number | null;
  cardNumber: string;
};

export default function PosRestoPageInner({
  restoTableLabel,
  tableId,
  hasSavedBefore,
  initialTempItems,
  tempOrderId,
  openPayOnLoad,
  skipCaptionOnPay,
  billModeOnLoad,
  isTakeAway,
}: POSRestoPageProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [searchProduct, setSearchProduct] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSelfOrderModal, setShowSelfOrderModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [ppnPercent, setPpnPercent] = useState<number>(10);
  const [includeTax, setIncludeTax] = useState<boolean>(false);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [newCustomerCode, setNewCustomerCode] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  // Legacy single payment states (kept for compatibility, but we now use payments array)
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "transfer" | "card"
  >("cash");
  const [cardType, setCardType] = useState<"debit" | "credit" | "">("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentAmountDisplay, setPaymentAmountDisplay] = useState<string>("");
  const [discountPercentInput, setDiscountPercentInput] = useState<string>("");
  const [discountAmountInput, setDiscountAmountInput] = useState<string>("");
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(0);
  const [cardNumber, setCardNumber] = useState<string>("");
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  // Locking support
  const [lockUser, setLockUser] = useState<{ id: number | null; name: string }>(
    { id: null, name: "" },
  );
  const lockIntervalRef = useRef<any>(null);

  // Multi-payment support (max 2 rows)
  const [payments, setPayments] = useState<PaymentRowType[]>([
    {
      method: "cash",
      amount: 0,
      amountDisplay: "",
      bankId: null,
      cardNumber: "",
    },
  ]);
  const [qzStatus, setQzStatus] = useState<{
    version: string | null;
    error: string | null;
  }>({ version: null, error: null });
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [showTableDropdown, setShowTableDropdown] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const tableDropdownRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef<HTMLDivElement>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProductState] = useState<any | null>(null);
  const [productQty, setProductQty] = useState<number>(1);
  const [productModifier, setProductModifier] = useState<string>("");
  const [canQtyMinus, setCanQtyMinus] = useState<boolean>(false);
  const [paymentName, setPaymentName] = useState<string>("");
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [hasSavedTemp, setHasSavedTemp] = useState(!!hasSavedBefore);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load permission QTY_MINUS + user identity for lock
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const d = await res.json().catch(() => ({}))
        const dyn = Array.isArray(d?.user?.dynamicPermissions) ? (d.user.dynamicPermissions as any[]) : []
        const has = dyn.some((p: any) =>
          ['pos_resto', 'pos_resto_table'].includes(String(p.menu_code || '').toLowerCase().trim()) &&
          String(p.permission_code || '').toUpperCase() === 'QTY_MINUS' &&
          Number(p.allowed) === 1,
        )
        setCanQtyMinus(has)
        const id = d?.user?.id ? Number(d.user.id) : null;
        const name = String(d?.user?.name || d?.user?.email || "").trim();
        setLockUser({ id, name });
      } catch {
        setCanQtyMinus(false)
      }
    })()
  }, [])

  // Jika datang dari halaman resto-table dengan intent bayar, buka modal pembayaran otomatis
  useEffect(() => {
    if (openPayOnLoad) {
      setShowPaymentModal(true);
    }
  }, [openPayOnLoad]);

  // Initialize deviceId cookie
  useEffect(() => {
    try {
      if (typeof document !== "undefined") {
        const getCookie = (name: string) =>
          document.cookie
            .split("; ")
            .find((r) => r.startsWith(name + "="))
            ?.split("=")[1];
        let did = getCookie("device_id");
        if (!did) {
          const uuid =
            crypto && "randomUUID" in crypto
              ? (crypto as any).randomUUID()
              : Date.now().toString(36) + Math.random().toString(36).slice(2);
          const exp = new Date();
          exp.setFullYear(exp.getFullYear() + 5);
          document.cookie = `device_id=${uuid}; path=/; expires=${exp.toUTCString()}`;
          did = uuid;
        }
        try {
          setDeviceId(did || "");
        } catch {}
      }
    } catch {}
  }, [])

  // Acquire and maintain lock for this table while POS page is open
  useEffect(() => {
    if (!tableId) return;
    const did = (() => {
      try {
        if (typeof document !== "undefined") {
          const getCookie = (name: string) =>
            document.cookie
              .split("; ")
              .find((r) => r.startsWith(name + "="))
              ?.split("=")[1];
          return getCookie("device_id") || "";
        }
      } catch {}
      return "";
    })();
    if (!did) return;
    let released = false;
    const acquire = async () => {
      try {
        await fetch("/api/pos/resto-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableId,
            deviceId: did,
            userId: lockUser.id,
            userName: lockUser.name,
            ttl: 120,
          }),
        });
      } catch {}
    };
    const refresh = async () => {
      try {
        await fetch("/api/pos/resto-lock", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId, deviceId: did, ttl: 120 }),
        });
      } catch {}
    };
    const release = async () => {
      if (released) return;
      released = true;
      try {
        const url = `/api/pos/resto-lock?table_id=${encodeURIComponent(String(tableId))}&device_id=${encodeURIComponent(did)}`;
        await fetch(url, { method: "DELETE" });
      } catch {}
    };
    const onBeforeUnload = () => {
      void release();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    (async () => {
      await acquire();
      if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = setInterval(refresh, 60000);
      window.addEventListener("beforeunload", onBeforeUnload);
      document.addEventListener("visibilitychange", onVisibility);
    })();

    return () => {
      if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [tableId, lockUser.id, lockUser.name]);

  // Hydrate cart dari temp order items (jika ada) saat pertama kali load
  useEffect(() => {
    if (!initialTempItems || !Array.isArray(initialTempItems)) return;
    if (initialTempItems.length === 0) return;
    if (cart.length > 0) return;

    const mapped: CartItem[] = initialTempItems
      .map((it: any) => ({
        id: Number(it.barang_id || it.barangId || 0),
        code: String(it.barang_code || it.code || ""),
        name: String(it.barang_name || it.name || ""),
        price: Number(it.unit_price || it.unitPrice || 0),
        quantity: Number(it.quantity || 0) || 0,
        total: Number(it.total_price || it.totalPrice || 0),
        kategoriId:
          it.kategori_id != null
            ? Number(it.kategori_id)
            : it.kategoriId != null
              ? Number(it.kategoriId)
              : null,
        modifier: it.modifier ?? null,
        locked: true,
      }))
      .filter((it) => it.id && it.code && it.name && it.quantity > 0);

    if (mapped.length > 0) {
      setCart(mapped);
      setHasSavedTemp(true);
    }
  }, [initialTempItems, cart.length]);

  const handleSaveTableOrder = async () => {
    if (isSavingTable) return;
    if (!tableId) {
      alert("Meja belum dipilih");
      return;
    }
    if (cart.length === 0) {
      alert("Keranjang masih kosong, tidak ada yang disimpan");
      return;
    }

    try {
      setIsSavingTable(true);
      const cartSnapshot = [...cart];
      const customerId = selectedCustomer?.id ?? null;
      let customerName = selectedCustomer?.name || "";
      if (!customerName) {
        const defaultCust = customers.find((c) => c.id === 1);
        if (defaultCust) {
          customerName = defaultCust.name;
        }
      }
      if (!customerName) {
        customerName = "Umum";
      }

      const payload = {
        tableId,
        customerId,
        customerName,
        guestCount: 1,
        items: cart.map((item) => ({
          barangId: item.id,
          code: item.code,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.total,
          modifier: item.modifier ?? null,
          kategoriId: item.kategoriId ?? null,
        })),
      };

      const res = await fetch("/api/pos/resto-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = "Gagal menyimpan pesanan sementara meja";
        try {
          const data = await res.json();
          if (data?.error) msg = String(data.error);
        } catch {}
        alert(msg);
        return;
      }
      setHasSavedTemp(true);

      // Cetak caption order & kitchen/bar untuk temp order (sebelum pembayaran)
      // Hanya kirim item baru (belum pernah tersimpan/terkirim), ditandai dengan !locked.
      const newItemsForPrint = cartSnapshot.filter((it) => !it.locked);
      const tableDisplayForTemp = (() => {
        if (selectedTable) {
          return `${selectedTable.code || ""} - ${selectedTable.name || ""}`.trim();
        }
        // Jika datang dari /pos/resto-table tanpa memilih ulang di dropdown,
        // coba cari nama meja dari daftar tables berdasarkan tableId.
        const t = tables.find(
          (tb: any) => tb.id === tableId || tb.table_id === tableId,
        );
        if (t) {
          return `${t.code || ""} - ${t.name || ""}`.trim();
        }
        return restoTableLabel ?? null;
      })();
      if (newItemsForPrint.length > 0) {
        try {
          await tryPrintCaption(
            `TEMP-${tableId}`,
            newItemsForPrint,
            customerName || null,
            tableDisplayForTemp,
          );
        } catch (err) {
          console.warn("Print caption temp order gagal:", err);
        }
      }

      if (typeof window !== "undefined") {
        window.location.href = "/pos/resto-table";
      }
    } catch (e) {
      console.error("Error save temp order:", e);
      alert("Terjadi kesalahan saat menyimpan order sementara");
    } finally {
      setIsSavingTable(false);
    }
  };

  useEffect(() => {
    const runBill = async () => {
      if (!billModeOnLoad || !tableId || !tempOrderId) return;
      try {
        const cartSnapshot: CartItem[] = cart.length
          ? [...cart]
          : Array.isArray(initialTempItems)
            ? initialTempItems
                .map((it: any) => ({
                  id: Number(it.barang_id || it.barangId || 0),
                  code: String(it.barang_code || it.code || ""),
                  name: String(it.barang_name || it.name || ""),
                  price: Number(it.unit_price || it.unitPrice || 0),
                  quantity: Number(it.quantity || 0) || 0,
                  total: Number(it.total_price || it.totalPrice || 0),
                  kategoriId:
                    it.kategori_id != null
                      ? Number(it.kategori_id)
                      : it.kategoriId != null
                        ? Number(it.kategoriId)
                        : null,
                  modifier: it.modifier ?? null,
                  locked: true,
                }))
                .filter(
                  (it: CartItem) =>
                    it.id && it.code && it.name && it.quantity > 0,
                )
            : [];

        if (!cartSnapshot.length) return;

        const tableDisplayForBill = (() => {
          if (selectedTable) {
            return `${selectedTable.code || ""} - ${selectedTable.name || ""}`.trim();
          }
          const t = tables.find(
            (tb: any) => tb.id === tableId || tb.table_id === tableId,
          );
          if (t) {
            return `${t.code || ""} - ${t.name || ""}`.trim();
          }
          return restoTableLabel ?? null;
        })();

        const trxNo = `BILL-${tempOrderId}`;
        const provisionalTotal = cartSnapshot.reduce(
          (s: number, it: any) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0),
          0,
        );
        await tryAutoPrint(trxNo, cartSnapshot, 0, 0, provisionalTotal, 0, 0, 0, tableDisplayForBill);

        try {
          await fetch("/api/pos/resto-temp", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: tempOrderId, status: "bill" }),
          });
        } catch (e) {
          console.warn("Gagal mengubah status temp order ke bill:", e);
        }

        if (typeof window !== "undefined") {
          window.location.href = "/pos/resto-table";
        }
      } catch (e) {
        console.warn("Error saat menjalankan bill sementara:", e);
      }
    };

    if (billModeOnLoad) {
      runBill();
    }
  }, [
    billModeOnLoad,
    tableId,
    tempOrderId,
    cart,
    initialTempItems,
    selectedTable,
    tables,
    restoTableLabel,
  ]);

  const handleCancelTableOrder = async () => {
    try {
      // Selalu pastikan temp order yang tidak memiliki isi keranjang dibatalkan,
      // supaya meja kembali Available ketika user batal tanpa ada pesanan.
      if (cart.length === 0 && tempOrderId) {
        const res = await fetch("/api/pos/resto-temp", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tempOrderId, status: "canceled" }),
        });
        if (!res.ok) {
          try {
            const data = await res.json();
            console.warn("Gagal membatalkan temp order kosong dari POS:", data);
          } catch {
            console.warn("Gagal membatalkan temp order kosong dari POS");
          }
        }
      } else if (!hasSavedTemp && tempOrderId) {
        // Kasus lama: belum ada order yang benar-benar disimpan (hasSavedTemp = false)
        // Jika ada tempOrderId, kita void supaya meja kembali Available.
        const res = await fetch("/api/pos/resto-temp", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tempOrderId }),
        });
        if (!res.ok) {
          try {
            const data = await res.json();
            console.warn(
              "Gagal membatalkan temp order dari POS (belum disimpan):",
              data,
            );
          } catch {
            console.warn(
              "Gagal membatalkan temp order dari POS (belum disimpan)",
            );
          }
        }
      }
      // Kasus B: jika hasSavedTemp = true dan keranjang berisi item,
      // kita hanya kembali ke halaman meja tanpa mengubah temp order.
    } catch (e) {
      console.warn("Error saat cancel dari POS:", e);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/pos/resto-table";
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTableDropdown(false);
      }
    };
    if (showTableDropdown) {
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [showTableDropdown]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!showTableDropdown) return;
      const el = tableDropdownRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setShowTableDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [showTableDropdown]);

  const [captionCfg, setCaptionCfg] = useState<Record<string, string>>({
    order_caption_enabled: "0",
    order_caption_header: "ORDER PESANAN",
    order_caption_show_customer: "1",
    order_caption_show_table: "1",
    order_caption_footer: "",
    cap_backend_mode: "server",
    cap_network_host: "",
    cap_network_port: "9100",
    cap_local_helper_id: "",
    cap_local_usb_name: "",
  });
  const [kitchenCfg, setKitchenCfg] = useState<Record<string, string>>({
    kitchen_print_mode: "combined",
    combined_backend_mode: "server",
    combined_network_host: "",
    combined_network_port: "9100",
    combined_local_helper_id: "",
    combined_local_usb_name: "",
    pantry_backend_mode: "server",
    pantry_network_host: "",
    pantry_network_port: "9100",
    pantry_local_helper_id: "",
    pantry_local_usb_name: "",
    kitchen_backend_mode: "server",
    kitchen_network_host: "",
    kitchen_network_port: "9100",
    kitchen_local_helper_id: "",
    kitchen_local_usb_name: "",
  });
  const [deviceId, setDeviceId] = useState<string>("");
  const [isPaying, setIsPaying] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email?: string;
  } | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [kategoriPrintMap, setKategoriPrintMap] = useState<
    Record<number, string>
  >({});
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showPaket, setShowPaket] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [printerCfg, setPrinterCfg] = useState<{
    deviceName: string;
    autoPrint: boolean;
    copies: number;
    cut: boolean;
    chars: number;
    paper: string;
    font?: "A" | "B";
    condensed?: boolean;
    lineSpacing?: number;
    widthMul?: number;
    heightMul?: number;
    backendMode:
      | "server"
      | "local_helper"
      | "local_helper_apk"
      | "local_helper_offline"
      | "mobile_rawbt"
      | "browser_print"
      | "android_intent"
      | "webusb";
    host: string;
    port: number;
    localHelperId: string;
    localHelperIp: string;
    localUsbName: string;
  }>({
    deviceName: "",
    autoPrint: false,
    copies: 1,
    cut: true,
    chars: 48,
    paper: "80mm",
    font: "B",
    condensed: false,
    lineSpacing: 24,
    widthMul: 0,
    heightMul: 0,
    backendMode: "server",
    host: "",
    port: 9100,
    localHelperId: "",
    localHelperIp: "",
    localUsbName: "",
  });
  const [companyInfo, setCompanyInfo] = useState<{
    name: string;
    address: string;
    city?: string;
    phone: string;
  }>({ name: "", address: "", city: "", phone: "" });

  type LayoutCfg = {
    header_title: string;
    show_company: "0" | "1";
    show_address: "0" | "1";
    show_phone: "0" | "1";
    show_invoice_code: "0" | "1";
    separator_char: "-" | "=";
    thankyou_text: string;
    align_header: "left" | "center";
    columns_style: "standard" | "compact";
    label_subtotal: string;
    label_tax: string;
    label_total: string;
    label_paid: string;
    label_change: string;
  };

  const [layoutCfg, setLayoutCfg] = useState<LayoutCfg>({
    header_title: "",
    show_company: "1",
    show_address: "1",
    show_phone: "1",
    show_invoice_code: "1",
    separator_char: "-",
    thankyou_text: "Terima kasih",
    align_header: "center",
    columns_style: "standard",
    label_subtotal: "Subtotal",
    label_tax: "PPN",
    label_total: "TOTAL",
    label_paid: "Bayar",
    label_change: "Kembali",
  });

  const catContainerRef = useRef<HTMLDivElement>(null);
  const catBtnRef = useRef<HTMLButtonElement>(null);
  const [catsPerPage, setCatsPerPage] = useState<number>(7);
  const [catPage, setCatPage] = useState<number>(0);
  const [catBtnWidth, setCatBtnWidth] = useState<number>(0);
  // Ukur lebar tombol kategori yang sesungguhnya dari DOM
  useEffect(() => {
    if (catBtnRef.current) {
      const w = catBtnRef.current.offsetWidth;
      if (w > 0) setCatBtnWidth(w);
    }
  }, [categories]);
  // Hitung ulang catsPerPage saat container berubah ukuran
  useEffect(() => {
    const el = catContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const cw = entry.contentRect.width;
      const step = Math.max(50, catBtnWidth + 6); // lebar tombol + gap-1.5
      const est = Math.max(1, Math.floor((cw + 6) / step));
      setCatsPerPage(est);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [catBtnWidth]);

  const totalCatPages = Math.max(
    1,
    Math.ceil(Math.max(0, categories.length - 1) / Math.max(1, catsPerPage)),
  );
  const visibleCategories = (() => {
    const others = categories.filter((c: any) => c.id !== "all");
    const limit = Math.max(1, catsPerPage);
    const start = catPage * limit;
    const pageSlice = others.slice(start, start + limit);
    return catPage === 0
      ? [categories.find((c: any) => c.id === "all"), ...pageSlice].filter(
          Boolean,
        )
      : pageSlice;
  })();

  useEffect(() => {
    if (showPaymentModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showPaymentModal]);

  // Initialize discount inputs when opening payment modal
  useEffect(() => {
    if (showPaymentModal) {
      const pct = 0; // reset setiap buka modal
      setDiscountPercent(0);
      const pctClamped = Math.max(0, Math.min(100, Number(pct.toFixed(2))));
      setDiscountPercentInput(String(pctClamped));
      // Compute discountAmount inline to avoid stale dependency
      const computedDiscAmt = 0;
      setDiscountAmountInput(
        computedDiscAmt > 0
          ? Math.round(computedDiscAmt).toLocaleString("id-ID")
          : "",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentModal]);

  // Jika datang dari POS Resto Table dengan tableId, otomatis pilih meja tersebut
  // sehingga field meja di modal pembayaran terisi nama meja yang dipilih
  useEffect(() => {
    if (!tableId || !tables || tables.length === 0) return;
    if (selectedTable) return;
    try {
      const found = tables.find(
        (tb: any) => tb.id === tableId || tb.table_id === tableId,
      );
      if (found) {
        setSelectedTable(found);
        const label = `${found.code || ""} - ${found.name || ""}`.trim();
        setTableSearch(label);
      }
    } catch {}
  }, [tableId, tables, selectedTable]);

  useEffect(() => {
    try {
      if (typeof document !== "undefined") {
        const getCookie = (name: string) =>
          document.cookie
            .split("; ")
            .find((r) => r.startsWith(name + "="))
            ?.split("=")[1];
        let did = getCookie("device_id");
        if (!did) {
          const uuid =
            crypto && "randomUUID" in crypto
              ? (crypto as any).randomUUID()
              : Date.now().toString(36) + Math.random().toString(36).slice(2);
          const exp = new Date();
          exp.setFullYear(exp.getFullYear() + 5);
          document.cookie = `device_id=${uuid}; path=/; expires=${exp.toUTCString()}`;
          did = uuid;
        }
        setDeviceId(did || "");
      }
    } catch {}
  }, []);

  // Renew lock meja secara berkala saat berada di halaman POS untuk meja tertentu
  useEffect(() => {
    if (!tableId || !deviceId) return;
    let active = true;
    const renew = async () => {
      try {
        await fetch("/api/pos/resto-lock", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId, deviceId }),
        });
      } catch {
        // abaikan error, lock tetap akan kadaluarsa otomatis
      }
    };
    renew();
    const id = setInterval(() => {
      if (!active) return;
      renew();
    }, 60000);
    return () => {
      active = false;
      clearInterval(id);
      // Lepaskan lock ketika keluar dari halaman POS
      fetch("/api/pos/resto-lock/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, deviceId }),
      }).catch(() => {});
    };
  }, [tableId, deviceId]);

  useEffect(() => {
    if (!deviceId) return;
    const loadClientGroup = async (
      group: string,
    ): Promise<Record<string, string>> => {
      try {
        const res = await fetch(
          `/api/client-settings?device_id=${encodeURIComponent(deviceId)}&group=${encodeURIComponent(group)}`,
        );
        const data = await res.json();
        if (!res.ok) return {};
        const map: Record<string, string> = {};
        (data?.settings || []).forEach((row: any) => {
          map[row.setting_key] = String(row.setting_value ?? "");
        });
        return map;
      } catch {
        return {};
      }
    };
    (async () => {
      const a = await loadClientGroup("order_caption_client");
      if (Object.keys(a).length) setCaptionCfg((v) => ({ ...v, ...a }));
      const b = await loadClientGroup("kitchen_client");
      if (Object.keys(b).length) setKitchenCfg((v) => ({ ...v, ...b }));
    })();
  }, [deviceId]);

  useEffect(() => {
    const loadPrinter = async () => {
      try {
        const [resC, resLayout, resPrinterGlobal] = await Promise.all([
          fetch("/api/settings?group=company"),
          fetch("/api/settings?group=printer_layout"),
          fetch("/api/settings?group=printer"),
        ]);

        // Per-device printer config via client-settings 'printer'
        if (deviceId) {
          try {
            const res = await fetch(
              `/api/client-settings?device_id=${encodeURIComponent(deviceId)}&group=printer`,
            );
            const data = await res.json();
            if (res.ok && Array.isArray(data?.settings)) {
              const map: Record<string, string> = {};
              (data.settings || []).forEach((row: any) => {
                map[row.setting_key] = String(row.setting_value ?? "");
              });
              const deviceName = String(
                map["printer_device_name"] || "",
              ).trim();
              const backend = String(map["printer_backend_mode"] || "server");
              const font = (
                String(map["printer_font"] || "B").toUpperCase() === "A"
                  ? "A"
                  : "B"
              ) as "A" | "B";
              const condensed = map["printer_condensed"] === "1";
              const lineSpacing = Math.max(
                16,
                Math.min(
                  64,
                  parseInt(map["printer_line_spacing"] || "24") || 24,
                ),
              );
              const widthMul = Math.max(
                0,
                Math.min(
                  7,
                  parseInt(map["printer_font_width_mul"] || "0") || 0,
                ),
              );
              const heightMul = Math.max(
                0,
                Math.min(
                  7,
                  parseInt(map["printer_font_height_mul"] || "0") || 0,
                ),
              );
              setPrinterCfg({
                deviceName,
                autoPrint: map["printer_auto_print"] === "1",
                copies: Math.max(
                  1,
                  parseInt(map["printer_copies"] || "1") || 1,
                ),
                cut: map["printer_cut_paper"] !== "0",
                chars: Math.max(
                  24,
                  Math.min(
                    64,
                    parseInt(map["printer_chars_per_line"] || "48") || 48,
                  ),
                ),
                paper: map["printer_paper_size"] || "80mm",
                font,
                condensed,
                lineSpacing,
                widthMul,
                heightMul,
                backendMode:
                  backend === "server" ||
                  backend === "local_helper" ||
                  backend === "local_helper_apk" ||
                  backend === "local_helper_offline" ||
                  backend === "mobile_rawbt" ||
                  backend === "browser_print"
                    ? (backend as any)
                    : "server",
                host: String(map["printer_network_host"] || "").trim(),
                port: Math.max(
                  1,
                  Math.min(
                    65535,
                    parseInt(map["printer_network_port"] || "9100") || 9100,
                  ),
                ),
                localHelperId: String(map["printer_local_helper_id"] || ""),
                localHelperIp: String(
                  map["printer_local_helper_ip"] || "",
                ).trim(),
                localUsbName: String(
                  map["printer_local_usb_name"] || "",
                ).trim(),
              });
            }
          } catch {}
        }
        // Fallback: merge global 'printer' settings if per-device not set or missing keys
        if (resPrinterGlobal.ok) {
          const rowsP = await resPrinterGlobal.json();
          const gmap: Record<string, string> = {};
          (rowsP || []).forEach(
            (r: any) => (gmap[r.setting_key] = String(r.setting_value ?? "")),
          );
          setPrinterCfg((prev) => {
            const font = (
              String(gmap["printer_font"] || prev.font || "B").toUpperCase() ===
              "A"
                ? "A"
                : "B"
            ) as "A" | "B";
            const merged = {
              ...prev,
              deviceName:
                prev.deviceName ||
                String(gmap["printer_device_name"] || "").trim(),
              autoPrint: prev.autoPrint ?? gmap["printer_auto_print"] === "1",
              copies:
                prev.copies ||
                Math.max(1, parseInt(gmap["printer_copies"] || "1") || 1),
              cut: prev.cut ?? gmap["printer_cut_paper"] !== "0",
              chars:
                prev.chars ||
                Math.max(
                  24,
                  Math.min(
                    64,
                    parseInt(gmap["printer_chars_per_line"] || "48") || 48,
                  ),
                ),
              paper: prev.paper || gmap["printer_paper_size"] || "80mm",
              font,
              condensed:
                prev.condensed !== undefined
                  ? prev.condensed
                  : gmap["printer_condensed"] === "1",
              lineSpacing:
                prev.lineSpacing ||
                Math.max(
                  16,
                  Math.min(
                    64,
                    parseInt(gmap["printer_line_spacing"] || "24") || 24,
                  ),
                ),
              widthMul:
                typeof prev.widthMul === "number"
                  ? prev.widthMul
                  : Math.max(
                      0,
                      Math.min(
                        7,
                        parseInt(gmap["printer_font_width_mul"] || "0") || 0,
                      ),
                    ),
              heightMul:
                typeof prev.heightMul === "number"
                  ? prev.heightMul
                  : Math.max(
                      0,
                      Math.min(
                        7,
                        parseInt(gmap["printer_font_height_mul"] || "0") || 0,
                      ),
                    ),
              host:
                prev.host || String(gmap["printer_network_host"] || "").trim(),
              port:
                prev.port ||
                Math.max(
                  1,
                  Math.min(
                    65535,
                    parseInt(gmap["printer_network_port"] || "9100") || 9100,
                  ),
                ),
              localHelperId:
                prev.localHelperId ||
                String(gmap["printer_local_helper_id"] || ""),
              localHelperIp:
                prev.localHelperIp ||
                String(gmap["printer_local_helper_ip"] || "").trim(),
              localUsbName:
                prev.localUsbName ||
                String(gmap["printer_local_usb_name"] || "").trim(),
            };
            return merged;
          });
        }
        if (resC.ok) {
          const rows = await resC.json();
          const map: Record<string, string> = {};
          (rows || []).forEach(
            (r: any) => (map[r.setting_key] = String(r.setting_value ?? "")),
          );
          setCompanyInfo({
            name: map["company_name"] || "",
            address: map["company_address"] || "",
            city: map["company_city"] || "",
            phone: map["company_phone"] || "",
          });
        }
        if (resLayout.ok) {
          const data = await resLayout.json();
          const map: Record<string, string> = {};
          (data || []).forEach((row: any) => {
            map[row.setting_key] = String(row.setting_value ?? "");
          });
          setLayoutCfg((prev) => ({
            ...prev,
            header_title: map.header_title ?? prev.header_title,
            show_company: (map.show_company as any) ?? prev.show_company,
            show_address: (map.show_address as any) ?? prev.show_address,
            show_phone: (map.show_phone as any) ?? prev.show_phone,
            show_invoice_code:
              (map.show_invoice_code as any) ?? prev.show_invoice_code,
            separator_char: (map.separator_char as any) || prev.separator_char,
            thankyou_text: map.thankyou_text ?? prev.thankyou_text,
            align_header: (map.align_header as any) || prev.align_header,
            columns_style: (map.columns_style as any) || prev.columns_style,
            label_subtotal: map.label_subtotal ?? prev.label_subtotal,
            label_tax: map.label_tax ?? prev.label_tax,
            label_total: map.label_total ?? prev.label_total,
            label_paid: map.label_paid ?? prev.label_paid,
            label_change: map.label_change ?? prev.label_change,
          }));
        }
        try {
          const meRes = await fetch("/api/me");
          if (meRes.ok) {
            const me = await meRes.json();
            if (me && typeof me === "object") {
              setCurrentUser({
                name: String(me.name || me.username || me.email || "User"),
                email: String(me.email || ""),
              });
            }
          }
        } catch {}
      } catch (e) {
        console.warn("Gagal memuat setting printer/company", e);
      }
    };
    loadPrinter();
  }, [deviceId]);

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id || item.locked));
  };
  const clearCart = () => setCart([]);
  const selectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setDiscountPercent(customer?.discountPercent || 0);
    setShowCustomerModal(false);
  };

  useEffect(() => {
    const loadData = async () => {
      // 1) Coba baca cache lokal dulu supaya tampilan lebih cepat
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const raw = window.localStorage.getItem("pos_resto_initial_data");
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                const {
                  barangData,
                  customerData,
                  kategoriData,
                  banksData,
                  settingsRows,
                  mejaData,
                } = parsed;

                const normKategori = Array.isArray(kategoriData) ? kategoriData : (kategoriData?.rows || []);
                if (
                  Array.isArray(barangData) &&
                  Array.isArray(customerData) &&
                  Array.isArray(normKategori)
                ) {
                  const menuItemsCache = barangData.filter(
                    (item: any) =>
                      item.jenis === 1 && item.aktif && item.tampilMenu,
                  );
                  const categoriesFromAPICache = [
                    { id: "all", name: "Semua", print_target: null },
                    ...normKategori.map((kat: any) => ({
                      id: kat.id.toString(),
                      name: kat.name,
                      print_target: kat.print_target || null,
                    })),
                  ];
                  setProducts(menuItemsCache);
                  setCustomers(customerData);
                  setCategories(categoriesFromAPICache);
                  const printMapCache: Record<number, string> = {};
                  normKategori.forEach((kat: any) => {
                    if (kat && kat.id != null) {
                      printMapCache[Number(kat.id)] = kat.print_target || "";
                    }
                  });
                  setKategoriPrintMap(printMapCache);
                  if (Array.isArray(banksData)) setBanks(banksData);
                  if (Array.isArray(mejaData)) setTables(mejaData);

                  const settingsMapCache: Record<string, string> = {};
                  (settingsRows || []).forEach((row: any) => {
                    settingsMapCache[row.setting_key] = String(
                      row.setting_value ?? "",
                    );
                  });
                  if (Object.keys(settingsMapCache).length > 0) {
                    setPpnPercent(
                      Number(
                        settingsMapCache["sales_default_ppn_percent"] || 10,
                      ),
                    );
                    setIncludeTax(
                      settingsMapCache["sales_include_tax"] === "1",
                    );
                  }

                  const defaultCustomerCache = customerData.find(
                    (c: Customer) => c.id === 1,
                  );
                  if (defaultCustomerCache) {
                    setSelectedCustomer(defaultCustomerCache);
                    setDiscountPercent(
                      defaultCustomerCache.discountPercent || 0,
                    );
                  }

                  // Karena sudah ada data cache, kita bisa tampilkan UI segera
                  setLoading(false);
                }
              }
            } catch (e) {
              console.warn("Failed to parse cache:", e);
            }
          }
        }
      } catch (e) {
        console.warn("localStorage not available:", e);
      }

      // 2) Tetap fetch data terbaru di background untuk memastikan sinkron
      try {
        const [
          barangResponse,
          customerResponse,
          kategoriResponse,
          banksResponse,
          settingsResponse,
          mejaResponse,
          paketResponse,
        ] = await Promise.all([
          fetch("/api/pos/products"),
          fetch("/api/customer"),
          fetch("/api/kategori"),
          fetch("/api/banks"),
          fetch("/api/settings?group=penjualan"),
          fetch("/api/meja?active=1"),
          fetch("/api/master-paket"),
        ]);
        if (
          !barangResponse.ok ||
          !customerResponse.ok ||
          !kategoriResponse.ok ||
          !banksResponse.ok ||
          !settingsResponse.ok ||
          !mejaResponse.ok
        ) {
          throw new Error("Failed to load data");
        }
        const barangData = await barangResponse.json();
        const customerData = await customerResponse.json();
        let kategoriData = await kategoriResponse.json();
        if (!Array.isArray(kategoriData)) kategoriData = kategoriData?.rows || [];
        let banksData = await banksResponse.json();
        if (!Array.isArray(banksData)) banksData = banksData?.rows || [];
        const settingsRows = await settingsResponse.json();
        const mejaData = await mejaResponse.json();
        const paketData = paketResponse.ok ? await paketResponse.json() : [];

        const filteredPaket = (
          Array.isArray(paketData) ? paketData : []
        ).filter((p: any) => p.aktif);
        setPaketList(filteredPaket);

        const menuItems = barangData.filter(
          (item: any) => item.jenis === 1 && item.aktif && item.tampilMenu,
        );

        const categoriesFromAPI = [
          { id: "all", name: "Semua", print_target: null },
          ...kategoriData.map((kat: any) => ({
            id: kat.id.toString(),
            name: kat.name,
            print_target: kat.print_target || null,
          })),
        ];
        if (filteredPaket.length > 0) {
          categoriesFromAPI.push({
            id: "paket",
            name: "Paket",
            print_target: null,
          });
        }

        setProducts(menuItems);
        setCustomers(customerData);
        setCategories(categoriesFromAPI);
        const printMap: Record<number, string> = {};
        (kategoriData || []).forEach((kat: any) => {
          if (kat && kat.id != null) {
            printMap[Number(kat.id)] = kat.print_target || "";
          }
        });
        setKategoriPrintMap(printMap);
        setBanks(banksData);
        setTables(Array.isArray(mejaData) ? mejaData : []);
        const settingsMap: Record<string, string> = {};
        (settingsRows || []).forEach((row: any) => {
          settingsMap[row.setting_key] = String(row.setting_value ?? "");
        });
        setPpnPercent(Number(settingsMap["sales_default_ppn_percent"] || 10));
        setServiceChargePercent(
          Number(
            settingsMap["sales_default_service_percent"] ||
              settingsMap["sales_service_percent"] ||
              0,
          ),
        );
        setIncludeTax(settingsMap["sales_include_tax"] === "1");

        const defaultCustomer = customerData.find((c: Customer) => c.id === 1);
        if (defaultCustomer) {
          setSelectedCustomer(defaultCustomer);
          setDiscountPercent(defaultCustomer.discountPercent || 0);
        }

        // Simpan ke cache untuk kunjungan berikutnya
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            const payload = {
              barangData,
              customerData,
              kategoriData,
              banksData,
              settingsRows,
              mejaData,
            };
            window.localStorage.setItem(
              "pos_resto_initial_data",
              JSON.stringify(payload),
            );
          }
        } catch (e) {
          console.warn("Failed to save cache:", e);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  const filteredProducts = products.filter((product) => {
    const matchSearch =
      !searchProduct ||
      product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      product.code.toLowerCase().includes(searchProduct.toLowerCase());
    const matchCategory =
      activeCategory === "all" ||
      product.kategoriId === Number(activeCategory) ||
      product.kategori_id === Number(activeCategory);
    return matchSearch && matchCategory;
  });

  const filteredPaketItems =
    activeCategory === "paket"
      ? paketList.filter((p) => {
          if (!searchProduct) return true;
          return (
            p.nama.toLowerCase().includes(searchProduct.toLowerCase()) ||
            p.kode.toLowerCase().includes(searchProduct.toLowerCase())
          );
        })
      : [];

  const rawSubtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const r = Math.max(0, ppnPercent) / 100;
  // Base DPP (sebelum PPN) untuk perhitungan diskon
  const discountBaseDpp = includeTax
    ? Math.round(rawSubtotal / (1 + r))
    : rawSubtotal;
  const discountAmount = Math.round(
    Math.max(0, discountBaseDpp) * (Math.max(0, discountPercent) / 100),
  );
  let subtotal = 0,
    ppnAmount = 0,
    total = 0;
  // Hitung DPP setelah diskon
  const dppAfterDisc = Math.max(0, discountBaseDpp - discountAmount);
  // Service Charge dihitung dari (Subtotal - Diskon)
  const serviceChargeAmt = Math.round(
    dppAfterDisc * (Math.max(0, serviceChargePercent) / 100),
  );
  // PB1 dihitung dari (Subtotal - Diskon) saja, TIDAK termasuk Service Charge
  ppnAmount = Math.round(dppAfterDisc * r);
  subtotal = dppAfterDisc;
  total = dppAfterDisc + serviceChargeAmt + ppnAmount;

  // Sinkronisasi ke Layar Pelanggan (monitor portable, extended display)
  useEffect(() => {
    try {
      const bc = new BroadcastChannel("pos_customer_display");
      const payload = () => ({
        type: "state",
        cart,
        subtotal,
        discountAmount,
        ppnAmount,
        serviceChargeAmt,
        total,
        count: cart.length,
      });
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === "request") {
          bc.postMessage(payload());
        }
      };
      bc.postMessage(payload());
      return () => bc.close();
    } catch {
      // BroadcastChannel tidak didukung
    }
  }, [cart, subtotal, discountAmount, ppnAmount, serviceChargeAmt, total]);

  const getUnitPrice = (product: any): number => {
    const prices = Array.isArray(product?.prices) ? product.prices : [];
    const today = new Date().toISOString().slice(0, 10);
    const rows = prices.map((r: any) => ({
      price: Number(r?.price) || 0,
      eff: String(r?.effectiveDate || r?.effective_date || "0000-00-00"),
    }));
    const past = rows.filter((r: any) => r.price > 0 && r.eff <= today);
    let chosen: any = null;
    if (past.length > 0) {
      past.sort((a: any, b: any) =>
        a.eff < b.eff ? -1 : a.eff > b.eff ? 1 : 0,
      );
      chosen = past[past.length - 1];
    } else if (rows.length > 0) {
      rows.sort((a: any, b: any) =>
        a.eff < b.eff ? -1 : a.eff > b.eff ? 1 : 0,
      );
      chosen = rows[0];
    }
    const p1 = Number(chosen?.price || 0);
    if (p1 > 0) return p1;
    const p2 = Number(product?.price || NaN);
    if (!isNaN(p2) && p2 > 0) return p2;
    const p3 = Number(product?.hpp || NaN);
    if (!isNaN(p3) && p3 > 0) return p3;
    return 0;
  };

  const addToCart = (
    product: any,
    qty: number = 1,
    modifier?: string | null,
  ) => {
    const unitPrice = getUnitPrice(product);
    const normalizedQty = Math.floor(qty || 0);
    if (!normalizedQty) return;

    setCart((prev) => {
      // Untuk qty positif, gabungkan dengan item existing yang tidak locked.
      if (normalizedQty > 0) {
        const existing = prev.find(
          (item) => item.id === product.id && !item.locked,
        );
        if (existing) {
          const newQty = existing.quantity + normalizedQty;
          // Jika setelah penyesuaian qty menjadi 0, hapus baris tersebut.
          if (!newQty) {
            return prev.filter((item) => item !== existing);
          }
          return prev.map((item) =>
            item === existing
              ? {
                  ...item,
                  quantity: newQty,
                  total: newQty * item.price,
                  modifier:
                    modifier != null ? modifier : (item.modifier ?? null),
                }
              : item,
          );
        }
      }

      // Untuk qty negatif atau jika belum ada existing, buat baris baru apa adanya.
      return [
        ...prev,
        {
          id: product.id,
          code: product.code,
          name: product.name,
          price: unitPrice,
          quantity: normalizedQty,
          total: unitPrice * normalizedQty,
          kategoriId: product.kategoriId ?? product.kategori_id ?? null,
          modifier: modifier ?? null,
          locked: false,
        },
      ];
    });
  };

  const addPaketToCart = (paket: any) => {
    const hargaJual = Number(paket.hargaJual || 0);
    if (!hargaJual) {
      alert("Harga jual paket belum diatur");
      return;
    }
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.paketId === paket.id && !item.locked,
      );
      if (existing) {
        const newQty = existing.quantity + 1;
        return prev.map((item) =>
          item === existing
            ? { ...item, quantity: newQty, total: newQty * item.price }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: paket.id,
          code: paket.kode,
          name: paket.nama,
          price: hargaJual,
          quantity: 1,
          total: hargaJual,
          modifier: null,
          locked: false,
          paketId: paket.id,
          paketName: paket.nama,
        },
      ];
    });
  };

  const openProductModal = (product: any) => {
    setSelectedProductState(product);
    setProductQty(1);
    setProductModifier("");
    setShowProductModal(true);
  };

  const confirmAddProduct = () => {
    if (!selectedProduct) return;
    addToCart(selectedProduct, productQty, productModifier.trim() || null);
    setShowProductModal(false);
  };

  const updateQuantity = (id: number, quantity: number) => {
    const normalizedQty = Math.floor(quantity || 0);
    if (!normalizedQty) {
      setCart((prev) => prev.filter((item) => item.id !== id || item.locked));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === id && !item.locked
          ? {
              ...item,
              quantity: normalizedQty,
              total: normalizedQty * item.price,
            }
          : item,
      ),
    );
  };

  const padRight = (s: string, n: number) =>
    s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
  const padLeft = (s: string, n: number) =>
    s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s;
  const wrap = (text: string, width: number) => {
    const words = String(text || "").split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const cand = line ? line + " " + w : w;
      if (cand.length <= width) line = cand;
      else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const formatReceiptCurrency = (value: number): string => {
    if (isNaN(value) || value === null || value === undefined) return "0";
    const num = value.toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return `${num}`;
  };

  const buildReceipt = (
    trxNo: string,
    items: CartItem[],
    totals: {
      subtotal: number;
      ppn: number;
      total: number;
      disc: number;
      paid: number;
      change: number;
      service?: number;
    },
    paymentMethodIn: "cash" | "transfer" | "card",
    cashierName: string,
    tableDisplay?: string | null,
    opts?: { salesName?: string | null; salesEmail?: string | null },
  ) => {
    const W = printerCfg.chars;
    const L: string[] = [];
    let layout: any = { ...layoutCfg };
    const sep = String(layout.separator_char || "-").repeat(W);
    const centerLine = (line: string) => {
      if (layout.align_header !== "center") return line;
      const pad = Math.max(0, Math.floor((W - line.length) / 2));
      return " ".repeat(pad) + line;
    };
    const pushWrapped = (text: string) => {
      const lines = wrap(text, W);
      for (const ln of lines) {
        L.push(centerLine(ln));
      }
    };
    const rightWidth = Math.max(8, Math.min(14, Math.round(W * 0.3)));
    const pushRight = (label: string, value: string) => {
      const rw = rightWidth;
      const lw = Math.max(1, W - rw);
      const left = padRight(label, lw);
      const right = padLeft(value, rw);
      if (left.length + right.length <= W) L.push(left + right);
      else {
        L.push(label);
        L.push(right);
      }
    };
    const nowDtHeader = new Date();
    const dd = String(nowDtHeader.getDate()).padStart(2, "0");
    const mm = String(nowDtHeader.getMonth() + 1).padStart(2, "0");
    const yyyy = nowDtHeader.getFullYear();
    const headerDate = `${dd}/${mm}/${yyyy}`;
    if (layout.show_company === "1" && companyInfo.name)
      pushWrapped(companyInfo.name.toUpperCase());
    if (layout.show_address === "1" && companyInfo.address)
      pushWrapped(companyInfo.address);
    if (layout.show_phone === "1" && companyInfo.phone)
      pushWrapped("Tel: " + companyInfo.phone);
    if (companyInfo.city) pushWrapped(String(companyInfo.city));
    L.push(sep);
    const headerTitle = String(layout.header_title || "NOTA PENJUALAN");
    pushWrapped(headerTitle.toUpperCase());
    if (layout.show_invoice_code === "1") pushWrapped("No: " + (trxNo || "-"));
    pushWrapped(headerDate);
    L.push(sep);
    for (const it of items) {
      const nameLines = wrap(it.name, W);
      if (nameLines.length) L.push(nameLines[0]);
      const qtyPrice = `${it.quantity} x ${formatReceiptCurrency(it.price)}`;
      const totStr = formatReceiptCurrency(it.total);
      const left = Math.max(0, W - qtyPrice.length - totStr.length);
      L.push(qtyPrice + " ".repeat(left) + totStr);
      for (let i = 1; i < nameLines.length; i++) L.push(nameLines[i]);
    }
    L.push(sep);
    const payLabel =
      paymentMethodIn === "cash"
        ? "Cash"
        : paymentMethodIn === "transfer"
          ? "Transfer"
          : "Kartu";
    pushRight("Metode", payLabel);
    const lblSubtotal = layout.label_subtotal || "Subtotal";
    const lblTax = layout.label_tax || "PPN";
    const lblTotal = layout.label_total || "TOTAL";
    const lblPaid = layout.label_paid || "Bayar";
    const lblChange = layout.label_change || "Kembali";
    pushRight(lblSubtotal, formatReceiptCurrency(totals.subtotal));
    if (totals.disc > 0)
      pushRight("Diskon", "-" + formatReceiptCurrency(totals.disc));
    if (totals.ppn > 0) pushRight(lblTax, formatReceiptCurrency(totals.ppn));
    // Service Charge line (always show if > 0)
    const svc =
      typeof totals.service === "number" ? totals.service : serviceChargeAmt;
    if (svc > 0) pushRight("Service Charge", formatReceiptCurrency(svc));
    pushRight(lblTotal, formatReceiptCurrency(totals.total));
    pushRight(lblPaid, formatReceiptCurrency(totals.paid));
    pushRight(lblChange, formatReceiptCurrency(totals.change));
    L.push(sep);
    // Footer per foto contoh
    const debit = payments.find(
      (p) =>
        p.method === "Debit Card" && (p.cardNumber || "").toString().trim(),
    );
    if (debit) {
      L.push(`No. Kartu Debit : ${(debit.cardNumber || "").toString().trim()}`);
    }
    const nowDt = new Date();
    const tgl = nowDt.toLocaleDateString("id-ID");
    const jam = nowDt.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    L.push(`Tgl. : ${tgl}  Jam : ${jam}`);
    if (tableDisplay) {
      L.push(`Meja : ${tableDisplay}`);
    }
    const custName =
      (paymentName || "").trim() || selectedCustomer?.name || "UMUM";
    L.push(`Cust : ${custName}`);
    const footerSalesName =
      (opts?.salesName ?? null) || currentUser?.name || null;
    if (footerSalesName) {
      L.push(`Nama Waiters : ${footerSalesName}`);
    }
    const footerCashierEmail = (opts?.salesEmail ?? null) || null;
    if (footerCashierEmail) {
      L.push(`Kasir : ${footerCashierEmail}`);
    }
    const ket = (paymentName || "").trim() || custName;
    L.push(`Keterangan : ${ket}`);
    // Extra feed lines to help dot-matrix printers advance paper further
    for (let i = 0; i < 5; i++) {
      L.push("");
    }
    L.push("\n");
    return L.join("\n");
  };

  // ===== Build Resto Receipt (Desain Baru dengan kolom QTY, Nama, Hrg.Sat, Total) =====
  const buildRestoReceipt = (
    trxNo: string,
    itemsList: CartItem[],
    paid: number,
    change: number,
    tableDisplay?: string | null,
    freshLayout?: Record<string,string>,
  ): string => {
    const W = printerCfg.chars;
    const L: string[] = [];
    const fmt = (n: number) =>
      new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));
    const center = (line: string) => {
      const pad = Math.max(0, Math.floor((W - line.length) / 2));
      return " ".repeat(pad) + line;
    };
    // Layout dari server — prioritaskan freshLayout
    const layout: any = freshLayout && Object.keys(freshLayout).length ? freshLayout : { ...layoutCfg };
    const sepChar = String(layout?.separator_char || "=");
    const sepLine = sepChar.repeat(W);
    // ESC/POS inline formatting helpers
    const escBoldOn = "\x1bE\x01";
    const escBoldOff = "\x1bE\x00";
    const escSize = (s: string) => {
      const v = parseInt(s) || 0;
      const h = v === 1 || v === 3 ? 1 : 0;
      const w = v === 2 || v === 3 ? 1 : 0;
      return "\x1d\x21" + String.fromCharCode(((h & 0x07) << 4) | (w & 0x07));
    };
    const escSizeNormal = "\x1d\x21\x00";
    const escCondOn = "\x0f";
    const escCondOff = "\x12";
    // Header font: bold + size
    const hdrBold = layout?.header_font_bold === "1";
    const hdrScale = String(layout?.header_font_scale || "0");
    if (hdrBold) L.push(escBoldOn);
    if (hdrScale !== "0") L.push(escSize(hdrScale));
    // Header perusahaan
    if (layout?.header_title) L.push(center(String(layout.header_title).toUpperCase()));
    if (companyInfo.name)
      L.push(center(String(companyInfo.name).toUpperCase()));
    if (companyInfo.address) L.push(center(String(companyInfo.address)));
    if (companyInfo.city) L.push(center(String(companyInfo.city)));
    if (companyInfo.phone) L.push(center(String(companyInfo.phone)));
    if (layout?.show_invoice_code === "1") L.push(center("No: " + (trxNo || "-")));
    // Reset header font
    if (hdrBold) L.push(escBoldOff);
    if (hdrScale !== "0") L.push(escSizeNormal);
    L.push(sepLine);

    // Header detail kolom dan renderer item
    // Untuk 58mm (W < 40) pakai format 2 baris per item agar nama item tidak terpotong
    const isNarrow = W < 40;
    let totalQty = 0;
    // Item condensed mode
    const itemCond = layout?.item_font_condensed === "1";
    if (itemCond) L.push(escCondOn);
    if (isNarrow) {
      // Format ringkas: Nama item di baris pertama, "Qty x Harga = Total" di baris kedua
      for (const it of itemsList) {
        totalQty += Number(it.quantity) || 0;
        const nameLines = wrap(it.name, W);
        if (nameLines.length) L.push(nameLines[0]);
        for (let i = 1; i < nameLines.length; i++) L.push(nameLines[i]);
        const qtyPrice = `${it.quantity} x ${fmt(Number(it.price))}`;
        const totStr = fmt(Number(it.total));
        const left = Math.max(0, W - qtyPrice.length - totStr.length);
        L.push(qtyPrice + " ".repeat(left) + totStr);
      }
    } else {
      // Format kolom: Qty(4) | Nama | Hrg.Sat(10) | Total(12)
      const QW = 4,
        SP = 1,
        PW = 10,
        TW = 12;
      const NAME_W = Math.max(5, W - (QW + SP + 1 + PW + TW));
      const hQty = padRight("Qty", QW);
      const hName = padRight("Nama Barang", NAME_W);
      const hPrice = padLeft("Harga.Stn", PW);
      const hSub = padLeft("Total", TW);
      L.push(hQty + " ".repeat(SP) + hName + " " + hPrice + hSub);
      L.push(sepLine);
      for (const it of itemsList) {
        const priceStr = fmt(Number(it.price));
        const subStr = fmt(Number(it.total));
        const qtyStr = padRight(String(it.quantity), QW);
        totalQty += Number(it.quantity) || 0;
        const nameLines = wrap(it.name, NAME_W);
        if (nameLines.length <= 1) {
          const namePart = padRight(nameLines[0] || "", NAME_W);
          L.push(
            qtyStr +
              " ".repeat(SP) +
              namePart +
              " " +
              padLeft(priceStr, PW) +
              padLeft(subStr, TW),
          );
        } else {
          L.push(qtyStr + " ".repeat(SP) + nameLines[0]);
          const name2 = padRight(nameLines[1], NAME_W);
          L.push(
            " ".repeat(QW + SP) +
              name2 +
              " " +
              padLeft(priceStr, PW) +
              padLeft(subStr, TW),
          );
          for (let i = 2; i < nameLines.length; i++) {
            L.push(" ".repeat(QW + SP) + nameLines[i]);
          }
        }
      }
    }
    if (itemCond) L.push(escCondOff);
    L.push(sepLine);
    L.push(`Total Item  : ${fmt(totalQty)}`);

    // Totals block dengan label rata kanan dan ':' sejajar
    const VAL_W = isNarrow ? 12 : 14;
    const LAB_W = Math.max(8, W - VAL_W - 2);
    const lineKV = (label: string, val: string) =>
      padLeft(label, LAB_W) + " :" + padLeft(val, VAL_W);
    const nonCash = Array.isArray(payments)
      ? payments.find(
          (p) =>
            (p?.amount || 0) > 0 &&
            String(p?.method || "").toLowerCase() !== "cash",
        )
      : null;
    const methodName = nonCash ? String(nonCash.method) : "Cash";
    const lblSubtotal = layout?.label_subtotal || "Subtotal";
    const lblTax = layout?.label_tax || "Pb 1";
    const lblTotal = layout?.label_total || "Total";
    const lblPaid = layout?.label_paid || "Bayar";
    const lblChange = layout?.label_change || "Kembali";
    L.push(lineKV("Metode", methodName));
    L.push(lineKV(lblSubtotal, fmt(rawSubtotal)));
    L.push(lineKV("Diskon", fmt(discountAmount)));
    L.push(lineKV(lblTax, fmt(ppnAmount)));
    L.push(lineKV("Service Charge", fmt(serviceChargeAmt)));
    // Total font: bold + size
    const totBold = layout?.total_font_bold === "1";
    const totScale = String(layout?.total_font_scale || "0");
    if (totBold) L.push(escBoldOn);
    if (totScale !== "0") L.push(escSize(totScale));
    L.push(lineKV(lblTotal, fmt(total)));
    if (totBold) L.push(escBoldOff);
    if (totScale !== "0") L.push(escSizeNormal);
    L.push(lineKV(lblPaid, fmt(paid)));
    L.push(lineKV(lblChange, fmt(change)));

    // Separator sebelum footer informasi
    L.push(sepLine);

    // Info kartu kondisional
    if (nonCash && (nonCash.cardNumber || "").toString().trim()) {
      const m = String(nonCash.method || "").toLowerCase();
      if (m.includes("debit"))
        L.push(`No.Kartu Debit : ${(nonCash.cardNumber || "").toString()}`);
      if (m.includes("credit"))
        L.push(`No.Kartu Kredit : ${(nonCash.cardNumber || "").toString()}`);
    }

    // Footer kiri
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const d = `${dd}/${mm}/${yyyy}`;
    const t = `${hh}.${min}`;
    L.push(`Tgl: ${d}   Jam : ${t}`);
    if (tableDisplay) L.push(`Meja: ${tableDisplay}`);
    const custName = paymentName.trim() || selectedCustomer?.name || "UMUM";
    L.push(`Cust: ${custName}`);
    if (currentUser?.name) L.push(`Nama Waiter: ${currentUser.name}`);
    L.push(`Keterangan: ${custName}`);
    // Footer thankyou_text dari layout
    const rawFooter = String(layout?.thankyou_text || "");
    if (rawFooter) {
      const footerLines = rawFooter.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      for (const fl of footerLines) {
        const wrapped = wrap(fl, W);
        for (const ln of wrapped) {
          L.push(center(ln));
        }
      }
    }
    for (let i = 0; i < 5; i++) L.push("");
    L.push("\n");
    return L.join("\n");
  };

  const buildBillReceipt = (
    trxNo: string,
    items: CartItem[],
    totals: { subtotal: number; ppn: number; total: number; disc: number },
    cashierName: string,
    tableDisplay?: string | null,
  ) => {
    const W = printerCfg.chars;
    const L: string[] = [];
    let layout: any = { ...layoutCfg };
    const sep = String(layout.separator_char || "-").repeat(W);
    const centerLine = (line: string) => {
      if (layout.align_header !== "center") return line;
      const pad = Math.max(0, Math.floor((W - line.length) / 2));
      return " ".repeat(pad) + line;
    };
    const pushWrapped = (text: string) => {
      const lines = wrap(text, W);
      for (const ln of lines) {
        L.push(centerLine(ln));
      }
    };
    const rightWidth = Math.max(10, Math.min(16, Math.round(W * 0.3)));
    const pushRight = (label: string, value: string) => {
      const rw = rightWidth;
      const lw = Math.max(1, W - rw);
      const left = padRight(label, lw);
      const right = padLeft(value, rw);
      if (left.length + right.length <= W) L.push(left + right);
      else {
        L.push(label);
        L.push(right);
      }
    };
    const now = new Date().toLocaleString();
    if (layout.show_company === "1" && companyInfo.name)
      pushWrapped(companyInfo.name.toUpperCase());
    if (layout.show_address === "1" && companyInfo.address)
      pushWrapped(companyInfo.address);
    if (layout.show_phone === "1" && companyInfo.phone)
      pushWrapped("Tel: " + companyInfo.phone);
    L.push(sep);
    const headerTitle = "BILL SEMENTARA";
    pushWrapped(headerTitle.toUpperCase());
    if (layout.show_invoice_code === "1") pushWrapped("No: " + (trxNo || "-"));
    pushWrapped(now);
    L.push(sep);
    for (const it of items) {
      const nameLines = wrap(it.name, W);
      if (nameLines.length) L.push(nameLines[0]);
      const qtyPrice = `${it.quantity} x ${formatReceiptCurrency(it.price)}`;
      const totStr = formatReceiptCurrency(it.total);
      const left = Math.max(0, W - qtyPrice.length - totStr.length);
      L.push(qtyPrice + " ".repeat(left) + totStr);
      for (let i = 1; i < nameLines.length; i++) L.push(nameLines[i]);
    }
    L.push(sep);
    const lblSubtotal = layout.label_subtotal || "Subtotal";
    const lblTax = layout.label_tax || "PPN";
    const lblTotal = layout.label_total || "TOTAL";
    pushRight(lblSubtotal, formatReceiptCurrency(totals.subtotal));
    if (totals.disc > 0)
      pushRight("Diskon", "-" + formatReceiptCurrency(totals.disc));
    if (totals.ppn > 0) pushRight(lblTax, formatReceiptCurrency(totals.ppn));
    pushRight(lblTotal, formatReceiptCurrency(totals.total));
    L.push(sep);
    const rawFooter = String(layout.thankyou_text || "Terima kasih");
    const footerLines = rawFooter
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (footerLines.length === 0) footerLines.push("Terima kasih");
    for (const fl of footerLines) {
      const wrapped = wrap(fl, W);
      for (const ln of wrapped) {
        L.push(centerLine(ln));
      }
    }
    if (tableDisplay) {
      L.push("");
      L.push(centerLine(`Meja: ${tableDisplay}`));
    }
    if (cashierName) {
      L.push("");
      L.push(centerLine(`Kasir: ${cashierName}`));
    }
    L.push("\n");
    return L.join("\n");
  };

  const sendToPrinterBackend = async (
    backend: "server" | "local_helper" | "local_helper_apk" | "local_helper_offline",
    opts: {
      host?: string;
      port?: number;
      localHelperId?: string;
      localUsbName?: string;
    },
    text: string,
    cut: boolean,
  ) => {
    if (!text.trim()) return;
    if (backend === "server") {
      const host = (opts.host || printerCfg.host || "").trim();
      const port = opts.port || printerCfg.port || 9100;
      if (!host) return;
      await fetch("/api/print/escpos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, host, port, cut }),
      });
    } else if (backend === "local_helper") {
      const id = opts.localHelperId || "";
      const h = printerCfg.localHelperIp || "127.0.0.1";
      const baseUrl = h.trim().match(/^https?:\/\//)
        ? h.trim().replace(/\/+$/, "")
        : `http://${h.trim()}:27128`;
      try {
        const r = await fetch(`${baseUrl}/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, cut, id }),
        });
        if (!r.ok) {
          const errText = await r.text().catch(() => "");
          console.error(
            "[POS] sendToPrinterBackend local_helper error:",
            r.status,
            errText,
          );
        }
      } catch (e: any) {
        console.error(
          "[POS] sendToPrinterBackend local_helper fetch error:",
          e,
        );
      }
    } else if (backend === "local_helper_apk") {
      const id = opts.localHelperId || "";
      const h = printerCfg.localHelperIp || "127.0.0.1";
      const baseUrl = h.trim().match(/^https?:\/\//)
        ? h.trim().replace(/\/+$/, "")
        : `http://${h.trim()}:27128`;
      try {
        const r = await fetch(`${baseUrl}/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, cut, id }),
        });
        if (!r.ok) {
          const errText = await r.text().catch(() => "");
          console.error(
            "[POS] sendToPrinterBackend local_helper error:",
            r.status,
            errText,
          );
        }
      } catch (e: any) {
        console.error(
          "[POS] sendToPrinterBackend local_helper fetch error:",
          e,
        );
      }
    } else if (backend === "local_helper_offline") {
      const printerName = opts.localUsbName || "";
      if (!printerName) return;
      try {
        const r = await fetch("http://127.0.0.1:27128/print/usb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, cut, printerName }),
        });
        if (!r.ok) {
          const errText = await r.text().catch(() => "");
          console.error(
            "[POS] sendToPrinterBackend offline error:",
            r.status,
            errText,
          );
        }
      } catch (e: any) {
        console.error("[POS] sendToPrinterBackend offline fetch error:", e);
      }
    }
  };

  const buildOrderCaption = (
    trxNo: string,
    items: CartItem[],
    customerName: string | null,
    tableDisplay: string | null,
    opts?: {
      includeHeader?: boolean;
      headerText?: string;
      cashierEmail?: string | null;
      waiterName?: string | null;
    },
  ): string => {
    if (!captionCfg) return "";
    const W = printerCfg.chars;
    const L: string[] = [];
    const includeHeader = opts?.includeHeader !== false;
    const centerLine = (line: string) => {
      const pad = Math.max(0, Math.floor((W - line.length) / 2));
      return " ".repeat(pad) + line;
    };
    if (includeHeader) {
      const header = String(
        opts?.headerText || captionCfg.order_caption_header || "ORDER PESANAN",
      );
      L.push(centerLine(header.toUpperCase()));
    }
    if (tableDisplay) L.push(`Table : ${tableDisplay}`);
    if (opts?.cashierEmail) L.push(String(opts.cashierEmail));
    if (opts?.waiterName) L.push(`Nama Waiters : ${opts.waiterName}`);
    if (customerName) L.push(`Customer : ${customerName}`);
    L.push("".padEnd(W, "="));
    // Items: qty left, name right
    const qtyCol = 3;
    for (const it of items) {
      const qtyStr = String(it.quantity).padStart(qtyCol, " ");
      const nameLines = wrap(it.name, W - (qtyCol + 1));
      if (nameLines.length) L.push(`${qtyStr} ${nameLines[0]}`);
      for (let i = 1; i < nameLines.length; i++) {
        L.push(" ".repeat(qtyCol) + " " + nameLines[i]);
      }
      if (it.modifier) {
        const modLines = wrap(String(it.modifier), W - (qtyCol + 3));
        for (const ml of modLines) L.push(" ".repeat(qtyCol) + " * " + ml);
      }
    }
    // Footer date time local + separator
    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    const dt = `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
    L.push("");
    L.push("".padEnd(W, "="));
    L.push(centerLine(dt));
    // Extra feed lines to ensure footer doesn't get merged into next print
    for (let i = 0; i < 5; i++) {
      L.push("");
    }
    L.push("\n");
    return L.join("\n");
  };

  const tryAutoPrint = async (
    trxNo: string,
    items: CartItem[],
    paid: number,
    change: number,
    tableDisplay?: string | null,
    opts?: { salesName?: string | null; salesEmail?: string | null },
  ) => {
    try {
      console.warn(
        "[POS] tryAutoPrint ENTERED printerCfg:",
        JSON.stringify({
          chars: printerCfg.chars,
          font: printerCfg.font,
          paper: printerCfg.paper,
          condensed: printerCfg.condensed,
          widthMul: printerCfg.widthMul,
          heightMul: printerCfg.heightMul,
          backendMode: printerCfg.backendMode,
          deviceName: printerCfg.deviceName,
        }),
      );
      if (!printerCfg.autoPrint) return;
      // Fetch fresh layout dari server
      let freshLayout: Record<string,string> = {};
      try {
        const r = await fetch("/api/settings?group=printer_layout", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          (d || []).forEach((row: any) => { freshLayout[row.setting_key] = String(row.setting_value ?? ""); });
        }
      } catch {}
      // Gunakan buildRestoReceipt (desain baru)
      const totals = {
        subtotal: rawSubtotal,
        ppn: ppnAmount,
        total,
        disc: discountAmount,
        paid,
        change,
        service: serviceChargeAmt,
      };
      const cashierName = currentUser?.name || "";
      const txtBody = buildRestoReceipt(
        trxNo,
        items,
        paid,
        change,
        tableDisplay,
        freshLayout,
      );
      // ESC/POS: Initialize (ESC @), Select Font (A/B), character size, line spacing, bold
      const escInit = "\x1b@";
      const escFont = printerCfg.font === "A" ? "\x1bM\x00" : "\x1bM\x01";
      const wMul = Math.max(0, Math.min(7, Number(printerCfg.widthMul || 0)));
      const hMul = Math.max(0, Math.min(7, Number(printerCfg.heightMul || 0)));
      const sizeByte = String.fromCharCode(
        ((hMul & 0x07) << 4) | (wMul & 0x07),
      );
      const gsSize = wMul === 0 && hMul === 0 ? "" : "\x1d\x21" + sizeByte;
      // Condensed mode: SI (0x0F) on, DC2 (0x12) off (berlaku untuk Font B di printer thermal Epson-compatible)
      const condensed = printerCfg.condensed && printerCfg.font === "B";
      const siOn = condensed ? "\x0f" : "";
      const dc2Off = condensed ? "" : "";
      // Line spacing lebih rapat untuk 58mm
      const targetLine = Math.max(
        16,
        Math.min(64, Number(printerCfg.lineSpacing || 24) - 2),
      );
      const escLine = "\x1b\x33" + String.fromCharCode(targetLine);
      // ESC E 1 = Bold ON, ESC E 0 = Bold OFF (untuk header)
      const escBoldOn = "\x1bE\x01";
      const escBoldOff = "\x1bE\x00";
      const txt =
        escInit + escFont + gsSize + escLine + siOn + txtBody + dc2Off;
      const copies = Math.max(1, printerCfg.copies);
      if (printerCfg.backendMode === "server") {
        if (!printerCfg.host) return;
        for (let i = 0; i < copies; i++) {
          await fetch("/api/print/escpos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: txt,
              host: printerCfg.host,
              port: printerCfg.port,
              cut: printerCfg.cut && i === copies - 1,
            }),
          });
        }
      } else if (printerCfg.backendMode === "local_helper") {
        const id = printerCfg.localHelperId;
        const h = printerCfg.localHelperIp || "127.0.0.1";
        const baseUrl = h.trim().match(/^https?:\/\//)
          ? h.trim().replace(/\/+$/, "")
          : `http://${h.trim()}:27128`;
        for (let i = 0; i < copies; i++) {
          try {
            const r = await fetch(`${baseUrl}/print`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: txt,
                cut: printerCfg.cut && i === copies - 1,
                id,
              }),
            });
            if (!r.ok) {
              const errText = await r.text().catch(() => "");
              console.error(
                "[POS] local_helper print error:",
                r.status,
                errText,
              );
            }
          } catch (e: any) {
            console.error("[POS] local_helper print fetch error:", e);
          }
        }
      } else if (printerCfg.backendMode === "local_helper_apk") {
        const id = printerCfg.localHelperId;
        const h = printerCfg.localHelperIp || "127.0.0.1";
        const baseUrl = h.trim().match(/^https?:\/\//)
          ? h.trim().replace(/\/+$/, "")
          : `http://${h.trim()}:27128`;
        for (let i = 0; i < copies; i++) {
          try {
            const r = await fetch(`${baseUrl}/print`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: txt,
                cut: printerCfg.cut && i === copies - 1,
                id,
              }),
            });
            if (!r.ok) {
              const errText = await r.text().catch(() => "");
              console.error(
                "[POS] local_helper print error:",
                r.status,
                errText,
              );
            }
          } catch (e: any) {
            console.error("[POS] local_helper print fetch error:", e);
          }
        }
      } else if (printerCfg.backendMode === "local_helper_offline") {
        const printerName = printerCfg.localUsbName;
        for (let i = 0; i < copies; i++) {
          await fetch("http://127.0.0.1:27128/print/usb", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: txt,
              cut: printerCfg.cut && i === copies - 1,
              printerName,
            }),
          });
        }
      } else if (printerCfg.backendMode === "webusb") {
        const {
          printUSB,
          connectUSBPrinter,
          autoConnectFromRemembered,
          getConnectedUSBPrinter,
          isWebUSBSupported,
        } = await import("@/lib/printing/webusb");
        if (!isWebUSBSupported()) return;
        if (!getConnectedUSBPrinter()) {
          if (!(await autoConnectFromRemembered())) {
            await connectUSBPrinter();
          }
        }
        for (let i = 0; i < copies; i++) {
          await printUSB(txt, printerCfg.cut && i === copies - 1);
        }
      } else if (printerCfg.backendMode === "mobile_rawbt") {
        try {
          const base64 =
            typeof window !== "undefined"
              ? btoa(unescape(encodeURIComponent(txt)))
              : "";
          window.location.href = "rawbt:base64," + base64;
        } catch {}
      } else if (printerCfg.backendMode === "android_intent") {
        try {
          // Strip ESC/POS bytes for Android intent (plain text only)
          const cleanBody = txtBody.replace(/[\x00-\x1f]/g, "").replace(/\x7f/g, "");
          const encoded =
            typeof window !== "undefined" ? encodeURIComponent(cleanBody) : "";
          window.location.href =
            "posprint://print?text=" + encoded + "&printer=0";
        } catch {}
      } else if (printerCfg.backendMode === "browser_print") {
        // Strip ESC/POS control bytes, render with pre tag
        const cleanBody = txtBody.replace(/[\x00-\x1f]/g, "").replace(/\x7f/g, "");
        const w = window.open("", "_blank", "width=480,height=640");
        if (w) {
          w.document.write(
            `<pre style="font-family:monospace;white-space:pre-wrap">${cleanBody.replace(/</g, "&lt;")}</pre><script>window.focus();window.print();</script>`,
          );
          w.document.close();
        }
      }
    } catch (e) {
      console.warn("Auto print gagal:", e);
    }
  };

  const tryPrintCaption = async (
    trxNo: string,
    items: CartItem[],
    customerName: string | null,
    tableDisplay: string | null,
  ) => {
    try {
      console.warn(
        "[POS] tryPrintCaption ENTERED items:",
        items.length,
        "captionCfg:",
        JSON.stringify({
          order_caption_enabled: captionCfg?.order_caption_enabled,
          cap_backend_mode: captionCfg?.cap_backend_mode,
          cap_local_usb_name: captionCfg?.cap_local_usb_name,
          cap_network_host: captionCfg?.cap_network_host,
          cap_local_helper_id: captionCfg?.cap_local_helper_id,
        }),
        "kitchenCfg:",
        JSON.stringify({
          kitchen_print_mode: kitchenCfg?.kitchen_print_mode,
          combined_backend_mode: kitchenCfg?.combined_backend_mode,
          combined_local_usb_name: kitchenCfg?.combined_local_usb_name,
          pantry_local_usb_name: kitchenCfg?.pantry_local_usb_name,
          kitchen_local_usb_name: kitchenCfg?.kitchen_local_usb_name,
        }),
      );
      // Read waiter & customer from resto_temp as requested
      let waiterFromTemp: string | null = null;
      let customerFromTemp: string | null = null;
      try {
        const effTableId =
          (selectedTable?.id ?? selectedTable?.table_id ?? tableId) || null;
        let temp: any = null;
        if (effTableId) {
          const res = await fetch(
            `/api/pos/resto-temp?table_id=${encodeURIComponent(String(effTableId))}`,
            { cache: "no-store" },
          );
          if (res.ok) temp = await res.json().catch(() => null);
        }
        // Fallback: if nothing returned (e.g., status already paid), fetch by tempOrderId
        if (!temp && tempOrderId) {
          const res2 = await fetch(
            `/api/pos/resto-temp?id=${encodeURIComponent(String(tempOrderId))}`,
            { cache: "no-store" },
          );
          if (res2.ok) temp = await res2.json().catch(() => null);
        }
        if (temp) {
          waiterFromTemp = temp.waiter_name ? String(temp.waiter_name) : null;
          customerFromTemp = temp.customer_name
            ? String(temp.customer_name)
            : null;
        }
      } catch {}
      const cashierEmail = currentUser?.email || null;
      const effCustomer = customerFromTemp || customerName;
      const captionText = buildOrderCaption(
        trxNo,
        items,
        effCustomer,
        tableDisplay,
        {
          includeHeader: true,
          headerText: String(
            captionCfg.order_caption_header || "ORDER PESANAN",
          ),
          cashierEmail,
          waiterName: waiterFromTemp,
        },
      );
      if (captionCfg && captionCfg.order_caption_enabled === "1") {
        if (!captionText.trim()) return;
        const capMode =
          (captionCfg.cap_backend_mode as
            | "server"
            | "local_helper"
            | "local_helper_apk"
            | "local_helper_offline"
            | undefined) || "server";
        if (capMode === "server") {
          await sendToPrinterBackend(
            "server",
            {
              host: captionCfg.cap_network_host,
              port: Number(captionCfg.cap_network_port || "9100") || 9100,
            },
            captionText,
            true,
          );
        } else if (capMode === "local_helper") {
          await sendToPrinterBackend(
            "local_helper",
            {
              localHelperId: captionCfg.cap_local_helper_id,
            },
            captionText,
            true,
          );
        } else if (capMode === "local_helper_apk") {
          await sendToPrinterBackend(
            "local_helper_apk",
            {
              localHelperId: captionCfg.cap_local_helper_id,
            },
            captionText,
            true,
          );
        } else if (capMode === "local_helper_offline") {
          await sendToPrinterBackend(
            "local_helper_offline",
            {
              localUsbName: captionCfg.cap_local_usb_name,
            },
            captionText,
            true,
          );
        }
      }

      const mode = kitchenCfg.kitchen_print_mode || "combined";
      console.warn("[POS Resto] tryPrintCaption called", {
        trxNo,
        itemsForPrint: items.map((it) => ({
          name: it.name,
          qty: it.quantity,
          kategoriId: it.kategoriId,
        })),
        kitchenMode: mode,
      });
      if (mode === "combined") {
        const baseKitchenText = buildOrderCaption(
          trxNo,
          items,
          effCustomer,
          tableDisplay,
          {
            includeHeader: true,
            headerText: "KITCHEN ORDER",
            cashierEmail,
            waiterName: waiterFromTemp,
          },
        );
        if (!baseKitchenText.trim()) return;
        const bMode =
          (kitchenCfg.combined_backend_mode as
            | "server"
            | "local_helper"
            | "local_helper_apk"
            | "local_helper_offline"
            | undefined) || "server";
        if (bMode === "server") {
          await sendToPrinterBackend(
            "server",
            {
              host: kitchenCfg.combined_network_host,
              port: Number(kitchenCfg.combined_network_port || "9100") || 9100,
            },
            baseKitchenText,
            true,
          );
        } else if (bMode === "local_helper") {
          await sendToPrinterBackend(
            "local_helper",
            {
              localHelperId: kitchenCfg.combined_local_helper_id,
            },
            baseKitchenText,
            true,
          );
        } else if (bMode === "local_helper_apk") {
          await sendToPrinterBackend(
            "local_helper_apk",
            {
              localHelperId: kitchenCfg.combined_local_helper_id,
            },
            baseKitchenText,
            true,
          );
        } else if (bMode === "local_helper_offline") {
          await sendToPrinterBackend(
            "local_helper_offline",
            {
              localUsbName: kitchenCfg.combined_local_usb_name,
            },
            baseKitchenText,
            true,
          );
        }
      } else if (mode === "split") {
        const pantryItems = items.filter((it) => {
          const kid = it.kategoriId != null ? Number(it.kategoriId) : NaN;
          const tgt = !isNaN(kid) ? kategoriPrintMap[kid] || "" : "";
          return tgt === "pantry";
        });
        const kitchenItems = items.filter((it) => {
          const kid = it.kategoriId != null ? Number(it.kategoriId) : NaN;
          const tgt = !isNaN(kid) ? kategoriPrintMap[kid] || "" : "";
          return tgt === "kitchen";
        });

        console.warn("[POS Resto] tryPrintCaption split mode detail", {
          trxNo,
          pantryItems: pantryItems.map((it) => ({
            name: it.name,
            qty: it.quantity,
            kategoriId: it.kategoriId,
          })),
          kitchenItems: kitchenItems.map((it) => ({
            name: it.name,
            qty: it.quantity,
            kategoriId: it.kategoriId,
          })),
        });
        if (pantryItems.length > 0) {
          const pantryText = buildOrderCaption(
            trxNo,
            pantryItems,
            effCustomer,
            tableDisplay,
            {
              includeHeader: true,
              headerText: "PANTRY ORDER",
              cashierEmail,
              waiterName: waiterFromTemp,
            },
          );
          if (pantryText.trim()) {
            const pantryMode =
              (kitchenCfg.pantry_backend_mode as
                | "server"
                | "local_helper"
                | "local_helper_apk"
                | "local_helper_offline"
                | undefined) || "server";
            try {
              if (pantryMode === "server") {
                await sendToPrinterBackend(
                  "server",
                  {
                    host: kitchenCfg.pantry_network_host,
                    port:
                      Number(kitchenCfg.pantry_network_port || "9100") || 9100,
                  },
                  pantryText,
                  true,
                );
              } else if (pantryMode === "local_helper") {
                await sendToPrinterBackend(
                  "local_helper",
                  {
                    localHelperId: kitchenCfg.pantry_local_helper_id,
                  },
                  pantryText,
                  true,
                );
              } else if (pantryMode === "local_helper_apk") {
                await sendToPrinterBackend(
                  "local_helper_apk",
                  {
                    localHelperId: kitchenCfg.pantry_local_helper_id,
                  },
                  pantryText,
                  true,
                );
              } else if (pantryMode === "local_helper_offline") {
                await sendToPrinterBackend(
                  "local_helper_offline",
                  {
                    localUsbName: kitchenCfg.pantry_local_usb_name,
                  },
                  pantryText,
                  true,
                );
              }
            } catch (err) {
              console.warn("Print pantry gagal (split mode):", err);
            }
          }
        }
        if (kitchenItems.length > 0) {
          const kitchenText = buildOrderCaption(
            trxNo,
            kitchenItems,
            effCustomer,
            tableDisplay,
            {
              includeHeader: true,
              headerText: "KITCHEN ORDER",
              cashierEmail,
              waiterName: waiterFromTemp,
            },
          );
          if (kitchenText.trim()) {
            const kitchenMode =
              (kitchenCfg.kitchen_backend_mode as
                | "server"
                | "local_helper"
                | "local_helper_apk"
                | "local_helper_offline"
                | undefined) || "server";
            try {
              if (kitchenMode === "server") {
                await sendToPrinterBackend(
                  "server",
                  {
                    host: kitchenCfg.kitchen_network_host,
                    port:
                      Number(kitchenCfg.kitchen_network_port || "9100") || 9100,
                  },
                  kitchenText,
                  true,
                );
              } else if (kitchenMode === "local_helper") {
                await sendToPrinterBackend(
                  "local_helper",
                  {
                    localHelperId: kitchenCfg.kitchen_local_helper_id,
                  },
                  kitchenText,
                  true,
                );
              } else if (kitchenMode === "local_helper_apk") {
                await sendToPrinterBackend(
                  "local_helper_apk",
                  {
                    localHelperId: kitchenCfg.kitchen_local_helper_id,
                  },
                  kitchenText,
                  true,
                );
              } else if (kitchenMode === "local_helper_offline") {
                await sendToPrinterBackend(
                  "local_helper_offline",
                  {
                    localUsbName: kitchenCfg.kitchen_local_usb_name,
                  },
                  kitchenText,
                  true,
                );
              }
            } catch (err) {
              console.warn("Print kitchen gagal (split mode):", err);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Print Caption Order gagal:", e);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDiscountPercent(customer.discountPercent || 0);
    setShowCustomerModal(false);
    setSearchCustomer("");
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      alert("Nama customer harus diisi");
      return;
    }
    try {
      const response = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code:
            (newCustomerName || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 10) || `CUST${Date.now()}`,
          name: newCustomerName,
          discountPercent: 0,
        }),
      });
      if (response.ok) {
        const newCustomer = await response.json();
        setCustomers((prev) => [...prev, newCustomer]);
        setSelectedCustomer(newCustomer);
        setDiscountPercent(0);
        setShowCreateCustomerModal(false);
        setNewCustomerName("");
        alert("Customer berhasil ditambahkan!");
      } else {
        alert("Gagal menambahkan customer");
      }
    } catch (error) {
      console.error("Error creating customer:", error);
      alert("Terjadi kesalahan saat menambahkan customer");
    }
  };

  const handlePayment = async () => {
    if (isPaying) return;
    if (!canPay) {
      console.warn("Payment blocked: canPay is false");
      return;
    }
    if (cart.length === 0) {
      alert("Keranjang kosong");
      return;
    }

    // Build payments array for API
    const paymentsForApi = payments
      .filter((p) => p.amount > 0)
      .map((p) => ({
        method: p.method,
        amount: p.amount,
        bankId: p.bankId,
        cardNumber: p.cardNumber.trim() || null,
      }));

    if (paymentsForApi.length === 0) {
      alert("Nominal pembayaran harus diisi");
      return;
    }

    const totalPaidNow = paymentsForApi.reduce((sum, p) => sum + p.amount, 0);
    const cashPaidNow = paymentsForApi
      .filter((p) => p.method === "cash")
      .reduce((sum, p) => sum + p.amount, 0);
    const nonCashPaidNow = totalPaidNow - cashPaidNow;

    if (totalPaidNow < total) {
      alert(
        `Total pembayaran (${formatCurrency(totalPaidNow)}) kurang dari total nota (${formatCurrency(total)})`,
      );
      return;
    }
    if (nonCashPaidNow > total) {
      alert("Total pembayaran non-cash tidak boleh melebihi total nota");
      return;
    }

    // Validate non-cash rows have bank
    for (const p of paymentsForApi) {
      if (p.method !== "cash" && !p.bankId) {
        alert(`Bank wajib dipilih untuk pembayaran ${p.method}`);
        return;
      }
      if (
        (p.method === "Debit Card" || p.method === "Credit Card") &&
        !p.cardNumber
      ) {
        alert(`Nomor kartu wajib diisi untuk pembayaran ${p.method}`);
        return;
      }
    }

    setIsPaying(true);
    try {
      const cartSnapshot = [...cart];
      const effPaymentAmount = totalPaidNow;
      const effChangeAmount = Math.max(0, totalPaidNow - total);

      // Get self order UID from first cart item that has it
      const selfOrderUid = cart.find((item) => item.selfOrderUid)?.selfOrderUid ?? null;

      const transactionItems = cart.map((item) => {
        const rawPrice = Number(item.price) || 0;
        const unitPriceEx = includeTax
          ? Math.round(rawPrice / (1 + r))
          : rawPrice;
        const base: any = {
          barangId: item.id,
          quantity: item.quantity,
          unitPrice: unitPriceEx,
          unitPriceIncludeTax: includeTax
            ? rawPrice
            : Math.round(rawPrice * (1 + r)),
          totalPrice: Number(item.price) * Number(item.quantity),
          modifier: item.modifier ?? null,
        };
        if (item.paketId) {
          base.paketId = item.paketId;
          base.paketName = item.paketName;
        }
        return base;
      });
      const transactionData = {
        customerId: selectedCustomer?.id ?? 1,
        jenisCustomerId: selectedCustomer?.jenisCustomerId ?? null,
        items: transactionItems,
        subtotal,
        total,
        transactionType: 1,
        transactionDate: getTodayDate(),
        includeTax,
        ppnPercent,
        ppnAmount,
        discountPercent,
        discountAmount,
        serviceChargePercent: serviceChargePercent,
        serviceChargeAmount: serviceChargeAmt,
        price_include_tax: includeTax ? 1 : 0,
        // Send payments array for multi-payment support
        payments: paymentsForApi,
        // Legacy fields for backward compatibility
        paymentMethod:
          paymentsForApi.length === 1 ? paymentsForApi[0].method : "multi",
        paymentAmount: effPaymentAmount,
        changeAmount: effChangeAmount,
        cardNumber:
          paymentsForApi.find(
            (p) => p.method === "Debit Card" || p.method === "Credit Card",
          )?.cardNumber || null,
        bankId: paymentsForApi.find((p) => p.method !== "cash")?.bankId || null,
        tableId:
          selectedTable?.id ?? selectedTable?.table_id ?? tableId ?? null,
        restoTempId: tempOrderId ?? null,
        Nm_cust: paymentName.trim() || null,
        selfOrderUid,
      };
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      });
      if (!response.ok) {
        let msg = "Failed to create transaction";
        try {
          const rawText = await response.text();
          console.error("POS Resto /api/transactions error response:", rawText);
          try {
            const err = JSON.parse(rawText);
            msg = String(err?.error || err?.details || msg);
          } catch {}
        } catch {}
        alert(msg);
        throw new Error(msg);
      }
      const result = await response.json();
      const trxNo = String(result?.transactionNumber || "");
      const tableDisplay = selectedTable
        ? `${selectedTable.code || ""} - ${selectedTable.name || ""}`.trim()
        : restoTableLabel || null;

      // Update self order status to paid if linked
      if (selfOrderUid) {
        try {
          await fetch(`/api/self-order/order/${selfOrderUid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_status: "paid" }),
          });
        } catch (e) {
          console.warn("Failed to update self order status:", e);
        }
      }

      // 1) Cetak nota penjualan (slip) dengan seluruh isi cart, tunggu selesai kirim.
      try {
        await tryAutoPrint(
          trxNo,
          cartSnapshot,
          effPaymentAmount,
          effChangeAmount,
          tableDisplay,
          {
            salesName: String(result?.sales_name || ""),
            salesEmail: String(result?.sales_email || ""),
          },
        );
      } catch (err) {
        console.warn("Auto print gagal:", err);
      }

      // Explicitly release table lock right after successful payment
      try {
        const tid =
          selectedTable?.id ?? selectedTable?.table_id ?? tableId ?? null;
        if (tid && deviceId) {
          const url = `/api/pos/resto-lock?table_id=${encodeURIComponent(String(tid))}&device_id=${encodeURIComponent(deviceId)}`;
          await fetch(url, { method: "DELETE" });
        }
      } catch {}

      // 2) Jika diminta dari halaman meja untuk hanya cetak nota, lewati caption/kitchen.
      //    Jika tidak, cetak caption/kitchen/bar untuk seluruh isi cart final (seperti POS resto biasa).
      if (!skipCaptionOnPay) {
        if (cartSnapshot.length > 0) {
          try {
            await tryPrintCaption(
              trxNo,
              cartSnapshot,
              paymentName.trim() || selectedCustomer?.name || null,
              tableDisplay,
            );
          } catch (err) {
            console.warn("Print caption gagal:", err);
          }
        }
      }

      // Setelah trigger print, baru reset state & tampilkan alert sukses.
      setCart([]);
      setSelectedCustomer(null);
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentAmountDisplay("");
      setCardNumber("");
      setPaymentMethod("cash");
      setCardType("");
      setSelectedBank(null);
      setSelectedTable(null);
      setShowTableDropdown(false);
      setPaymentName("");
      // Reset multi-payment state
      setPayments([
        {
          method: "cash",
          amount: 0,
          amountDisplay: "",
          bankId: null,
          cardNumber: "",
        },
      ]);

      // Setelah bayar selesai, kembali ke halaman sesuai mode.
      if (typeof window !== "undefined") {
        if (tableId) window.location.href = "/pos/resto-table";
        else window.location.href = "/pos";
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Terjadi kesalahan saat memproses pembayaran");
    } finally {
      setIsPaying(false);
    }
  };

  // Multi-payment validation
  const paymentsClean = payments.filter((p) => p.amount > 0);
  const totalPaid = paymentsClean.reduce((sum, p) => sum + p.amount, 0);
  const cashPaid = paymentsClean
    .filter((p) => p.method === "cash")
    .reduce((sum, p) => sum + p.amount, 0);
  const nonCashPaid = totalPaid - cashPaid;
  const changeAmount = Math.max(0, totalPaid - total);

  // Validation for multi-payment
  const multiPayValid = (() => {
    if (paymentsClean.length === 0) return false;
    if (paymentsClean.length > 2) return false;
    if (totalPaid < total) return false;
    if (nonCashPaid > total) return false;
    // Check non-cash rows have bank selected
    for (const p of paymentsClean) {
      if (p.method !== "cash" && !p.bankId) return false;
      if (
        (p.method === "Debit Card" || p.method === "Credit Card") &&
        !p.cardNumber.trim()
      )
        return false;
    }
    return true;
  })();

  // Legacy validation (kept for backward compat but not used when payments array is active)
  const isNonCashPay = paymentMethod === "transfer" || paymentMethod === "card";
  const payFromDisplay = (() => {
    const raw = String(paymentAmountDisplay || "")
      .replace(/\./g, "")
      .replace(/,/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  })();

  const nominalValid =
    paymentMethod === "cash"
      ? payFromDisplay > 0 && payFromDisplay >= total
      : payFromDisplay > 0 && payFromDisplay === total;

  const nonCashFieldsValid =
    !isNonCashPay ||
    (!!selectedBank && (paymentMethod !== "card" || !!cardNumber.trim()));

  // Use multi-payment validation
  const canPay = !isPaying && cart.length > 0 && total > 0 && multiPayValid;

  // Tombol cepat pembayaran (Cash) berbasis pembulatan ke atas dari total
  const quickPaySuggestions = (() => {
    const t = Math.max(0, Math.round(total || 0));
    if (!t) return [] as number[];
    const roundUp = (value: number, step: number) =>
      Math.ceil(value / step) * step;
    // s1: kelipatan 5.000 terdekat ke atas (contoh 490.600 -> 495.000)
    let s1 = roundUp(t, 5000);
    // s2: s1 + 5.000 (contoh 495.000 -> 500.000)
    let s2 = s1 + 5000;
    // s3: kelipatan 50.000 terdekat ke atas; jika tidak lebih besar dari s2, pakai s2 + 50.000
    let s3 = roundUp(t, 50000);
    if (s3 <= s2) s3 = s2 + 50000;
    // s4: kelipatan 100.000 terdekat ke atas; jika tidak lebih besar dari s3, pakai s3 + 50.000
    let s4 = roundUp(t, 100000);
    if (s4 <= s3) s4 = s3 + 50000;
    return [s1, s2, s3, s4];
  })();

  useEffect(() => {
    const el = posRef.current;
    if (!el) return;
    const update = () => {
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      el.style.height = `calc(100dvh - ${top}px)`;
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      ref={posRef}
      className="w-full max-w-full bg-[#FAFAFA] flex flex-col md:flex-row overflow-hidden gap-2 px-2 md:px-3 lg:px-4"
    >
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-[420px] max-w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#3C3C3C]">
                  Tambah Item
                </h3>
                <p
                  className="text-xs text-slate-500 truncate mt-0.5"
                  title={selectedProduct.name}
                >
                  {selectedProduct.name}
                </p>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {selectedProduct.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedProduct.photoUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <CubeIcon className="w-10 h-10 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <p
                    className="font-semibold text-[#3C3C3C] line-clamp-2"
                    title={selectedProduct.name}
                  >
                    {selectedProduct.name}
                  </p>
                  <p className="text-teal-primary font-bold mt-1.5 text-lg">
                    {formatCurrency(getUnitPrice(selectedProduct))}
                  </p>
                  <div className="flex items-center justify-between gap-3 mt-4">
                    <span className="text-xs text-slate-500 font-medium">
                      Qty
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setProductQty((q) => Math.max(canQtyMinus ? -99 : 1, q - 1))
                        }
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-lg font-bold transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={productQty}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) {
                            setProductQty(0);
                            return;
                          }
                          const clamped = Math.max(
                            canQtyMinus ? -99 : 1,
                            Math.min(999, Math.round(v)),
                          );
                          setProductQty(clamped);
                        }}
                        className="w-16 text-center border border-slate-200 rounded-xl text-sm py-1.5 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-primary/30 focus:border-teal-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setProductQty((q) => q + 1)}
                        className="w-9 h-9 rounded-full bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary flex items-center justify-center text-lg font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <textarea
                  value={productModifier}
                  onChange={(e) => setProductModifier(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-teal-primary/30 focus:border-teal-primary placeholder:text-slate-400"
                  placeholder="Catatan..."
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="flex-1 px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmAddProduct}
                className="flex-[1.2] px-4 py-2.5 rounded-full bg-teal-primary hover:bg-teal-dark text-white text-sm font-semibold transition-colors shadow-sm"
              >
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 p-2 min-w-0 flex flex-col overflow-hidden">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-[#3C3C3C]">
                Point of Sale
              </h1>
              <span suppressHydrationWarning className="text-xs text-slate-400 font-medium whitespace-nowrap">
                {clock.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}{" "}
                {clock.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {restoTableLabel && (
              <div
                className="text-xs text-slate-500 font-medium truncate bg-slate-50 px-3 py-1.5 rounded-full"
                title={restoTableLabel}
              >
                {restoTableLabel}
              </div>
            )}
          </div>
          <div className="p-3 border-b border-slate-100 space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary/30 focus:border-teal-primary bg-slate-50/50 transition-all"
              />
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCatPage((p) => Math.max(0, p - 1))}
                disabled={catPage === 0}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${catPage === 0 ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:bg-slate-100"}`}
                title="Sebelumnya"
              >
                ‹
              </button>
              <div ref={catContainerRef} className="flex gap-1.5 overflow-hidden flex-1">
                {visibleCategories.map((category: any, idx: number) => (
                  <button
                    key={category.id}
                    ref={idx === 0 ? catBtnRef : undefined}
                    onClick={() => setActiveCategory(category.id)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                      activeCategory === category.id
                        ? "bg-teal-primary text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  setCatPage((p) => Math.min(totalCatPages - 1, p + 1))
                }
                disabled={catPage >= totalCatPages - 1}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${catPage >= totalCatPages - 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:bg-slate-100"}`}
                title="Berikutnya"
              >
                ›
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-24 md:pb-3 pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-primary border-t-transparent mx-auto mb-3"></div>
                    <p className="text-slate-500 text-sm">Memuat menu...</p>
                  </div>
                </div>
              ) : activeCategory === "paket" &&
                filteredPaketItems.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <CubeIcon className="w-12 h-12 text-slate-300" />
                    </div>
                    <p className="text-slate-500 text-sm">
                      Tidak ada paket tersedia
                    </p>
                  </div>
                </div>
              ) : activeCategory === "paket" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {filteredPaketItems.map((paket) => (
                    <div
                      key={`paket-${paket.id}`}
                      onClick={() => addPaketToCart(paket)}
                      className="bg-white border border-slate-100 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-teal-primary/30 transition-all duration-150 group flex flex-col h-full"
                    >
                      <div className="w-full aspect-square rounded-lg mb-2.5 overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl mb-1">📦</div>
                          <div className="text-[10px] text-teal-primary font-medium">
                            {paket.itemCount} item
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        <h3
                          className="font-semibold text-xs text-[#3C3C3C] line-clamp-2 group-hover:text-teal-primary transition-colors"
                          title={paket.nama}
                        >
                          {paket.nama}
                        </h3>
                        <p className="font-bold text-teal-primary text-xs mt-1.5">
                          {formatCurrency(paket.hargaJual || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <CubeIcon className="w-12 h-12 text-slate-300" />
                    </div>
                    <p className="text-slate-500 text-sm">
                      Tidak ada menu tersedia
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">
                      Total produk: {products.length}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => openProductModal(product)}
                      className="bg-white border border-slate-100 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-teal-primary/30 transition-all duration-150 group flex flex-col h-full"
                    >
                      <div className="w-full aspect-square rounded-lg mb-2.5 overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center">
                        {product.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.photoUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50">
                            <svg
                              className="w-12 h-12 text-slate-300"
                              viewBox="0 0 48 48"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <rect
                                x="10"
                                y="18"
                                width="28"
                                height="22"
                                rx="4"
                                fill="#2BA8A2"
                                opacity="0.15"
                              />
                              <path
                                d="M7 18h34l-2.5 18H9.5L7 18z"
                                fill="#2BA8A2"
                                opacity="0.3"
                              />
                              <rect
                                x="18"
                                y="8"
                                width="12"
                                height="12"
                                rx="3"
                                fill="#2BA8A2"
                                opacity="0.5"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-h-0">
                        <h3
                          className="font-semibold text-xs text-[#3C3C3C] line-clamp-2 group-hover:text-teal-primary transition-colors"
                          title={product.name}
                        >
                          {product.name}
                        </h3>
                        <p className="font-bold text-[#3C3C3C] text-xs mt-1.5">
                          {formatCurrency(product.prices?.[0]?.price || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      <div className="hidden md:flex md:flex-col md:w-2/5 lg:w-[350px] xl:w-[420px] p-2 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0 relative z-10">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#3C3C3C]">
              Keranjang
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSelfOrderModal(true)}
                className={`text-xs px-2 py-1 rounded-pill border transition-colors ${
                  cart.some((item) => item.selfOrderUid)
                    ? "border-teal-primary bg-teal-primary text-white"
                    : "border-teal-primary text-teal-primary hover:bg-teal-primary/5"
                }`}
              >
                Self Order{cart.find((item) => item.selfOrderUid)?.selfOrderNumber ? ` #${cart.find((item) => item.selfOrderUid)!.selfOrderNumber}` : ""}
              </button>
              <button
                onClick={() =>
                  window.open(
                    "/pos/customer-display",
                    "posCustomerDisplay",
                    "width=1024,height=768",
                  )
                }
                className="text-xs px-2 py-1 rounded-pill border border-teal-primary text-teal-primary hover:bg-teal-primary/5 transition-colors"
              >
                Layar Pelanggan
              </button>
              <span className="text-xs text-slate-400 font-medium">
                {cart.length} item
              </span>
            </div>
          </div>
          <div className="p-3 border-b border-slate-100">
            <button
              onClick={() => setShowCustomerModal(true)}
              className="w-full p-3 border border-slate-200 rounded-xl text-left text-sm hover:border-teal-primary/50 hover:bg-teal-primary/5 transition-all bg-white"
            >
              {selectedCustomer ? (
                <div>
                  <p className="font-semibold text-sm text-[#3C3C3C]">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Diskon: {selectedCustomer.discountPercent}%
                  </p>
                </div>
              ) : (
                <div className="text-slate-500 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Pilih Customer
                </div>
              )}
            </button>
          </div>
          <div className="flex-1 p-3 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center p-4">
                  <svg
                    className="w-20 h-20 mx-auto mb-3 text-slate-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-400">
                    Keranjang kosong
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Pilih produk untuk memulai
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent pr-1">
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2.5 p-2.5 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all ${
                        item.locked ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <h4
                          className="font-semibold text-xs text-[#3C3C3C] truncate"
                          title={item.name}
                        >
                          {item.name}
                          {item.locked && (
                            <span className="ml-1 text-[9px] font-medium text-teal-primary">
                              locked
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {formatCurrency(item.price)} × {item.quantity}
                        </p>
                        {item.modifier && (
                          <p className="text-[10px] text-slate-400 italic truncate mt-0.5">
                            * {item.modifier}
                          </p>
                        )}
                        <p className="text-xs font-bold text-teal-primary mt-1">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            if (!item.locked)
                              updateQuantity(item.id, item.quantity - 1);
                          }}
                          disabled={item.locked}
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition-colors text-sm ${
                            item.locked
                              ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                          }`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-xs font-semibold text-[#3C3C3C]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => {
                            if (!item.locked)
                              updateQuantity(item.id, item.quantity + 1);
                          }}
                          disabled={item.locked}
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition-colors text-sm ${
                            item.locked
                              ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                              : "bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary"
                          }`}
                        >
                          +
                        </button>
                        <button
                          onClick={() => {
                            if (!item.locked) removeFromCart(item.id);
                          }}
                          disabled={item.locked}
                          className={`p-1.5 rounded-full transition-colors ${
                            item.locked
                              ? "text-slate-300 cursor-not-allowed"
                              : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                          }`}
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-slate-100 bg-white mt-auto">
            <div className="space-y-2 text-xs text-slate-600 mb-3">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-[#3C3C3C]">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Diskon</span>
                <span className="text-slate-500">
                  - {formatCurrency(discountAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">PPN</span>
                <span className="text-slate-500">
                  + {formatCurrency(ppnAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="font-bold text-sm text-[#3C3C3C]">Total</span>
                <span className="font-extrabold text-teal-primary text-lg">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {tableId ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTableOrder}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-teal-primary hover:bg-teal-dark disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                    type="button"
                    disabled={isSavingTable}
                  >
                    {isSavingTable ? "Menyimpan..." : "Simpan"}
                  </button>
                  <button
                    onClick={handleCancelTableOrder}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                    type="button"
                  >
                    Batal
                  </button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!hasSavedTemp) clearCart();
                  }}
                  disabled={hasSavedTemp}
                  type="button"
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${hasSavedTemp ? "text-slate-300 bg-slate-50 cursor-not-allowed" : "text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                >
                  Kosongkan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentAmount(0);
                    setPaymentAmountDisplay("");
                    setShowPaymentModal(true);
                  }}
                  className="flex-[2] px-3 py-2.5 rounded-xl bg-[#3C3C3C] hover:bg-[#2A2A2A] text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  Bayar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div
            className="bg-white rounded-2xl w-[780px] max-w-full max-h-[90vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 rounded-t-2xl border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-[#3C3C3C]">Pembayaran</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Info Nota */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
                <div className="space-y-1.5 text-sm order-2 md:order-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold">
                      {formatCurrency(rawSubtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600">Diskon</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={discountPercentInput}
                          onChange={(e) => {
                            const raw = e.target.value
                              .replace(/[^0-9.,]/g, "")
                              .replace(",", ".");
                            setDiscountPercentInput(raw);
                            const num = Math.max(
                              0,
                              Math.min(100, Number(raw) || 0),
                            );
                            setDiscountPercent(num);
                            const amt = Math.max(
                              0,
                              Math.min(
                                rawSubtotal,
                                Math.round(rawSubtotal * (num / 100)),
                              ),
                            );
                            setDiscountAmountInput(
                              amt ? amt.toLocaleString("id-ID") : "",
                            );
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs text-right"
                          placeholder="0"
                        />
                        <span className="text-red-600 text-xs">%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">atau</span>
                        <input
                          type="text"
                          value={discountAmountInput}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            const num = Math.max(
                              0,
                              Math.min(rawSubtotal, Number(raw) || 0),
                            );
                            setDiscountAmountInput(
                              num ? num.toLocaleString("id-ID") : "",
                            );
                            const pct =
                              rawSubtotal > 0
                                ? Math.min(100, (num / rawSubtotal) * 100)
                                : 0;
                            const pctRounded = Math.round(pct * 100) / 100;
                            setDiscountPercent(pctRounded);
                            setDiscountPercentInput(String(pctRounded));
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs text-right"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <span className="text-red-600">
                      {formatCurrency(discountAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sky-600">Service Charge</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={serviceChargePercent.toString()}
                          onChange={(e) => {
                            const raw = e.target.value
                              .replace(/[^0-9.,]/g, "")
                              .replace(",", ".");
                            const num = Math.max(
                              0,
                              Math.min(100, Number(raw) || 0),
                            );
                            setServiceChargePercent(num);
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs text-right"
                          placeholder="0"
                        />
                        <span className="text-sky-600 text-xs">%</span>
                      </div>
                    </div>
                    <span className="text-sky-600">
                      + {formatCurrency(serviceChargeAmt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sky-600">PB1</span>
                    <span className="text-sky-600">
                      + {formatCurrency(ppnAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t">
                    <span className="font-bold">Total Nota</span>
                    <span className="font-extrabold text-teal-primary">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
                <div className="order-1 md:order-2">
                  <div className="text-[11px] text-slate-600 font-bold mb-1">
                    Nama / Keterangan (opsional)
                  </div>
                  <input
                    type="text"
                    value={paymentName}
                    onChange={(e) => setPaymentName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Nama customer atau catatan singkat"
                  />
                  <div className="mt-2">
                    <div className="text-[11px] text-slate-600 font-bold mb-1">
                      No. Meja{" "}
                      <span className="text-slate-400 font-normal">
                        (opsional)
                      </span>
                    </div>
                    <div className="relative" ref={tableDropdownRef}>
                      <input
                        type="text"
                        placeholder={
                          selectedTable
                            ? `${selectedTable.code || ""} - ${selectedTable.name || ""}`
                            : "Cari / pilih meja..."
                        }
                        value={tableSearch}
                        onChange={(e) => {
                          setTableSearch(e.target.value);
                          setShowTableDropdown(true);
                        }}
                        onFocus={() => setShowTableDropdown(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setShowTableDropdown(false);
                          }
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      {showTableDropdown && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-auto">
                          {(tables || [])
                            .filter((t: any) => {
                              const q = tableSearch.toLowerCase();
                              if (!q) return true;
                              const s =
                                `${t.code || ""} ${t.name || ""} ${t.floor_name || ""} ${t.zone || ""}`.toLowerCase();
                              return s.includes(q);
                            })
                            .slice(0, 50)
                            .map((t: any) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  setSelectedTable(t);
                                  setTableSearch("");
                                  setShowTableDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                                title={`${t.code || ""} - ${t.name || ""}`}
                              >
                                <div className="font-medium text-slate-800">
                                  {t.code || ""} - {t.name || ""}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {t.floor_name || "-"}
                                  {t.zone ? ` • ${t.zone}` : ""}
                                </div>
                              </button>
                            ))}
                          {(!tables || tables.length === 0) && (
                            <div className="px-3 py-2 text-sm text-slate-500">
                              Tidak ada data meja
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabel Cara Bayar */}
              <div>
                <div className="text-[11px] text-slate-600 font-bold mb-2">
                  Cara Bayar (maks. 2 metode)
                </div>

                {/* Mobile: card layout */}
                <div className="md:hidden space-y-2">
                  {payments.map((row, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Metode</span>
                        {payments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            ✕ Hapus
                          </button>
                        )}
                      </div>
                      <select
                        value={row.method}
                        onChange={(e) => {
                          const newMethod = e.target.value as PaymentRowType["method"];
                          setPayments((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    method: newMethod,
                                    bankId: newMethod === "cash" ? null : p.bankId,
                                    cardNumber: newMethod === "Debit Card" || newMethod === "Credit Card" ? p.cardNumber : "",
                                    amount: newMethod !== "cash"
                                      ? Math.max(0, total - payments.filter((_, j) => j !== idx).reduce((s, x) => s + x.amount, 0))
                                      : p.amount,
                                    amountDisplay: newMethod !== "cash"
                                      ? Math.max(0, total - payments.filter((_, j) => j !== idx).reduce((s, x) => s + x.amount, 0)).toLocaleString("id-ID")
                                      : p.amountDisplay,
                                  }
                                : p,
                            ),
                          );
                        }}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                      >
                        <option value="cash">Cash</option>
                        <option value="transfer">Transfer</option>
                        <option value="Debit Card">Kartu Debit</option>
                        <option value="Credit Card">Kartu Kredit</option>
                      </select>
                      {row.method !== "cash" && (
                        <>
                          <div>
                            <span className="text-[11px] font-semibold text-slate-600">Bank</span>
                            <select
                              value={row.bankId || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || null;
                                setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, bankId: val } : p)));
                              }}
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs mt-1"
                            >
                              <option value="">Pilih Bank...</option>
                              {banks.map((bank: any) => {
                                const id = bank.id ?? bank.bank_id;
                                const name = bank.bank_name ?? bank.bankName ?? bank.name ?? "Bank";
                                const no = bank.account_number ?? bank.accountNumber ?? bank.no_rek ?? "";
                                return <option key={id} value={id}>{name}{no ? ` - ${no}` : ""}</option>;
                              })}
                            </select>
                          </div>
                        </>
                      )}
                      {(row.method === "Debit Card" || row.method === "Credit Card") && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-600">No Kartu</span>
                          <input
                            type="text"
                            value={row.cardNumber}
                            onChange={(e) => setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, cardNumber: e.target.value } : p)))}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs mt-1"
                            placeholder="No. Kartu"
                          />
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] font-semibold text-slate-600">Nominal</span>
                        <input
                          type="text"
                          value={row.amountDisplay}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, "");
                            const numValue = Number(value) || 0;
                            setPayments((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? { ...p, amount: numValue, amountDisplay: numValue ? numValue.toLocaleString("id-ID") : "" }
                                  : p,
                              ),
                            );
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-right mt-1"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table layout */}
                <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 w-[140px]">Metode</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 w-[160px]">Bank</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 w-[140px]">No Kartu</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 w-[140px]">Nominal</th>
                        <th className="w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((row, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-2 py-2">
                            <select
                              value={row.method}
                              onChange={(e) => {
                                const newMethod = e.target.value as PaymentRowType["method"];
                                setPayments((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? {
                                          ...p,
                                          method: newMethod,
                                          bankId: newMethod === "cash" ? null : p.bankId,
                                          cardNumber: newMethod === "Debit Card" || newMethod === "Credit Card" ? p.cardNumber : "",
                                          amount: newMethod !== "cash"
                                            ? Math.max(0, total - payments.filter((_, j) => j !== idx).reduce((s, x) => s + x.amount, 0))
                                            : p.amount,
                                          amountDisplay: newMethod !== "cash"
                                            ? Math.max(0, total - payments.filter((_, j) => j !== idx).reduce((s, x) => s + x.amount, 0)).toLocaleString("id-ID")
                                            : p.amountDisplay,
                                        }
                                      : p,
                                  ),
                                );
                              }}
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                            >
                              <option value="cash">Cash</option>
                              <option value="transfer">Transfer</option>
                              <option value="Debit Card">Kartu Debit</option>
                              <option value="Credit Card">Kartu Kredit</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            {row.method !== "cash" ? (
                              <select
                                value={row.bankId || ""}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || null;
                                  setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, bankId: val } : p)));
                                }}
                                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                              >
                                <option value="">Pilih Bank...</option>
                                {banks.map((bank: any) => {
                                  const id = bank.id ?? bank.bank_id;
                                  const name = bank.bank_name ?? bank.bankName ?? bank.name ?? "Bank";
                                  const no = bank.account_number ?? bank.accountNumber ?? bank.no_rek ?? "";
                                  return <option key={id} value={id}>{name}{no ? ` - ${no}` : ""}</option>;
                                })}
                              </select>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {row.method === "Debit Card" || row.method === "Credit Card" ? (
                              <input
                                type="text"
                                value={row.cardNumber}
                                onChange={(e) => setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, cardNumber: e.target.value } : p)))}
                                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                                placeholder="No. Kartu"
                              />
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={row.amountDisplay}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, "");
                                const numValue = Number(value) || 0;
                                setPayments((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? { ...p, amount: numValue, amountDisplay: numValue ? numValue.toLocaleString("id-ID") : "" }
                                      : p,
                                  ),
                                );
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-right"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            {payments.length > 1 && (
                              <button type="button" onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 text-xs" title="Hapus baris">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {payments.length < 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = Math.max(
                        0,
                        total - payments.reduce((s, p) => s + p.amount, 0),
                      );
                      setPayments((prev) => [
                        ...prev,
                        {
                          method: "cash",
                          amount: remaining,
                          amountDisplay: remaining
                            ? remaining.toLocaleString("id-ID")
                            : "",
                          bankId: null,
                          cardNumber: "",
                        },
                      ]);
                    }}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    + Tambah Cara Bayar
                  </button>
                )}
                {/* Quick pay buttons for cash */}
                {payments.length === 1 && payments[0].method === "cash" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-[11px] text-slate-500 mr-1">
                      Nominal cepat:
                    </span>
                    {quickPaySuggestions.map((amt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPayments([
                            {
                              method: "cash",
                              amount: amt,
                              amountDisplay: amt.toLocaleString("id-ID"),
                              bankId: null,
                              cardNumber: "",
                            },
                          ]);
                        }}
                        className="px-2 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        {formatCurrency(amt)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setPayments([
                          {
                            method: "cash",
                            amount: total,
                            amountDisplay: total.toLocaleString("id-ID"),
                            bankId: null,
                            cardNumber: "",
                          },
                        ]);
                      }}
                      className="px-2 py-1 rounded border border-teal-light bg-teal-bg text-xs text-teal-dark hover:bg-teal-bg font-semibold"
                    >
                      Uang Pas
                    </button>
                  </div>
                )}
              </div>

              {/* Ringkasan Pembayaran */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total Bayar</span>
                  <span
                    className={`font-semibold ${totalPaid >= total ? "text-teal-primary" : "text-red-600"}`}
                  >
                    {formatCurrency(totalPaid)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Sisa</span>
                  <span
                    className={`font-semibold ${total - totalPaid > 0 ? "text-red-600" : "text-slate-500"}`}
                  >
                    {total - totalPaid > 0
                      ? `Kurang ${formatCurrency(total - totalPaid)}`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-1.5">
                  <span className="font-bold text-slate-700">Kembalian</span>
                  <span className="font-bold text-teal-primary">
                    {formatCurrency(changeAmount)}
                  </span>
                </div>
                {nonCashPaid > total && (
                  <div className="text-xs text-red-600 mt-1">
                    ⚠ Total non-cash tidak boleh melebihi total nota
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 rounded-b-2xl flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount(0);
                  setPaymentAmountDisplay("");
                  setCardNumber("");
                  setSelectedBank(null);
                  setPaymentMethod("cash");
                  setCardType("");
                  setDiscountPercent(0);
                  setDiscountPercentInput("");
                  setDiscountAmountInput("");
                  setPayments([
                    {
                      method: "cash",
                      amount: 0,
                      amountDisplay: "",
                      bankId: null,
                      cardNumber: "",
                    },
                  ]);
                }}
                className="px-3 py-2 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold flex-1"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!canPay) return;
                  handlePayment();
                }}
                disabled={!canPay}
                className={`px-5 py-2.5 rounded-full text-white text-sm font-bold flex-[1.5] transition-all shadow-sm
                  ${canPay ? "bg-[#3C3C3C] hover:bg-[#2A2A2A] cursor-pointer" : "bg-slate-300 cursor-not-allowed"}
                `}
              >
                {isPaying ? "Memproses..." : "Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-96 max-h-96 flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-[#3C3C3C]">Pilih Customer</h3>
              <input
                type="text"
                placeholder="Cari customer..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                className="w-full mt-3 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary/30 focus:border-teal-primary bg-slate-50"
              />
            </div>
            <div className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <div className="space-y-2">
                <button
                  onClick={() => selectCustomer(null as any)}
                  className="w-full p-3.5 text-left border border-slate-200 rounded-xl hover:border-teal-primary/50 hover:bg-teal-primary/5 transition-all bg-white"
                >
                  <p className="font-semibold text-sm text-[#3C3C3C]">
                    Customer Umum
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Tanpa diskon khusus</p>
                </button>
                {customers
                  .filter(
                    (c) =>
                      !searchCustomer ||
                      c.name
                        .toLowerCase()
                        .includes(searchCustomer.toLowerCase()) ||
                      c.code
                        .toLowerCase()
                        .includes(searchCustomer.toLowerCase()),
                  )
                  .map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => selectCustomer(customer)}
                      className="w-full p-3.5 text-left border border-slate-200 rounded-xl hover:border-teal-primary/50 hover:bg-teal-primary/5 transition-all bg-white"
                    >
                      <p className="font-semibold text-sm text-[#3C3C3C]">
                        {customer.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {customer.code} • Diskon {customer.discountPercent}%
                      </p>
                    </button>
                  ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl font-medium transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {showSelfOrderModal && (
        <SelfOrderDialog onClose={() => setShowSelfOrderModal(false)} onPay={(order) => {
          const newItems: typeof cart = order.items.map((item) => ({
            id: item.barang_id,
            code: '',
            name: item.barang_name,
            price: item.price,
            quantity: item.qty,
            total: item.subtotal,
            selfOrderUid: order.uid,
            selfOrderNumber: order.order_number,
          }))
          setCart(newItems)
        }} />
      )}
      {showCreateCustomerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-96 max-h-96 flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-[#3C3C3C]">Customer Baru</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tambah customer baru ke daftar.
              </p>
            </div>
            <div className="p-5 space-y-4 flex-1 overflow-auto">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Kode Customer
                </label>
                <input
                  type="text"
                  value={newCustomerCode}
                  onChange={(e) =>
                    setNewCustomerCode(e.target.value.toUpperCase())
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary/30 focus:border-teal-primary bg-slate-50"
                  placeholder="Cth: CUST001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Nama Customer
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary/30 focus:border-teal-primary bg-slate-50"
                  placeholder="Nama lengkap customer"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2.5">
              <button
                onClick={() => setShowCreateCustomerModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleCreateCustomer}
                className="flex-1 bg-teal-primary hover:bg-teal-dark text-white py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom cart bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100 shadow-lg px-4 py-3 pb-5">
        {cart.length > 0 ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileCart(true)}
              className="flex-1 flex items-center gap-3 min-w-0"
            >
              <div className="w-10 h-10 rounded-full bg-teal-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-teal-primary">
                  {cart.length}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500">
                  Total ({cart.length} item)
                </div>
                <div className="text-base font-extrabold text-[#3C3C3C]">
                  {formatCurrency(total)}
                </div>
              </div>
            </button>
            {tableId ? (
              <button
                onClick={handleSaveTableOrder}
                disabled={isSavingTable}
                className="px-5 py-2.5 rounded-xl bg-teal-primary hover:bg-teal-dark disabled:opacity-60 text-white text-sm font-bold active:scale-95 transition-transform shadow-sm"
              >
                {isSavingTable ? "Menyimpan..." : "Simpan"}
              </button>
            ) : null}
            {tableId ? (
              <button
                onClick={handleCancelTableOrder}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold active:scale-95 transition-transform"
              >
                Batal
              </button>
            ) : null}
            <button
              onClick={() => {
                setPaymentAmount(0);
                setPaymentAmountDisplay("");
                setShowPaymentModal(true);
              }}
              className="px-6 py-2.5 rounded-xl bg-[#3C3C3C] hover:bg-[#2A2A2A] text-white text-sm font-bold active:scale-95 transition-transform shadow-sm"
            >
              Bayar
            </button>
          </div>
        ) : (
          <div className="text-center text-xs text-slate-400 py-1">
            Keranjang kosong — pilih produk di atas
          </div>
        )}
      </div>

      {/* Mobile cart overlay */}
      {showMobileCart && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 flex flex-col">
          <div className="mt-auto bg-white rounded-t-2xl max-h-[70vh] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-sm font-bold text-[#3C3C3C]">
                Keranjang ({cart.length} item)
              </h3>
              <button
                onClick={() => setShowMobileCart(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 p-2.5 border border-slate-100 rounded-xl bg-slate-50/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-[#3C3C3C] truncate">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {formatCurrency(item.price)} × {item.quantity}
                    </div>
                    <div className="text-xs font-bold text-teal-primary mt-0.5">
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.locked}
                      className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-semibold text-[#3C3C3C]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.locked}
                      className="w-7 h-7 rounded-full bg-teal-primary/10 text-teal-primary flex items-center justify-center text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-white space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Total</span>
                <span className="font-extrabold text-teal-primary text-lg">
                  {formatCurrency(total)}
                </span>
              </div>
              {tableId ? (
                <button
                  onClick={() => {
                    handleSaveTableOrder();
                    setShowMobileCart(false);
                  }}
                  disabled={isSavingTable}
                  className="w-full py-2.5 rounded-xl bg-teal-primary hover:bg-teal-dark disabled:opacity-60 text-white text-sm font-bold transition-colors shadow-sm"
                >
                  {isSavingTable ? "Menyimpan..." : "Simpan"}
                </button>
              ) : null}
              {tableId ? (
                <button
                  onClick={() => {
                    handleCancelTableOrder();
                    setShowMobileCart(false);
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
              ) : null}
              <button
                onClick={() => {
                  setShowMobileCart(false);
                  setPaymentAmount(0);
                  setPaymentAmountDisplay("");
                  setShowPaymentModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-[#3C3C3C] hover:bg-[#2A2A2A] text-white text-sm font-bold transition-colors shadow-sm"
              >
                Bayar
              </button>
              <button
                onClick={() => {
                  if (!hasSavedTemp) clearCart();
                  setShowMobileCart(false);
                }}
                disabled={hasSavedTemp}
                className={`w-full py-2 rounded-xl border text-sm transition-colors ${hasSavedTemp ? "text-slate-300 bg-slate-50 cursor-not-allowed" : "text-slate-500 border-slate-200 hover:bg-slate-50"}`}
              >
                Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
