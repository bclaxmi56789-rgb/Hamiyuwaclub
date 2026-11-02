import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Layers,
  FolderTree,
  DollarSign,
  Hash,
  Scale,
  RefreshCw,
  X,
  CheckCircle2,
  Building,
  ShieldAlert,
} from "lucide-react";
import {
  getItemMaster,
  saveItemMaster,
  deleteItemMaster,
  getFixedAssetMaster,
  saveFixedAssetMaster,
  deleteFixedAssetMaster,
} from "@/lib/workspace.functions";
import {
  ITEM_PARENTS,
  FIXED_ASSET_PARENTS,
  COMMON_UOM_OPTIONS,
  type ItemMaster,
  type FixedAssetMaster,
} from "@/lib/receipt-rules";
import { useAppConfig } from "@/lib/app-config";

export const Route = createFileRoute("/items")({
  component: ItemsAndAssetsPage,
});

const ITEM_STORAGE_KEY = "hami_items_master_cache";
const ASSET_STORAGE_KEY = "hami_fixed_asset_master_cache";

function fmt(n: number | undefined | null) {
  return (Number(n) || 0).toLocaleString("ne-NP", { minimumFractionDigits: 2 });
}

function ItemsAndAssetsPage() {
  const appConfig = useAppConfig();
  const getItemsFn = useServerFn(getItemMaster);
  const saveItemFn = useServerFn(saveItemMaster);
  const deleteItemFn = useServerFn(deleteItemMaster);

  const getAssetsFn = useServerFn(getFixedAssetMaster);
  const saveAssetFn = useServerFn(saveFixedAssetMaster);
  const deleteAssetFn = useServerFn(deleteFixedAssetMaster);

  const [activeTab, setActiveTab] = useState<"items" | "assets">("items");

  // State: Items
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemSearch, setItemSearch] = useState("");
  const [itemParentFilter, setItemParentFilter] = useState("all");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);

  // Form state: Item
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemParent, setItemParent] = useState("");
  const [itemSubParent, setItemSubParent] = useState("");
  const [itemUom, setItemUom] = useState("nos");
  const [itemUnits, setItemUnits] = useState<number>(1);
  const [itemAmount, setItemAmount] = useState<number>(0);
  const [savingItem, setSavingItem] = useState(false);

  // State: Fixed Assets
  const [assets, setAssets] = useState<FixedAssetMaster[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetParentFilter, setAssetParentFilter] = useState("all");
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAssetMaster | null>(null);

  // Form state: Fixed Asset
  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetParent, setAssetParent] = useState("");
  const [assetSubParent, setAssetSubParent] = useState("");
  const [assetUom, setAssetUom] = useState("nos");
  const [assetUnits, setAssetUnits] = useState<number>(1);
  const [assetAmount, setAssetAmount] = useState<number>(0);
  const [savingAsset, setSavingAsset] = useState(false);

  // Load Initial Data
  useEffect(() => {
    loadItems();
    loadAssets();
  }, []);

  async function loadItems() {
    setLoadingItems(true);
    try {
      const serverData = await getItemsFn({});
      if (Array.isArray(serverData) && serverData.length > 0) {
        setItems(serverData);
        localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(serverData));
      } else {
        const local = localStorage.getItem(ITEM_STORAGE_KEY);
        if (local) setItems(JSON.parse(local));
      }
    } catch {
      const local = localStorage.getItem(ITEM_STORAGE_KEY);
      if (local) setItems(JSON.parse(local));
    } finally {
      setLoadingItems(false);
    }
  }

  async function loadAssets() {
    setLoadingAssets(true);
    try {
      const serverData = await getAssetsFn({});
      if (Array.isArray(serverData) && serverData.length > 0) {
        setAssets(serverData);
        localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(serverData));
      } else {
        const local = localStorage.getItem(ASSET_STORAGE_KEY);
        if (local) setAssets(JSON.parse(local));
      }
    } catch {
      const local = localStorage.getItem(ASSET_STORAGE_KEY);
      if (local) setAssets(JSON.parse(local));
    } finally {
      setLoadingAssets(false);
    }
  }

  // Auto-generate code helpers
  function generateNextItemCode() {
    const existing = items
      .map((i) => i.item_code)
      .filter((c) => c && c.startsWith("ITM-"))
      .map((c) => parseInt(c.replace("ITM-", ""), 10))
      .filter((n) => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `ITM-${String(next).padStart(3, "0")}`;
  }

  function generateNextAssetCode() {
    const existing = assets
      .map((a) => a.code)
      .filter((c) => c && c.startsWith("FA-"))
      .map((c) => parseInt(c.replace("FA-", ""), 10))
      .filter((n) => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `FA-${String(next).padStart(3, "0")}`;
  }

  // Open Item Form
  function handleOpenItemDialog(item?: ItemMaster) {
    if (item) {
      setEditingItem(item);
      setItemCode(item.item_code);
      setItemName(item.name);
      setItemParent(item.parent || "");
      setItemSubParent(item.sub_parent || "");
      setItemUom(item.uom || "nos");
      setItemUnits(item.units !== undefined ? Number(item.units) : 1);
      setItemAmount(item.amount !== undefined ? Number(item.amount) : Number(item.last_rate) || 0);
    } else {
      setEditingItem(null);
      setItemCode(generateNextItemCode());
      setItemName("");
      setItemParent(ITEM_PARENTS[0] || "");
      setItemSubParent("");
      setItemUom("nos");
      setItemUnits(1);
      setItemAmount(0);
    }
    setItemDialogOpen(true);
  }

  // Save Item
  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemCode.trim() || !itemName.trim()) {
      alert("कृपया सामानको कोड र नाम प्रविष्ट गर्नुहोस्।");
      return;
    }
    setSavingItem(true);
    try {
      const payload: ItemMaster = {
        id: editingItem?.id,
        item_code: itemCode.trim().toUpperCase(),
        name: itemName.trim(),
        parent: itemParent.trim(),
        sub_parent: itemSubParent.trim(),
        uom: itemUom || "nos",
        units: Number(itemUnits) || 1,
        amount: Number(itemAmount) || 0,
        category: "item",
        last_rate: Number(itemAmount) || 0,
        is_active: true,
      };

      let saved: ItemMaster = { ...payload, id: payload.id || `local-${Date.now()}` };
      try {
        const res = await saveItemFn({ data: payload });
        if (res) saved = res;
      } catch {
        // Fallback to local
      }

      setItems((prev) => {
        const next = editingItem
          ? prev.map((x) => (x.id === editingItem.id ? saved : x))
          : [saved, ...prev.filter((x) => x.item_code !== saved.item_code)];
        localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      setItemDialogOpen(false);
    } catch (err: any) {
      alert("सुरक्षित गर्न सकिएन: " + err.message);
    } finally {
      setSavingItem(false);
    }
  }

  // Delete Item
  async function handleDeleteItem(id?: string) {
    if (!id || !confirm("के तपाईं यो सामान मेटाउन निश्चित हुनुहुन्छ?")) return;
    try {
      if (!id.startsWith("local-")) {
        await deleteItemFn({ data: { id } });
      }
    } catch {
      // Local fallback
    }
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Open Asset Form
  function handleOpenAssetDialog(asset?: FixedAssetMaster) {
    if (asset) {
      setEditingAsset(asset);
      setAssetCode(asset.code);
      setAssetName(asset.name);
      setAssetParent(asset.parent || "");
      setAssetSubParent(asset.sub_parent || "");
      setAssetUom(asset.uom || "nos");
      setAssetUnits(asset.units !== undefined ? Number(asset.units) : 1);
      setAssetAmount(asset.amount !== undefined ? Number(asset.amount) : 0);
    } else {
      setEditingAsset(null);
      setAssetCode(generateNextAssetCode());
      setAssetName("");
      setAssetParent(FIXED_ASSET_PARENTS[0] || "");
      setAssetSubParent("");
      setAssetUom("nos");
      setAssetUnits(1);
      setAssetAmount(0);
    }
    setAssetDialogOpen(true);
  }

  // Save Asset
  async function handleSaveAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!assetCode.trim() || !assetName.trim()) {
      alert("कृपया स्थिर सम्पत्तिको कोड र नाम प्रविष्ट गर्नुहोस्।");
      return;
    }
    setSavingAsset(true);
    try {
      const payload: FixedAssetMaster = {
        id: editingAsset?.id,
        code: assetCode.trim().toUpperCase(),
        name: assetName.trim(),
        parent: assetParent.trim(),
        sub_parent: assetSubParent.trim(),
        uom: assetUom || "nos",
        units: Number(assetUnits) || 1,
        amount: Number(assetAmount) || 0,
        is_active: true,
      };

      let saved: FixedAssetMaster = { ...payload, id: payload.id || `local-${Date.now()}` };
      try {
        const res = await saveAssetFn({ data: payload });
        if (res) saved = res;
      } catch {
        // Fallback to local
      }

      setAssets((prev) => {
        const next = editingAsset
          ? prev.map((x) => (x.id === editingAsset.id ? saved : x))
          : [saved, ...prev.filter((x) => x.code !== saved.code)];
        localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      setAssetDialogOpen(false);
    } catch (err: any) {
      alert("सम्पत्ति सुरक्षित गर्न सकिएन: " + err.message);
    } finally {
      setSavingAsset(false);
    }
  }

  // Delete Asset
  async function handleDeleteAsset(id?: string) {
    if (!id || !confirm("के तपाईं यो स्थिर सम्पत्ति मेटाउन निश्चित हुनुहुन्छ?")) return;
    try {
      if (!id.startsWith("local-")) {
        await deleteAssetFn({ data: { id } });
      }
    } catch {
      // Local fallback
    }
    setAssets((prev) => {
      const next = prev.filter((x) => x.id !== id);
      localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const matchesSearch =
        !itemSearch.trim() ||
        i.item_code.toLowerCase().includes(itemSearch.toLowerCase()) ||
        i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (i.parent && i.parent.toLowerCase().includes(itemSearch.toLowerCase())) ||
        (i.sub_parent && i.sub_parent.toLowerCase().includes(itemSearch.toLowerCase()));
      const matchesParent =
        itemParentFilter === "all" || i.parent === itemParentFilter;
      return matchesSearch && matchesParent;
    });
  }, [items, itemSearch, itemParentFilter]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchesSearch =
        !assetSearch.trim() ||
        a.code.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        (a.parent && a.parent.toLowerCase().includes(assetSearch.toLowerCase())) ||
        (a.sub_parent && a.sub_parent.toLowerCase().includes(assetSearch.toLowerCase()));
      const matchesParent =
        assetParentFilter === "all" || a.parent === assetParentFilter;
      return matchesSearch && matchesParent;
    });
  }, [assets, assetSearch, assetParentFilter]);

  // Aggregate stats
  const totalItemUnits = items.reduce((s, x) => s + (Number(x.units) || 0), 0);
  const totalItemValuation = items.reduce(
    (s, x) => s + (Number(x.units) || 1) * (Number(x.amount) || Number(x.last_rate) || 0),
    0
  );
  const uniqueItemParents = Array.from(new Set(items.map((x) => x.parent).filter(Boolean))).length;

  const totalAssetUnits = assets.reduce((s, x) => s + (Number(x.units) || 0), 0);
  const totalAssetValuation = assets.reduce(
    (s, x) => s + (Number(x.units) || 1) * (Number(x.amount) || 0),
    0
  );
  const uniqueAssetParents = Array.from(new Set(assets.map((x) => x.parent).filter(Boolean))).length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                सामग्री तथा स्थिर सम्पत्ति सूची
              </h1>
              <p className="text-sm text-muted-foreground">
                Item Master & Fixed Asset Master (Item Code, Name, Parent, Sub-parent, UOM, Units, Amount)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "items" ? (
            <Button onClick={() => handleOpenItemDialog()} className="gap-1.5 shadow-xs">
              <Plus className="h-4 w-4" />
              <span>नयाँ सामग्री थप्नुहोस्</span>
            </Button>
          ) : (
            <Button onClick={() => handleOpenAssetDialog()} className="gap-1.5 shadow-xs bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="h-4 w-4" />
              <span>नयाँ स्थिर सम्पत्ति थप्नुहोस्</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "items" | "assets")}
        className="w-full"
      >
        <TabsList className="grid w-full sm:w-[480px] grid-cols-2">
          <TabsTrigger value="items" className="gap-2 font-semibold">
            <Package className="h-4 w-4" />
            सामग्री सूची (Item Master)
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {items.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2 font-semibold">
            <Building className="h-4 w-4" />
            स्थिर सम्पत्ति (Fixed Assets)
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {assets.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 1: ITEM MASTER                                          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="items" className="mt-4 space-y-5">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>सामग्री प्रकार</span>
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-bold">{items.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">दर्ता भएका प्रकारहरू</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>जम्मा परिमाण (Units)</span>
                <Scale className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {totalItemUnits.toLocaleString("ne-NP")}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">सबै सामग्रीहरूको कुल एकाइ</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>कुल मूल्याङ्कन रकम</span>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-400">
                रु. {fmt(totalItemValuation)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">एकाइ × दर अनुसार कुल रकम</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>मुख्य वर्ग (Categories)</span>
                <FolderTree className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-bold">{uniqueItemParents}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">सामग्री वर्गीकरण समूहहरू</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 border p-3 rounded-xl">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="कोड, नाम, मुख्य वर्ग वा सहायक वर्ग खोज्नुहोस्..."
                className="pl-9 bg-background"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={itemParentFilter} onValueChange={setItemParentFilter}>
                <SelectTrigger className="w-[220px] bg-background">
                  <SelectValue placeholder="मुख्य वर्ग अनुसार छान्नुहोस्" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">सबै मुख्य वर्गहरू (All Parents)</SelectItem>
                  {ITEM_PARENTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                  {Array.from(new Set(items.map((x) => x.parent).filter(Boolean)))
                    .filter((p) => !ITEM_PARENTS.includes(p!))
                    .map((p) => (
                      <SelectItem key={p} value={p!}>
                        {p}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={loadItems} title="ताजा गर्नुहोस्">
                <RefreshCw className={`h-4 w-4 ${loadingItems ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="px-4 py-3">सामग्री कोड</th>
                    <th className="px-4 py-3">सामग्रीको नाम</th>
                    <th className="px-4 py-3">मुख्य वर्ग (Parent)</th>
                    <th className="px-4 py-3">सहायक वर्ग (Sub Parent)</th>
                    <th className="px-4 py-3 text-center">इकाई (UOM)</th>
                    <th className="px-4 py-3 text-right">परिमाण (Units)</th>
                    <th className="px-4 py-3 text-right">दर / रकम (Amount)</th>
                    <th className="px-4 py-3 text-right">जम्मा रकम (Total)</th>
                    <th className="px-4 py-3 text-center">कार्य</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-muted-foreground">
                        {itemSearch || itemParentFilter !== "all"
                          ? "खोजिए अनुसार कुनै सामग्री फेला परेन।"
                          : "हालसम्म कुनै सामग्री प्रविष्ट गरिएको छैन। 'नयाँ सामग्री थप्नुहोस्' मा क्लिक गर्नुहोस्।"}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const totalVal = (Number(item.units) || 1) * (Number(item.amount) || Number(item.last_rate) || 0);
                      return (
                        <tr key={item.id || item.item_code} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-primary">
                            <Badge variant="outline" className="font-mono bg-primary/5 text-primary">
                              {item.item_code}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {item.parent ? (
                              <Badge variant="secondary" className="bg-muted font-normal">
                                {item.parent}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {item.sub_parent || "—"}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs">
                            <span className="rounded bg-muted px-2 py-0.5 font-medium">{item.uom || "nos"}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            {(Number(item.units) || 0).toLocaleString("ne-NP")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            रु. {fmt(item.amount !== undefined ? item.amount : item.last_rate)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            रु. {fmt(totalVal)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleOpenItemDialog(item)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                title="सम्पादन"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleDeleteItem(item.id)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                title="मेटाउनुहोस्"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 2: FIXED ASSET MASTER                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="assets" className="mt-4 space-y-5">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>स्थिर सम्पत्ति प्रकार</span>
                <Building className="h-4 w-4 text-purple-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-purple-700 dark:text-purple-400">{assets.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">सम्पत्ति वर्ग तथा शीर्षकहरू</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>जम्मा सम्पत्ति एकाइ (Units)</span>
                <Scale className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {totalAssetUnits.toLocaleString("ne-NP")}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">कुल स्थिर सम्पत्ति परिमाण</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>कुल सम्पत्ति लागत/मूल्याङ्कन</span>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-400">
                रु. {fmt(totalAssetValuation)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">संस्थाको कुल स्थिर सम्पत्ति मूल्य</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>मुख्य सम्पत्ति वर्ग</span>
                <FolderTree className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-bold">{uniqueAssetParents}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">गाडी, मेसिनरी, भवन, फर्निचर, आदि</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 border p-3 rounded-xl">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="सम्पत्ति कोड, नाम, मुख्य वर्ग वा सहायक वर्ग खोज्नुहोस्..."
                className="pl-9 bg-background"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={assetParentFilter} onValueChange={setAssetParentFilter}>
                <SelectTrigger className="w-[230px] bg-background">
                  <SelectValue placeholder="मुख्य वर्ग अनुसार छान्नुहोस्" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">सबै मुख्य वर्गहरू (All Parents)</SelectItem>
                  {FIXED_ASSET_PARENTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                  {Array.from(new Set(assets.map((x) => x.parent).filter(Boolean)))
                    .filter((p) => !FIXED_ASSET_PARENTS.includes(p!))
                    .map((p) => (
                      <SelectItem key={p} value={p!}>
                        {p}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={loadAssets} title="ताजा गर्नुहोस्">
                <RefreshCw className={`h-4 w-4 ${loadingAssets ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Assets Table */}
          <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="px-4 py-3">सम्पत्ति कोड (Code)</th>
                    <th className="px-4 py-3">सम्पत्तिको नाम (Name)</th>
                    <th className="px-4 py-3">मुख्य वर्ग (Parent)</th>
                    <th className="px-4 py-3">सहायक वर्ग (Sub Parent)</th>
                    <th className="px-4 py-3 text-center">इकाई (UOM)</th>
                    <th className="px-4 py-3 text-right">परिमाण (Units)</th>
                    <th className="px-4 py-3 text-right">लागत रकम (Amount)</th>
                    <th className="px-4 py-3 text-right">कुल लागत मूल्य (Total)</th>
                    <th className="px-4 py-3 text-center">कार्य</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-muted-foreground">
                        {assetSearch || assetParentFilter !== "all"
                          ? "खोजिए अनुसार कुनै स्थिर सम्पत्ति फेला परेन।"
                          : "हालसम्म कुनै स्थिर सम्पत्ति प्रविष्ट गरिएको छैन। 'नयाँ स्थिर सम्पत्ति थप्नुहोस्' मा क्लिक गर्नुहोस्।"}
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => {
                      const totalVal = (Number(asset.units) || 1) * (Number(asset.amount) || 0);
                      return (
                        <tr key={asset.id || asset.code} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-purple-700 dark:text-purple-400">
                            <Badge variant="outline" className="font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300">
                              {asset.code}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {asset.name}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {asset.parent ? (
                              <Badge variant="secondary" className="bg-muted font-normal">
                                {asset.parent}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {asset.sub_parent || "—"}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs">
                            <span className="rounded bg-muted px-2 py-0.5 font-medium">{asset.uom || "nos"}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            {(Number(asset.units) || 0).toLocaleString("ne-NP")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            रु. {fmt(asset.amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            रु. {fmt(totalVal)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleOpenAssetDialog(asset)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                title="सम्पादन"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleDeleteAsset(asset.id)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                title="मेटाउनुहोस्"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL: ITEM MASTER DIALOG                                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {itemDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg">
                  {editingItem ? "सामग्री सम्पादन गर्नुहोस्" : "नयाँ सामग्री दर्ता (Item Master)"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setItemDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>सामग्री कोड (Item Code) *</Label>
                  <Input
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                    placeholder="उदा. ITM-001"
                    className="font-mono font-bold"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>इकाई (UOM) *</Label>
                  <Select value={itemUom} onValueChange={setItemUom}>
                    <SelectTrigger>
                      <SelectValue placeholder="इकाई छान्नुहोस्" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_UOM_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>सामग्रीको नाम (Item Name) *</Label>
                <Input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="उदा. झाडु (Broom), A4 Paper, पञ्जा (Gloves)"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>मुख्य वर्ग (Parent Category)</Label>
                  <Select value={itemParent} onValueChange={setItemParent}>
                    <SelectTrigger>
                      <SelectValue placeholder="मुख्य वर्ग छान्नुहोस्" />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_PARENTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={itemParent}
                    onChange={(e) => setItemParent(e.target.value)}
                    placeholder="वा नयाँ मुख्य वर्ग लेख्नुहोस्"
                    className="text-xs mt-1"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>सहायक वर्ग (Sub Parent)</Label>
                  <Input
                    value={itemSubParent}
                    onChange={(e) => setItemSubParent(e.target.value)}
                    placeholder="उदा. झाडु/कुचो, मास्क, डिजेल"
                  />
                  <p className="text-[11px] text-muted-foreground">उप-वर्गीकरण वा ब्रान्ड</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="grid gap-1.5">
                  <Label>परिमाण (Units / Quantity)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={itemUnits}
                    onChange={(e) => setItemUnits(Number(e.target.value))}
                    placeholder="1"
                    className="font-mono"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>दर / रकम (Amount - रु.)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={itemAmount}
                    onChange={(e) => setItemAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Total Calculation Note */}
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">कुल मौज्दात मूल्य (Units × Amount):</span>
                <span className="font-bold font-mono text-primary text-sm">
                  रु. {fmt((Number(itemUnits) || 1) * (Number(itemAmount) || 0))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setItemDialogOpen(false)}
                  disabled={savingItem}
                >
                  रद्द गर्नुहोस्
                </Button>
                <Button type="submit" disabled={savingItem} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{savingItem ? "सुरक्षित गर्दै..." : "सुरक्षित गर्नुहोस्"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL: FIXED ASSET MASTER DIALOG                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {assetDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-purple-600" />
                <h3 className="font-bold text-lg">
                  {editingAsset ? "स्थिर सम्पत्ति सम्पादन" : "नयाँ स्थिर सम्पत्ति दर्ता (Fixed Asset Master)"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssetDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>सम्पत्ति कोड (Asset Code) *</Label>
                  <Input
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
                    placeholder="उदा. FA-001"
                    className="font-mono font-bold text-purple-700 dark:text-purple-300"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>इकाई (UOM) *</Label>
                  <Select value={assetUom} onValueChange={setAssetUom}>
                    <SelectTrigger>
                      <SelectValue placeholder="इकाई छान्नुहोस्" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nos">nos (थान / गोटा)</SelectItem>
                      <SelectItem value="set">set (सेट)</SelectItem>
                      <SelectItem value="unit">unit (इकाई)</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="mtr">mtr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>सम्पत्तिको नाम (Asset Name) *</Label>
                <Input
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="उदा. फोहोर संकलन ट्रयाक्टर, कम्प्युटर सिस्टम, काठको टेबल"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>मुख्य वर्ग (Parent Category)</Label>
                  <Select value={assetParent} onValueChange={setAssetParent}>
                    <SelectTrigger>
                      <SelectValue placeholder="मुख्य वर्ग छान्नुहोस्" />
                    </SelectTrigger>
                    <SelectContent>
                      {FIXED_ASSET_PARENTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={assetParent}
                    onChange={(e) => setAssetParent(e.target.value)}
                    placeholder="वा नयाँ मुख्य वर्ग लेख्नुहोस्"
                    className="text-xs mt-1"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>सहायक वर्ग (Sub Parent)</Label>
                  <Input
                    value={assetSubParent}
                    onChange={(e) => setAssetSubParent(e.target.value)}
                    placeholder="उदा. ट्रयाक्टर, टिपर, ल्यापटप, सोफा"
                  />
                  <p className="text-[11px] text-muted-foreground">मोडेल, कम्पनी वा उप-प्रकार</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="grid gap-1.5">
                  <Label>परिमाण (Units / संख्या)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    value={assetUnits}
                    onChange={(e) => setAssetUnits(Number(e.target.value))}
                    placeholder="1"
                    className="font-mono"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>लागत रकम (Amount / Rate - रु.)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={assetAmount}
                    onChange={(e) => setAssetAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Total Calculation Note */}
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 flex items-center justify-between text-xs">
                <span className="font-medium text-purple-900 dark:text-purple-200">कुल सम्पत्ति मूल्य (Units × Amount):</span>
                <span className="font-bold font-mono text-purple-700 dark:text-purple-300 text-sm">
                  रु. {fmt((Number(assetUnits) || 1) * (Number(assetAmount) || 0))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssetDialogOpen(false)}
                  disabled={savingAsset}
                >
                  रद्द गर्नुहोस्
                </Button>
                <Button
                  type="submit"
                  disabled={savingAsset}
                  className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{savingAsset ? "सुरक्षित गर्दै..." : "सुरक्षित गर्नुहोस्"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

