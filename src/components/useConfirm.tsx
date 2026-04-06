import { useState, useCallback, memo } from 'react';
import { 
  Button, Dialog, DialogActions, DialogContent, 
  DialogContentText, DialogTitle, FormControlLabel, Checkbox 
} from '@mui/material';

// 将 Dialog 部分抽离成独立组件，避免 Checkbox 勾选时导致 Hook 调用者（父组件）闪烁
const InternalDialog = memo(({ 
  open, 
  config, 
  onConfirm, 
  onCancel 
}: { 
  open: boolean, 
  config: any, 
  onConfirm: (dontShow: boolean) => void, 
  onCancel: () => void 
}) => {
  const [checked, setChecked] = useState(false);

  // 当对话框关闭/开启时，可以在这里处理状态重置
  // 但为了防止闪烁，不要在渲染期间重置父组件状态

  return (
    <Dialog 
      open={open} 
      onClose={onCancel}
      // 关键：禁用过渡动画或优化 Paper 表现可以减少视觉抖动
      disableRestoreFocus 
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: 'var(--card)',
          backgroundImage: 'none',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          minWidth: 320
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 'bold', pb: 1 }}>{config.title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'var(--muted-foreground)', mb: 2 }}>
          {config.content}
        </DialogContentText>
        
        {config.showCheckbox && (
          <FormControlLabel
            control={
              <Checkbox 
                size="small" 
                checked={checked} 
                onChange={(e) => setChecked(e.target.checked)}
                sx={{ 
                  color: 'var(--muted-foreground)', 
                  '&.Mui-checked': { color: 'primary.main' } 
                }}
              />
            }
            label="不再显示此提示"
            slotProps={{ typography: { variant: 'caption', sx: { color: 'var(--muted-foreground)' } } }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} sx={{ color: 'var(--muted-foreground)' }}>取消</Button>
        <Button 
          onClick={() => onConfirm(checked)} 
          variant="contained" 
          color="error" 
          autoFocus 
          sx={{ borderRadius: 2 }}
        >
          确认
        </Button>
      </DialogActions>
    </Dialog>
  );
});

export const useConfirm = () => {
  const [promise, setPromise] = useState<{ resolve: (value: any) => void } | null>(null);
  const [config, setConfig] = useState({ title: '', content: '', showCheckbox: false });

  const confirm = useCallback((title: string, content: string, showCheckbox = false) => {
    setConfig({ title, content, showCheckbox });
    return new Promise<{ confirmed: boolean, dontShowAgain: boolean }>((resolve) => {
      setPromise({ resolve });
    });
  }, []);

  const handleConfirm = useCallback((dontShowAgain: boolean) => {
    promise?.resolve({ confirmed: true, dontShowAgain });
    setPromise(null);
  }, [promise]);

  const handleCancel = useCallback(() => {
    promise?.resolve({ confirmed: false, dontShowAgain: false });
    setPromise(null);
  }, [promise]);

  // 返回组件时，确保它是一个稳固的子组件
  const ConfirmDialog = useCallback(() => (
    <InternalDialog 
      open={promise !== null}
      config={config}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ), [promise, config, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
};