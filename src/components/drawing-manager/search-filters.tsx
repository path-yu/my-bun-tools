'use client'

import { Search, ChevronDown, X, RotateCcw } from 'lucide-react'
import { DrawingCategory } from '@/lib/types'
import { categories } from '@/lib/mock-data'
import { useState, useRef, useEffect } from 'react'

interface SearchFiltersProps {
  drawingNumber: string
  materialCode: string
  selectedCategory: DrawingCategory | ''
  onDrawingNumberChange: (value: string) => void
  onMaterialCodeChange: (value: string) => void
  onCategoryChange: (value: DrawingCategory | '') => void
  onSearch: () => void
  onReset: () => void
}

export function SearchFilters({
  drawingNumber,
  materialCode,
  selectedCategory,
  onDrawingNumberChange,
  onMaterialCodeChange,
  onCategoryChange,
  onSearch,
  onReset,
}: SearchFiltersProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  const hasFilters = drawingNumber || materialCode || selectedCategory

  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">搜索筛选</h2>
      <div className="grid gap-4 md:grid-cols-4">
        {/* 图号输入 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">图号</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="输入图号搜索..."
              value={drawingNumber}
              onChange={(e) => onDrawingNumberChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-11 w-full rounded-xl bg-secondary pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {drawingNumber && (
              <button
                onClick={() => onDrawingNumberChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* 物料编号输入 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">物料编号</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="输入物料编号搜索..."
              value={materialCode}
              onChange={(e) => onMaterialCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-11 w-full rounded-xl bg-secondary pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {materialCode && (
              <button
                onClick={() => onMaterialCodeChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* 分类下拉选择 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">分类</label>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex h-11 w-full items-center justify-between rounded-xl bg-secondary px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <span className={selectedCategory ? 'text-foreground' : 'text-muted-foreground'}>
                {selectedCategory || '选择分类'}
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl bg-popover shadow-lg ring-1 ring-border">
                <button
                  onClick={() => {
                    onCategoryChange('')
                    setIsDropdownOpen(false)
                  }}
                  className={`flex w-full items-center px-4 py-3 text-left text-sm transition-colors hover:bg-secondary ${!selectedCategory ? 'bg-secondary text-primary' : 'text-foreground'}`}
                >
                  全部分类
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      onCategoryChange(category)
                      setIsDropdownOpen(false)
                    }}
                    className={`flex w-full items-center px-4 py-3 text-left text-sm transition-colors hover:bg-secondary ${selectedCategory === category ? 'bg-secondary text-primary' : 'text-foreground'}`}
                  >
                    <span
                      className={`mr-3 h-2 w-2 rounded-full ${
                        category === '不锈钢'
                          ? 'bg-blue-500'
                          : category === '碳钢'
                            ? 'bg-orange-500'
                            : 'bg-emerald-500'
                      }`}
                    />
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 搜索和重置按钮 */}
        <div className="flex items-end gap-2">
          <button
            onClick={onSearch}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <Search className="h-4 w-4" />
            搜索
          </button>
          <button
            onClick={onReset}
            disabled={!hasFilters}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground transition-all hover:bg-secondary/80 hover:text-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            title="重置筛选"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
