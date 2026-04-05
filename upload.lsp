(defun c:MatchSmart (/ ss i en ent pt txt f_materialCode f_dwg f_materialCode_pt f_dwg_pt all_texts) 
  (vl-load-com)
  (setvar "cmdecho" 0)

  (princ "\n请框选包含物料编码和图号的区域...")

  (if (setq ss (ssget '((0 . "MTEXT,TEXT")))) 
    (progn 
      ;; 1. 提取所有文字的坐标和内容
      (setq i         0
            all_texts nil
      )
      (repeat (sslength ss) 
        (setq en (ssname ss i))
        (setq ent (entget en))
        ;; 存储列表格式：(坐标 内容)
        (setq all_texts (cons 
                          (list (cdr (assoc 10 ent)) 
                                (MegaClean (cdr (assoc 1 ent)))
                          )
                          all_texts
                        )
        )
        (setq i (1+ i))
      )

      ;; 2. 核心匹配逻辑
      (foreach item all_texts 
        (setq pt  (car item)
              txt (cadr item)
        )

        ;; A. 物料编码逻辑
        (if (vl-string-search "物料编码" txt) 
          (progn 
            ;; 尝试从当前字符串提取 (合在一起的情况)
            (setq f_materialCode (GetAlphaNum txt "物料编码"))
            (setq f_materialCode_pt pt) ;; 记录坐标

            ;; 如果当前字符串没内容，启动雷达向右搜索 (分开的情况)
            (if (or (not f_materialCode) (= f_materialCode "")) 
              (setq f_materialCode (ScanRightFormaterialCode pt all_texts))
            )
          )
        )

        ;; B. 图号逻辑 (识别特征：包含 / 或 -，且不含“物料编码”)
        (if 
          (and (or (vl-string-search "/" txt) (vl-string-search "-" txt)) 
               (not (vl-string-search "物料编码" txt))
          )
          (setq f_dwg    txt
                f_dwg_pt pt
          )
        )
      )

      ;; 3. 输出结果（带坐标显示）
      (princ "\n------------------------------------------------------------")
      (if f_materialCode 
        (princ 
          (strcat "\n物料编码: " 
                  f_materialCode
                  "\n坐标位置: X="
                  (rtos (car f_materialCode_pt) 2 2)
                  ", Y="
                  (rtos (cadr f_materialCode_pt) 2 2)
          )
        )
        (princ "\n物料编码: [未匹配]")
      )
      (princ "\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -")
      (if f_dwg 
        (princ 
          (strcat "\n图    号: " 
                  f_dwg
                  "\n坐标位置: X="
                  (rtos (car f_dwg_pt) 2 2)
                  ", Y="
                  (rtos (cadr f_dwg_pt) 2 2)
          )
        )
        (princ "\n图    号: [未匹配]")
      )
      (princ "\n------------------------------------------------------------\n")
    )
  )
  (princ)
)

;; 向右搜索 500 单位内的文字
(defun ScanRightFormaterialCode (base_pt text_list / best_dist best_txt pt dx dy) 
  (setq best_dist 500.0
        best_txt  nil
  )
  (foreach item text_list 
    (setq pt (car item))
    (setq dx (- (car pt) (car base_pt)))
    (setq dy (abs (- (cadr pt) (cadr base_pt))))
    (if (and (> dx 2.0) (< dx best_dist) (< dy 30.0)) 
      (setq best_dist dx
            best_txt  (cadr item)
      )
    )
  )
  (if best_txt (GetAlphaNum best_txt "") nil)
)

;; 提取字母和数字
(defun GetAlphaNum (str key / i c a res pos) 
  (setq pos (vl-string-search key str))
  (if pos (setq str (vl-string-subst "" key str)))
  (setq i   1
        res ""
  )
  (repeat (strlen str) 
    (setq c (substr str i 1)
          a (ascii c)
    )
    (if 
      (or (and (>= a 48) (<= a 57)) 
          (and (>= a 65) (<= a 90))
          (and (>= a 97) (<= a 122))
          (= a 45)
      )
      (setq res (strcat res c))
    )
    (setq i (1+ i))
  )
  (if (vl-string-search "075" res) (setq res (vl-string-subst "" "075" res)))
  res
)

;; 去除 MText 格式码
(defun MegaClean (str / p e) 
  (while (setq p (vl-string-search "\\" str)) 
    (if (setq e (vl-string-search ";" str p)) 
      (setq str (strcat (substr str 1 p) (substr str (+ e 2))))
      (setq str (vl-string-subst "" "\\" str))
    )
  )
  (while (setq p (vl-string-search "{" str)) 
    (setq str (vl-string-subst "" "{" str))
  )
  (while (setq p (vl-string-search "}" str)) 
    (setq str (vl-string-subst "" "}" str))
  )
  (vl-string-trim " :：	" str)
)

(princ "\n加载成功。输入命令: MatchSmart 执行。")
(princ)


(defun c:MatchSmartBatch (/ ss) 
  (vl-load-com)
  (setvar "cmdecho" 0)

  (princ "\n批量模式：连续框选区域，ESC 结束...")

  (while (setq ss (ssget '((0 . "MTEXT,TEXT")))) 
    (MatchSmartCore ss)
  )

  (princ "\n批量读取完成.")
  (princ)
)

(defun MatchSmartCore (ss / i en ent pt txt f_materialCode f_dwg f_materialCode_pt f_dwg_pt all_texts 
                        dwg_name dwg_path full_path) 
  (vl-load-com)

  ;; --- 1. 获取当前文档信息 ---
  (setq dwg_name (getvar "DWGNAME"))
  (setq dwg_path (getvar "DWGPREFIX"))
  ;; 确保路径中的反斜杠在拼接前是正常的，或者后续统一处理
  (setq full_path (strcat dwg_path dwg_name))

  ;; --- 2. 提取所选区域的所有文字 ---
  (setq i 0
        all_texts nil
  )
  (repeat (sslength ss) 
    (setq en (ssname ss i))
    (setq ent (entget en))
    (setq all_texts (cons 
                      (list (cdr (assoc 10 ent)) 
                            (MegaClean (cdr (assoc 1 ent)))
                      )
                      all_texts
                    )
    )
    (setq i (1+ i))
  )

  ;; --- 3. 核心匹配逻辑 (必须写在这里) ---
  (foreach item all_texts 
    (setq pt  (car item)
          txt (cadr item)
    )

    ;; A. 匹配物料编码
    (if (vl-string-search "物料编码" txt) 
      (progn 
        (setq f_materialCode (GetAlphaNum txt "物料编码"))
        (setq f_materialCode_pt pt)
        ;; 如果当前文本没提取到数字，向右搜索
        (if (or (not f_materialCode) (= f_materialCode "")) 
          (setq f_materialCode (ScanRightFormaterialCode pt all_texts))
        )
      )
    )

    ;; B. 匹配图号 (识别特征：包含 / 或 -，且不含“物料编码”)
    (if 
      (and (or (vl-string-search "/" txt) (vl-string-search "-" txt)) 
           (not (vl-string-search "物料编码" txt))
      )
      (setq f_dwg    txt
            f_dwg_pt pt
      )
    )
  )

  ;; --- 4. 判断并上传 ---
  (princ "\n------------------")
  (if (and f_materialCode f_dwg (not (= f_materialCode "")) (not (= f_dwg ""))) 
    (progn 
      (princ (strcat "\n物料编码: " f_materialCode))
      (princ (strcat "\n图    号: " f_dwg))
      (princ (strcat "\n文件路径: " full_path))
      (princ "\n[系统] 正在上传数据...")
      ;; 调用发送函数
      (SendToServer f_materialCode f_dwg dwg_name full_path (car f_materialCode_pt) (cadr f_materialCode_pt))
    )
    (progn
      (princ "\n[错误] 匹配不完整。")
      (if (not f_materialCode) (princ " 未找到物料编码。"))
      (if (not f_dwg) (princ " 未找到图号。"))
    )
  )
  (princ "\n------------------")
  (princ)
)

;; --- 新增：发送 HTTP POST 请求函数 ---
(defun SendToServer (materialCode dwg fileName path x y / xml http url json_data safe_path) 
  (setq url "http://localhost:3003/upload") 

  ;; 1. 处理路径：将单反斜杠替换为双反斜杠，防止 JSON 解析失败
  ;; 如果你的 CAD 支持 vl-string-translate
  (setq safe_path (vl-string-translate "\\" "/" path)) 

  ;; 2. 构造 JSON 字符串 (严格检查引号转义)
  (setq json_data (strcat "{" 
                          "\"materialCode\":\""  materialCode "\","
                          "\"drawingNumber\":\"" dwg "\","
                          "\"fileName\":\""      fileName "\","
                          "\"filePath\":\""      safe_path "\","
                          "\"x\":"               (rtos x 2 2) ","
                          "\"y\":"               (rtos y 2 2) 
                          "}"
                  )
  )

  ;; 3. 发送请求
  (setq http (vlax-create-object "MSXML2.XMLHTTP"))
  (vlax-invoke-method http 'open "POST" url :vlax-false)
  (vlax-invoke-method http 'setRequestHeader "Content-Type" "application/json")
  (vlax-invoke-method http 'send json_data)
  
  ;; 打印服务器响应(可选)
  (princ (strcat "\n[服务器响应]: " (vlax-get-property http 'responseText)))
  
  (vlax-release-object http)
  (princ)
)