import { useEffect, useState, useMemo, useCallback } from "react";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { ThemeProvider, Box, Button, Modal, Fade, Typography, TextField, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { Plus, Upload, Trash2, Package, Edit, Copy } from "lucide-react";
import { getElectroView } from "@/lib/rpc";
import { useAppTheme } from "../ThemeContext";
import { useToast } from "../useToast";
import { useDataGridTheme } from "../useDataGrid";
import { IOSInput } from "../IOSInput";
import { SelectDropdown } from "../SelectDropdown";
import zhCN from "@/lib/locale";

export interface Product {
  id?: number;
  unit: string;
  productName: string;
  processRoute: string;
  productCode: string;
  productSpec: string;
  productAttribute: string;
  created_at?: string;
}

export function ProductList() {
  const { isDark } = useAppTheme();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [searchSpec, setSearchSpec] = useState("");
  const [attributeFilter, setAttributeFilter] = useState<string>("all");
  const [codePrefixFilter, setCodePrefixFilter] = useState<string>("");
  const [productNameFilter, setProductNameFilter] = useState<string>("");
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Product>({
    unit: "",
    productName: "",
    processRoute: "",
    productCode: "",
    productSpec: "",
    productAttribute: "自制",
  });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getElectroView().rpc!.request.getProducts({});
      setAllProducts(result);
      setProducts(result);

      const prefixResult = await getElectroView().rpc!.request.getAllCodePrefixes({});
      setPrefixes(prefixResult);

      const uniqueNames = [...new Set(result.filter(p => p.productAttribute === "自制" && p.productCode.startsWith("03")).map(p => p.productName).filter(Boolean))].sort();
      setProductNames(uniqueNames);
    } catch (error) {
      console.error("加载产品列表失败:", error);
      showToast("加载产品列表失败", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearch = useCallback(async () => {
    let filtered = allProducts;

    if (searchCode) {
      filtered = filtered.filter(p => p.productCode.toLowerCase().includes(searchCode.toLowerCase()));
    }
    if (searchSpec) {
      filtered = filtered.filter(p => {
        return p.productSpec?.toLowerCase().includes(searchSpec.toLowerCase()) || false;
      });
    }

    if (attributeFilter !== "all") {
      filtered = filtered.filter(p => p.productAttribute === attributeFilter);
    }

    if (attributeFilter === "自制" && codePrefixFilter) {
      filtered = filtered.filter(p => p.productCode.startsWith(codePrefixFilter));
    }

    if (attributeFilter === "自制" && productNameFilter) {
      filtered = filtered.filter(p => p.productName === productNameFilter);
    }

    setProducts(filtered);
  }, [allProducts, searchCode, searchSpec, attributeFilter, codePrefixFilter, productNameFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  const handleCopyProductCode = async (productCode: string) => {
    try {
      await navigator.clipboard.writeText(productCode);
      showToast("产品编号已复制到剪贴板", "success");
    } catch (error) {
      console.error("复制失败:", error);
      showToast("复制失败", "error");
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.productCode || !newProduct.productName) {
      showToast("请填写产品编号和产品名称", "error");
      return;
    }

    try {
      const result = await getElectroView().rpc!.request.addProduct(newProduct);
      if (result.success) {
        showToast("产品添加成功", "success");
        setIsAddModalOpen(false);
        setNewProduct({
          unit: "",
          productName: "",
          processRoute: "",
          productCode: "",
          productSpec: "",
          productAttribute: "自制",
        });
        loadProducts();
      } else {
        showToast(result.error || "添加失败", "error");
      }
    } catch (error) {
      console.error("添加产品失败:", error);
      showToast("添加产品失败", "error");
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct({ ...product });
    setIsEditModalOpen(true);
  };

  const handleSaveEditProduct = async () => {
    if (!editingProduct) return;
    if (!editingProduct.productCode || !editingProduct.productName) {
      showToast("请填写产品编号和产品名称", "error");
      return;
    }

    try {
      const result = await getElectroView().rpc!.request.updateProduct(editingProduct);
      if (result.success) {
        showToast("产品更新成功", "success");
        setIsEditModalOpen(false);
        setEditingProduct(null);
        loadProducts();
      } else {
        showToast(result.error || "更新失败", "error");
      }
    } catch (error) {
      console.error("更新产品失败:", error);
      showToast("更新产品失败", "error");
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      const result = await getElectroView().rpc!.request.deleteProduct({ id });
      if (result.success) {
        showToast("产品删除成功", "success");
        loadProducts();
      } else {
        showToast(result.error || "删除失败", "error");
      }
    } catch (error) {
      console.error("删除产品失败:", error);
      showToast("删除产品失败", "error");
    }
  };

  const handleImportExcel = async () => {
    try {
      const result = await getElectroView().rpc!.request.selectExcelFile({});
      if (result.success && result.path) {
        const filePath = result.path;
        const importResult = await getElectroView().rpc!.request.importProductsFromExcel({ filePath });
        if (importResult.success) {
          showToast(`成功导入 ${importResult.count} 条产品数据`, "success");
          setIsImportModalOpen(false);
          loadProducts();
        } else {
          showToast(importResult.error || "导入失败", "error");
        }
      } else if (result.canceled) {
      } else {
        showToast(result.error || "选择文件失败", "error");
      }
    } catch (error) {
      console.error("导入产品失败:", error);
      showToast("导入产品失败", "error");
    }
  };

  const handleFilterByPrefix = (prefix: string) => {
    setCodePrefixFilter(prefix === codePrefixFilter ? "" : prefix);
    setProductNameFilter("");
  };

  const handleFilterByProductName = (name: string) => {
    setProductNameFilter(name === productNameFilter ? "" : name);
    setCodePrefixFilter("");
  };

  const handleAttributeFilterChange = (value: string) => {
    setAttributeFilter(value);
    setCodePrefixFilter("");
    setProductNameFilter("");
  };

  const theme = useDataGridTheme(isDark);

  const columns: GridColDef[] = [
    {
      field: "productName",
      headerName: "产品名称",
      width: 150,
      editable: false,
    },
    {
      field: "unit",
      headerName: "单位",
      width: 80,
      editable: false,
    },
    {
      field: "processRoute",
      headerName: "工艺路线",
      width: 150,
      editable: false,
    },
    {
      field: "productCode",
      headerName: "产品编号",
      width: 150,
      editable: false,
      renderCell: (p: GridRenderCellParams) => (
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleCopyProductCode(p.value)}>
          <span className="text-sm">{p.value}</span>
          <Copy className="h-3 w-3 text-slate-500 hover:text-blue-500" />
        </div>
      ),
    },
    {
      field: "productSpec",
      headerName: "产品规格",
      width: 150,
      editable: false,
    },
    {
      field: "productAttribute",
      headerName: "产品属性",
      width: 100,
      renderCell: (p: GridRenderCellParams) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            p.value === "自制"
              ? isDark
                ? "bg-green-500/20 text-green-400"
                : "bg-green-100 text-green-700"
              : isDark
              ? "bg-blue-500/20 text-blue-400"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {p.value === "自制" ? "自制" : "外购"}
        </span>
      ),
      editable: false,
    },
    {
      field: "actions",
      headerName: "操作",
      width: 160,
      sortable: false,
      renderCell: (p: GridRenderCellParams) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleEditProduct(p.row)}
            className={`inline-flex h-8 items-center justify-center gap-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer hover:bg-blue-500/20 text-blue-500`}
            title="编辑产品"
          >
            <Edit className="h-3 w-3" />
            编辑
          </button>
          <button
            onClick={() => handleDeleteProduct(p.row.id as number)}
            className={`inline-flex h-8 items-center justify-center gap-1 px-2 rounded text-xs font-medium transition-colors cursor-pointer hover:bg-red-500/20 text-red-500`}
            title="删除产品"
          >
            <Trash2 className="h-3 w-3" />
            删除
          </button>
        </div>
      ),
    },
  ];

  const rows = useMemo(() => {
    return products.map((product, index) => ({
      id: product.id || index,
      ...product,
    }));
  }, [products]);

  const filteredPrefixes = useMemo(() => {
    if (attributeFilter !== "自制") return [];
    return prefixes.filter(prefix => prefix.startsWith("03"));
  }, [prefixes, attributeFilter]);


  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
      }`}
    >
      <div
        className={`px-4 py-3 border-b ${
          isDark ? "border-slate-800 bg-slate-800/30" : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">产品查询</span>
            <span className="text-xs text-slate-500">({products.length}条)</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              <Upload className="h-3 w-3" />
              导入Excel
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              <Plus className="h-3 w-3" />
              添加产品
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <IOSInput
            value={searchCode}
            onChange={(value) => setSearchCode(value)}
            placeholder="产品编号..."
            className="w-40"
          />
          <IOSInput
            value={searchSpec}
            onChange={(value) => setSearchSpec(value)}
            placeholder="产品规格..."
            className="w-40"
          />
          <SelectDropdown
            value={attributeFilter}
            onChange={handleAttributeFilterChange}
            options={[
              { value: "all", label: "全部" },
              { value: "自制", label: "自制" },
              { value: "外购", label: "外购" },
            ]}
          />
          {attributeFilter === "自制" && filteredPrefixes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">编码前缀:</span>
              <div className="flex flex-wrap gap-1">
                {filteredPrefixes.map((prefix) => (
                  <button
                    key={prefix}
                    onClick={() => handleFilterByPrefix(prefix)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                      codePrefixFilter === prefix
                        ? isDark
                          ? "bg-blue-500 text-white"
                          : "bg-blue-500 text-white"
                        : isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {prefix}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(codePrefixFilter || productNameFilter) && (
            <button
              onClick={() => {
                setCodePrefixFilter("");
                setProductNameFilter("");
              }}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-red-50 text-red-600 hover:bg-red-100"
              }`}
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Package className="h-12 w-12 text-slate-600 mb-4 opacity-20" />
          <p className="text-sm text-slate-500">暂无产品数据</p>
        </div>
      ) : (
        <ThemeProvider theme={theme}>
          <Box sx={{ height: "calc(100vh - 320px)" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              initialState={{
                pagination: { paginationModel: { pageSize: 50 } },
              }}
              localeText={zhCN}
              pageSizeOptions={[50, 100, 200]}
              disableRowSelectionOnClick
              rowHeight={48}
              columnHeaderHeight={44}
              sx={{
                "& .MuiDataGrid-cell": {
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                },
                border: "none",
                "& .MuiDataGrid-virtualScroller": {
                  backgroundColor: "background.default",
                },
                "& .MuiDataGrid-footerContainer": {
                  borderTop: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                },
                "& .MuiDataGrid-cell:focus": {
                  outline: "none !important",
                },
                "& .MuiDataGrid-cell:focus-within": {
                  outline: "none !important",
                },
                "& .MuiDataGrid-row:focus": {
                  outline: "none !important",
                },
              }}
            />
          </Box>
        </ThemeProvider>
      )}

      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Fade timeout={250} in={isAddModalOpen}>
          <Box
            sx={{
              bgcolor: isDark ? "#1e293b" : "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: 440,
              outline: "none",
              p: 4,
            }}
          >
            <Typography
              variant="h6"
              component="h3"
              sx={{ fontWeight: 600, color: isDark ? "#e2e8f0" : "#1e293b", mb: 4 }}
            >
              添加产品
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="单位"
                value={newProduct.unit}
                onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <TextField
                label="产品名称"
                value={newProduct.productName}
                onChange={(e) => setNewProduct({ ...newProduct, productName: e.target.value })}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <TextField
                label="工艺路线"
                value={newProduct.processRoute}
                onChange={(e) => setNewProduct({ ...newProduct, processRoute: e.target.value })}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <TextField
                label="产品编号"
                value={newProduct.productCode}
                onChange={(e) => setNewProduct({ ...newProduct, productCode: e.target.value })}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <TextField
                label="产品规格"
                value={newProduct.productSpec}
                onChange={(e) => setNewProduct({ ...newProduct, productSpec: e.target.value })}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <FormControl fullWidth>
                <InputLabel sx={{ color: isDark ? "#94a3b8" : "#64748b" }}>产品属性</InputLabel>
                <Select
                  value={newProduct.productAttribute}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, productAttribute: e.target.value })
                  }
                  sx={{
                    color: isDark ? "#e2e8f0" : "#1e293b",
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                    },
                  }}
                >
                  <MenuItem value="自制">自制</MenuItem>
                  <MenuItem value="外购">外购</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
                mt: 4,
              }}
            >
              <Button
                variant="outlined"
                onClick={() => setIsAddModalOpen(false)}
                sx={{
                  color: isDark ? "#e2e8f0" : "#1e293b",
                  borderColor: isDark ? "#475569" : "#e2e8f0",
                }}
              >
                取消
              </Button>
              <Button
                variant="contained"
                onClick={handleAddProduct}
                sx={{ bgcolor: "#9333ea", "&:hover": { bgcolor: "#7c3aed" } }}
              >
                保存
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>

      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Fade timeout={250} in={isEditModalOpen}>
          <Box
            sx={{
              bgcolor: isDark ? "#1e293b" : "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: 440,
              outline: "none",
              p: 4,
            }}
          >
            <Typography
              variant="h6"
              component="h3"
              sx={{ fontWeight: 600, color: isDark ? "#e2e8f0" : "#1e293b", mb: 4 }}
            >
              编辑产品
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="单位"
                value={editingProduct?.unit || ""}
                onChange={(e) => setEditingProduct(prev => prev ? { ...prev, unit: e.target.value } : null)}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <TextField
                label="产品名称"
                value={editingProduct?.productName || ""}
                onChange={(e) => setEditingProduct(prev => prev ? { ...prev, productName: e.target.value } : null)}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <TextField
                label="工艺路线"
                value={editingProduct?.processRoute || ""}
                onChange={(e) => setEditingProduct(prev => prev ? { ...prev, processRoute: e.target.value } : null)}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <TextField
                label="产品编号"
                value={editingProduct?.productCode || ""}
                onChange={(e) => setEditingProduct(prev => prev ? { ...prev, productCode: e.target.value } : null)}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <TextField
                label="产品规格"
                value={editingProduct?.productSpec || ""}
                onChange={(e) => setEditingProduct(prev => prev ? { ...prev, productSpec: e.target.value } : null)}
                sx={{
                  "& .MuiInputLabel-root": { color: isDark ? "#94a3b8" : "#64748b" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                  },
                }}
              />
              <FormControl fullWidth>
                <InputLabel sx={{ color: isDark ? "#94a3b8" : "#64748b" }}>产品属性</InputLabel>
                <Select
                  value={editingProduct?.productAttribute || "自制"}
                  onChange={(e) =>
                    setEditingProduct(prev => prev ? { ...prev, productAttribute: e.target.value } : null)
                  }
                  sx={{
                    color: isDark ? "#e2e8f0" : "#1e293b",
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: isDark ? "#475569" : "#e2e8f0" },
                    },
                  }}
                >
                  <MenuItem value="自制">自制</MenuItem>
                  <MenuItem value="外购">外购</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
                mt: 4,
              }}
            >
              <Button
                variant="outlined"
                onClick={() => setIsEditModalOpen(false)}
                sx={{
                  color: isDark ? "#e2e8f0" : "#1e293b",
                  borderColor: isDark ? "#475569" : "#e2e8f0",
                }}
              >
                取消
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveEditProduct}
                sx={{ bgcolor: "#9333ea", "&:hover": { bgcolor: "#7c3aed" } }}
              >
                保存
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>

      <Modal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Fade timeout={250} in={isImportModalOpen}>
          <Box
            sx={{
              bgcolor: isDark ? "#1e293b" : "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: 400,
              outline: "none",
              p: 4,
            }}
          >
            <Typography
              variant="h6"
              component="h3"
              sx={{ fontWeight: 600, color: isDark ? "#e2e8f0" : "#1e293b", mb: 2 }}
            >
              导入Excel产品数据
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: isDark ? "#94a3b8" : "#64748b", mb: 4 }}
            >
              请选择Excel文件（支持.xlsx和.xls格式），文件应包含以下列：
              <br />
              单位、产品名称、工艺路线、产品编号、产品规格、产品属性(自制/外购)
            </Typography>
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
              }}
            >
              <Button
                variant="outlined"
                onClick={() => setIsImportModalOpen(false)}
                sx={{
                  color: isDark ? "#e2e8f0" : "#1e293b",
                  borderColor: isDark ? "#475569" : "#e2e8f0",
                }}
              >
                取消
              </Button>
              <Button
                variant="contained"
                onClick={handleImportExcel}
                sx={{ bgcolor: "#9333ea", "&:hover": { bgcolor: "#7c3aed" } }}
              >
                选择文件
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>
    </div>
  );
}
