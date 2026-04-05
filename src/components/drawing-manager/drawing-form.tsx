

import { X, ChevronDown, Upload, FileText, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Drawing, DrawingCategory, DrawingFormData } from '@/lib/types'
import { categories } from '@/lib/mock-data'
import { useState, useRef, useEffect } from 'react'
import { parseDrawingFile } from '@/lib/dxf-parser'

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
  const [selectedDrawings, setSelectedDrawings] = useState<Set<number>>(new Set())
  
  const categoryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (drawing) {
      setFormData({
        materialCode: drawing.materialCode,
        drawingNumber: drawing.drawingNumber,
        filePath: drawing.filePath,
        remarks: drawing.remarks || '', // 绑定已有备注
      })
    } else {
      setFormData({
        materialCode: '',
        drawingNumber: '',
        filePath: '',
        remarks: '', // 新增时备注默认为空
      })
    }
    // 重置导入状态
    setImportedDrawings([])
    setCurrentImportIndex(0)
    setSelectedDrawings(new Set())
  }, [drawing, isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 当选择导入的图纸时，更新表单数据
  useEffect(() => {
    if (importedDrawings.length > 0 && currentImportIndex < importedDrawings.length) {
      const imported = importedDrawings[currentImportIndex]
      setFormData({
        materialCode: imported.materialCode,
        drawingNumber: imported.drawingNumber,
        filePath: `/${imported.fileName}`,
      })
    }
  }, [currentImportIndex, importedDrawings])


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...drawing,
      ...formData
    })
  }

  if (!isOpen) return null

 return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="max-h-[90vh] overflow-hidden rounded-2xl bg-card shadow-2xl">
          {/* Header ... */}
          
          <div className="max-h-[calc(90vh-80px)] overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid gap-4">
                {/* 物料编码 & 图号 */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">物料编码</label>
                    <input
                      type="text"
                      value={formData.materialCode}
                      onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
                      placeholder="编码..."
                      required
                      className="h-11 w-full rounded-xl bg-secondary px-4 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">图号</label>
                    <input
                      type="text"
                      value={formData.drawingNumber}
                      onChange={(e) => setFormData({ ...formData, drawingNumber: e.target.value })}
                      placeholder="图号..."
                      required
                      className="h-11 w-full rounded-xl bg-secondary px-4 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                  </div>
                </div>

                {/* 文件路径 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">文件路径</label>
                  <input
                    type="text"
                    value={formData.filePath}
                    onChange={(e) => setFormData({ ...formData, filePath: e.target.value })}
                    className="h-11 w-full rounded-xl bg-secondary px-4 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>

                {/* --- 新增：备注输入框 --- */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">备注</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="添加图纸备注信息..."
                    className="min-h-[80px] w-full rounded-xl bg-secondary p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>
              </div>

              {/* Actions ... */}
              <div className="mt-6 flex gap-3">
                 <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-secondary py-3 text-sm font-medium">取消</button>
                 <button type="submit" className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground">
                   {drawing ? '保存更改' : '添加图纸'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
