import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useAppTheme } from "@/components/ThemeContext";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function SelectDropdown({ value, onChange, options, placeholder }: SelectDropdownProps) {
  const { isDark } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || placeholder || "请选择";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleButtonClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isDark
          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
          }`}
      >
        <span>{displayValue}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className={`absolute right-0 top-full z-10 mt-1 overflow-hidden rounded-lg shadow-lg border min-w-[180px] ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
          }`}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={(e) => handleOptionClick(option.value, e)}
              className={`w-full px-4 py-2 text-left text-sm transition-colors whitespace-nowrap ${value === option.value
                ? isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
                : isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-50"
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}