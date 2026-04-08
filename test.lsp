(vl-load-com)

;; ==========================================================
;; 1. 核心清洗函数
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
          (= code 126)
      )
      (setq result (strcat result char))
    )
    (setq i (1+ i))
  )
  result
)

(defun auto_plot_to_pdf (p1 p2 filename /) 
  ;; 1. 先告诉 Bun 准备接管窗口
  (send_to_bun filename)

  ;; 2. 执行打印命令 (会触发弹窗)
  (command "-PLOT" "Y" "Model" "Microsoft Print to PDF" "A3" "M" "L" "N" "W" p1 p2 
           "F" "C" "Y" "monochrome.ctb" "Y" "A" "N" ;; 是否打印到文件选 N，这样才会触发系统弹窗
           "N" "Y"
  )
)

;; ==========================================================
;; 3. 主命令 EKC
;; ==========================================================
(defun c:EKC (/ ss_txt ss_all i j ed vlist p_min p_max area candidates is_outer box_a 
              box_b res_list plot_name
             ) 
  (setvar "CMDECHO" 0)
  (setvar "OSMODE" 0)
  (setvar "BACKGROUNDPLOT" 0) ;; 关闭后台打印确保同步执行
  (setq txt_data   '()
        candidates '()
  )

  ;; A. 采集文字
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

  ;; B. 筛选候选框
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
        (if (and (> area 10000000.0) (< area 80000000.0)) 
          (setq candidates (cons (list p_min p_max area) candidates))
        )
        (setq i (1+ i))
      )

      ;; C. 嵌套过滤并执行打印
      (foreach box_a candidates 
        (setq is_outer T)
        (foreach box_b candidates 
          (if 
            (and (not (equal box_a box_b)) 
                 (< (car (car box_b)) (car (car box_a)))
                 (< (cadr (car box_b)) (cadr (car box_a)))
                 (> (car (cadr box_b)) (car (cadr box_a)))
                 (> (cadr (cadr box_b)) (cadr (cadr box_a)))
            )
            (setq is_outer nil)
          )
        )

        (if is_outer 
          (progn 
            (setq p_min (nth 0 box_a)
                  p_max (nth 1 box_a)
            )
            ;; 识别该框内的数据（图号等）
            (setq res_list (get_box_data p_min p_max))
            ;; 命名规则：图号_物料编码 (如果没有则用时间戳)
            (if (and (/= (nth 1 res_list) "") (/= (nth 1 res_list) "None")) 
              (setq plot_name (strcat (nth 1 res_list) "_" (nth 0 res_list)))
              (setq plot_name (rtos (* (getvar "CDATE") 1e8) 2 0))
            )
            ;; --- 执行打印 ---
            (princ (strcat "\n正在导出 PDF: " plot_name))
            (auto_plot_to_pdf p_min p_max plot_name)
          )
        )
      )
    )
  )
  (princ "\n[完成] 所有最外框已批量导出至 D:\\CAD_Export\\")
  (princ)
)

;; ==========================================================
;; 4. 数据提取子程序 (仅返回列表，不存全局)
;; ==========================================================
(defun get_box_data (pmin pmax / ax ay s_min s_max cur_m cur_d cur_p tx ty tstr tmp) 
  (setq ax    (car pmax)
        ay    (cadr pmin)
        cur_m ""
        cur_d ""
        cur_p ""
  )
  (setq s_min (list (car pmin) (- (cadr pmax) 350))
        s_max (list (+ (car pmin) 1100) (cadr pmax))
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
      (setq cur_p (clean_final_logic tstr))
    )
    (if (and (> tx (- ax 550)) (< tx ax)) 
      (cond 
        ((and (>= ty (+ ay 40)) (<= ty (+ ay 180)))
         (setq cur_m (clean_final_logic tstr))
        )
        ((and (>= ty (+ ay 180)) (<= ty (+ ay 350)))
         (setq cur_d (clean_final_logic tstr))
        )
      )
    )
  )
  (list (if (/= cur_m "") cur_m "None") 
        (if (/= cur_d "") cur_d "None")
        (if (/= cur_p "") cur_p "None")
  )
)