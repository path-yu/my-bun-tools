(vl-load-com)

;; ==========================================================
;; 1. 辅助函数：生成临时调试红框 (带线宽控制)
;; ==========================================================
(defun draw_debug_rect (p1 p2 width / p3 p4) 
  (setq p3 (list (car p2) (cadr p1) 0.0)
        p4 (list (car p1) (cadr p2) 0.0)
  )
  (entmake 
    (list 
      '(0 . "LWPOLYLINE")
      '(100 . "AcDbEntity")
      '(100 . "AcDbPolyline")
      '(90 . 4)
      '(70 . 1)
      '(62 . 1) ; 红色
      (cons 43 width) ; 全局线宽
      (cons 10 p1)
      (cons 10 p3)
      (cons 10 p2)
      (cons 10 p4)
    )
  )
  (entlast)
)

;; ==========================================================
;; 2. 坐标获取：通过顶点避开 Variant 错误
;; ==========================================================
(defun get-polyline-bbox (ent / pts x_list y_list) 
  (setq pts (vl-remove-if 'not 
                          (mapcar '(lambda (x) (if (= (car x) 10) (cdr x))) 
                                  (entget ent)
                          )
            )
  )
  (if pts 
    (progn 
      (setq x_list (mapcar 'car pts)
            y_list (mapcar 'cadr pts)
      )
      (list (list (apply 'min x_list) (apply 'min y_list) 0.0) 
            (list (apply 'max x_list) (apply 'max y_list) 0.0)
      )
    )
    nil
  )
)

;; ==========================================================
;; 3. PDF导出核心函数 (已修正：支持传入自定义文件名 custom_name)
;; ==========================================================
(defun export_single_pdf (ent_out p1_out p2_out paper_size custom_name / pdfname path 
                          p1_new p2_new paper_name timestamp dx dy is_landscape
                         ) 
  (setvar "CMDECHO" 0)

  ;; 1. 根据纸张类型设置标准名称
  (setq paper_name (if (= (strcase paper_size) "A4") 
                     "ISO full bleed A4 (210.00 x 297.00 毫米)"
                     "ISO full bleed A3 (297.00 x 420.00 毫米)"
                   )
  )

  ;; 2. 【修改】如果传入了 custom_name 则使用它，否则使用时间戳默认名
  (if (and custom_name (/= custom_name "")) 
    (setq pdfname (strcat custom_name ".pdf"))
    (progn 
      (setq timestamp (menucmd "M=$(edtime,$(getvar,date),YYYYMMDD_HHMMSS)"))
      (setq pdfname (strcat paper_size 
                            "_"
                            timestamp
                            "_"
                            (substr (rtos (rem (getvar "CPUTICKS") 1e6) 2 0) 1 4)
                            ".pdf"
                    )
      )
    )
  )
  (setq path (strcat (getenv "USERPROFILE") "\\Desktop\\" pdfname))

  ;; 3. 核心计算：计算图框在世界坐标系(WCS)下的长宽尺寸
  (setq dx (abs (- (car p1_out) (car p2_out)))
        dy (abs (- (cadr p1_out) (cadr p2_out)))
  )

  ;; 判断图形是横向还是竖向
  (if (> dx dy) 
    (setq is_landscape T)
    (setq is_landscape nil)
  )

  ;; 4. 坐标系与视图智能化处理
  (vl-cmdf "_.UCS" "_W")

  (if (= (strcase paper_size) "A4") 
    (progn 
      (vl-cmdf "_.PLAN" "_W")
      (vl-cmdf "_.ZOOM" "_Object" ent_out "")
      (setq p1_new (trans p1_out 0 0)
            p2_new (trans p2_out 0 0)
      )
    )
    (if is_landscape 
      (progn 
        (vl-cmdf "_.PLAN" "_W")
        (vl-cmdf "_.ZOOM" "_Object" ent_out "")
        (setq p1_new (trans p1_out 0 0)
              p2_new (trans p2_out 0 0)
        )
      )
      (progn 
        (vl-cmdf "_.UCS" "_Z" "90")
        (vl-cmdf "_.PLAN" "_C")
        (vl-cmdf "_.ZOOM" "_Object" ent_out "")
        (setq p1_new (trans p1_out 0 1)
              p2_new (trans p2_out 0 1)
        )
      )
    )
  )

  ;; 清理同名文件
  (if (findfile path) (vl-file-delete path))

  ;; 5. 执行动态打印
  (vl-cmdf "-PLOT" 
           "Y"
           ""
           "DWG To PDF.pc5"
           paper_name
           "M"
           (if 
             (or is_landscape 
                 (and (= (strcase paper_size) "A3") (not is_landscape))
             )
             "L"
             "P"
           )
           "N"
           "W"
           "non"
           p1_new
           "non"
           p2_new
           "F"
           "C"
           "Y"
           "monochrome.ctb"
           "Y"
           "A"
           path
           "N"
           "Y"
  )

  ;; 6. 统一恢复环境
  (vl-cmdf "_.UCS" "_W")
  (vl-cmdf "_.PLAN" "_W")

  (princ (strcat "\n[导出成功] " pdfname))
  (princ)
)
;; ==========================================================
;; 4. 智能批量处理逻辑 (BESA3与BESA4核心：X坐标排序 + PDF24合并)
;; ==========================================================
(defun smart_batch_plot (target_size / ss i ent coords p1 p2 area box_list final_list 
                         f_box is_inside cx cy temp_frames w h ratio confirm dyn_width 
                         idx custom_name pdf_path_list current_pdf_path pdf24_cmd 
                         timestamp combined_name combined_path
                        ) 
  (princ (strcat "\n请框选 " target_size " 范围..."))

  (if (setq ss (ssget '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      (setq box_list '()
            i        0
      )
      (repeat (sslength ss) 
        (setq ent (ssname ss i))
        (if (setq coords (get-polyline-bbox ent)) 
          (progn 
            (setq p1    (car coords)
                  p2    (cadr coords)
                  w     (abs (- (car p2) (car p1)))
                  h     (abs (- (cadr p2) (cadr p1)))
                  area  (* w h)
                  ratio (if (and (> h 0) (> w 0)) (/ (max w h) (min w h)) 0)
            )
            ;; 过滤：保证是有效的闭合大图框
            (if (and (> area 15000) (> ratio 1.25) (< ratio 1.5)) 
              (setq box_list (cons (list area ent p1 p2) box_list))
            )
          )
        )
        (setq i (1+ i))
      )

      ;; 第一阶段：按面积降序排列以进行重叠框剔除
      (setq box_list (vl-sort box_list '(lambda (a b) (> (car a) (car b)))))
      (setq final_list  '()
            temp_frames '()
      )

      (foreach box box_list 
        (setq is_inside nil
              p1        (nth 2 box)
              p2        (nth 3 box)
        )
        (setq cx (/ (+ (car p1) (car p2)) 2.0)
              cy (/ (+ (cadr p1) (cadr p2)) 2.0)
        )
        (foreach f_box final_list 
          (setq f_p1 (nth 2 f_box)
                f_p2 (nth 3 f_box)
          )
          (if 
            (and (> cx (car f_p1)) 
                 (< cx (car f_p2))
                 (> cy (cadr f_p1))
                 (< cy (cadr f_p2))
            )
            (setq is_inside T)
          )
        )
        ;; 如果通过剔除，将中心点 X 坐标 (cx) 追加在数据尾部，方便排序
        (if (not is_inside) 
          (progn 
            (setq final_list (cons (append box (list cx)) final_list))
            (setq dyn_width (/ (sqrt (car box)) 100.0))
            (setq temp_frames (cons (draw_debug_rect p1 p2 dyn_width) temp_frames))
          )
        )
      )

      (if (> (length final_list) 0) 
        (progn 
          ;; 第二阶段：【核心排序】严格按中心点 X 坐标进行升序（从左到右排序）
          (setq final_list (vl-sort final_list 
                                    '(lambda (a b) (< (nth 4 a) (nth 4 b)))
                           )
          )

          (vl-cmdf "_.regen")
          (princ 
            (strcat "\n[识别完成] 已识别 " (itoa (length final_list)) " 个图框，已由左至右完成测算。")
          )

          (initget "Yes No")
          (initget "Yes No")
          ;; 把描述性中文字移到括号外面
          (setq confirm (getkword "\n确认开始[Y/N]？(将按顺序打印并调用PDF24合并) <Y>: "))

          (if (or (= confirm nil) (= confirm "Yes")) 
            (progn 
              (princ "\n[执行中] 正在输出单页 PDF ...")
              (foreach f temp_frames (if (entget f) (entdel f)))
              (vl-cmdf "_.regen")

              ;; 循环输出单页文件并记录路径
              (setq idx 0)
              (setq pdf_path_list '())

              (foreach box final_list 
                (setq custom_name (itoa idx))
                (setq current_pdf_path (strcat (getenv "USERPROFILE") 
                                               "\\Desktop\\"
                                               custom_name
                                               ".pdf"
                                       )
                )

                (export_single_pdf 
                  (nth 1 box)
                  (nth 2 box)
                  (nth 3 box)
                  target_size
                  custom_name
                )

                (setq pdf_path_list (append pdf_path_list (list current_pdf_path)))
                (setq idx (1+ idx))
              )

              ;; ==========================================================
              ;; 【核心升级】：改用 (startapp) 异步完美调用 PDF24
              ;; ==========================================================
              (princ "\n[PDF24] 单页缓存完毕，正在唤醒合并模组3333...")
              
                ;; 1. 安全獲取使用者主目錄
              (setq user_profile (getenv "USERPROFILE"))
              (if (not user_profile) (setq user_profile (getenv "HOME")))

              (if (not user_profile) 
                (progn 
                  (princ "\n[嚴重錯誤] 無法獲取 Windows 系統使用者路徑！")
                  (setq desktop_path nil)
                )
                (setq desktop_path (strcat user_profile "\\Desktop\\"))
              )
              (setq timestamp (menucmd "M=$(edtime,$(getvar,date),YYYYMMDD_HHMMSS)"))
              (setq combined_name (strcat "Combined_" target_size "_" timestamp ".pdf"))
              (setq combined_path (strcat desktop_path combined_name))
              (setq q "\"")
              ;; 如果已存在则删除
              (if (findfile combined_path)
                  (vl-file-delete combined_path)
              )

              ;; 1. 精准拼接参数字符串 (遵照你提供的参数结构，在代码中换行排版完全不受影响)
              ;; 1. 【修复安全机制】安全初始化参数字符串
              (setq pdf24_args "-join -noProgress -profile user/aaa ")
                (princ (strcat "\n[调试参数流333]: " pdf24_args))
              ;; 2. 动态循环追加列表中所有**真正生成**的单页 PDF 路径 (彻底告别写死 test_f1 的 nil 错误)
              (foreach path pdf_path_list
                (if path
                  (setq pdf24_args (strcat pdf24_args q path q " "))
                )
              )
              (princ (strcat "\n[调试参数流]: " pdf24_args))
              ;; 3. 追加最终的目标输出文件路径
              (setq pdf24_args (strcat pdf24_args "-outputFile " q combined_path q))

              (princ (strcat "\n[调试信息] startapp 准备发送参数:\n" pdf24_args))

              ;; 4. 强制等待 2 秒钟，确保 AutoCAD 把所有单页 PDF 彻底写完并关闭文件
              (vl-cmdf "_.delay" 2000)

              ;; 5. 【核心改动】使用 startapp 隐式异步调用
              (startapp "D:\\PDF24\\pdf24-DocTool.exe" pdf24_args)

              ;; 6. 因为 startapp 是后台异步运行的，给 PDF24 一点合成时间后再去检查总文件
              (vl-cmdf "_.delay" 3500)
              (if (findfile combined_path) 
                (progn 
                  (princ (strcat "\n\n【成功】总图纸已完美输出至桌面: " combined_name))
                  ;; 成功后粉碎清理单页临时小垃圾文件
                  (foreach path pdf_path_list 
                    (if (findfile path) (vl-file-delete path))
                  )
                )
                (princ "\n\n【提示】合并指令已发出，如桌面暂未出现总文件，请检查 PDF24 的 user/aaa 配置是否正确。")
              )
            )
            (progn 
              (foreach f temp_frames (if (entget f) (entdel f)))
              (vl-cmdf "_.regen")
              (princ "\n[取消] 用户中止打印。")
            )
          )
        )
        (princ "\n[未识别] 未发现符合要求的图框。")
      )
    )
    (princ "\n[取消] 未选取任何物件。")
  )
  (princ)
)

;; ==========================================================
;; 5. 新增：不旋轉直接列印的核心函數 (適用於 bpdfA3 / bpdfA4)
;; ==========================================================
(defun export_direct_pdf (ent_out p1_out p2_out paper_size / pdfname path paper_name 
                          timestamp
                         ) 
  (setvar "CMDECHO" 0)
  ;; 2. 設定對應的紙張名稱
  ;; 注意：實體印表機的紙張名稱通常與 DWG To PDF 不同，請確保與你印表機支援的 A3/A4 名稱一致
  (setq paper_name (if (= (strcase paper_size) "A4") 
                     "A4" ; 實體機通常直接是 "A4" 或 "ISO A4"
                     "A3" ; 實體機通常直接是 "A3" 或 "ISO A3"
                   )
  )
  ;; 2. 生成時間戳記唯一文件名，防止覆蓋
  (setq timestamp (menucmd "M=$(edtime,$(getvar,date),YYYYMMDD_HHMMSS)"))
  (setq pdfname (strcat paper_size 
                        "_"
                        timestamp
                        "_"
                        (substr (rtos (rem (getvar "CPUTICKS") 1e6) 2 0) 1 4)
                        ".pdf"
                )
  )
  ;; 4. 呼叫列印 (關鍵修正：倒數第二個參數改為 "N"，代表不列印到檔案，直接輸出到印表機)
  ;; 參數順序解讀：
  ;; "Y" (詳細配置) -> "" (預設模型空間) -> printer_name (印表機) -> paper_name (紙張)
  ;; -> "M" (毫米) -> "L" (橫向) -> "N" (不反向) -> "W" (窗口) -> "non" p1_out -> "non" p2_out
  ;; -> "F" (佈滿) -> "C" (居中) -> "Y" (依樣式列印) -> "打印.ctb" -> "Y" (列印線寬)
  ;;着色打印设A置 [按显示(A)/线框(W)/隐藏(H)/视觉样式(V)/渲染(R)] <按显示>: A
  ;; -是否打印到文件  N
  ;; 是否保存对页面设置的修改 Y  (是否继续打印)"Y"

  ;; 3. 確保在世界坐標系下進行窗口捕捉，但不做任何 UCS 旋轉或 PLAN 視圖跳轉
  (vl-cmdf "_.UCS" "_W")


  ;; 4. 呼叫列印 (移除旋轉步驟，直接使用傳入的 WCS 原始坐標 p1_out 和 p2_out)
  ;; 注意：這裡採用橫向 "L" (Landscape) 列印模式，如果一號機橫豎反了，可將下方的 "L" 改為 "P"
  (vl-cmdf "-PLOT" "Y" "" "一号机" paper_name "M" "L" "N" "W" "non" p1_out "non" p2_out 
           "F" "C" "Y" "打印.ctb" "Y" "A" "N" "Y" "Y"
  )

  (princ (strcat "\n[直接導出成功] " pdfname))
)

;; ==========================================================
;; 6. 新增：不旋轉的批量處理外殼邏輯
;; ==========================================================
(defun smart_direct_plot (target_size / ss i ent coords p1 p2 area box_list 
                          final_list f_box is_inside cx cy temp_frames w h ratio 
                          confirm dyn_width
                         ) 
  (princ (strcat "\n[直接列印] 請框选 " target_size " 範圍..."))

  (if (setq ss (ssget '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      (setq box_list '()
            i        0
      )
      (repeat (sslength ss) 
        (setq ent (ssname ss i))
        (if (setq coords (get-polyline-bbox ent)) 
          (progn 
            (setq p1    (car coords)
                  p2    (cadr coords)
                  w     (abs (- (car p2) (car p1)))
                  h     (abs (- (cadr p2) (cadr p1)))
                  area  (* w h)
                  ratio (if (and (> h 0) (> w 0)) (/ (max w h) (min w h)) 0)
            )
            ;; 保持原有的圖框過濾標準
            (if (and (> area 15000) (> ratio 1.25) (< ratio 1.5)) 
              (setq box_list (cons (list area ent p1 p2) box_list))
            )
          )
        )
        (setq i (1+ i))
      )

      ;; 排序與重疊內框剔除
      (setq box_list (vl-sort box_list '(lambda (a b) (> (car a) (car b)))))
      (setq final_list  '()
            temp_frames '()
      )

      (foreach box box_list 
        (setq is_inside nil
              p1        (nth 2 box)
              p2        (nth 3 box)
        )
        (setq cx (/ (+ (car p1) (car p2)) 2.0)
              cy (/ (+ (cadr p1) (cadr p2)) 2.0)
        )
        (foreach f_box final_list 
          (setq f_p1 (nth 2 f_box)
                f_p2 (nth 3 f_box)
          )
          (if 
            (and (> cx (car f_p1)) 
                 (< cx (car f_p2))
                 (> cy (cadr f_p1))
                 (< cy (cadr f_p2))
            )
            (setq is_inside T)
          )
        )
        (if (not is_inside) 
          (progn 
            (setq final_list (cons box final_list))
            ;; 畫出紅色調試確認框
            (setq dyn_width (/ (sqrt (car box)) 100.0))
            (setq temp_frames (cons (draw_debug_rect p1 p2 dyn_width) temp_frames))
          )
        )
      )

      ;; 標紅確認與直接執行列印
      (if (> (length final_list) 0) 
        (progn 
          (vl-cmdf "_.regen")
          (princ (strcat "\n[識別完成] 已標紅 " (itoa (length final_list)) " 个圖框。"))

          (initget "Yes No")
          (setq confirm (getkword "\n確認直接列印標紅區域？[是(Y)/否(N)] <Y>: "))

          (if (or (= confirm nil) (= confirm "Yes")) 
            (progn 
              (princ "\n[執行中] 正在直接輸出 PDF (不旋轉)...")
              ;; 清理調試紅框
              (foreach f temp_frames (if (entget f) (entdel f)))
              (vl-cmdf "_.regen")
              ;; 執行不旋轉直接列印
              (foreach box final_list 
                (export_direct_pdf (nth 1 box) (nth 2 box) (nth 3 box) target_size)
              )
            )
            (progn 
              ;; 使用者取消時，記得也清理掉紅框
              (foreach f temp_frames (if (entget f) (entdel f)))
              (vl-cmdf "_.regen")
              (princ "\n[取消] 使用者中止直接列印。")
            )
          )
        )
        (princ "\n[未識別] 未發現符合要求的圖框。")
      )
    )
  )
  (princ)
)

;; ==========================================================
;; 7. 註冊使用者命令 bpdfA3 與 bpdfA4
;; ==========================================================
(defun c:bpdfA3 () (smart_direct_plot "A3") (princ))
(defun c:bpdfA4 () (smart_direct_plot "A4") (princ))
;; ==========================================================
;; 8. 靈活秒刷版：手動選取矩形「直接送印」不確認 (適用於 bpA3 / bpA4)
;; ==========================================================
(defun manual_direct_plot (target_size / ss i ent coords p1 p2 w h area ratio 
                           box_list final_list cx cy is_inside f_box f_p1 f_p2
                          ) 
  (princ (strcat "\n[直接送印] 請選取要列印為 " target_size " 的圖框矩形(可多選)..."))

  ;; 讓使用者手動選擇圖面上的閉合多段線
  (if (setq ss (ssget '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      (setq box_list '()
            i        0
      )
      ;; 1. 遍歷使用者選中的所有矩形
      (repeat (sslength ss) 
        (setq ent (ssname ss i))
        (if (setq coords (get-polyline-bbox ent)) 
          (progn 
            (setq p1    (car coords)
                  p2    (cadr coords)
                  w     (abs (- (car p2) (car p1)))
                  h     (abs (- (cadr p2) (cadr p1)))
                  area  (* w h)
                  ratio (if (and (> h 0) (> w 0)) (/ (max w h) (min w h)) 0)
            )
            ;; 放寬過濾限制，只要是常規比例的框都允許手動列印
            (if (and (> area 15000) (> ratio 1.1)) 
              (setq box_list (cons (list area ent p1 p2) box_list))
            )
          )
        )
        (setq i (1+ i))
      )

      ;; 2. 移除重複選取的內框 (保留大框)
      (setq box_list (vl-sort box_list '(lambda (a b) (> (car a) (car b)))))
      (setq final_list '())

      (foreach box box_list 
        (setq is_inside nil
              p1        (nth 2 box)
              p2        (nth 3 box)
        )
        (setq cx (/ (+ (car p1) (car p2)) 2.0)
              cy (/ (+ (cadr p1) (cadr p2)) 2.0)
        )
        (foreach f_box final_list 
          (setq f_p1 (nth 2 f_box)
                f_p2 (nth 3 f_box)
          )
          (if 
            (and (> cx (car f_p1)) 
                 (< cx (car f_p2))
                 (> cy (cadr f_p1))
                 (< cy (cadr f_p2))
            )
            (setq is_inside T)
          )
        )
        (if (not is_inside) 
          (setq final_list (cons box final_list))
        )
      )

      ;; 3. 【核心修改】不進行彈窗或快顯確認，直接循環呼叫實體列印
      (if (> (length final_list) 0) 
        (progn 
          (princ (strcat "\n[執行中] 正在將 " (itoa (length final_list)) " 個圖框發送至一號機..."))
          (foreach box final_list 
            (export_direct_pdf (nth 1 box) (nth 2 box) (nth 3 box) target_size)
          )
        )
        (princ "\n[未識別] 選取的物體不符合圖框特徵。")
      )
    )
    (princ "\n[取消] 未選取任何物件。")
  )
  (princ)
)
;; ==========================================================
;; 10. 新增：按点选顺序编号导出 PDF (自定文件名 1, 2, 3...)
;; ==========================================================
(defun manual_sequence_plot (target_size / ent entsel_res coords p1 p2 idx 
                             custom_name loop
                            ) 
  (setq idx 1) ;; 计数器从 1 开始
  (setq loop T)

  (princ (strcat "\n--- [" target_size "] 顺序列印模式 ---"))
  (princ "\n提示：请依次鼠标单选矩形图框。按 ESC 或 鼠标右键/回车 结束选择。")

  (while loop 
    ;; 使用 entsel 确保能精准捕捉单选物体的顺序
    (setq entsel_res (entsel (strcat "\n请选择第 [" (itoa idx) "] 个图框: ")))

    (if entsel_res 
      (progn 
        (setq ent (car entsel_res))
        ;; 验证选中的是不是闭合的多段线
        (if (= (cdr (assoc 0 (entget ent))) "LWPOLYLINE") 
          (progn 
            (setq coords (get-polyline-bbox ent))
            (if coords 
              (progn 
                (setq p1 (car coords)
                      p2 (cadr coords)
                )
                ;; 组合出文件名，例如: "A3_1", "A3_2" 或者是单纯的 "1", "2"
                ;; 如果只想要纯数字，可以改成 (setq custom_name (itoa idx))
                (setq custom_name (strcat target_size "_" (itoa idx)))

                (princ (strcat " -> 正在导出为: " custom_name ".pdf ..."))

                ;; 调用修改后的核心打印函数，传入自定义文件名
                (export_single_pdf ent p1 p2 target_size custom_name)

                ;; 成功后编号递增
                (setq idx (1+ idx))
              )
              (princ "\n[错误] 无法获取该物体的边界。")
            )
          )
          (princ "\n[提示] 选取的不是有效的多段线(LWPOLYLINE)，请重新选择。")
        )
      )
      ;; 如果用户按了回车、右键或取消，则退出循环
      (setq loop nil)
    )
  )
  (princ (strcat "\n[结束] 顺序打印完毕，共导出 " (itoa (1- idx)) " 个文件。"))
  (princ)
)

;; ==========================================================
;; 11. 注册新命令：seqA3 与 seqA4
;; ==========================================================
(defun c:seqA3 () (manual_sequence_plot "A3") (princ))
(defun c:seqA4 () (manual_sequence_plot "A4") (princ))

(princ "\n--- seqA3 与 seqA4 命令（按点选顺序命名 1~10 导出）加载成功 ---")
;; ==========================================================
;; 9. 註冊快捷命令 bpA3 與 bpA4
;; ==========================================================
(defun c:bpA3 () (manual_direct_plot "A3") (princ))
(defun c:bpA4 () (manual_direct_plot "A4") (princ))

;; ==========================================================
;; 9. 註冊手動快捷命令 bpA3 與 bpA4
;; ==========================================================
(defun c:bpA3 () (manual_direct_plot "A3") (princ))
(defun c:bpA4 () (manual_direct_plot "A4") (princ))
(defun c:BESA3 () (smart_batch_plot "A3") (princ))
(defun c:BESA4 () (smart_batch_plot "A4") (princ))
(princ "\n--- bpA3 與 bpA4 命令（手動選框、一號機直接送印模式）加載成功 ---")
(princ "\n--- bpdfA3 與 bpdfA4 命令（一號機直接列印、不旋轉模式）加載成功 ---")
(princ "\n--- BESA3 與 BESA4 命令 批量框选，导出A3或A4pdf文件")
;; ==========================================================
;; 12. 終極修正版：PDF24 標準合併功能直接測試命令 (完美解決字符嵌套)
;; ==========================================================
(defun c:testpdf24 (/ user_profile desktop_path test_f1 test_f2 out_f q cmd_standard) 
  (vl-load-com)

  (princ "\n==============================================")
  (princ "\n【PDF24 命令行合併無錯測試工具 v2.0】")
  (princ "\n==============================================")

  ;; 1. 安全獲取使用者主目錄
  (setq user_profile (getenv "USERPROFILE"))
  (if (not user_profile) (setq user_profile (getenv "HOME")))

  (if (not user_profile) 
    (progn 
      (princ "\n[嚴重錯誤] 無法獲取 Windows 系統使用者路徑！")
      (setq desktop_path nil)
    )
    (setq desktop_path (strcat user_profile "\\Desktop\\"))
  )

  ;; 2. 只有在桌面路徑有效時才繼續執行
  (if desktop_path 
    (progn 
      (setq test_f1 (strcat desktop_path "0.pdf")
            test_f2 (strcat desktop_path "1.pdf")
            out_f   (strcat desktop_path "Combined_TEST_Result.pdf")
      )

      ;; 3. 安全檢查：確保桌面確實有這兩個文件
      (if (not (and (findfile test_f1) (findfile test_f2))) 
        (progn 
          (princ "\n[提示] 未在桌面找到測試源文件。")
          (princ "\n請確認桌面上是否有 0.pdf 和 1.pdf 這兩個單頁文件。")
        )
        (progn 
          (princ "\n[檢測] 成功發現桌面 0.pdf 與 1.pdf，開始直接測試...")

          ;; 安全刪除舊的測試結果
          (if (findfile out_f) (vl-file-delete out_f))

          ;; 【核心修復】：定義 q 為雙引號 (chr 34)，徹底避免反斜槓 \" 拼接導致的 nil 錯誤
          (setq q (chr 34))

          (startapp 
            "D:\\PDF24\\pdf24-DocTool.exe"
            (strcat "-join -noProgress -profile user/aaa " q test_f1 q " " q test_f2 
                    q " -outputFile " q out_f q
            )
          )
          ;; 2. 【核心黑科技】：通過 Windows 核心 API 徹底過濾、清洗並壓平所有換行符和回車符
          ;; (setq clean_cmd cmd_raw)
          ;; (while (vl-string-search "\n" clean_cmd)
          ;;   (setq clean_cmd (vl-string-subst "" "\n" clean_cmd))
          ;; )
          ;; (while (vl-string-search "\r" clean_cmd)
          ;;   (setq clean_cmd (vl-string-subst "" "\r" clean_cmd))
          ;; )
          ;; (setq cmd_standard clean_cmd)
          ;;(princ (strcat "\n[執行中] 正在發送標準合併指令:\n" cmd_standard))

          ;; 5. 調用 Windows 系統 Shell 執行命令
          ;; (vl-cmdf "_.shell" cmd_standard)

          ;; 6. 驗證結果：給系統 2 秒種反應時間後檢查文件
          (vl-cmdf "_.delay" 2000)
          (if (findfile out_f) 
            (princ (strcat "\n\n【恭喜！】測試成功！合併文件已順利生成在桌面:\n>>> " out_f))
            (progn 
              (princ "\n\n【失敗】未能在桌面檢測到 Combined_TEST_Result.pdf")
              (princ "\n請確認您的電腦中是否安裝了 PDF24，且路徑是否為默認的 C:\\Program Files\\PDF24\\")
            )
          )
        )
      )
    )
  )
  (princ "\n==============================================\n")
  (princ)
)
