import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { useAppTheme } from "@/components/ThemeContext";

interface IOSInputProps {
  type?: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  clearable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function IOSInput({
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  clearable = true,
  className = "",
  style,
}: IOSInputProps) {
  const { isDark } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChange("");
  };

  return (
    <div
      className={`relative flex items-center rounded-xl border ios-transition duration-200 ${isDark
        ? "bg-slate-800 border-slate-700"
        : "bg-white border-slate-200"
        } ${isFocused ? "ring-2 ring-blue-500/30 border-blue-500" : ""} ${className}`}
      style={style}
    >
      <div className="absolute left-2">
        {icon || <Search className="h-4 w-4 text-slate-400" />}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-2 py-2 text-sm outline-none ${isDark
          ? "bg-transparent text-slate-200 placeholder:text-slate-500"
          : "bg-transparent text-slate-700 placeholder:text-slate-400"
          }`}
      />
      {clearable && value && (
        <button
          onClick={handleClear}
          className={`absolute right-2 p-1 rounded-full ios-transition ${isDark
            ? "bg-slate-600 text-slate-300 hover:bg-slate-500"
            : "bg-slate-200 text-slate-500 hover:bg-slate-300"
          }`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
