import { GridLocaleText } from "@mui/x-data-grid";

const zhCN: Partial<GridLocaleText> = {
  // Pagination
  paginationRowsPerPage: "每页行数:",
  paginationDisplayedRows: ({ from, to, count }) => `${from}-${to} / ${count}`,
  paginationItemAriaLabel: (type) => {
    const labels: Record<string, string> = {
      first: "首页",
      last: "末页",
      next: "下一页",
      previous: "上一页",
    };
    return labels[type] || type;
  },

  // Columns
  columnMenuUnsort: "取消排序",
  columnMenuSortAsc: "升序",
  columnMenuSortDesc: "降序",
  columnMenuFilter: "筛选",
  columnMenuShowColumns: "显示列",

  filterPanelDeleteIconLabel: "删除",
  filterPanelAddFilter: "添加筛选",
  filterPanelColumns: "列",
  filterPanelOperator: "运算符",
  filterPanelOperatorAnd: "且",
  filterPanelOperatorOr: "或",
  filterPanelInputLabel: "值",
  filterPanelInputPlaceholder: "输入值",

  // Filter operators
  filterOperatorContains: "包含",
  filterOperatorDoesNotContain: "不包含",
  filterOperatorEquals: "等于",
  filterOperatorDoesNotEqual: "不等于",
  filterOperatorStartsWith: "开头是",
  filterOperatorEndsWith: "结尾是",
  filterOperatorIsEmpty: "为空",
  filterOperatorIsNotEmpty: "不为空",
  filterOperatorIsAnyOf: "是其中任一",

  // Columns panel
  columnsManagementSearchTitle: "搜索列",
  columnsManagementNoColumns: "没有列",

  // No rows
  noRowsLabel: "没有数据",
  noResultsOverlayLabel: "没有找到结果",

  // Column menu
  columnMenuLabel: "菜单",
  columnMenuManageColumns: "管理列",
  columnMenuHideColumn: "隐藏列",
  columnMenuManagePivot: "管理透视",

  // Footer
  footerRowSelected: (count) => `已选择 ${count} 行`,
  footerTotalRows: "总行数:",
  footerTotalVisibleRows: (visibleCount, totalCount) => `${visibleCount} / ${totalCount}`,

  // Toolbar
  toolbarColumns: "列",
  toolbarFilters: "筛选",
  toolbarFiltersLabel: "显示筛选",
  toolbarFiltersTooltipHide: "隐藏筛选",
  toolbarFiltersTooltipShow: "显示筛选",
  toolbarQuickFilterPlaceholder: "搜索...",
  toolbarQuickFilterLabel: "搜索",
  toolbarExport: "导出",
  toolbarExportLabel: "导出",
  toolbarExportCSV: "导出 CSV",
  toolbarExportPrint: "打印",

  // Density
  toolbarDensity: "密度",
  toolbarDensityLabel: "表格密度",
  toolbarDensityCompact: "紧凑",
  toolbarDensityStandard: "标准",
  toolbarDensityComfortable: "舒适",

  // Boolean
  booleanCellTrueLabel: "是",
  booleanCellFalseLabel: "否",

  // Actions
  actionsCellMore: "更多",

  // Tree data
  treeDataExpand: "展开",
  treeDataCollapse: "折叠",
  groupingColumnHeaderName: "分组",

  // Misc
  expandDetailPanel: "展开详情",
  collapseDetailPanel: "折叠详情",
  checkboxSelectionHeaderName: "选择",
  checkboxSelectionSelectAllRows: "选择所有行",
  checkboxSelectionUnselectAllRows: "取消选择所有行",
  checkboxSelectionSelectRow: "选择行",
  checkboxSelectionUnselectRow: "取消选择行",
};
export default zhCN;