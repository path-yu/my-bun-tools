(vl-load-com)

;; ==========================================================
;; 1. 核心清洗函数：放宽白名单，支持 ~ 符号
;; ==========================================================
(defun clean_final_logic (str / s len i char code result pos1 pos2) 
  (setq s str)
  ;; 处理 MTEXT 格式控制字符
  (while (setq pos1 (vl-string-search "{" s)) (setq s (vl-string-subst "" "{" s)))
  (while (setq pos1 (vl-string-search "}" s)) (setq s (vl-string-subst "" "}" s)))
  (while (setq pos1 (vl-string-search "\\" s)) 
    (if (setq pos2 (vl-string-search ";" s pos1)) 
      (setq s (strcat (substr s 1 pos1) (substr s (+ pos2 2))))
      (setq s (vl-string-subst "" "\\" s))
    )
  )
  (setq result "" i 1 len (strlen s))
  (while (<= i len) 
    (setq char (substr s i 1) code (ascii char))
    ;; 白名单：数字(48-57), 字母, /, -, ., 以及 ~ (126)
    (if (or (and (>= code 48) (<= code 57)) 
            (and (>= code 65) (<= code 90))
            (and (>= code 97) (<= code 122)) 
            (= code 47) (= code 45) (= code 46) 
            (= code 126)) ;; 允许 ~ 符号
      (setq result (strcat result char))
    )
    (setq i (1+ i))
  )
  result
)

;; ==========================================================
;; 2. 核心提取逻辑：处理单个图框
;; ==========================================================
(defun process_single_box (pmin pmax / ax ay ray y_hits int_pt cur_y top_left s_min s_max cur_m cur_d cur_p tx ty tstr tmp key)
  (setq ax (car pmax) ay (cadr pmin))
  
  ;; A. 右下角横线探测
  (setq ray (vla-addline (vla-get-modelspace (vla-get-activedocument (vlax-get-acad-object))) 
                         (vlax-3d-point (list ax ay 0))
                         (vlax-3d-point (list ax (+ ay 800) 0))))
  (setq y_hits '())
  (foreach obj box_list 
    (setq int_pt (vl-catch-all-apply 'vlax-invoke (list ray 'IntersectWith obj acextendnone)))
    (if (and int_pt (not (vl-catch-all-error-p int_pt)))
      (while (>= (length int_pt) 3) 
        (setq cur_y (cadr int_pt))
        (if (not (member cur_y y_hits)) (setq y_hits (cons cur_y y_hits)))
        (setq int_pt (cdddr int_pt))
      )
    )
  )
  (vla-delete ray)
  (setq y_hits (vl-sort y_hits '<))

  (if (>= (length y_hits) 2)
    (progn
      ;; B. 定义左上角 800x200 产品编码区
      (setq top_left (list (car pmin) (cadr pmax)))
      (setq s_min (list (car top_left) (- (cadr top_left) 200)))
      (setq s_max (list (+ (car top_left) 800) (cadr top_left)))
      
      (setq cur_m "" cur_d "" cur_p "")
      (foreach item txt_data 
        (setq tx (car (car item)) ty (cadr (car item)) tstr (cadr item))
        
        ;; 1. 匹配左上角：产品编码
        (if (and (>= tx (car s_min)) (<= tx (car s_max))
                 (>= ty (cadr s_min)) (<= ty (cadr s_max)))
            (setq cur_p (clean_final_logic tstr))
        )

        ;; 2. 匹配右下角：物料和图号
        (if (and (> tx (- ax 400)) (< tx ax)) 
          (cond 
            ((and (>= (length y_hits) 4) (>= ty (nth 1 y_hits)) (<= ty (nth 2 y_hits)))
             (setq tmp (clean_final_logic tstr))
             (if (> (strlen tmp) 2) (setq cur_m tmp)))
            ((and (>= (length y_hits) 4) (>= ty (nth 2 y_hits)) (<= ty (nth 3 y_hits)))
             (setq tmp (clean_final_logic tstr))
             (if (> (strlen tmp) 2) (setq cur_d tmp)))
          )
        )
      )
      
      ;; C. 去重并存入最终列表
      (if (and (/= cur_m "") (/= cur_d "")) 
        (progn 
          (setq key (strcat cur_m "|" cur_d))
          (if (not (member key unique_list)) 
            (progn
              (setq final_list (cons (list cur_m cur_d (if (/= cur_p "") cur_p "None")) final_list))
              (setq unique_list (cons key unique_list))
            )
          )
        )
      )
    )
  )
)

;; ==========================================================
;; 3. 主命令 EKC：全图扫描 + 剪切板导出 (使用 - 拼接)
;; ==========================================================
(defun c:EKC (/ ss_txt ss_lines ss_inner i ed vlist p_min p_max area export_str row html) 
  (setvar "CMDECHO" 0) (setvar "OSMODE" 0)
  (setq final_list '() txt_data '() box_list '() unique_list '())
  
  (princ "\n正在采集全图文字...")
  (if (setq ss_txt (ssget "X" '((0 . "TEXT,MTEXT")))) 
    (progn (setq i 0) (repeat (sslength ss_txt) 
      (setq ed (entget (ssname ss_txt i)))
      (setq txt_data (cons (list (cdr (assoc 10 ed)) (cdr (assoc 1 ed))) txt_data))
      (setq i (1+ i)))))
  
  (princ "\n正在识别图框结构...")
  (if (setq ss_lines (ssget "X" '((0 . "LWPOLYLINE,LINE")))) 
    (progn (setq i 0) (repeat (sslength ss_lines) 
      (setq box_list (cons (vlax-ename->vla-object (ssname ss_lines i)) box_list))
      (setq i (1+ i)))))

  (if (setq ss_inner (ssget "X" '((0 . "LWPOLYLINE") (70 . 1)))) 
    (progn (setq i 0) (repeat (sslength ss_inner) 
      (setq ed (entget (ssname ss_inner i)))
      (setq vlist (mapcar 'cdr (vl-remove-if-not '(lambda (x) (= 10 (car x))) ed)))
      (setq p_min (list (apply 'min (mapcar 'car vlist)) (apply 'min (mapcar 'cadr vlist)))
            p_max (list (apply 'max (mapcar 'car vlist)) (apply 'max (mapcar 'cadr vlist)))
            area  (abs (* (- (car p_max) (car p_min)) (- (cadr p_max) (cadr p_min)))))
      
      ;; 面积过滤
      (if (and (> area 10000000.0) (< area 60000000.0)) 
          (process_single_box p_min p_max))
      (setq i (1+ i)))))
  
  ;; --- 核心修改：使用 "-" 拼接字符串并复制 ---
  (if (> (length final_list) 0)
    (progn
      (setq export_str "")
      (foreach row (reverse final_list)
        ;; row 结构: (物料编码 图号 产品编码)
        ;; 拼接结果: 物料编码-图号-产品编码
        (setq export_str (strcat export_str 
                                 (nth 0 row) "-" 
                                 (nth 1 row) "-" 
                                 (nth 2 row) "\r\n"))
      )
      
      ;; 写入剪切板
      (vl-catch-all-apply
        '(lambda ()
          (setq html (vlax-create-object "htmlfile"))
          (vlax-invoke (vlax-get (vlax-get html 'ParentWindow) 'ClipBoardData) 
                       'SetData "Text" export_str)
        )
      )
      (princ (strcat "\n[成功] 已提取 " (itoa (length final_list)) " 条记录，按 '物料-图号-产品' 格式复制。"))
    )
    (princ "\n[提示] 未发现符合条件的图框数据。")
  )
  (princ)
)

(princ "\n加载成功：EKC (支持~格式产品编码提取)")
(princ)