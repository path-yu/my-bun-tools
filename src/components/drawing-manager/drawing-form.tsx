import { X, ChevronDown, Upload, FileText, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Drawing, DrawingCategory, DrawingFormData } from '@/lib/types'
import { categories } from '@/lib/mock-data'
import { useState, useRef, useEffect, useCallback } from 'react'

interface ParsedDrawing {
  productmaterialCode: string
  materialCode: string
  drawingNumber: string
  diameter: string
  pressure: string
  volume: string
  category: DrawingCategory
  fileName: string
}

interface DrawingFormProps {
  isOpen: boolean
  drawing?: Drawing | null
  onClose: () => void
  onSubmit: (data: DrawingFormData) => void
  onBatchSubmit?: (data: DrawingFormData[]) => void
}

export function DrawingForm({ isOpen, drawing, onClose, onSubmit, onBatchSubmit }: DrawingFormProps) {
  const [formData, setFormData] = useState<DrawingFormData>({
    materialCode: '',
    drawingNumber: '',
    filePath: '',
    remarks: '',
  })
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [importedDrawings, setImportedDrawings] = useState<ParsedDrawing[]>([])
  const [currentImportIndex, setCurrentImportIndex] = useState(0)
  
  const categoryRef = useRef<HTMLDivElement>(null)

  // 1. 初始化与重置逻辑
  useEffect(() => {
    if (isOpen) {
      if (drawing) {
        setFormData({
          materialCode: drawing.materialCode,
          drawingNumber: drawing.drawingNumber,
          filePath: drawing.filePath,
          remarks: drawing.remarks || '',
        })
      } else {
        setFormData({
          materialCode: '',
          drawingNumber: '',
          filePath: '',
          remarks: '',
        })
      }
      setImportedDrawings([])
      setCurrentImportIndex(0)
    }
  }, [drawing, isOpen])

  // 2. 监听 ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 3. 点击分类下拉框外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...drawing,
      ...formData
    })
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose} // 关键：点击背景遮罩触发关闭
    >
      <div 
        className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()} // 关键：阻止冒泡，防止点击弹窗内部也触发 onClose
      >
        <div className="max-h-[90vh] overflow-hidden rounded-2xl bg-card shadow-2xl border border-border">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {drawing ? '编辑图纸' : '新增图纸'}
                </h2>
                <p className="text-xs text-muted-foreground">填写或修改 CAD 图纸元数据</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(90vh-80px)] overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid gap-6">
                {/* 物料编码 & 图号 */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">物料编码</label>
                    <input
                      type="text"
                      value={formData.materialCode}
                      onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
                      placeholder="例如: M20260407"
                      required
                      className="h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">图号</label>
                    <input
                      type="text"
                      value={formData.drawingNumber}
                      onChange={(e) => setFormData({ ...formData, drawingNumber: e.target.value })}
                      placeholder="例如: DWG-SH-001"
                      required
                      className="h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* 文件路径 */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">文件路径 (UNC/本地)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.filePath}
                      onChange={(e) => setFormData({ ...formData, filePath: e.target.value })}
                      placeholder="\\服务器\工程部\图纸.dwg"
                      className="h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Upload className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* 备注 */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">备注信息</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="在此输入技术要求、变更记录或客户要求..."
                    className="min-h-[100px] w-full rounded-xl border border-border bg-secondary/50 p-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="mt-8 flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="flex-1 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  {drawing ? '确认更新' : '提交入库'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}