import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

/**
 * Search input with icon. Submits on Enter when onSubmit is provided.
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search…',
  style,
}) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit?.();
    }}
    style={{ position: 'relative', minWidth: 0, flex: '1 1 220px', ...style }}
  >
    <Search
      size={15}
      style={{
        position: 'absolute',
        left: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'var(--admin-text-secondary)',
        pointerEvents: 'none',
      }}
    />
    <input
      className="adm-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      style={{ paddingLeft: '32px' }}
    />
  </form>
);
