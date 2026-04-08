(vl-load-com)

;; ==========================================================
;; 1. 核心清洗函数：白名单过滤 (只保留数字、字母、/、-、.)
;; ==========================================================
(defun clean_final_logic (str / s len i char code result pos1 pos2) 
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
    (setq char (substr s i 1))
    (setq code (ascii char))
    (if 
      (or (and (>= code 48) (<= code 57)) 
          (and (>= code 65) (<= code 90))
          (and (>= code 97) (<= code 122))
          (= code 47)
          (= code 45)
          (= code 46)
      )
      (setq result (strcat result char))
    )
    (setq i (1+ i))
  )
  result
)

;; ==========================================================
;; 2. 后台上传函数：构建 JSON 并 POST
;; ==========================================================
(defun upload_to_backend (data_list / url http json_str dwg_path item i) 
  ;; --- 请在这里修改你的后台 API 地址 ---
  (setq url "http://localhost:3003/uploadDrawings")

  (if (> (length data_list) 0) 
    (progn 
      ;; 获取并格式化路径 (防止反斜杠破坏 JSON)
      (setq dwg_path (strcat (getvar "DWGPREFIX") (getvar "DWGNAME")))
      (setq dwg_path (vl-string-translate "\\" "/" dwg_path))

      (princ "\n正在封装数据并上传...")

      ;; 构建 JSON 字符串
      (setq json_str (strcat "{\"filePath\":\"" dwg_path "\",\"data\":["))
      (setq i 0)
      (foreach item data_list 
        (setq json_str (strcat json_str 
                               "{"
                               "\"materialCode\":\""
                               (nth 0 item)
                               "\","
                               "\"drawingNumber\":\""
                               (nth 1 item)
                               "\"," ;; 默认同 no
                               "\"x\":\""
                               (nth 2 item)
                               "\","
                               "\"y\":\""
                               (nth 3 item)
                               "\""
                               "}"
                       )
        )
        (setq i (1+ i))
        (if (< i (length data_list)) (setq json_str (strcat json_str ",")))
      )
      (setq json_str (strcat json_str "]}"))

      ;; 调用 XMLHTTP 推送
      (setq http (vlax-create-object "MSXML2.XMLHTTP"))
      (vlax-invoke-method http 'open "POST" url :vlax-false)
      (vlax-invoke-method http 
                          'setRequestHeader
                          "Content-Type"
                          "application/json;charset=utf-8"
      )

      (vl-catch-all-apply 'vlax-invoke-method (list http 'send json_str))

      (if (= (vlax-get-property http 'status) 200) 
        (princ (strcat "\n[成功] " (itoa (length data_list)) " 条数据已同步至服务器。"))
        (princ 
          (strcat "\n[失败] 服务器响应异常，代码: " (itoa (vlax-get-property http 'status)))
        )
      )
      (vlax-release-object http)
    )
    (princ "\n[提示] 没有采集到有效数据，取消上传。")
  )
)

;; ==========================================================
;; 3. 公共子程序：处理单个图框内部搜索
;; ==========================================================
(defun process_single_box (pmax pmin) 
  (setq ax (car pmax)
        ay (cadr pmin)
  )
  (setq ray (vla-addline (vla-get-modelspace (vla-get-activedocument (vlax-get-acad-object))) 
                         (vlax-3d-point (list ax ay 0))
                         (vlax-3d-point (list ax (+ ay 600) 0))
            )
  )
  (setq y_hits '())
  (foreach obj box_list 
    (setq int_pt (vlax-invoke ray 'IntersectWith obj acextendnone))
    (if int_pt 
      (while (>= (length int_pt) 3) 
        (setq cur_y (cadr int_pt))
        (if (not (member cur_y y_hits)) (setq y_hits (cons cur_y y_hits)))
        (setq int_pt (cdddr int_pt))
      )
    )
  )
  (vla-delete ray)
  (setq y_hits (vl-sort y_hits '<))

  (if (>= (length y_hits) 4) 
    (progn 
      (setq cur_m ""
            cur_d ""
      )
      (foreach item txt_data 
        (setq tx   (car (car item))
              ty   (cadr (car item))
              tstr (cadr item)
        )
        (if (and (> tx (- ax 400)) (< tx ax)) 
          (cond 
            ((and (>= ty (nth 1 y_hits)) (<= ty (nth 2 y_hits)))
             (setq tmp (clean_final_logic tstr))
             (if (> (strlen tmp) 2) (setq cur_m tmp))
            )
            ((and (>= ty (nth 2 y_hits)) (<= ty (nth 3 y_hits)))
             (setq tmp (clean_final_logic tstr))
             (if (> (strlen tmp) 2) (setq cur_d tmp))
            )
          )
        )
      )
      (if (and (/= cur_m "") (/= cur_d "")) 
        (progn 
          (setq key (strcat cur_m "|" cur_d))
          (if (not (member key unique_list)) 
            (setq final_list  (cons (list cur_m cur_d (rtos ax 2 2) (rtos ay 2 2)) 
                                    final_list
                              )
                  unique_list (cons key unique_list)
            )
          )
        )
      )
    )
  )
)

;; ==========================================================
;; 命令 1: EXK (全自动)
;; ==========================================================
(defun c:EXK (/ ss_txt ed vlist x_pts y_pts p_min p_max ax ay box_list txt_data 
              y_hits ray final_list unique_list
             ) 
  (setvar "CMDECHO" 0)
  (setvar "OSMODE" 0)
  (setq final_list  '()
        txt_data    '()
        box_list    '()
        unique_list '()
  )
  (princ "\n正在执行全图提取...")
  (if (setq ss_txt (ssget "X" '((0 . "TEXT,MTEXT")))) 
    (progn (setq i 0) 
           (repeat (sslength ss_txt) 
             (setq ed (entget (ssname ss_txt i)))
             (setq txt_data (cons (list (cdr (assoc 10 ed)) (cdr (assoc 1 ed))) 
                                  txt_data
                            )
             )
             (setq i (1+ i))
           )
    )
  )
  (if (setq ss_lines (ssget "X" '((0 . "LWPOLYLINE,LINE")))) 
    (progn (setq i 0) 
           (repeat (sslength ss_lines) 
             (setq box_list (cons (vlax-ename->vla-object (ssname ss_lines i)) 
                                  box_list
                            )
             )
             (setq i (1+ i))
           )
    )
  )
  (if (setq ss_inner (ssget "X" '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn (setq i 0) 
           (repeat (sslength ss_inner) 
             (setq ed (entget (ssname ss_inner i)))
             (setq vlist (mapcar 'cdr 
                                 (vl-remove-if-not '(lambda (x) (= 10 (car x))) 
                                                   ed
                                 )
                         )
             )
             (setq x_pts (mapcar 'car vlist)
                   y_pts (mapcar 'cadr vlist)
             )
             (setq p_min (list (apply 'min x_pts) (apply 'min y_pts))
                   p_max (list (apply 'max x_pts) (apply 'max y_pts))
                   area  (abs 
                           (* (- (car p_max) (car p_min)) 
                              (- (cadr p_max) (cadr p_min))
                           )
                         )
             )
             (if (and (> area 10000000.0) (< area 60000000.0)) 
               (process_single_box p_max p_min)
             )
             (setq i (1+ i))
           )
    )
  )
  (upload_to_backend final_list)
  (princ)
)

;; ==========================================================
;; 命令 2: BEXK (手动框选)
;; ==========================================================
(defun c:BEXK (/ ss_user en ed etype vlist x_pts y_pts p_min p_max ax ay box_list 
               txt_data y_hits ray final_list unique_list
              ) 
  (setvar "CMDECHO" 0)
  (setvar "OSMODE" 0)
  (setq final_list  '()
        txt_data    '()
        box_list    '()
        unique_list '()
  )
  (princ "\n请框选图框所在区域...")
  (if (setq ss_user (ssget '((0 . "LWPOLYLINE,LINE,TEXT,MTEXT")))) 
    (progn 
      (setq i 0)
      (repeat (sslength ss_user) 
        (setq en    (ssname ss_user i)
              ed    (entget en)
              etype (cdr (assoc 0 ed))
        )
        (if (member etype '("TEXT" "MTEXT")) 
          (setq txt_data (cons (list (cdr (assoc 10 ed)) (cdr (assoc 1 ed))) 
                               txt_data
                         )
          )
        )
        (if (member etype '("LWPOLYLINE" "LINE")) 
          (setq box_list (cons (vlax-ename->vla-object en) box_list))
        )
        (setq i (1+ i))
      )
      (setq i 0)
      (repeat (sslength ss_user) 
        (setq ed (entget (ssname ss_user i)))
        (if (and (= (cdr (assoc 0 ed)) "LWPOLYLINE") (= (cdr (assoc 70 ed)) 1)) 
          (progn 
            (setq vlist (mapcar 'cdr 
                                (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed)
                        )
            )
            (setq x_pts (mapcar 'car vlist)
                  y_pts (mapcar 'cadr vlist)
            )
            (setq p_min (list (apply 'min x_pts) (apply 'min y_pts))
                  p_max (list (apply 'max x_pts) (apply 'max y_pts))
                  area  (abs 
                          (* (- (car p_max) (car p_min)) 
                             (- (cadr p_max) (cadr p_min))
                          )
                        )
            )
            (if (and (> area 10000000.0) (< area 60000000.0)) 
              (process_single_box p_max p_min)
            )
          )
        )
        (setq i (1+ i))
      )
      (upload_to_backend final_list)
    )
  )
  (princ)
)


(princ "\n加载成功：EXK(全图直传), BEXK(框选直传)")
(princ)
