import { useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor, Slide, SlideProps } from '@mui/material';

// 增加一个平滑的滑动动画（iOS 风格）
function TransitionDown(props: SlideProps) {
  return <Slide {...props} direction="down" />;
}

export const useToast = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');

  const showToast = useCallback((msg: string, sev: AlertColor = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const handleClose = (_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const ToastComponent = () => (
    <Snackbar 
      open={open} 
      autoHideDuration={2000} 
      onClose={handleClose}
      // 【关键：居中显示】
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      TransitionComponent={TransitionDown}
      // 解决可能被 Dialog 遮挡的问题
      sx={{ zIndex: 9999 }} 
    >
      <Alert 
        onClose={handleClose}
        severity={severity} // 确保传入 'error', 'success', 'warning', 'info'
        variant="filled" 
        elevation={6}
        sx={{ 
          width: '100%', 
          minWidth: '300px',
          borderRadius: '12px',
          fontWeight: 500,
          // 针对 error 类型的特殊处理，确保在暗黑模式下显眼
          ...(severity === 'error' && {
            bgcolor: '#ef4444', // 强制使用红色，防止被变量覆盖
            color: '#fff'
          }),
          // 针对 success 类型
          ...(severity === 'success' && {
            bgcolor: '#10b981',
            color: '#fff'
          })
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );

  return { showToast, ToastComponent };
};