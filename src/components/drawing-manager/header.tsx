import { FileText, Settings, Moon, Sun, Wrench, Info } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAppTheme } from '@/components/ThemeContext' // 确保路径指向你的 Context

interface HeaderProps {
  onOpenSettings: () => void
}

export function Header({ onOpenSettings }: HeaderProps) {
  // 1. 直接从全局 Context 获取主题状态和切换函数
  const { isDark, toggleTheme } = useAppTheme()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
      isDark 
        ? 'border-slate-800 bg-slate-900/80 backdrop-blur-xl' 
        : 'border-slate-200 bg-white/80 backdrop-blur-xl'
    }`}>
      {/* iOS 风格导航栏 */}
      <div className="flex h-14 items-center justify-between px-6">
        
        {/* 左侧 Logo 与 标题 */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className={`text-sm font-bold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              图纸管理系统1
            </h1>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Engineering Docs</p>
          </div>
        </div>

        {/* 右侧 操作区域 */}
        <div className="flex items-center gap-3">
          
          {/* 快捷切换模式按钮 (主导航栏显式展示) */}
          <button
            onClick={toggleTheme}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-90 ${
              isDark 
                ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* 设置下拉菜单入口 */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-90 ${
                isDark 
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'
              } ${isSettingsOpen ? 'ring-2 ring-blue-500/20' : ''}`}
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* 设置下拉菜单内容 */}
            {isSettingsOpen && (
              <div className={`absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border shadow-xl animate-in fade-in zoom-in-95 duration-200 ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 shadow-black/40' 
                  : 'bg-white border-slate-200 shadow-slate-200/50'
              }`}>
                <div className="p-1.5">
                  <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    系统偏好
                  </div>

                  {/* 模式切换 (下拉菜单内选项) */}
                  <button
                    onClick={() => {
                      toggleTheme()
                      setIsSettingsOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
                      isDark ? 'bg-slate-700 text-amber-400' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </div>
                    <span className="flex-1 text-left">外观模式</span>
                    <span className="text-[10px] font-medium opacity-50">{isDark ? '暗黑' : '明亮'}</span>
                  </button>

                  {/* CAD 配置 */}
                  <button
                    onClick={() => {
                      onOpenSettings()
                      setIsSettingsOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
                      isDark ? 'bg-slate-700 text-blue-400' : 'bg-slate-200 text-slate-500'
                    }`}>
                      <Wrench className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1 text-left">配置</span>
                  </button>

                  <div className={`my-1.5 h-px ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`} />

                  {/* 关于按钮 */}
                  <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}>
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
                      isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                    }`}>
                      <Info className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1 text-left">关于</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}