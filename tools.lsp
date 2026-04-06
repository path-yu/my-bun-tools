(defun c:JJ (/ e1 e2 e3 t1 t2 t3 result)
  (vl-load-com)

  ;; 纯LISP清理MText格式 (不使用RegExp，避免Automation错误)
  (defun clearMtext (str / res i char skip)
    (setq i 1 res "" skip nil)
    (while (<= i (strlen str))
      (setq char (substr str i 1))
      (cond
        ;; 跳过大括号
        ((member char '("{" "}")) 
         (setq i (1+ i)))
        ;; 处理反斜杠开头的格式控制符
        ((= char "\\")
         (setq i (1+ i))
         ;; 寻找分号作为结束符，跳过中间的所有控制内容
         (while (and (<= i (strlen str)) (/= (substr str i 1) ";"))
           (setq i (1+ i)))
         (setq i (1+ i)))
        ;; 普通字符保留
        (t 
         (setq res (strcat res char)
               i (1+ i)))
      )
    )
    ;; 最后的清理：去除首尾空格
    (vl-string-trim " " res)
  )

  ;; 提取数字开始的部分
  (defun removePrefix (str / i)
    (setq i 1)
    (while (and (<= i (strlen str))
                (not (wcmatch (substr str i 1) "[0-9]")))
      (setq i (1+ i))
    )
    (substr str i)
  )

  ;; 替换所有斜杠为横杠
  (defun replaceAllSlash (str)
    (vl-string-translate "/" "-" str)
  )

  ;; 主流程
  (setq e1 (car (entsel "\n请选择第一个文字 (物料编码): ")))
  (if (not e1) (exit))
  (setq e2 (car (entsel "\n请选择第二个文字 (规格型号): ")))
  (if (not e2) (exit))
  (setq e3 (car (entsel "\n请选择第三个文字 (其他编号): ")))
  (if (not e3) (exit))

  ;; 处理文字
  (setq t1 (removePrefix (clearMtext (cdr (assoc 1 (entget e1))))))
  (setq t2 (replaceAllSlash (clearMtext (cdr (assoc 1 (entget e2))))))
  (setq t3 (clearMtext (cdr (assoc 1 (entget e3)))))

  ;; 拼接
  (setq result (strcat t1 "-" t2 "-" t3))

  ;; 复制到剪贴板 (封装一下，防止htmlfile也报错)
  (vl-catch-all-apply
    '(lambda ()
       (setq html (vlax-create-object "htmlfile"))
       (setq clip (vlax-get html 'ParentWindow))
       (vlax-invoke (vlax-get clip 'ClipboardData) 'SetData "Text" result)
       (vlax-release-object html)
     )
  )

  (princ (strcat "\n>>> 拼接成功: " result))
  (princ)
)
(defun c:CLN (/ ss i ent ed type layer) 

  (vl-load-com)

  (prompt "\n正在清理标注与中心线...")

  (setq ss (ssget "X"))

  (if ss 
    (progn 
      (setq i 0)
      (while (< i (sslength ss)) 
        (setq ent (ssname ss i))
        (setq ed (entget ent))
        (setq type (cdr (assoc 0 ed)))
        (setq layer (strcase (cdr (assoc 8 ed))))

        (if 
          (or 
            ;; 标注类型
            (= type "DIMENSION")
            (= type "LEADER")
            (= type "MULTILEADER")
            (= type "CENTERLINE")
            (= type "CENTERMARK")

            ;; 中心线图层
            (= layer "CENTER")
            (= layer "CENTERLINE")
            (= layer "CENTER-LINE")
            (= layer "中心线")

            ;; 标注图层
            (= layer "DIM")
            (= layer "DIMS")
            (= layer "标注")
          )
          (entdel ent)
        )

        (setq i (1+ i))
      )

      (prompt "\n清理完成")
    )
  )

  (princ)
)
(defun c:CLNSEL (/ ss i ent ed type layer) 

  (vl-load-com)

  (prompt "\n框选需要清理的区域: ")
  (setq ss (ssget))

  (if ss 
    (progn 
      (setq i 0)
      (while (< i (sslength ss)) 
        (setq ent (ssname ss i))
        (setq ed (entget ent))
        (setq type (cdr (assoc 0 ed)))
        (setq layer (strcase (cdr (assoc 8 ed))))

        (if 
          (or 
            ;; 标注类型
            (= type "DIMENSION")
            (= type "LEADER")
            (= type "MULTILEADER")
            (= type "CENTERLINE")
            (= type "CENTERMARK")

            ;; 中心线图层
            (= layer "CENTER")
            (= layer "CENTERLINE")
            (= layer "CENTER-LINE")
            (= layer "中心线")

            ;; 标注图层
            (= layer "DIM")
            (= layer "DIMS")
            (= layer "标注")
          )
          (entdel ent)
        )

        (setq i (1+ i))
      )

      (prompt "\n选中区域清理完成")
    )
    (prompt "\n未选择对象")
  )

  (princ)
)
(defun addTol (tol / ent e data type oldTxt newTxt) 

  (while (setq ent (entsel "\n选择文字或标注（回车结束）: ")) 

    (setq e (car ent))
    (setq data (entget e))
    (setq type (cdr (assoc 0 data)))
    (setq oldTxt (cdr (assoc 1 data)))

    ;; 标注默认值处理
    (if (and (= type "DIMENSION") (= oldTxt "")) 
      (setq oldTxt "<>")
    )

    ;; 拼接公差
    (setq newTxt (strcat oldTxt "±" tol))

    ;; 处理 TEXT / MTEXT / DIMENSION
    (if (member type '("TEXT" "MTEXT" "DIMENSION")) 
      (progn 
        (entmod (subst (cons 1 newTxt) (assoc 1 data) data))
        (entupd e)
      )
      (princ "\n? 不是文字或标注")
    )
  )

  (princ "\n完成")
  (princ)
)

;; ===== 三个快捷命令 =====

(defun c:TOL1 () 
  (addTol "5")
)

(defun c:TOL2 () 
  (addTol "10")
)

(defun c:TOL3 () 
  (addTol "15")
)