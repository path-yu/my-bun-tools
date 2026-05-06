import { SyncReasonType } from "@/lib/types";
import { useAppTheme } from "@/components/ThemeContext";
import { useState } from "react";
import { X } from "lucide-react";
import { Fade,Modal,Collapse,Box,Typography,TextField, } from "@mui/material";
import { IOSButton } from "@/components/IOSButton";
export interface SyncReasonModalProps {
  isOpen: boolean;
  fileName: string;
  onClose: () => void;
  onConfirm: (reasonType: SyncReasonType, reason: string) => void;
}

export function SyncReasonModal({ isOpen, fileName, onClose, onConfirm }: SyncReasonModalProps) {
  const { isDark } = useAppTheme();
  const [selectedReasonType, setSelectedReasonType] = useState<SyncReasonType>("modify");
  const [customReason, setCustomReason] = useState("");

  const reasonOptions = [
    { value: "modify" as SyncReasonType, label: "图纸修改" },
    { value: "new" as SyncReasonType, label: "上传新图纸" },
    { value: "delete" as SyncReasonType, label: "删除图纸" },
    { value: "custom" as SyncReasonType, label: "自定义原因" },
  ];

  const handleConfirm = () => {
    const reason = selectedReasonType === "custom" ? customReason : reasonOptions.find(o => o.value === selectedReasonType)?.label || "";
    onConfirm(selectedReasonType, reason);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      closeAfterTransition
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Fade timeout={250} in={isOpen}>
        <Box sx={{
          bgcolor: isDark ? '#1e293b' : '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 440,
          outline: 'none',
          // --- 添加下面这一行 ---
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          p: 0,
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              同步原因
            </Typography>
            <IOSButton size="sm" variant="secondary" onClick={onClose} className="!p-1">
              <X className="h-5 w-5" />
            </IOSButton>
          </Box>
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ mb: 2, color: isDark ? '#94a3b8' : '#64748b' }}>
              正在同步文件: <Box component="span" sx={{ fontWeight: 500, color: isDark ? '#e2e8f0' : '#1e293b' }}>{fileName}</Box>
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                请选择同步原因:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {reasonOptions.map((option) => (
                  <Box
                    key={option.value}
                    onClick={() => setSelectedReasonType(option.value)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      border: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderColor: selectedReasonType === option.value
                        ? '#3b82f6'
                        : isDark ? '#334155' : '#e2e8f0',
                      bgcolor: selectedReasonType === option.value
                        ? '#3b82f6'
                        : 'transparent',
                      color: selectedReasonType === option.value
                        ? 'white'
                        : isDark ? '#e2e8f0' : '#1e293b',
                      '&:hover': {
                        bgcolor: selectedReasonType === option.value
                          ? '#2563eb'
                          : isDark ? '#334155' : '#f1f5f9',
                      },
                    }}
                  >
                    <Box
                      component="input"
                      type="radio"
                      checked={selectedReasonType === option.value}
                      onChange={() => setSelectedReasonType(option.value)}
                      sx={{
                        width: 16,
                        height: 16,
                        accentColor: selectedReasonType === option.value ? '#3b82f6' : 'white',
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Collapse in={selectedReasonType === "custom"}>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="请输入同步原因..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                sx={{
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isDark ? '#0f172a' : '#f8fafc',
                    '& fieldset': {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: isDark ? '#e2e8f0' : '#1e293b',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: isDark ? '#64748b' : '#94a3b8',
                  },
                }}
              />
            </Collapse>
          </Box>
          <Box sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            p: 2,
            borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          }}>
            <IOSButton variant="outline" onClick={onClose}>
              取消
            </IOSButton>
            <IOSButton variant="primary" onClick={handleConfirm} disabled={selectedReasonType === "custom" && !customReason.trim()}>
              确认同步
            </IOSButton>
          </Box>
        </Box>
      </Fade>

    </Modal>
  );
}