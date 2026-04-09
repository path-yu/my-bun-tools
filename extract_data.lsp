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
                           ss_local_lines obj k key
                          ) 
  (setq ax     (car pmax)
        ay     (cadr pmin)
        y_hits '()
  )
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
        (setq int_pt (vl-catch-all-apply 'vlax-invoke 
                                         (list ray 'IntersectWith obj acextendnone)
                     )
        )
        (if (and int_pt (not (vl-catch-all-error-p int_pt))) 
          (while (>= (length int_pt) 3) 
            (setq cur_y_val (cadr int_pt))
            (if (not (member cur_y_val y_hits)) 
              (setq y_hits (cons cur_y_val y_hits))
            )
            (setq int_pt (cdddr int_pt))
          )
        )
        (setq k (1+ k))
      )
      (vla-delete ray)
    )
  )
  (setq y_hits (vl-sort y_hits '<))

  (if (>= (length y_hits) 2) 
    (progn 
      (setq top_left (list (car pmin) (cadr pmax)))
      (setq s_min (list (car top_left) (- (cadr top_left) 250))
            s_max (list (+ (car top_left) 2500) (+ (cadr top_left) 100))
      )
      (draw_debug_rect s_min s_max)
      (setq cur_m    ""
            cur_d    ""
            cur_p    ""
            cur_x    0.0
            cur_y_pt 0.0
      )

      (foreach item txt_data 
        (setq tx   (car (car item))
              ty   (cadr (car item))
              tstr (cadr item)
        )
        (if 
          (and (>= tx (car s_min)) 
               (<= tx (car s_max))
               (>= ty (cadr s_min))
               (<= ty (cadr s_max))
          )
          (progn 
            (setq tmp (clean_final_logic tstr))
            (if (> (strlen tmp) (strlen cur_p)) (setq cur_p tmp))
          )
        )
        (if (and (> tx (- ax 600)) (< tx ax)) 
          (cond 
            ((and (>= (length y_hits) 4) 
                  (>= ty (nth 1 y_hits))
                  (<= ty (nth 2 y_hits))
             )
             (setq tmp (clean_final_logic tstr))
             (if (> (strlen tmp) 2) 
               (setq cur_m    tmp
                     cur_x    tx
                     cur_y_pt ty
               )
             )
            )
            ((and (>= (length y_hits) 4) 
                  (>= ty (nth 2 y_hits))
                  (<= ty (nth 3 y_hits))
             )
             (setq tmp (clean_final_logic tstr))
             (if (> (strlen tmp) 2) (setq cur_d tmp))
            )
          )
        )
      )
      ;; 返回结果格式: (图号 图名 编码 X坐标 Y坐标)
      (if (and (/= cur_m "") (/= cur_d "")) 
        (list cur_m 
              cur_d
              (if (/= cur_p "") cur_p "None")
              (rtos cur_x 2 3)
              (rtos cur_y_pt 2 3)
        )
        nil
      )
    )
  )
)

;; ==========================================================
;; 4. 修正后的后台上传函数
;; ==========================================================
(defun upload_to_backend (data_list / url http json_str dwg_full_path dwg_name item i) 
  (setq url "http://localhost:3003/uploadDrawings")
  (if (> (length data_list) 0) 
    (progn 
      ;; 获取完整路径和纯文件名
      (setq dwg_full_path (strcat (getvar "DWGPREFIX") (getvar "DWGNAME")))
      (setq dwg_full_path (vl-string-translate "\\" "/" dwg_full_path))
      (setq dwg_name (getvar "DWGNAME"))

      (princ "\n正在封装数据并同步到数据库...")

      ;; 构建 JSON
      (setq json_str (strcat "{\"filePath\":\"" dwg_full_path "\",\"data\":["))
      (setq i 0)
      (foreach item data_list 
        (setq json_str (strcat json_str 
                               "{"
                               "\"materialCode\":\""
                               (nth 0 item)
                               "\"," ;; 对应 (nth 2 row) 编码
                               "\"drawingNumber\":\""
                               (nth 1 item)
                               "\"," ;; 对应 (nth 0 row) 图号
                               "\"fileName\":\""
                               dwg_name
                               "\"," ;; 补全文件名
                               "\"remarks\":\""
                               (nth 2 item)
                               "\"," ;; 将“图名”存入备注
                               "\"x\":\""
                               (nth 3 item)
                               "\","
                               "\"y\":\""
                               (nth 4 item)
                               "\""
                               "}"
                       )
        )
        (setq i (1+ i))
        (if (< i (length data_list)) (setq json_str (strcat json_str ",")))
      )
      (setq json_str (strcat json_str "]}"))

      ;; 发送请求
      (setq http (vlax-create-object "MSXML2.XMLHTTP"))
      (vlax-invoke-method http 'open "POST" url :vlax-false)
      (vlax-invoke-method http 
                          'setRequestHeader
                          "Content-Type"
                          "application/json;charset=utf-8"
      )

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
;; 5. BEXK 命令 - 框选上传
;; ==========================================================
(defun c:BEXK (/ ss_pick i ed vlist p_min p_max area res unique_list ss_txt item) 
  (setvar "CMDECHO" 0)
  (setq final_list  '()
        txt_data    '()
        unique_list '()
  )

  (princ "\n请框选需要提取的图框区域...")
  (if (setq ss_pick (ssget '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      ;; 1. 预存区域内文字
      (if (setq ss_txt (ssget "X" '((0 . "TEXT,MTEXT")))) 
        (repeat (setq i (sslength ss_txt)) 
          (setq ed (entget (ssname ss_txt (setq i (1- i)))))
          (setq txt_data (cons (list (cdr (assoc 10 ed)) (cdr (assoc 1 ed))) 
                               txt_data
                         )
          )
        )
      )

      ;; 2. 处理选中的图框
      (setq i 0)
      (repeat (sslength ss_pick) 
        (setq ed (entget (ssname ss_pick i)))
        (setq vlist (mapcar 'cdr 
                            (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed)
                    )
        )
        (setq p_min (list (apply 'min (mapcar 'car vlist)) 
                          (apply 'min (mapcar 'cadr vlist))
                    )
              p_max (list (apply 'max (mapcar 'car vlist)) 
                          (apply 'max (mapcar 'cadr vlist))
                    )
              area  (abs 
                      (* (- (car p_max) (car p_min)) (- (cadr p_max) (cadr p_min)))
                    )
        )

        (if (and (> area 1000000.0) (< area 400000000.0)) 
          (if (setq res (process_single_box p_min p_max)) 
            (if (not (member (strcat (car res) (cadr res)) unique_list)) 
              (setq final_list  (cons res final_list)
                    unique_list (cons (strcat (car res) (cadr res)) unique_list)
              )
            )
          )
        )
        (setq i (1+ i))
      )
     (upload_to_backend final_list) 
    )
    (princ "\n[取消] 未选中任何闭合多段线。")
  )
  (princ)
)

;; ==========================================================
;; ==========================================================
;; 5. EXK 命令 - 全图自动扫描并【打印】调试数据
;; ==========================================================
(defun c:EXK (/ ss_all i ed vlist p_min p_max area res unique_list ss_txt row_idx)
  (setvar "CMDECHO" 0)
  (setq final_list '() txt_data '() unique_list '())
  
  (princ "\n[系统] 正在启动全图自动扫描 (调试模式)...")

  ;; 1. 预存全图文字
  (if (setq ss_txt (ssget "X" '((0 . "TEXT,MTEXT"))))
    (repeat (setq i (sslength ss_txt))
      (setq ed (entget (ssname ss_txt (setq i (1- i)))))
      (setq txt_data (cons (list (cdr (assoc 10 ed)) (cdr (assoc 1 ed))) txt_data))
    )
  )

  ;; 2. 自动搜索全图符合条件的图框
  (if (setq ss_all (ssget "X" '((0 . "LWPOLYLINE") (70 . 1))))
    (progn
      (setq i 0)
      (repeat (sslength ss_all)
        (setq ed (entget (ssname ss_all i)))
        (setq vlist (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed)))
        (setq p_min (list (apply 'min (mapcar 'car vlist)) (apply 'min (mapcar 'cadr vlist)))
              p_max (list (apply 'max (mapcar 'car vlist)) (apply 'max (mapcar 'cadr vlist)))
              area (abs (* (- (car p_max) (car p_min)) (- (cadr p_max) (cadr p_min)))))

        ;; 面积过滤：1,000,000 到 400,000,000
        (if (and (> area 1000000.0) (< area 400000000.0))
          (if (setq res (process_single_box p_min p_max))
            ;; 使用图号(index 0)和物料编码(index 2)进行去重
            (if (not (member (strcat (nth 0 res) (nth 2 res)) unique_list))
              (setq final_list (cons res final_list)
                    unique_list (cons (strcat (nth 0 res) (nth 2 res)) unique_list))
            )
          )
        )
        (setq i (1+ i))
      )

      ;; 3. 打印数据代替上传
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
    )
    (princ "\n[提示] 图中未发现任何闭合的多段线(图框)。")
  )
  (princ)
)
;; ==========================================================
;; 6. 辅助函数：将字符串推送到剪切板
;; ==========================================================
(defun set_clipboard (str / html result) 
  ;; 使用 Win 系统的 mshta 对象来操作剪切板，无需第三方 DLL
  (setq html (vlax-create-object "htmlfile"))
  (setq result (vlax-invoke (vlax-get (vlax-get html 'ParentWindow) 'ClipBoardData) 
                            'setData
                            "Text"
                            str
               )
  )
  (vlax-release-object html)
  (princ "\n[系统] 内容已成功复制到剪切板。")
)

;; ==========================================================
;; 7. GTA 命令 - 获取并拼接字符串到剪切板
;; ==========================================================
(defun c:GTA (/ ss_all i ed vlist p_min p_max area res unique_list ss_txt final_str 
              row item_str
             ) 
  (setvar "CMDECHO" 0)
  (setq final_list  '()
        txt_data    '()
        unique_list '()
  )

  (princ "\n正在分析全图并提取拼接字符串...")

  ;; 1. 预存全图文字
  (if (setq ss_txt (ssget "X" '((0 . "TEXT,MTEXT")))) 
    (repeat (setq i (sslength ss_txt)) 
      (setq ed (entget (ssname ss_txt (setq i (1- i)))))
      (setq txt_data (cons (list (cdr (assoc 10 ed)) (cdr (assoc 1 ed))) txt_data))
    )
  )

  ;; 2. 识别全图符合条件的图框
  (if (setq ss_all (ssget "X" '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn 
      (setq i 0)
      (repeat (sslength ss_all) 
        (setq ed (entget (ssname ss_all i)))
        (setq vlist (mapcar 'cdr 
                            (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed)
                    )
        )
        (setq p_min (list (apply 'min (mapcar 'car vlist)) 
                          (apply 'min (mapcar 'cadr vlist))
                    )
              p_max (list (apply 'max (mapcar 'car vlist)) 
                          (apply 'max (mapcar 'cadr vlist))
                    )
              area  (abs 
                      (* (- (car p_max) (car p_min)) (- (cadr p_max) (cadr p_min)))
                    )
        )

        ;; 面积过滤规则
        (if (and (> area 1000000.0) (< area 400000000.0)) 
          (if (setq res (process_single_box p_min p_max)) 
            (if (not (member (strcat (car res) (cadr res)) unique_list)) 
              (setq final_list  (cons res final_list)
                    unique_list (cons (strcat (car res) (cadr res)) unique_list)
              )
            )
          )
        )
        (setq i (1+ i))
      )

      ;; 3. 格式化拼接并复制
      (if (> (length final_list) 0) 
        (progn 
          (setq final_str "")
          (foreach row (reverse final_list) 
            ;; row 格式: (图号 图名 编码 X坐标 Y坐标)
            ;; 目标格式: 编码-图号-图名 (或按您要求的 物料编码-图号-产品编码)
            (setq item_str (strcat (nth 2 row) "-" (nth 0 row) "-" (nth 1 row)))
            (if (= final_str "") 
              (setq final_str item_str)
              (setq final_str (strcat final_str "\n" item_str)) ;; 多组换行分隔
            )
          )

          ;; 执行复制到剪切板
          (set_clipboard final_str)
          (princ (strcat "\n[成功] 提取了 " (itoa (length final_list)) " 组数据。"))
          (princ 
            (strcat "\n[预览]: " 
                    (if (> (strlen final_str) 50) 
                      (strcat (substr final_str 1 50) "...")
                      final_str
                    )
            )
          )
        )
        (princ "\n[提示] 未找到有效的图框数据。")
      )
    )
    (princ "\n[错误] 图中未发现闭合的多段线。")
  )
  (princ)
)
(princ "输出GTA 提取使用文件名")