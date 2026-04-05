"use client"

import { X, FolderOpen, Check } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { CADConfig, CADType } from '@/lib/types'
import { useAppTheme } from '@/components/ThemeContext' // 引入全局主题状态

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  cadConfig: CADConfig
  onSaveCADConfig: (config: CADConfig) => void
}

const CAD_TYPES: CADType[] = ['AutoCAD', '浩辰CAD', '中望CAD']

const CAD_DEFAULT_PATHS: Record<CADType, string> = {
  'AutoCAD': 'C:\\Program Files\\Autodesk\\AutoCAD 2024\\acad.exe',
  '浩辰CAD': 'C:\\Program Files\\GstarCAD\\GstarCAD 2024\\gcad.exe',
  '中望CAD': 'C:\\Program Files\\ZWSOFT\\ZWCAD 2024\\ZWCAD.exe',
}

export function SettingsModal({ isOpen, onClose, cadConfig, onSaveCADConfig }: SettingsModalProps) {
  const { isDark } = useAppTheme() // 获取全局暗黑状态
  const [selectedType, setSelectedType] = useState<CADType>(cadConfig.type as unknown as CADType)
  const [cadPath, setCadPath] = useState(cadConfig.path)
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedType(cadConfig.type as any)
    setCadPath(cadConfig.path)
  }, [cadConfig, isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTypeChange = (type: CADType) => {
    setSelectedType(type)
    setCadPath(CAD_DEFAULT_PATHS[type])
    setIsTypeDropdownOpen(false)
  }

  const handleSave = () => {
    onSaveCADConfig({ type: selectedType as any, path: cadPath })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 800)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all">
      <div 
        className={`w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl transition-all border ${
          isDark 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-white border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className={`flex items-center justify-between border-b px-6 py-4 ${
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>系统设置</h2>
          <button
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isDark ? 'bg-blue-500/10' : 'bg-blue-50'
              }`}>
                <FolderOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>CAD 软件配置</h3>
                <p className="text-xs text-slate-500">配置用于打开图纸文件的默认 CAD 软件路径</p>
              </div>
            </div>

            {/* CAD 类型选择 */}
            <div className="space-y-2">
              <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>CAD 品牌</label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className={`flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    isDark 
                      ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' 
                      : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500'
                  }`}
                >
                  <span>{selectedType}</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isTypeDropdownOpen && (
                  <div className={`absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl shadow-xl border animate-in fade-in zoom-in-95 duration-200 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}>
                    {CAD_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => handleTypeChange(type)}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                          selectedType === type 
                            ? (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')
                            : (isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')
                        }`}
                      >
                        <span>{type}</span>
                        {selectedType === type && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CAD 安装路径 */}
            <div className="space-y-2">
              <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>执行文件全路径 (.exe)</label>
              <input
                type="text"
                value={cadPath}
                onChange={(e) => setCadPath(e.target.value)}
                placeholder="例如: C:\CAD\acad.exe"
                className={`h-11 w-full rounded-xl border px-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-blue-500' 
                    : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
                }`}
              />
              <p className="text-[11px] text-slate-500 italic">
                提示: 默认通常位于 {CAD_DEFAULT_PATHS[selectedType]}
              </p>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className={`flex justify-end gap-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <button
              onClick={onClose}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
                isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saved}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
                saved 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-500/20'
              }`}
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" />
                  已应用
                </>
              ) : (
                '应用设置'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}