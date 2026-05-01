import { Search, X } from 'lucide-react'

interface SearchFiltersProps {
  drawingNumber: string
  materialCode: string
  onDrawingNumberChange: (value: string) => void
  onMaterialCodeChange: (value: string) => void
}

export function SearchFilters({
  drawingNumber,
  materialCode,
  onDrawingNumberChange,
  onMaterialCodeChange,
}: SearchFiltersProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // 实时搜索，无需额外操作
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* 图号输入 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="图号..."
          value={drawingNumber}
          onChange={(e) => onDrawingNumberChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-10 w-40 rounded-lg bg-secondary pl-10 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {drawingNumber && (
          <button
            onClick={() => onDrawingNumberChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* 物料编号输入 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="物料编号..."
          value={materialCode}
          onChange={(e) => onMaterialCodeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-10 w-40 rounded-lg bg-secondary pl-10 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {materialCode && (
          <button
            onClick={() => onMaterialCodeChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
