"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { formatCurrency, parseRegionalNumber } from "@/lib/regionalNumber";
import { useRouter } from "next/navigation";
import { showSuccess, showError } from "@/lib/notification";
import { printPurchaseById } from "@/lib/printPurchase";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import FormHeader from "@/components/ui/FormHeader";
import PageLoading from "@/components/ui/PageLoading";
import SearchableSelect from "@/components/ui/SearchableSelect";
import type { SearchableSelectOption } from "@/components/ui/SearchableSelect";
import SupplierPickerModal from "@/components/purchase/SupplierPickerModal";

type Customer = {
  id: number;
  code: string;
  name: string;
  discountPercent: number;
  term?: number;
};

type Warehouse = {
  id: number;
  code: string;
  name: string;
  is_active: number;
};

type Product = {
  id: number;
  code: string;
  name: string;
  kategoriName?: string;
  spesifikasiName?: string;
  hpp?: number;
  units?: { id: number; name: string; ratio: number }[];
  prices?: { unit_id: number; price: number; effectiveDate: string }[];
};

type InvoiceItem = {
  id: string;
  productId: number | null;
  name: string;
  quantity: number;
  unit: string;
  unitRatio: number;
  price: number;
  discountPercent: number;
  disc1Percent: number;
  disc2Percent: number;
  disc3Percent: number;
  discNominal: number;
  bonusProductId: number | null;
  bonusName: string;
  bonusQty: number;
  bonusUnit: string;
  bonusUnitRatio: number;
  grossAmount: number;
  totalDiscount: number;
  netAmount: number;
  poItemId?: number;
  poQtyBase?: number;
  poReceivedBase?: number;
};

export type PurchaseEntryFormInitialItem = {
  productId: number;
  name: string;
  quantity: number;
  unit: string;
  unitRatio: number;
  price: number;
  discountPercent: number;
  disc1Percent: number;
  disc2Percent: number;
  disc3Percent: number;
  discNominal: number;
  bonusProductId?: number | null;
  bonusName?: string;
  bonusQty?: number;
  bonusUnit?: string;
  bonusUnitRatio?: number;
};

export type PurchaseEntryFormInitial = {
  purchaseNumber?: string;
  purchaseDate: string;
  expectedDate?: string;
  invoiceNumber?: string;
  fakturPajak?: string;
  notes?: string;
  supplier?: {
    id: number;
    code: string;
    name: string;
    discountPercent: number;
    term?: number;
  };
  warehouse?: { id: number; code: string; name: string };
  discountPercent: number;
  ppnPercent: number;
  poId?: number | null;
  poNumber?: string;
  pembelianId?: number | null;
  pembelianNumber?: string;
  items: PurchaseEntryFormInitialItem[];
};

export type SubmitPayload = {
  purchaseDate: string;
  expectedDate: string | null;
  invoiceNumber: string | null;
  fakturPajak: string | null;
  notes: string | null;
  supplierId: number;
  warehouseId: number;
  poId: number | null;
  pembelianId: number | null;
  discountPercent: number;
  ppnPercent: number;
  isReturn: boolean;
  items: Array<{
    barangId: number;
    quantity: number;
    unitName: string;
    unitRatio: number;
    unitPrice: number;
    discountPercent: number;
    disc1Percent: number;
    disc2Percent: number;
    disc3Percent: number;
    discNominal: number;
    bonusBarangId: number | null;
    bonusName: string | null;
    bonusQty: number;
    bonusUnit: string | null;
    bonusUnitRatio: number;
    poItemId: number | null;
  }>;
};

export type PurchaseEntryFormProps = {
  title: string;
  subtitle?: string;
  backHref: string;
  isReturn?: boolean;
  readonly?: boolean;
  initial?: PurchaseEntryFormInitial;
  onSubmit?: (
    data: SubmitPayload,
  ) => Promise<{ id: number; purchaseNumber: string } | void>;
  onEdit?: () => void;
  purchaseId?: number;
};

const roundRp = (v: number) => Math.round(v || 0);

const calcItem = (
  qty: number,
  price: number,
  discPct: number,
  d1: number,
  d2: number,
  d3: number,
  discNominal: number = 0,
) => {
  const gross = roundRp(qty * price);
  const discAmt = roundRp(gross * (discPct / 100));
  const afterDisc = gross - discAmt;
  const d1Amt = roundRp(afterDisc * (d1 / 100));
  const after1 = afterDisc - d1Amt;
  const d2Amt = roundRp(after1 * (d2 / 100));
  const after2 = after1 - d2Amt;
  const d3Amt = roundRp(after2 * (d3 / 100));
  const after3 = after2 - d3Amt;
  const discNominalTotal = Math.min(
    Math.max(roundRp(discNominal || 0) * qty, 0),
    Math.max(after3, 0),
  );
  const netAmount = after3 - discNominalTotal;
  const totalDiscount = gross - netAmount;
  return {
    grossAmount: gross,
    totalDiscount,
    netAmount,
  };
};

const applyItem = (item: InvoiceItem): InvoiceItem => {
  const calc = calcItem(
    item.quantity || 0,
    item.price || 0,
    item.discountPercent || 0,
    item.disc1Percent || 0,
    item.disc2Percent || 0,
    item.disc3Percent || 0,
    item.discNominal || 0,
  );
  return {
    ...item,
    grossAmount: calc.grossAmount,
    totalDiscount: calc.totalDiscount,
    netAmount: calc.netAmount,
  };
};

const emptyPurchaseItem = (): InvoiceItem => ({
  id: Date.now().toString(),
  productId: null,
  name: "",
  quantity: 0,
  unit: "",
  unitRatio: 1,
  price: 0,
  discountPercent: 0,
  disc1Percent: 0,
  disc2Percent: 0,
  disc3Percent: 0,
  discNominal: 0,
  bonusProductId: null,
  bonusName: "",
  bonusQty: 0,
  bonusUnit: "",
  bonusUnitRatio: 1,
  grossAmount: 0,
  totalDiscount: 0,
  netAmount: 0,
});

export default function PurchaseEntryForm({
  title,
  subtitle,
  backHref,
  isReturn: isReturnProp = false,
  readonly = false,
  initial,
  onSubmit,
  onEdit,
  purchaseId,
}: PurchaseEntryFormProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [printPrompt, setPrintPrompt] = useState<{
    id: number | null;
    number: string;
  }>({ id: null, number: "" });

  const isReturn = isReturnProp;
  const isBuiltIn = !onSubmit;
  const isEdit = !!initial && !!purchaseId && !readonly
  const headerDisabled = readonly || isEdit

  const [products, setProducts] = useState<Product[]>([]);

  const [purchaseNumber, setPurchaseNumber] = useState(
    initial?.purchaseNumber || "",
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    initial?.invoiceNumber || "",
  );
  const [fakturPajak, setFakturPajak] = useState(initial?.fakturPajak || "");
  const [purchaseDate, setPurchaseDate] = useState(
    initial?.purchaseDate || new Date().toISOString().split("T")[0],
  );
  const [expectedDate, setExpectedDate] = useState(
    initial?.expectedDate ||
      (() => {
        const dd = new Date();
        dd.setDate(dd.getDate() + 30);
        return dd.toISOString().split("T")[0];
      })(),
  );
  const [selectedPO, setSelectedPO] = useState<any>(
    initial?.poId || initial?.poNumber
      ? { id: initial.poId, po_number: initial.poNumber || "" }
      : null,
  );
  const poCache = useRef<Map<number, any>>(new Map());
  const [notes, setNotes] = useState(initial?.notes || "");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    initial?.supplier
      ? {
          id: initial.supplier.id,
          code: initial.supplier.code || "",
          name: initial.supplier.name,
          discountPercent: initial.supplier.discountPercent || 0,
          term: initial.supplier.term,
        }
      : null,
  );
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(
    initial?.warehouse
      ? {
          id: initial.warehouse.id,
          code: initial.warehouse.code || "",
          name: initial.warehouse.name,
          is_active: 1,
        }
      : null,
  );
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (initial?.items && initial.items.length > 0) {
      const mapped = initial.items.map(
        (it, i) =>
          applyItem({
            ...emptyPurchaseItem(),
            id: `${Date.now()}_${i}`,
            productId: it.productId,
            name: it.name,
            quantity: it.quantity || 0,
            unit: it.unit || "",
            unitRatio: it.unitRatio || 1,
            price: it.price || 0,
            discountPercent: it.discountPercent || 0,
            disc1Percent: it.disc1Percent || 0,
            disc2Percent: it.disc2Percent || 0,
            disc3Percent: it.disc3Percent || 0,
            discNominal: it.discNominal || 0,
            bonusProductId: it.bonusProductId ?? null,
            bonusName: it.bonusName || "",
            bonusQty: it.bonusQty || 0,
            bonusUnit: it.bonusUnit || "",
            bonusUnitRatio: it.bonusUnitRatio || 1,
          }),
      );
      return [...mapped, emptyPurchaseItem()];
    }
    return [emptyPurchaseItem()];
  });
  const supplierCache = useRef<Map<number, Customer>>(new Map());
  const [supplierList, setSupplierList] = useState<import('@/components/purchase/SupplierPickerModal').Supplier[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const warehouseCache = useRef<Map<number, Warehouse>>(new Map());

  const [searchProduct, setSearchProduct] = useState("");
  const [showProductModal, setShowProductModal] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(
    initial?.discountPercent ?? 0,
  );
  const [ppnPercent, setPpnPercent] = useState(initial?.ppnPercent ?? 11);
  const [emptyRowSearch, setEmptyRowSearch] = useState("");
  const [allowBackdate, setAllowBackdate] = useState(true);

  const [poStatus, setPoStatus] = useState<"outstanding" | "realisasi">(
    "outstanding",
  );
  const [selectedSourcePurchase, setSelectedSourcePurchase] = useState<any>(
    initial?.pembelianId
      ? {
          id: initial.pembelianId,
          purchase_number: initial.pembelianNumber || "",
        }
      : null,
  );
  const sourcePurchaseCache = useRef<Map<number, any>>(new Map());
  const sourcePurchaseLoaded = useRef(false);

  const subtotal = items.reduce((sum, item) => sum + (item.netAmount || 0), 0);
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const dpp = subtotal - discountAmount;
  const ppnAmount = Math.round(dpp * (ppnPercent / 100));
  const total = dpp + ppnAmount;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (readonly) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setAllowBackdate(
          d.backdate_permissions?.["purchase"] ?? d.allow_backdate === true,
        );
      })
      .catch(() => setAllowBackdate(false));
  }, [readonly]);

  useEffect(() => {
    if (readonly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setShowProductModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readonly]);

  const loadPOOptions = async (
    query: string,
  ): Promise<SearchableSelectOption[]> => {
    try {
      const supplierId = selectedCustomer?.id;
      const params = new URLSearchParams({
        status: "outstanding",
        limit: "50",
      });
      if (query) params.set("q", query);
      if (supplierId) params.set("supplier_id", String(supplierId));
      const res = await fetch(`/api/purchase-orders?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : data || [];
      list.forEach((po: any) => {
        poCache.current.set(po.id, po);
      });
      return list.map((po: any) => ({
        value: po.id,
        label: po.po_number,
        description:
          po.supplier_name || po.total != null
            ? `${po.supplier_name || "-"} • ${po.order_date?.slice(0, 10) || ""}`
            : undefined,
      }));
    } catch {
      return [];
    }
  };

  const handleSelectPO = (po: any) => {
    if (readonly) return;
    try {
      setSelectedPO(po);
      if (po.supplier_id || po.supplier?.id) {
        setSelectedCustomer({
          id: po.supplier_id || po.supplier.id,
          code: po.supplier_code || "",
          name: po.supplier_name || po.supplier?.name || "",
          discountPercent: 0,
        });
      }
      const poDisc =
        Number(po.discount_percent ?? po.discountPercent ?? 0) || 0;
      setDiscountPercent(poDisc);
      if (po.expected_date)
        setExpectedDate(String(po.expected_date).slice(0, 10));

      const mapped = (po.items || [])
        .map((it: any) => {
          const poQty = Number(it.quantity || it.qty || 0);
          const poUnitRatio = Number(it.unit_ratio || 1) || 1;
          const poQtyBase = poQty * poUnitRatio;
          const poReceivedBase =
            Number(it.received_qty_base || 0) ||
            Number(it.received_qty || 0) * poUnitRatio;

          const remainingBase = Math.max(0, poQtyBase - poReceivedBase);
          const remainingQty =
            poUnitRatio > 0 ? remainingBase / poUnitRatio : 0;

          const productId = it.barang_id ?? it.product_id ?? null;
          const nameFromPo = String(it.barang_name ?? it.name ?? "").trim();
          const nameFromMaster = productId
            ? String(
                products.find((p) => p.id === productId)?.name || "",
              ).trim()
            : "";
          const name = nameFromPo || nameFromMaster;

          const price = Number(it.unit_price || it.price || 0);
          const discountPercent = Number(it.discount_percent || 0);
          const subtotal = (remainingQty || 0) * (price || 0);
          const discountAmountFromPo = Number(it.discount_amount || 0);
          const discountAmount = Math.min(
            subtotal,
            Math.max(
              0,
              discountAmountFromPo > 0
                ? discountAmountFromPo
                : Math.round(
                    subtotal * (Math.max(0, discountPercent) / 100),
                  ),
            ),
          );
          const total = Math.max(0, Math.round(subtotal - discountAmount));

          const mappedItem: InvoiceItem = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId,
            name,
            quantity: remainingQty,
            unit: it.unit_name || it.unit || "",
            unitRatio: poUnitRatio,
            price,
            discountPercent: discountPercent,
            disc1Percent: 0,
            disc2Percent: 0,
            disc3Percent: 0,
            discNominal: 0,
            grossAmount: subtotal,
            totalDiscount: discountAmount,
            netAmount: total,
            bonusProductId: null,
            bonusName: "",
            bonusQty: 0,
            bonusUnit: "",
            bonusUnitRatio: 1,
            poItemId: it.id,
            poQtyBase,
            poReceivedBase,
          };
          return applyItem(mappedItem);
        })
        .filter((x: InvoiceItem) => Number(x.quantity || 0) > 0);
      const emptyRow: InvoiceItem = {
        id: Date.now().toString(),
        productId: null,
        name: "",
        quantity: 0,
        unit: "",
        unitRatio: 1,
        price: 0,
        discountPercent: 0,
        disc1Percent: 0,
        disc2Percent: 0,
        disc3Percent: 0,
        discNominal: 0,
        bonusProductId: null,
        bonusName: "",
        bonusQty: 0,
        bonusUnit: "",
        bonusUnitRatio: 1,
        grossAmount: 0,
        totalDiscount: 0,
        netAmount: 0,
      };
      setItems(mapped.length ? [...mapped, emptyRow] : [emptyRow]);
    } catch (err) {
      console.error("Failed to apply PO:", err);
    }
  };

  const handleSelectSourcePurchase = async (id: number) => {
    if (readonly) return;
    if (!isReturn) return;
    try {
      const detRes = await fetch(`/api/purchases?id=${id}&is_return=0`);
      if (!detRes.ok) throw new Error("Gagal mengambil detail pembelian");
      const detail = await detRes.json();
      setSelectedSourcePurchase(detail);
      if (detail.supplier_id) {
        setSelectedCustomer({
          id: detail.supplier_id,
          code: "",
          name: detail.supplier_name || "",
          discountPercent: 0,
        });
      }
    } catch (e: any) {
      alert(`Gagal memuat pembelian sumber: ${e.message}`);
    }
  };

  const ensureSourcePurchasesLoaded = async () => {
    if (sourcePurchaseLoaded.current) return;
    try {
      const res = await fetch("/api/purchases?is_return=0&void=0&limit=100");
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json) ? json : [];
      list.forEach((p: any) => {
        if (Number(p?.void || 0) === 1) return;
        sourcePurchaseCache.current.set(p.id, p);
      });
      sourcePurchaseLoaded.current = true;
    } catch {}
  };

  const loadSourcePurchaseOptions = async (
    query: string,
  ): Promise<SearchableSelectOption[]> => {
    await ensureSourcePurchasesLoaded();
    const q = (query || "").toLowerCase().trim();
    const all = Array.from(sourcePurchaseCache.current.values());
    return all
      .filter((p: any) => {
        if (!q) return true;
        const no = String(p.purchase_number || "").toLowerCase();
        const sup = String(p.supplier_name || "").toLowerCase();
        return no.includes(q) || sup.includes(q);
      })
      .map((p: any) => ({
        value: p.id,
        label: p.purchase_number,
        description: p.supplier_name
          ? `${p.supplier_name} • ${String(p.purchase_date || "").slice(0, 10)}`
          : undefined,
      }));
  };

  const applySupplier = (customer: Customer) => {
    if (readonly) return;
    supplierCache.current.set(customer.id, customer);
    setSelectedCustomer(customer);
    setSelectedPO(null);
    if (typeof customer.discountPercent === "number") {
      setDiscountPercent(customer.discountPercent);
    }
    const termDays = customer.term || 30;
    try {
      const base = new Date(purchaseDate);
      base.setDate(base.getDate() + termDays);
      setExpectedDate(base.toISOString().split("T")[0]);
    } catch {}
  };

  const loadWarehouseOptions = async (
    query: string,
  ): Promise<SearchableSelectOption[]> => {
    if (readonly) return [];
    try {
      const res = await fetch(
        `/api/gudang?q=${encodeURIComponent(query)}&limit=50`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.rows || [];
      const active = list.filter((w: any) => w.is_active && !w.isdelete);
      active.forEach((w: any) => {
        warehouseCache.current.set(w.id, {
          id: w.id,
          code: w.code,
          name: w.name,
          is_active: w.is_active,
        });
      });
      return active.map((w: any) => ({
        value: w.id,
        label: `${w.code} - ${w.name}`,
      }));
    } catch {
      return [];
    }
  };

  const loadData = async () => {
    try {
      const [barangResponse, supplierResponse] = await Promise.all([
        fetch("/api/barang"),
        fetch("/api/supplier"),
      ]);
      if (barangResponse.ok) {
        const barangData = await barangResponse.json();
        const barangList = Array.isArray(barangData)
          ? barangData
          : barangData?.rows || [];
        const activeProducts = barangList.filter((item: any) => item.aktif);
        setProducts(
          activeProducts.map((item: any) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            kategoriName: item.kategoriName,
            spesifikasiName: item.spesifikasiName,
            hpp: item.hpp,
            units: item.units || [],
            prices: item.prices || [],
          })),
        );
      }
      if (supplierResponse.ok) {
        const supplierData = await supplierResponse.json();
        const list = Array.isArray(supplierData) ? supplierData : (supplierData?.rows || []);
        const active = list.filter((c: any) => !c.isdelete);
        setSupplierList(active.map((c: any) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          discountPercent: c.discountPercent || 0,
          term: c.term,
        })));
        active.forEach((c: any) => {
          supplierCache.current.set(c.id, { id: c.id, code: c.code, name: c.name, discountPercent: c.discountPercent || 0, term: c.term });
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const sourceItemMap = useMemo(() => {
    const map = new Map<number, any>();
    if (isReturn && selectedSourcePurchase?.items) {
      for (const it of selectedSourcePurchase.items) {
        if (it.barang_id) map.set(Number(it.barang_id), it);
      }
    }
    return map;
  }, [isReturn, selectedSourcePurchase]);

  const filteredProducts = products.filter((product) => {
    if (isReturn && selectedSourcePurchase && !sourceItemMap.has(product.id))
      return false;
    const q = searchProduct.toLowerCase().trim();
    if (!q) return true;
    return (
      product.code.toLowerCase().includes(q) ||
      product.name.toLowerCase().includes(q)
    );
  });

  const handleSelectProduct = (product: Product) => {
    if (readonly) return;
    const smallestUnit =
      product.units?.find((u) => u.ratio === 1) || product.units?.[0];
    const defaultUnit = smallestUnit?.name || "pcs";
    const defaultUnitRatio = smallestUnit?.ratio || 1;

    const srcItem = sourceItemMap.get(product.id);
    const srcQty = srcItem ? Number(srcItem.quantity || 0) : 0;
    const srcPrice = srcItem ? Number(srcItem.unit_price || 0) : 0;
    const srcUnit = srcItem ? srcItem.unit_name || defaultUnit : defaultUnit;
    const srcUnitRatio = srcItem
      ? Number(srcItem.unit_ratio || 1) || 1
      : defaultUnitRatio;
    const srcDiscPct = srcItem ? Number(srcItem.discount_percent || 0) : 0;
    const srcDisc1 = srcItem ? Number(srcItem.disc1_percent || 0) : 0;
    const srcDisc2 = srcItem ? Number(srcItem.disc2_percent || 0) : 0;
    const srcDisc3 = srcItem ? Number(srcItem.disc3_percent || 0) : 0;
    const srcDiscNominal = srcItem
      ? Number(srcItem.disc_nominal || 1) || 1
      : 0;

    const baseItem = {
      productId: product.id,
      name: product.name,
      unit: srcUnit,
      unitRatio: srcUnitRatio,
      price: isReturn && selectedSourcePurchase ? srcPrice : 0,
      quantity: isReturn && selectedSourcePurchase ? srcQty : 0,
      discountPercent: isReturn && selectedSourcePurchase ? srcDiscPct : 0,
      disc1Percent: isReturn && selectedSourcePurchase ? srcDisc1 : 0,
      disc2Percent: isReturn && selectedSourcePurchase ? srcDisc2 : 0,
      disc3Percent: isReturn && selectedSourcePurchase ? srcDisc3 : 0,
      discNominal: isReturn && selectedSourcePurchase ? srcDiscNominal : 0,
    };

    if (activeItemId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id !== activeItemId ? item : applyItem({ ...item, ...baseItem }),
        ),
      );
      setActiveItemId(null);
      setShowProductModal(false);
      setSearchProduct("");
      return;
    }

    setItems((prev) => {
      const emptyRowIndex = prev.findIndex((item) => !item.productId);
      if (emptyRowIndex >= 0) {
        const updated = prev.map((item, index) =>
          index === emptyRowIndex ? applyItem({ ...item, ...baseItem }) : item,
        );
        const selectedItem = updated[emptyRowIndex];
        setTimeout(() => {
          const qtyInput = document.querySelector(
            `input[data-itemid="${selectedItem.id}"][data-field="quantity"]`,
          ) as HTMLInputElement;
          if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
          }
        }, 100);
        return [...updated, emptyPurchaseItem()];
      }
      const newItem = applyItem({ ...emptyPurchaseItem(), ...baseItem });
      setTimeout(() => {
        const qtyInput = document.querySelector(
          `input[data-itemid="${newItem.id}"][data-field="quantity"]`,
        ) as HTMLInputElement;
        if (qtyInput) {
          qtyInput.focus();
          qtyInput.select();
        }
      }, 100);
      return [...prev, newItem, emptyPurchaseItem()];
    });

    setSearchProduct("");
    setShowProductModal(false);
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    if (readonly) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id !== id
          ? item
          : applyItem({ ...item, quantity: quantity || 0 }),
      ),
    );
  };

  const updateItemPrice = (id: string, price: number) => {
    if (readonly) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id !== id ? item : applyItem({ ...item, price: price || 0 }),
      ),
    );
  };

  const updateItemUnit = (id: string, unit: string) => {
    if (readonly) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.productId) return item;
        const product = products.find((p) => p.id === item.productId);
        const selectedUnit = product?.units?.find((u: any) => u.name === unit);
        const unitRatio = selectedUnit?.ratio ?? item.unitRatio;
        return applyItem({ ...item, unit, unitRatio });
      }),
    );
  };

  const updateItemDisc1 = (id: string, disc1Percent: number) => {
    if (readonly) return;
    const clamped = Math.min(Math.max(disc1Percent || 0, 0), 100);
    setItems((prev) =>
      prev.map((item) =>
        item.id !== id ? item : applyItem({ ...item, disc1Percent: clamped }),
      ),
    );
  };

  const updateItemDisc2 = (id: string, disc2Percent: number) => {
    if (readonly) return;
    const clamped = Math.min(Math.max(disc2Percent || 0, 0), 100);
    setItems((prev) =>
      prev.map((item) =>
        item.id !== id ? item : applyItem({ ...item, disc2Percent: clamped }),
      ),
    );
  };

  const updateItemDisc3 = (id: string, disc3Percent: number) => {
    if (readonly) return;
    const clamped = Math.min(Math.max(disc3Percent || 0, 0), 100);
    setItems((prev) =>
      prev.map((item) =>
        item.id !== id ? item : applyItem({ ...item, disc3Percent: clamped }),
      ),
    );
  };

  const updateItemDiscPercent = (id: string, discountPercent: number) => {
    if (readonly) return;
    const clamped = Math.min(Math.max(discountPercent || 0, 0), 100);
    setItems((prev) =>
      prev.map((item) =>
        item.id !== id
          ? item
          : applyItem({ ...item, discountPercent: clamped }),
      ),
    );
  };

  const updateItemDiscNominal = (id: string, discNominal: number) => {
    if (readonly) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id !== id
          ? item
          : applyItem({
              ...item,
              discNominal: Math.max(0, discNominal || 0),
            }),
      ),
    );
  };

  const updateItemBonus = (
    id: string,
    bonusProductId: number | null,
    bonusName: string,
    bonusQty: number,
    bonusUnit: string,
  ) => {
    if (readonly) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const bpId = bonusProductId ?? (item.productId || null);
        const bpName = bonusName || (bpId === item.productId ? item.name : "");
        return {
          ...item,
          bonusProductId: bpId,
          bonusName: bpName,
          bonusQty,
          bonusUnit,
        };
      }),
    );
  };

  const removeItem = (id: string) => {
    if (readonly) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const buildPayload = (): SubmitPayload | null => {
    if (!selectedCustomer) return null;
    if (!selectedWarehouse) return null;
    const validItems = items.filter(
      (item) => item.productId && item.quantity > 0,
    );
    if (validItems.length === 0) return null;
    return {
      purchaseDate,
      expectedDate: expectedDate || null,
      invoiceNumber: invoiceNumber.trim() || null,
      fakturPajak: fakturPajak.trim() || null,
      notes: notes || null,
      supplierId: selectedCustomer.id,
      warehouseId: selectedWarehouse.id,
      poId: !isReturn ? selectedPO?.id || null : null,
      pembelianId: isReturn ? selectedSourcePurchase?.id || null : null,
      discountPercent,
      ppnPercent,
      isReturn,
      items: validItems.map((item) => ({
        barangId: item.productId!,
        quantity: item.quantity,
        unitName: item.unit,
        unitRatio: item.unitRatio || 1,
        unitPrice: item.price,
        discountPercent: item.discountPercent || 0,
        disc1Percent: item.disc1Percent || 0,
        disc2Percent: item.disc2Percent || 0,
        disc3Percent: item.disc3Percent || 0,
        discNominal: item.discNominal || 0,
        bonusBarangId: item.bonusProductId || null,
        bonusName: item.bonusName || null,
        bonusQty: item.bonusQty || 0,
        bonusUnit: item.bonusUnit || null,
        bonusUnitRatio: item.bonusUnitRatio || 1,
        poItemId: item.poItemId || null,
      })),
    };
  };

  const handleSave = async () => {
    if (readonly) return;
    if (saving) return;
    if (!selectedCustomer) {
      alert("Silakan pilih supplier");
      return;
    }
    if (!selectedWarehouse) {
      alert("Silakan pilih gudang");
      return;
    }

    let workingItems: InvoiceItem[] = [...items];

    if (
      !isReturn &&
      selectedPO &&
      selectedPO.items &&
      selectedPO.items.length > 0
    ) {
      type OverItem = {
        idx: number;
        name: string;
        inputQty: number;
        unit: string;
        poQty: number;
        poReceived: number;
        remaining: number;
      };
      const overItems: OverItem[] = [];

      workingItems.forEach((it, idx) => {
        if (!it.productId || !it.poItemId || !it.unitRatio) return;
        const poQtyBase = Number(it.poQtyBase || 0);
        const poReceivedBase = Number(it.poReceivedBase || 0);
        const remainingBase = Math.max(0, poQtyBase - poReceivedBase);
        if (remainingBase <= 0) return;

        const unitRatio = Number(it.unitRatio || 1) || 1;
        const inputBase = (Number(it.quantity) || 0) * unitRatio;
        if (inputBase > remainingBase + 1e-6) {
          const poQty = poQtyBase / unitRatio;
          const poReceived = poReceivedBase / unitRatio;
          const remaining = remainingBase / unitRatio;
          overItems.push({
            idx,
            name: it.name,
            inputQty: it.quantity,
            unit: it.unit || "",
            poQty,
            poReceived,
            remaining,
          });
        }
      });

      if (overItems.length > 0) {
        const lines = overItems.map((o) => {
          return `- ${o.name}: PO ${o.poQty} ${o.unit}, sudah terima ${o.poReceived} ${o.unit}, sisa ${o.remaining} ${o.unit}, input ${o.inputQty} ${o.unit}`;
        });
        const msg =
          "Qty penerimaan melebihi sisa PO untuk item berikut:\n\n" +
          lines.join("\n") +
          "\n\nKlik OK jika tetap ingin menggunakan qty input.\nKlik Cancel jika ingin menyesuaikan otomatis ke sisa qty PO.";

        const allowOver = window.confirm(msg);

        if (!allowOver) {
          workingItems = workingItems.map((it, idx) => {
            const over = overItems.find((o) => o.idx === idx);
            if (!over) return it;
            return {
              ...it,
              quantity: over.remaining,
            };
          });
          setItems(workingItems);
        }
      }
    }

    if (
      isReturn &&
      selectedSourcePurchase &&
      Array.isArray(selectedSourcePurchase.items)
    ) {
      type OverItem2 = {
        idx: number;
        name: string;
        inputQty: number;
        unit: string;
        maxQty: number;
      };
      const overItems2: OverItem2[] = [];
      const srcItems: any[] = selectedSourcePurchase.items;
      workingItems.forEach((it, idx) => {
        if (!it.productId || !it.unitRatio) return;
        const src = srcItems.find(
          (si) => Number(si.barang_id) === Number(it.productId),
        );
        if (!src) return;
        const srcBase =
          (Number(src.quantity) || 0) * (Number(src.unit_ratio) || 1);
        const inputBase =
          (Number(it.quantity) || 0) * (Number(it.unitRatio) || 1);
        if (inputBase > srcBase + 1e-6) {
          const maxQty = srcBase / (Number(it.unitRatio) || 1);
          overItems2.push({
            idx,
            name: it.name,
            inputQty: it.quantity,
            unit: it.unit || "",
            maxQty,
          });
        }
      });
      if (overItems2.length > 0) {
        const lines = overItems2.map(
          (o) =>
            `- ${o.name}: Maks ${o.maxQty} ${o.unit}, input ${o.inputQty} ${o.unit}`,
        );
        const msg =
          "Qty retur melebihi qty pembelian untuk item berikut:\n\n" +
          lines.join("\n") +
          "\n\nKlik OK untuk menyesuaikan otomatis ke maksimal.\nKlik Cancel untuk tetap menggunakan qty input.";
        const cap = window.confirm(msg);
        if (cap) {
          workingItems = workingItems.map((it, idx) => {
            const over = overItems2.find((o) => o.idx === idx);
            if (!over) return it;
            return { ...it, quantity: over.maxQty };
          });
          setItems(workingItems);
        }
      }
    }

    const validItems = workingItems.filter(
      (item) => item.productId && item.quantity > 0,
    );
    if (validItems.length === 0) {
      alert("Silakan tambahkan minimal 1 item dengan quantity > 0");
      return;
    }

    const finalPayload: SubmitPayload = {
      purchaseDate,
      expectedDate: expectedDate || null,
      invoiceNumber: invoiceNumber.trim() || null,
      fakturPajak: fakturPajak.trim() || null,
      notes: notes || null,
      supplierId: selectedCustomer.id,
      warehouseId: selectedWarehouse.id,
      poId: !isReturn ? selectedPO?.id || null : null,
      pembelianId: isReturn ? selectedSourcePurchase?.id || null : null,
      discountPercent,
      ppnPercent,
      isReturn,
      items: validItems.map((item) => ({
        barangId: item.productId!,
        quantity: item.quantity,
        unitName: item.unit,
        unitRatio: item.unitRatio || 1,
        unitPrice: item.price,
        discountPercent: item.discountPercent || 0,
        disc1Percent: item.disc1Percent || 0,
        disc2Percent: item.disc2Percent || 0,
        disc3Percent: item.disc3Percent || 0,
        discNominal: item.discNominal || 0,
        bonusBarangId: item.bonusProductId || null,
        bonusName: item.bonusName || null,
        bonusQty: item.bonusQty || 0,
        bonusUnit: item.bonusUnit || null,
        bonusUnitRatio: item.bonusUnitRatio || 1,
        poItemId: item.poItemId || null,
      })),
    };

    setSaving(true);
    try {
      if (onSubmit) {
        const result = await onSubmit(finalPayload);
        if (result && result.id) {
          setPrintPrompt({ id: result.id, number: result.purchaseNumber || "-" });
        } else {
          router.push(backHref);
        }
        return;
      }

      const url = isBuiltIn
        ? initial
          ? `/api/purchases/${purchaseId ?? initial.poId ?? ""}`
          : "/api/purchases"
        : "/api/purchases";
      const method = initial ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.details ? ` (${errorData.details})` : '';
        throw new Error((errorData.error || `HTTP ${response.status}`) + detail);
      }

      const result = await response.json();
      const newId = Number(result.id || result.purchaseId);
      const number = String(result.purchaseNumber || "").trim();
      alert(
        `✅ ${isReturn ? "Retur Pembelian" : "Pembelian"} berhasil disimpan!\nNomor: ${number || "-"} `,
      );
      if (isReturn) {
        router.push("/pembelian/retur");
      } else if (newId) {
        setPrintPrompt({ id: newId, number: number || "-" });
      } else {
        router.push(backHref);
      }
    } catch (error: any) {
      console.error("Save error:", error);
      alert(`❌ Gagal menyimpan: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const displayItems = readonly
    ? items.filter(
        (it) =>
          it.productId != null || (it.name && it.name.trim().length > 0),
      )
    : items;

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="p-3 max-w-full mx-auto space-y-4">
      <FormHeader
        title={title}
        subtitle={subtitle}
        backHref={backHref}
      />

      <div className="container-card p-3 text-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 pb-3 border-b">
          <FormField label={isReturn ? "No. Retur" : "No. Pembelian"}>
            <Input
              type="text"
              value={purchaseNumber}
              disabled
              placeholder={
                isReturn
                  ? "Akan digenerate saat disimpan"
                  : "Akan digenerate saat disimpan"
              }
              className="text-xs"
            />
          </FormField>

          <FormField
            label={isReturn ? "Tanggal Retur" : "Tanggal Pembelian"}
            required
          >
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              disabled={headerDisabled}
              className="text-xs"
            />
          </FormField>

          <FormField label="Supplier" required>
            {headerDisabled ? (
              <Input type="text" value={selectedCustomer ? `${selectedCustomer.code} - ${selectedCustomer.name}` : '-'} disabled className="text-xs" />
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <div
                  className={`flex-1 px-3 py-1.5 text-xs border rounded-pill cursor-pointer ${
                    selectedCustomer
                      ? 'border-teal-bg text-slate-800'
                      : 'border-slate-300 text-slate-400'
                  } bg-white hover:border-slate-400`}
                  onClick={() => setShowSupplierModal(true)}
                >
                  {selectedCustomer
                    ? (selectedCustomer.code ? selectedCustomer.code + ' - ' : '') + selectedCustomer.name
                    : 'Klik untuk pilih supplier...'}
                </div>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0"
                  >
                    Hapus
                  </button>
                )}
              </div>
            )}
          </FormField>

          <FormField label="Gudang" required>
            {headerDisabled ? (
              <Input type="text" value={selectedWarehouse ? `${selectedWarehouse.code} - ${selectedWarehouse.name}` : '-'} disabled className="text-xs" />
            ) : (
              <SearchableSelect
                options={[]}
                value={selectedWarehouse?.id ?? null}
                onChange={(v) => {
                  if (v === null) {
                    setSelectedWarehouse(null);
                    return;
                  }
                  const cached = warehouseCache.current.get(Number(v));
                  if (cached) setSelectedWarehouse(cached);
                }}
                loadOptions={loadWarehouseOptions}
                placeholder="Cari gudang..."
                showSearch={true}
                allowClear={false}
                className="w-full"
                inputClassName="text-xs"
              />
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 pb-3 border-b">
          <FormField label="Kode Nota Supplier">
            <Input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              disabled={headerDisabled}
              placeholder="Nomor faktur dari supplier"
              className="text-xs"
            />
          </FormField>
          <FormField label="Faktur Pajak">
            <Input
              type="text"
              value={fakturPajak}
              onChange={(e) => setFakturPajak(e.target.value)}
              disabled={headerDisabled}
              placeholder="Nomor faktur pajak"
              className="text-xs"
            />
          </FormField>

          {!isReturn && (
            <FormField label="Ambil dari PO (Opsional)">
              {headerDisabled ? (
                <Input
                  type="text"
                  value={selectedPO ? selectedPO.po_number || "" : ""}
                  disabled
                  className="text-xs"
                />
              ) : (
                <SearchableSelect
                  key={`po-${selectedCustomer?.id ?? "all"}`}
                  options={[]}
                  value={selectedPO?.id ?? null}
                  onChange={(v) => {
                    if (v === null) {
                      setSelectedPO(null);
                      return;
                    }
                    const cached = poCache.current.get(Number(v));
                    if (cached) handleSelectPO(cached);
                  }}
                  loadOptions={loadPOOptions}
                  placeholder="Cari PO..."
                  showSearch={true}
                  allowClear={false}
                  className="w-full"
                  inputClassName="text-xs"
                />
              )}
            </FormField>
          )}
          {isReturn && (
            <FormField label="Ambil dari Pembelian (Opsional)">
              {headerDisabled ? (
                <Input
                  type="text"
                  value={selectedSourcePurchase
                    ? selectedSourcePurchase.purchase_number || ""
                    : ""}
                  disabled
                  className="text-xs"
                />
              ) : (
                <SearchableSelect
                  options={[]}
                  value={selectedSourcePurchase?.id ?? null}
                  onChange={(v) => {
                    if (readonly) return;
                    if (v === null) {
                      setSelectedSourcePurchase(null);
                      return;
                    }
                    handleSelectSourcePurchase(Number(v));
                  }}
                  loadOptions={loadSourcePurchaseOptions}
                  placeholder="Cari No. Pembelian..."
                  showSearch={true}
                  allowClear={false}
                  className="w-full"
                  inputClassName="text-xs"
                />
              )}
            </FormField>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">
              Detail Transaksi
            </h2>
            {!readonly && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={emptyRowSearch}
                  onChange={(e) => setEmptyRowSearch(e.target.value)}
                  placeholder="Scan Barcode / Ketik Kode Barang..."
                  className="w-64 text-xs"
                />
                <Button
                  type="button"
                  onClick={() => setShowProductModal(true)}
                  className="text-xs px-3 py-1.5"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                  Cari
                </Button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-teal-primary to-[#3CC4BD] text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold w-48">
                    Barang
                  </th>
                  <th className="px-2 py-1.5 text-center w-14 text-xs font-semibold">
                    Qty
                  </th>
                  <th className="px-2 py-1.5 text-left w-24 text-xs font-semibold">
                    Satuan
                  </th>
                  <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">
                    Qty Bonus
                  </th>
                  <th className="px-2 py-1.5 text-left w-20 text-xs font-semibold">
                    Sat Bonus
                  </th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">
                    Harga Satuan
                  </th>
                  <th className="px-1 py-1.5 text-right w-14 text-xs font-semibold">
                    Disc%
                  </th>
                  <th className="px-1 py-1.5 text-right w-14 text-xs font-semibold">
                    Disc1%
                  </th>
                  <th className="px-1 py-1.5 text-right w-14 text-xs font-semibold">
                    Disc2%
                  </th>
                  <th className="px-1 py-1.5 text-right w-14 text-xs font-semibold">
                    Disc3%
                  </th>
                  <th className="px-1 py-1.5 text-right w-24 text-xs font-semibold">
                    DiscRp
                  </th>
                  <th className="px-2 py-1.5 text-right w-28 text-xs font-semibold">
                    Netto
                  </th>
                  {!readonly && (
                    <th className="px-2 py-1.5 text-center w-16 text-xs font-semibold">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-teal-bg hover:bg-teal-bg/50"
                  >
                    <td className="px-2 py-1.5">
                      {item.productId ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={item.name}
                              readOnly
                              className="flex-1 px-2 py-1 border rounded text-xs bg-slate-50 text-slate-800 font-medium cursor-pointer"
                              onClick={() => {
                                if (readonly) return;
                                setActiveItemId(item.id);
                                setShowProductModal(true);
                              }}
                              title="Klik untuk ganti barang"
                            />
                            {!readonly && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveItemId(item.id);
                                  setShowProductModal(true);
                                }}
                                className="px-2 py-1 text-xs text-teal-primary hover:bg-blue-50 rounded flex items-center"
                                title="Cari barang"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                          {item.bonusName && (
                            <div className="text-[10px] text-teal-primary mt-0.5 truncate">
                              Bonus: {item.bonusName}
                            </div>
                          )}
                        </div>
                      ) : (
                        !readonly && (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="Scan / Ketik Kode Barang..."
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  e.currentTarget.value.trim()
                                ) {
                                  e.currentTarget.value = "";
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-dashed border-slate-300 rounded text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveItemId(null);
                                setShowProductModal(true);
                              }}
                              className="px-2 py-1 text-xs text-teal-primary hover:bg-blue-50 rounded flex items-center"
                              title="Cari barang"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                                />
                              </svg>
                            </button>
                          </div>
                        )
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        placeholder="0"
                        value={item.quantity || ""}
                        onChange={(e) =>
                          updateItemQuantity(item.id, Number(e.target.value))
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="quantity"
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-center disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={item.unit}
                        onChange={(e) =>
                          updateItemUnit(item.id, e.target.value)
                        }
                        disabled={!item.productId || readonly}
                        data-itemid={item.id}
                        data-field="unit"
                        className="w-full px-1.5 py-0.5 border rounded text-xs"
                      >
                        <option value="">-</option>
                        {item.productId &&
                          products
                            .find((p) => p.id === item.productId)
                            ?.units?.map((u: any) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={item.bonusQty}
                        onChange={(e) =>
                          updateItemBonus(
                            item.id,
                            item.bonusProductId,
                            item.bonusName,
                            e.target.value === ""
                              ? 0
                              : Number(e.target.value),
                            item.bonusUnit,
                          )
                        }
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="bonusQty"
                        className="w-full px-1 py-0.5 border rounded text-xs text-center disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={item.bonusUnit}
                        onChange={(e) =>
                          updateItemBonus(
                            item.id,
                            item.bonusProductId,
                            item.bonusName,
                            item.bonusQty,
                            e.target.value,
                          )
                        }
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="unit"
                        className="w-full px-1.5 py-0.5 border rounded text-xs disabled:bg-slate-100 disabled:opacity-60"
                      >
                        <option value="">-</option>
                        {products
                          .find((p) => p.id === item.productId)
                          ?.units?.map((u: any) => (
                            <option key={u.id} value={u.name}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={
                          item.price ? item.price.toLocaleString("id-ID") : "0"
                        }
                        onChange={(e) => {
                          updateItemPrice(
                            item.id,
                            parseRegionalNumber(e.target.value),
                          );
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="price"
                        className="w-full px-1.5 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={item.discountPercent || 0}
                        onChange={(e) =>
                          updateItemDiscPercent(
                            item.id,
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="discountPercent"
                        className="w-full px-1 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={item.disc1Percent || 0}
                        onChange={(e) =>
                          updateItemDisc1(
                            item.id,
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="disc1Percent"
                        className="w-full px-1 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={item.disc2Percent || 0}
                        onChange={(e) =>
                          updateItemDisc2(
                            item.id,
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="disc2Percent"
                        className="w-full px-1 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={item.disc3Percent || 0}
                        onChange={(e) =>
                          updateItemDisc3(
                            item.id,
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="disc3Percent"
                        className="w-full px-1 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="text"
                        value={
                          item.discNominal
                            ? item.discNominal.toLocaleString("id-ID")
                            : "0"
                        }
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          updateItemDiscNominal(
                            item.id,
                            v === "" ? 0 : Number(v),
                          );
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={readonly}
                        data-itemid={item.id}
                        data-field="discNominal"
                        className="w-full px-1 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-teal-primary text-xs">
                      {formatCurrency(item.netAmount || 0)}
                    </td>
                    {!readonly && (
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-30 text-xs"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!readonly && (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs italic">
                <div className="text-slate-500">
                  Scan barcode atau klik &ldquo;Cari&rdquo; untuk menambah item.
                </div>
                {!items.some((i) => !!i.productId) && (
                  <div className="text-red-600">
                    Minimal satu item harus dipilih.
                  </div>
                )}
              </div>
              <Button
                type="button"
                onClick={() =>
                  setItems((prev) => [...prev, emptyPurchaseItem()])
                }
                className="text-xs"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Tambah Item
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-2">
            <FormField label="Catatan">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                readOnly={readonly}
                rows={2}
                placeholder="Catatan tambahan..."
                className="text-xs"
              />
            </FormField>

            <FormField label="Jatuh Tempo">
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                min={purchaseDate}
                disabled={readonly}
                className="text-xs"
              />
            </FormField>
          </div>

          <div>
            <div className="p-3 rounded bg-teal-bg">
              <h3 className="text-xs font-semibold text-slate-700 mb-2">
                Ringkasan
              </h3>

              <div className="space-y-1.5 mb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-xs items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600">Diskon:</span>
                    <input
                      type="number"
                      value={discountPercent === 0 ? "" : discountPercent}
                      onChange={(e) =>
                        setDiscountPercent(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      onFocus={(e) => e.currentTarget.select()}
                      min="0"
                      max="100"
                      disabled={readonly}
                      placeholder="0"
                      className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs text-center"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(discountAmount)}
                  </span>
                </div>

                <div className="flex justify-between text-xs items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600">PPN:</span>
                    <input
                      type="number"
                      value={ppnPercent}
                      onChange={(e) => setPpnPercent(Number(e.target.value))}
                      min="0"
                      max="100"
                      disabled={readonly}
                      className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs text-center"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(ppnAmount)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-300 pt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-800">TOTAL:</span>
                  <span className="text-teal-primary">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!readonly ? (
          <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-teal-bg">
            <Button
              variant="outline"
              onClick={() => {
                setItems([emptyPurchaseItem()]);
                setSelectedCustomer(null);
                setSelectedWarehouse(null);
                setSelectedPO(null);
                setPoStatus("outstanding");
                setSelectedSourcePurchase(null);
                setDiscountPercent(0);
                setPpnPercent(11);
                setNotes("");
                setInvoiceNumber("");
                setFakturPajak("");
                setPurchaseDate(new Date().toISOString().split("T")[0]);
                const next = new Date();
                next.setDate(next.getDate() + 30);
                setExpectedDate(next.toISOString().split("T")[0]);
              }}
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !selectedCustomer ||
                !selectedWarehouse ||
                !items.some((i) => !!i.productId)
              }
            >
              {saving
                ? "Menyimpan..."
                : isReturn
                  ? "Simpan Retur"
                  : "Simpan Pembelian"}
            </Button>
          </div>
        ) : (
          onEdit && (
            <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-teal-bg">
              <Button onClick={onEdit}>Edit</Button>
            </div>
          )
        )}
      </div>

      {showProductModal && !readonly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">
                Cari Barang
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Ketik nama atau kode barang, atau scan barcode
              </p>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ketik nama/kode barang atau scan barcode..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-bg focus:border-teal-primary"
              />
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Kode
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Nama Barang
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Kategori
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Spesifikasi
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-center text-slate-500"
                        >
                          {searchProduct
                            ? "Barang tidak ditemukan"
                            : "Ketik untuk mencari barang"}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-600">
                            {product.code}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {product.name}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {product.kategoriName || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {product.spesifikasiName || "-"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleSelectProduct(product)}
                              className="px-3 py-1 bg-teal-primary hover:bg-teal-dark text-white rounded text-xs font-medium transition-colors"
                            >
                              Pilih
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-between items-center">
              <div className="text-xs text-slate-600">
                Ditemukan:{" "}
                <span className="font-semibold">{filteredProducts.length}</span>{" "}
                barang
              </div>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setSearchProduct("");
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-pill font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {printPrompt.id && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">
                Cetak Slip Pembelian
              </h2>
            </div>
            <div className="px-4 py-3 text-sm text-slate-700 space-y-2">
              <p>Pembelian berhasil disimpan.</p>
              <p>
                Nomor Pembelian:
                <span className="font-mono font-semibold text-slate-900 ml-1">
                  {printPrompt.number || "-"}
                </span>
              </p>
              <p>Apakah Anda ingin langsung mencetak slip pembelian (A5)?</p>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPrintPrompt({ id: null, number: "" });
                  router.push(backHref);
                }}
                className="px-3 py-1.5 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = printPrompt.id;
                  setPrintPrompt({ id: null, number: "" });
                  if (id) {
                    await printPurchaseById(id);
                  }
                  router.push(backHref);
                }}
                className="px-3 py-1.5 rounded bg-teal-primary hover:bg-teal-dark text-xs text-white font-semibold"
              >
                Ya, Cetak
              </button>
            </div>
          </div>
        </div>
      )}

      <SupplierPickerModal
        open={showSupplierModal}
        supplierList={supplierList}
        onSelect={(s) => {
          applySupplier(s);
          setShowSupplierModal(false);
        }}
        onClose={() => setShowSupplierModal(false)}
      />
    </div>
  );
}
