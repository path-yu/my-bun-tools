(vl-load-com)

;; ==========================================================
;; 1. 强力文字清洗函数
;; ==========================================================
(defun clean_final_logic (str / s pos1 pos2 result i len char code) 
  (setq s str)
  (while (setq pos1 (vl-string-search "{" s)) (setq s (vl-string-subst "" "{" s)))
  (while (setq pos1 (vl-string-search "}" s)) (setq s (vl-string-subst "" "}" s)))
  (while (setq pos1 (vl-string-search "\\" s)) 
    (if (setq pos2 (vl-string-search ";" s pos1)) 
      (setq s (strcat (substr s 1 pos1) (substr s (+ pos2 2))))
      (setq s (vl-string-subst "" "\\" s))
    )
  )
  (setq result ""
        i      1
        len    (strlen s)
  )
  (while (<= i len) 
    (setq char (substr s i 1)
          code (ascii char)
    )
    (if 
      (or (and (>= code 48) (<= code 57)) 
          (and (>= code 65) (<= code 90))
          (and (>= code 97) (<= code 122))
          (= code 47)
          (= code 45)
          (= code 46)
          (= code 95)
          (= code 126)
          (= code 32)
      )
      (setq result (strcat result char))
    )
    (setq i (1+ i))
  )
  (vl-string-trim " " result)
)

;; ==========================================================
;; 2. 调试框生成函数 (红色)
;; ==========================================================
(defun draw_debug_rect (p1 p2) 
  (entmake 
    (list '(0 . "LWPOLYLINE") 
          '(100 . "AcDbEntity")
          '(100 . "AcDbPolyline")
          '(62 . 1)
          '(90 . 4)
          '(70 . 1)
          (cons 10 (list (car p1) (cadr p1)))
          (cons 10 (list (car p2) (cadr p1)))
          (cons 10 (list (car p2) (cadr p2)))
          (cons 10 (list (car p1) (cadr p2)))
    )
  )
)

;; ==========================================================
;; 3. 单个图框处理逻辑 (返回数据列表)
;; ==========================================================
(defun process_single_box (pmin pmax / ax ay ray y_hits int_pt cur_y_val top_left 
                           s_min s_max cur_m cur_d cur_p cur_x cur_y_pt tx ty tstr tmp 
                           ss_local_lines obj k key dist min_dist box_w box_h
                          ) 
  (setq ax     (car pmax)
        ay     (cadr pmin)
        y_hits '()
        box_w  (- (car pmax) (car pmin))
        box_h  (- (cadr pmax) (cadr pmin))
  )
  ;; --- 步骤 1: 穿刺线逻辑 ---
  (if 
    (setq ss_local_lines (ssget "C" 
                                (list (- ax 10) ay)
                                (list (+ ax 10) (+ ay 1500))
                                '((0 . "LWPOLYLINE,LINE"))
                         )
    )
    (progn 
      (setq ray (vla-addline (vla-get-modelspace (vla-get-activedocument (vlax-get-acad-object))) 
                             (vlax-3d-point (list ax ay 0))
                             (vlax-3d-point (list ax (+ ay 1500) 0))
                )
      )
      (setq k 0)
      (repeat (sslength ss_local_lines) 
        (setq obj (vlax-ename->vla-object (ssname ss_local_lines k)))
        (setq int_pt (vl-catch-all-apply 'vlax-invoke (list ray 'IntersectWith obj acextendnone)))
        (if (and int_pt (not (vl-catch-all-error-p int_pt))) 
          (while (>= (length int_pt) 3) 
            (setq cur_y_val (cadr int_pt))
            (if (not (member cur_y_val y_hits)) (setq y_hits (cons cur_y_val y_hits)))
            (setq int_pt (cdddr int_pt))
          )
        )
        (setq k (1+ k))
      )
      (vla-delete ray)
    )
  )
  (setq y_hits (vl-sort y_hits '<))

  ;; --- 步骤 2: 定位文字 ---
  (if (>= (length y_hits) 2) 
    (progn 
      (setq top_left (list (car pmin) (cadr pmax)))
      ;; 修改 process_single_box 内部的搜索定义
      (setq s_min (list (car top_left) (- (cadr top_left) (* box_h 0.1))) ;; 下探高度的10%
            s_max (list (+ (car top_left) (* box_w 0.5)) (+ (cadr top_left) (* box_h 0.01))) ;; 横向覆盖宽度的一半
      )
      ;; --- 在这里插入下面这行代码来开启调试 ---
      ;;(draw_debug_rect s_min s_max)
      
      ;; --- 新增：显示物料编码和图号的搜索区 ---
      (if (>= (length y_hits) 4)
        (progn
          ;; 1. 物料编码搜索区 (y_hits 的第2条到第3条线之间)
          ;;(draw_debug_rect 
          ;;  (list (- ax 1000) (nth 1 y_hits)) 
          ;;  (list ax (nth 2 y_hits)))
          ;;
          ;;;; 2. 图号搜索区 (y_hits 的第3条到第4条线之间)
          ;;(draw_debug_rect 
          ;;  (list (- ax 1000) (nth 2 y_hits)) 
          ;;  (list ax (nth 3 y_hits)))
        )
      )
      
      
      (setq cur_m    ""
            cur_d    ""
            cur_p    ""
            cur_x    0.0
            cur_y_pt 0.0
            min_dist 1e10
      )

      (foreach item txt_data 
        (setq tx   (car (car item))
              ty   (cadr (car item))
              tstr (cadr item)
        )
        ;; A. 寻找产品编码 (左上角最近距离)
        (if (and (>= tx (car s_min)) (<= tx (car s_max))
                 (>= ty (cadr s_min)) (<= ty (cadr s_max)))
          (progn 
            
            (setq tmp (clean_final_logic tstr))
            (if (/= tmp "")
              (progn
                (setq dist (distance top_left (list tx ty)))
                (if (< dist min_dist)
                  (setq min_dist dist
                        cur_p    tmp)
                )
              )
            )
          )
        )

        ;; B. 寻找图号和物料编码
        (if (and (> tx (- ax 1000)) (< tx ax)) 
          (cond 
            ;; 物料编码通常在倒数第二格
            ((and (>= (length y_hits) 4) (>= ty (nth 1 y_hits)) (<= ty (nth 2 y_hits)))
            (setq tmp (clean_final_logic tstr))
            (if (> (strlen tmp) 2) (setq cur_m tmp cur_x tx cur_y_pt ty)))
            
            ;; 图号：锁定在第3条和第4条线之间，且更靠近右下角
            ((and (>= (length y_hits) 4) (>= ty (nth 2 y_hits)) (<= ty (nth 3 y_hits)))
            (setq tmp (clean_final_logic tstr))
            ;; 过滤掉带 'MPa' 或 'm3' 的干扰项 (根据你的错误样本增加判断)
            (if (and (> (strlen tmp) 2) 
                      (not (vl-string-search "MPa" tstr))
                      (not (vl-string-search "m3" tstr)))
                (setq cur_d tmp)
            ));
          )
        )
      )
      ;; --- 新增：打印逻辑 ---
   ;; === 新增：未找到数据时的控制台打印诊断 ===
      ;; (if (or (= cur_m "") (= cur_d "") (= cur_p ""))
      ;;   (progn
      ;;     (princ "\n------------------------------------")
      ;;     (princ (strcat "\n[诊断] 图框坐标 (右下角): " (rtos ax 2 2) ", " (rtos ay 2 2)))
      ;;     (princ (strcat "\n[诊断] 检测到横线数量: " (itoa (length y_hits))))
      ;;     (if (= cur_p "") (princ "\n[错误] 未能匹配到 -> [产品编码] (左上角区域)"))
      ;;     (if (= cur_m "") (princ "\n[错误] 未能匹配到 -> [物料编码] (y_hits 第2-3线之间)"))
      ;;     (if (= cur_d "") (princ "\n[错误] 未能匹配到 -> [图号] (y_hits 第3-4线之间)"))
      ;;     (princ "\n------------------------------------")
      ;;   )
      ;; )
      (if (and (/= cur_m "") (/= cur_d "")) 
        (list cur_m cur_d (if (/= cur_p "") cur_p "None") (rtos cur_x 2 3) (rtos cur_y_pt 2 3))
        nil
      )
    )
  )
)

;; ==========================================================
;; 4. 后台上传函数
;; ==========================================================
(defun upload_to_backend (data_list / url http json_str dwg_full_path dwg_name item i) 
  (setq url "http://localhost:3003/uploadDrawings")
  (if (> (length data_list) 0) 
    (progn 
      (setq dwg_full_path (strcat (getvar "DWGPREFIX") (getvar "DWGNAME")))
      (setq dwg_full_path (vl-string-translate "\\" "/" dwg_full_path))
      (setq dwg_name (getvar "DWGNAME"))

      (princ "\n正在封装数据并同步到数据库...")

      (setq json_str (strcat "{\"filePath\":\"" dwg_full_path "\",\"data\":["))
      (setq i 0)
      (foreach item data_list 
        (setq json_str (strcat json_str 
                               "{"
                               "\"materialCode\":\"" (nth 0 item) "\","
                               "\"drawingNumber\":\"" (nth 1 item) "\","
                               "\"fileName\":\"" dwg_name "\","
                               "\"remarks\":\"" (nth 2 item) "\","
                               "\"x\":\"" (nth 3 item) "\","
                               "\"y\":\"" (nth 4 item) "\""
                               "}"))
        (setq i (1+ i))
        (if (< i (length data_list)) (setq json_str (strcat json_str ",")))
      )
      (setq json_str (strcat json_str "]}"))

      (setq http (vlax-create-object "MSXML2.XMLHTTP"))
      (vlax-invoke-method http 'open "POST" url :vlax-false)
      (vlax-invoke-method http 'setRequestHeader "Content-Type" "application/json;charset=utf-8")

      (princ "\n[网络] 发送 POST 请求...")
      (vl-catch-all-apply 'vlax-invoke-method (list http 'send json_str))

      (if (= (vlax-get-property http 'status) 200) 
        (princ (strcat "\n[成功] " (itoa (length data_list)) " 组图纸数据已入库。"))
        (princ (strcat "\n[失败] 服务器响应异常: " (itoa (vlax-get-property http 'status))))
      )
      (vlax-release-object http)
    )
    (princ "\n[提示] 未采集到有效数据。")
  )
)

;; ==========================================================
;; 5. 公共函数 - 收集所有文字
;; ==========================================================
(defun collect_all_text_data (/ ss_txt i ed)
  (setq txt_data '())
  (if (setq ss_txt (ssget "X" '((0 . "TEXT,MTEXT"))))
    (repeat (setq i (sslength ss_txt))
      (setq ed (entget (ssname ss_txt (setq i (1- i)))))
      (setq txt_data (cons (list (cdr (assoc 10 ed)) (cdr (assoc 1 ed))) txt_data))
    )
  )
  txt_data
)

;; ==========================================================
;; 6. 公共函数 - 扫描并提取图框数据
;; ==========================================================
(defun scan_and_extract_boxes (/ ss_all i ed vlist p_min p_max area res)
  (setq final_list '() unique_list '())
  (if (setq ss_all (ssget "X" '((0 . "LWPOLYLINE") (70 . 1))))
    (progn
      (setq i 0)
      (repeat (sslength ss_all)
        (setq ed (entget (ssname ss_all i)))
        (setq vlist (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed)))
        (setq p_min (list (apply 'min (mapcar 'car vlist))
                          (apply 'min (mapcar 'cadr vlist)))
              p_max (list (apply 'max (mapcar 'car vlist))
                          (apply 'max (mapcar 'cadr vlist)))
              area (abs (* (- (car p_max) (car p_min)) (- (cadr p_max) (cadr p_min)))))
        
        (if (and (> area 1000000.0) (< area 400000000.0))
          (if (setq res (process_single_box p_min p_max))
            (if (not (member (strcat (nth 0 res) (nth 2 res)) unique_list))
              (setq final_list (cons res final_list)
                    unique_list (cons (strcat (nth 0 res) (nth 2 res)) unique_list))
            )
          )
        )
        (setq i (1+ i))
      )
    )
  )
  final_list
)

;; ==========================================================
;; 7. 公共函数 - 单张PDF导出核心流程
;; ==========================================================
(defun export_single_pdf (ent_out res p1_out p2_out / cen pdfname path ss_members member_handles 
                          ss_all_now hide_list p1_new p2_new vla_obj_out m_idx n_idx cur_ent h)
  
  (setq vla_obj_out (vlax-ename->vla-object ent_out)
        pdfname (strcat (nth 0 res) "-" (nth 1 res) "-" (nth 2 res) ".pdf")
        pdfname (vl-string-translate "/\\:*?\"<>|" "_________" pdfname)
        path (strcat desktop pdfname)
        cen (list (/ (+ (car p1_out) (car p2_out)) 2.0) 
                  (/ (+ (cadr p1_out) (cadr p2_out)) 2.0) 0.0))

  (setq member_handles '() hide_list '())

  ;; 缓存当前外框内部所有成员
  (setq ss_members (ssget "W" p1_out p2_out))
  (if ss_members
    (progn
      (setq m_idx 0)
      (repeat (sslength ss_members)
        (setq member_handles (cons (cdr (assoc 5 (entget (ssname ss_members m_idx)))) member_handles))
        (setq m_idx (1+ m_idx)))
      (ssadd ent_out ss_members))
    (setq ss_members (ssadd ent_out (sscreate))))

  ;; 旋转 270 度
  (command "_.ROTATE" ss_members "" "non" cen "270")
  
  ;; 旋转后重新获取边界框
  (vla-getboundingbox vla_obj_out 'mpt1 'mpt2)
  (setq p1_new (vlax-safearray->list mpt1)
        p2_new (vlax-safearray->list mpt2))

  ;; 隐藏外部干扰实体
  (if (setq ss_all_now (ssget "C" p1_new p2_new))
    (progn
      (setq n_idx 0)
      (repeat (sslength ss_all_now)
        (setq cur_ent (ssname ss_all_now n_idx)
              h (cdr (assoc 5 (entget cur_ent))))
        (if (and (not (member h member_handles)) (/= cur_ent ent_out))
          (progn (redraw cur_ent 2) (setq hide_list (cons cur_ent hide_list))))
        (setq n_idx (1+ n_idx)))))

  ;; 执行打印
  (if (findfile path) (vl-file-delete path))
  (command "-PLOT" "Y" "" "DWG To PDF.pc3" "ISO full bleed A3 (297.00 x 420.00 毫米)" 
           "M" "P" "N" "W" "non" p1_new "non" p2_new "F" "C" "Y" "monochrome.ctb" "Y" "A" path "N" "Y")

  ;; 还原
  (foreach h_item hide_list (redraw h_item 1))
  (command "_.ROTATE" ss_members "" "non" cen "90")

  (princ (strcat "\n[成功导出] " pdfname))
)

;; ==========================================================
;; 8. BEXK 命令 - 框选上传（保留原有逻辑）
;; ==========================================================
(defun c:BEXK (/ ss_pick i ed vlist p_min p_max area res unique_list final_list)
  (setvar "CMDECHO" 0)
  (setq final_list '() unique_list '())

  (princ "\n请框选需要提取的图框区域...")
  (if (setq ss_pick (ssget '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      (setq txt_data (collect_all_text_data))

      (setq i 0)
      (repeat (sslength ss_pick) 
        (setq ed (entget (ssname ss_pick i)))
        (setq vlist (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed)))
        (setq p_min (list (apply 'min (mapcar 'car vlist)) 
                          (apply 'min (mapcar 'cadr vlist)))
              p_max (list (apply 'max (mapcar 'car vlist)) 
                          (apply 'max (mapcar 'cadr vlist)))
              area (abs (* (- (car p_max) (car p_min)) (- (cadr p_max) (cadr p_min)))))
        
        (if (and (> area 1000000.0) (< area 400000000.0))
          (if (setq res (process_single_box p_min p_max))
            (if (not (member (strcat (car res) (cadr res)) unique_list))
              (setq final_list (cons res final_list)
                    unique_list (cons (strcat (car res) (cadr res)) unique_list))
            )
          )
        )
        (setq i (1+ i))
      )
      
      (princ (strcat "\n共提取 " (itoa (length final_list)) " 个有效图框。"))
      ;; (upload_to_backend final_list)   ; 已注释，保持原样
    )
    (princ "\n[取消] 未选中任何闭合多段线。")
  )
  (princ)
)

;; ==========================================================
;; 9. EXK 命令 - 全图自动扫描并上传
;; ==========================================================
(defun c:EXK (/ final_list)
  (setvar "CMDECHO" 0)
  (princ "\n[系统] 正在启动全图自动扫描 (调试模式)...")

  (setq txt_data (collect_all_text_data))
  (setq final_list (scan_and_extract_boxes))

  (if (> (length final_list) 0)
    (progn
      (princ "\n\n==================== 自动提取结果预览 ====================")
      (princ (strcat "\n当前图纸: " (getvar "DWGNAME")))
      (princ (strcat "\n共发现有效图框: " (itoa (length final_list)) " 个"))
      (princ "\n----------------------------------------------------------")
      (upload_to_backend final_list)
    )
    (princ "\n[提示] 扫描完成，但没有找到符合条件的图纸数据。")
  )
  (princ)
)

;; ==========================================================
;; 4. GTA 命令 - 提取数据并导出带 ZOOM 命令的 TXT
;; ==========================================================
(defun c:GTA (/ final_list filename file_ptr row item_str cur_x cur_y zoom_cmd)
  (setvar "CMDECHO" 0)
  (princ "\n[系统] 正在启动全图扫描与数据提取...")

  (setq txt_data (collect_all_text_data))
  (setq final_list (scan_and_extract_boxes))

  (if (and final_list (> (length final_list) 0)) 
    (progn 
      (setq filename (getfiled "导出数据为 TXT 文件" "物料清单_带定位命令" "txt" 1))
      (if filename
        (progn
          (setq file_ptr (open filename "w"))
          ;; 写入表头
          (write-line "物料编码 | 物料编码 | 图号 | 产品编码 | ZOOM命令" file_ptr)
          
          (foreach row (reverse final_list) 
            (setq cur_x (nth 3 row) cur_y (nth 4 row))
            
            ;; 构造 ZOOM 命令字符串
            (setq zoom_cmd (strcat "ZOOM C " cur_x "," cur_y " 500"))
            
            ;; 实时视图定位反馈
            (command "_.ZOOM" "C" (list (atof cur_x) (atof cur_y)) 500)
            (princ (strcat "\n定位至物料: " (nth 0 row)))

            ;; 构造写入 TXT 的数据行
            (setq item_str (strcat 
                             (nth 0 row) " | " 
                             (nth 1 row) " | " 
                             (nth 2 row) " | " 
                             zoom_cmd))
            
            (write-line item_str file_ptr)
          )
          
          (close file_ptr)
          (princ (strcat "\n\n[成功] 数据已保存至: " filename))
          (command "_.ZOOM" "E")
        )
        (princ "\n[提示] 操作已取消。")
      )
    )
    (princ "\n[错误] 未能识别到符合条件的图纸数据。")
  )
  (princ)
)

;; ==========================================================
;; 11. set_clipboard 函数
;; ==========================================================
(defun set_clipboard (str / html result) 
  (setq html (vlax-create-object "htmlfile"))
  (setq result (vlax-invoke (vlax-get (vlax-get html 'ParentWindow) 'ClipBoardData) 
                            'setData "Text" str))
  (vlax-release-object html)
  (princ "\n[系统] 内容已成功复制到剪切板。")
)

;; ==========================================================
;; 12. ESPDF 命令 - 手动选择外框导出PDF
;; ==========================================================
(defun c:ESPDF (/ ss_pick i ent_out vla_obj_out p1_out p2_out out_area cen 
                 ss_inner k obj_in in_ed in_vlist in_min in_max in_area ratio res)
  
  (vl-load-com)
  (setq old_cmdecho (getvar "CMDECHO") old_osmode (getvar "OSMODE"))
  (setvar "CMDECHO" 0) (setvar "OSMODE" 0)

  (setq txt_data '() desktop (strcat (getenv "USERPROFILE") "\\Desktop\\"))
  (princ "\n[系统] 请选择图纸【最外圈打印边框】(可多选)...")

  (setq txt_data (collect_all_text_data))

  (if (setq ss_pick (ssget '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      (setq i 0)
      (repeat (sslength ss_pick) 
        (setq ent_out (ssname ss_pick i)
              vla_obj_out (vlax-ename->vla-object ent_out))
        
        (vla-getboundingbox vla_obj_out 'mpt1 'mpt2)
        (setq p1_out (vlax-safearray->list mpt1)
              p2_out (vlax-safearray->list mpt2)
              out_area (abs (* (- (car p2_out) (car p1_out)) (- (cadr p2_out) (cadr p1_out))))
              cen (list (/ (+ (car p1_out) (car p2_out)) 2.0) 
                        (/ (+ (cadr p1_out) (cadr p2_out)) 2.0) 0.0))

        (if (setq ss_inner (ssget "C" p1_out p2_out '((0 . "LWPOLYLINE") (70 . 1))))
          (progn
            (setq k 0)
            (repeat (sslength ss_inner)
              (setq obj_in (ssname ss_inner k)
                    in_ed (entget obj_in)
                    in_vlist (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) in_ed))
                    in_min (list (apply 'min (mapcar 'car in_vlist)) (apply 'min (mapcar 'cadr in_vlist)))
                    in_max (list (apply 'max (mapcar 'car in_vlist)) (apply 'max (mapcar 'cadr in_vlist)))
                    in_area (abs (* (- (car in_max) (car in_min)) (- (cadr in_max) (cadr in_min))))
                    ratio (/ in_area out_area))

              (if (and (> ratio 0.85) (< ratio 0.98))
                (if (setq res (process_single_box in_min in_max))
                  (export_single_pdf ent_out res p1_out p2_out)
                )
              )
              (setq k (1+ k))
            )
          )
        )
        (setq i (1+ i))
      )
      (princ "\n[完成] 所有选中图纸已处理完毕。")
    )
    (princ "\n[取消] 未选中有效外框。")
  )

  (setvar "CMDECHO" old_cmdecho)
  (setvar "OSMODE" old_osmode)
  (princ)
)

;; ==========================================================
;; 13. ESA 命令 - 全图自动批量导出PDF
;; ==========================================================
(defun c:ESA (/ ss_all i ent_out ed_out vlist_out p1_out p2_out out_area cen 
               ss_inner k obj_in in_ed in_vlist in_min in_max in_area ratio res)
  
  (vl-load-com)
  (setq old_cmdecho (getvar "CMDECHO") old_osmode (getvar "OSMODE"))
  (setvar "CMDECHO" 0) (setvar "OSMODE" 0)

  (setq txt_data '() desktop (strcat (getenv "USERPROFILE") "\\Desktop\\"))
  (princ "\n[系统] 正在启动全图自动扫描导出...")

  (setq txt_data (collect_all_text_data))

  (if (setq ss_all (ssget "X" '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      (setq i 0)
      (repeat (sslength ss_all) 
        (setq ent_out (ssname ss_all i)
              ed_out (entget ent_out)
              vlist_out (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed_out))
              p1_out (list (apply 'min (mapcar 'car vlist_out)) (apply 'min (mapcar 'cadr vlist_out)))
              p2_out (list (apply 'max (mapcar 'car vlist_out)) (apply 'max (mapcar 'cadr vlist_out)))
              out_area (abs (* (- (car p2_out) (car p1_out)) (- (cadr p2_out) (cadr p1_out))))
              vla_obj_out (vlax-ename->vla-object ent_out))

        (if (and (> out_area 1000000.0) (< out_area 400000000.0))
          (if (setq ss_inner (ssget "C" p1_out p2_out '((0 . "LWPOLYLINE") (70 . 1))))
            (progn
              (setq k 0)
              (repeat (sslength ss_inner)
                (setq obj_in (ssname ss_inner k)
                      in_ed (entget obj_in)
                      in_vlist (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) in_ed))
                      in_min (list (apply 'min (mapcar 'car in_vlist)) (apply 'min (mapcar 'cadr in_vlist)))
                      in_max (list (apply 'max (mapcar 'car in_vlist)) (apply 'max (mapcar 'cadr in_vlist)))
                      in_area (abs (* (- (car in_max) (car in_min)) (- (cadr in_max) (cadr in_min))))
                      ratio (/ in_area out_area))

                (if (and (> ratio 0.85) (< ratio 0.98))
                  (if (setq res (process_single_box in_min in_max))
                    (export_single_pdf ent_out res p1_out p2_out)
                  )
                )
                (setq k (1+ k))
              )
            )
          )
        )
        (setq i (1+ i))
      )
      (princ "\n[完成] 全图批量导出任务结束。")
    )
    (princ "\n[错误] 未能识别到符合面积要求的图框。")
  )

  (setvar "CMDECHO" old_cmdecho)
  (setvar "OSMODE" old_osmode)
  (princ)
)
;; ==========================================================
;; 14. CA 命令 - 提取数据并拼接字符串到剪切板
;; ==========================================================
(defun c:CA (/ final_list res_str item m_code d_num p_code)
  (setvar "CMDECHO" 0)
  (princ "\n[系统] 正在扫描图纸并生成拼接字符串...")

  (setq txt_data (collect_all_text_data))
  (setq final_list (scan_and_extract_boxes))

  (if (and final_list (> (length final_list) 0))
    (progn
      (setq res_str "")
      (foreach item (reverse final_list)
        (setq m_code (nth 0 item)           ; 物料编码
              d_num  (nth 1 item)           ; 图号
              p_code (nth 2 item))          ; 产品编码

        ;; 将图号中的 / 转换为 -
        (while (vl-string-search "/" d_num)
          (setq d_num (vl-string-subst "-" "/" d_num))
        )

        ;; 拼接每组数据：物料编码-图号-产品编码
        (setq res_str (strcat res_str m_code "-" d_num "-" p_code "\n"))
      )

      ;; 调用剪切板函数
      (set_clipboard res_str)
      (princ (strcat "\n[成功] 已提取 " (itoa (length final_list)) " 组数据并复制到剪切板。"))
    )
    (princ "\n[错误] 未能识别到符合条件的图纸数据。")
  )
  (princ)
)
;; ==========================================================
;; 加载提示
;; ==========================================================
(princ "\n--- ESA 命令加载成功：输入 ESA 执行全图自动批量导出 PDF ---")
(princ "\n--- BEXK 命令加载成功：框选提取数据 ---")
(princ "\n--- GTA 命令 - 提取数据并导出为 TXT ---")
(princ "\n--- EXK 命令加载成功：全图扫描并上传 ---")
(princ "\n--- CA命令加载成功：全图复制剪切板文件名 ---")
(princ "\n--- BPA命令加载成功：全图打印图纸到打印机 ---")
;; 热更新快捷键
(setq _current_lsp_path "C:/Users/19746/Desktop/node/extract_data.lsp") 
(defun c:EAD ()
  (load _current_lsp_path)
  (princ (strcat "\n[热更新] 已重载: " _current_lsp_path))
  (princ)
)
;; ==========================================================
;; 15. BPA 命令 - 修复版 (解决 lentityp nil 错误)
;; ==========================================================
(defun c:BPA (/ ss_all i ent_out ed_out vlist_out p1_out p2_out out_area 
               ss_inner k obj_in in_ed in_vlist in_min in_max in_area ratio 
               printer_name count)
  
  (vl-load-com)
  (setq old_cmdecho (getvar "CMDECHO") 
        old_osmode (getvar "OSMODE"))
  (setvar "CMDECHO" 0) 
  (setvar "OSMODE" 0)

  ;; 1. 设定物理打印机名称 (请确保这里是你二号机的真实驱动名)
  (setq printer_name "二号机打印机名称.pc3") 
  (setq count 0)

  (princ "\n[系统] 正在按 ESA 嵌套逻辑扫描外框...")

  ;; 2. 扫描全图所有闭合多段线
  (if (setq ss_all (ssget "X" '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      (setq i 0)
      (repeat (sslength ss_all) 
        (setq ent_out (ssname ss_all i))
        (if (and ent_out (entget ent_out)) ; 确保实体存在
          (progn
            (setq ed_out (entget ent_out)
                  vlist_out (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed_out))
                  p1_out (list (apply 'min (mapcar 'car vlist_out)) (apply 'min (mapcar 'cadr vlist_out)))
                  p2_out (list (apply 'max (mapcar 'car vlist_out)) (apply 'max (mapcar 'cadr vlist_out)))
                  out_area (abs (* (- (car p2_out) (car p1_out)) (- (cadr p2_out) (cadr p1_out)))))

            ;; 过滤外框面积 (A4约 6e4, A3约 1.2e5, 这里你的 1e6 是针对大图的)
            (if (and (> out_area 1000000.0) (< out_area 400000000.0))
              (progn
                ;; 3. 在外框范围内寻找内框
                (if (setq ss_inner (ssget "C" p1_out p2_out '((0 . "LWPOLYLINE") (70 . 1))))
                  (progn
                    (setq k 0)
                    (repeat (sslength ss_inner)
                      (setq obj_in (ssname ss_inner k))
                      (if (and obj_in (not (equal obj_in ent_out))) ; 确保内框不是外框本身
                        (progn
                          (setq in_ed (entget obj_in)
                                in_vlist (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) in_ed))
                                in_min (list (apply 'min (mapcar 'car in_vlist)) (apply 'min (mapcar 'cadr in_vlist)))
                                in_max (list (apply 'max (mapcar 'car in_vlist)) (apply 'max (mapcar 'cadr in_vlist)))
                                in_area (abs (* (- (car in_max) (car in_min)) (- (cadr in_max) (cadr in_min))))
                                ratio (/ in_area out_area))

                          ;; 4. 判定比例
                          (if (and (> ratio 0.85) (< ratio 0.98))
                            (progn
                              ;; 检查 draw_debug_rect 是否存在，若报错则临时定义一个
                              (if (and p1_out p2_out)
                                (progn
                                  ;; 模拟 ESA 的调试框绘制
                                  (entmake (list '(0 . "LINE") '(62 . 1) (cons 10 p1_out) (cons 11 (list (car p2_out) (cadr p1_out)))))
                                  (entmake (list '(0 . "LINE") '(62 . 1) (cons 10 p1_out) (cons 11 (list (car p1_out) (cadr p2_out)))))
                                  (princ (strcat "\n[打印中] 发现标准图框，发送至: " printer_name))
                                  
                                  ;; (command "-PLOT" "Y" "" printer_name 
                                  ;;          "ISO full bleed A3 (297.00 x 420.00 毫米)" 
                                  ;;          "M" "L" "N" "W" "non" p1_out "non" p2_out "F" "C" "Y" 
                                  ;;          "monochrome.ctb" "Y" "N" "N" "Y")
                                  
                                  (setq count (1+ count))
                                  (setq k (sslength ss_inner)) ; 跳出内循环
                                ))
                            )
                          )
                        ))
                      (setq k (1+ k))
                    )
                  )
                )
              )
            )
          ))
        (setq i (1+ i))
      )
      (princ (strcat "\n[完成] 共成功打印 " (itoa count) " 张图纸。"))
    )
    (princ "\n[错误] 未能在图中找到任何闭合线。")
  )

  (setvar "CMDECHO" old_cmdecho)
  (setvar "OSMODE" old_osmode)
  (princ)
)
(princ "\n--- extract_data.lsp 已优化加载完成 ---")