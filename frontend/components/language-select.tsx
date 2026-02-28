import { Language } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LanguageSelectProps = {
  value: Language;
  onValueChange: (value: Language) => void;
};

const options: Array<{ value: Language; label: string }> = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

export function LanguageSelect({ value, onValueChange }: LanguageSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as Language)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Language" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}